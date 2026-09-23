import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { readHookInput, writeHookOutput } from '../engine/hookIO.js';
import {
  projectStateDir,
  ensureInitialized,
  readState,
  writeState,
  withNewValues,
  readDisposition,
  writeDisposition,
  readLogTail,
  appendTurn,
} from '../engine/state.js';
import { computeEmotions, TOP } from '../engine/graph.js';
import { applyDispositionNudges } from '../engine/disposition.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

const AXES_SCHEMA = {
  type: 'object',
  properties: {
    axes: {
      type: 'object',
      properties: {
        frust_enl: { type: 'number' },
        humil_pride: { type: 'number' },
        anx_conf: { type: 'number' },
        disap_enc: { type: 'number' },
        dread_hope: { type: 'number' },
        bore_cur: { type: 'number' },
      },
      required: ['frust_enl', 'humil_pride', 'anx_conf', 'disap_enc', 'dread_hope', 'bore_cur'],
    },
  },
  required: ['axes'],
};

/** With --thinking disabled, --json-schema is cheap and reliable again (measured: ~5s, ~$0.004,
 * no markdown fencing) — structured_output holds the schema-validated object directly. Kept a
 * couple of defensive fallbacks in case the envelope shape ever drifts. */
function extractAxes(stdout) {
  let outer;
  try {
    outer = JSON.parse(stdout);
  } catch {
    return null;
  }

  const candidates = [outer.structured_output, tryParse(outer.result), outer];
  for (const c of candidates) {
    if (c?.axes && TOP.every((t) => typeof c.axes[t.id] === 'number')) return c.axes;
  }
  return null;
}

function tryParse(s) {
  if (typeof s !== 'string') return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function renderFramework(template, values) {
  let out = template;
  for (const [k, v] of Object.entries(values)) {
    out = out.replaceAll(`{${k}}`, v.toFixed(2));
  }
  return out;
}

function main() {
  const input = readHookInput();
  const userMessage = input.user_input ?? '';

  const dir = projectStateDir();
  ensureInitialized(dir);

  const state = readState(dir);
  const disposition = readDisposition(dir);
  const logTail = readLogTail(dir, 8);

  const interpretPrompt = readFileSync(join(__dirname, '..', 'prompts', 'interpret.md'), 'utf8');
  const turnPrompt = [
    `CURRENT STATE: ${JSON.stringify(state.values)}`,
    `RECENT LOG:\n${logTail.length ? logTail.join('\n') : '(none yet)'}`,
    `THE MESSAGE: ${userMessage}`,
  ].join('\n');

  // --system-prompt (full replace) + --strict-mcp-config --tools none keeps this a plain
  // classification request instead of a full agentic session. --effort low --thinking disabled
  // was the fix that mattered: without it, --json-schema forced a thinking+tool_use round trip
  // (17-34s observed); with it, --json-schema is back to ~5s / ~$0.004 and gives clean
  // structured output with no markdown-fence parsing needed (measured during build).
  const result = spawnSync(
    'claude',
    [
      '-p',
      '--model',
      'haiku',
      '--output-format',
      'json',
      '--strict-mcp-config',
      '--tools',
      'none',
      '--effort',
      'low',
      '--thinking',
      'disabled',
      '--system-prompt',
      interpretPrompt,
      '--json-schema',
      JSON.stringify(AXES_SCHEMA),
      turnPrompt,
    ],
    { encoding: 'utf8', timeout: 15000 }
  );

  if (result.error || result.status !== 0 || !result.stdout) {
    process.stderr.write(`agent-emotions: interpretation call failed: ${result.error ?? result.stderr}\n`);
    process.exit(0); // never block the user's message on our own failure
  }

  const axes = extractAxes(result.stdout);
  if (!axes) {
    process.stderr.write(`agent-emotions: could not extract axes from output: ${result.stdout}\n`);
    process.exit(0);
  }

  const clampedAxes = Object.fromEntries(TOP.map((t) => [t.id, clamp(axes[t.id] ?? 0, -1, 1)]));
  const newValues = computeEmotions(clampedAxes, disposition);

  const newState = withNewValues(state, newValues);
  writeState(dir, newState);
  appendTurn(dir, { message: userMessage, axes: clampedAxes, values: newValues });

  const { disposition: nudgedDisposition, nudged } = applyDispositionNudges(disposition, newState.history);
  if (nudged.length) {
    writeDisposition(dir, nudgedDisposition);
  }

  const frameworkTemplate = readFileSync(join(__dirname, '..', 'prompts', 'framework.md'), 'utf8');
  const framework = renderFramework(frameworkTemplate, newValues);

  writeHookOutput('UserPromptSubmit', { additionalContext: framework });
}

main();
