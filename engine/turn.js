import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  projectStateDir,
  ensureInitialized,
  readState,
  writeState,
  withNewValues,
  readDisposition,
  writeDisposition,
  appendTurn,
} from './state.js';
import { computeEmotions, TOP } from './graph.js';
import { applyDispositionNudges } from './disposition.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function renderFramework(template, values) {
  let out = template;
  for (const [k, v] of Object.entries(values)) {
    out = out.replaceAll(`{${k}}`, v.toFixed(2));
  }
  return out;
}

/**
 * One turn of the pipeline, given the agent's own reading of the user's message:
 * axes -> emotions (with disposition) -> disposition nudges -> persisted turn record.
 * Returns the rendered framework text describing the new emotional state.
 */
export function processTurn({ userSummary, axes }) {
  const dir = projectStateDir();
  ensureInitialized(dir);

  const state = readState(dir);
  const disposition = readDisposition(dir);

  const clampedAxes = Object.fromEntries(TOP.map((t) => [t.id, clamp(axes[t.id] ?? 0, -1, 1)]));
  const newValues = computeEmotions(clampedAxes, disposition);

  const newState = withNewValues(state, newValues);
  writeState(dir, newState);

  const { disposition: nudgedDisposition, nudged } = applyDispositionNudges(disposition, newState.history);
  if (nudged.length) writeDisposition(dir, nudgedDisposition);

  // Disposition recorded here is the one *after* this turn's nudges, for the dashboard's
  // disposition-over-time chart; this turn's values were computed with the pre-nudge one.
  appendTurn(dir, { message: userSummary, axes: clampedAxes, values: newValues, disposition: nudgedDisposition });

  const template = readFileSync(join(__dirname, '..', 'prompts', 'framework.md'), 'utf8');
  return renderFramework(template, newValues);
}
