import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { BOTTOM } from './graph.js';

const HISTORY_MAX = 10;
const TURNS_MAX = 200;
const TURN_MESSAGE_TRUNCATE = 200;

function neutralValues() {
  return Object.fromEntries(BOTTOM.map((b) => [b.id, 0.5]));
}

function neutralDisposition() {
  return Object.fromEntries(BOTTOM.map((b) => [b.id, 0]));
}

/** Resolves (and creates if needed) this project's state partition under $CLAUDE_PLUGIN_DATA. */
export function projectStateDir() {
  const dataRoot = process.env.CLAUDE_PLUGIN_DATA;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!dataRoot) {
    throw new Error('CLAUDE_PLUGIN_DATA is not set — expected to run as a plugin hook/MCP subprocess');
  }
  const hash = createHash('sha256').update(projectDir).digest('hex').slice(0, 16);
  const dir = join(dataRoot, 'projects', hash);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function statePath(dir) {
  return join(dir, 'state.json');
}
function dispositionPath(dir) {
  return join(dir, 'disposition.json');
}
function turnsPath(dir) {
  return join(dir, 'turns.jsonl');
}

/** Creates default files if this is a fresh project partition. Idempotent. */
export function ensureInitialized(dir) {
  if (!existsSync(statePath(dir))) {
    writeFileSync(statePath(dir), JSON.stringify({ values: neutralValues(), history: [] }, null, 2));
  }
  if (!existsSync(dispositionPath(dir))) {
    writeFileSync(dispositionPath(dir), JSON.stringify(neutralDisposition(), null, 2));
  }
  if (!existsSync(turnsPath(dir))) {
    writeFileSync(turnsPath(dir), '');
  }
}

export function readState(dir) {
  return JSON.parse(readFileSync(statePath(dir), 'utf8'));
}

export function writeState(dir, state) {
  writeFileSync(statePath(dir), JSON.stringify(state, null, 2));
}

/** Returns a new state object with newValues appended to history (capped), ready for writeState(). */
export function withNewValues(state, newValues) {
  return { values: newValues, history: [...state.history, newValues].slice(-HISTORY_MAX) };
}

export function readDisposition(dir) {
  return JSON.parse(readFileSync(dispositionPath(dir), 'utf8'));
}

export function writeDisposition(dir, disposition) {
  writeFileSync(dispositionPath(dir), JSON.stringify(disposition, null, 2));
}

/** Dashboard/debug data only — not read by the live pipeline. One record per turn: the
 * agent's one-line summary of the user's message, its axes reading, and the resulting values. */
export function appendTurn(dir, { message, axes, values, disposition }) {
  const record = {
    ts: new Date().toISOString(),
    message: message.length > TURN_MESSAGE_TRUNCATE ? message.slice(0, TURN_MESSAGE_TRUNCATE) + '…' : message,
    axes,
    values,
    disposition,
  };
  appendFileSync(turnsPath(dir), JSON.stringify(record) + '\n');

  // Cheap rotation: only rewrite once the file has grown well past the cap.
  const lines = readFileSync(turnsPath(dir), 'utf8').split('\n').filter(Boolean);
  if (lines.length > TURNS_MAX * 1.5) {
    writeFileSync(turnsPath(dir), lines.slice(-TURNS_MAX).join('\n') + '\n');
  }
}

export function readTurns(dir, n = TURNS_MAX) {
  const text = readFileSync(turnsPath(dir), 'utf8');
  return text
    .split('\n')
    .filter(Boolean)
    .slice(-n)
    .map((line) => JSON.parse(line));
}
