import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BOTTOM } from './graph.js';

const LOG_MAX_LINES = 40;
const HISTORY_MAX = 10;

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
function logPath(dir) {
  return join(dir, 'emotion-log.md');
}

/** Creates default files if this is a fresh project partition. Idempotent. */
export function ensureInitialized(dir) {
  if (!existsSync(statePath(dir))) {
    writeFileSync(statePath(dir), JSON.stringify({ values: neutralValues(), history: [] }, null, 2));
  }
  if (!existsSync(dispositionPath(dir))) {
    writeFileSync(dispositionPath(dir), JSON.stringify(neutralDisposition(), null, 2));
  }
  if (!existsSync(logPath(dir))) {
    writeFileSync(logPath(dir), '');
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

export function readLogTail(dir, n = 8) {
  const text = readFileSync(logPath(dir), 'utf8');
  const lines = text.split('\n').filter(Boolean);
  return lines.slice(-n);
}

export function appendLog(dir, entry) {
  const text = readFileSync(logPath(dir), 'utf8');
  const lines = text.split('\n').filter(Boolean);
  lines.push(entry.trim().replace(/\n+/g, ' '));
  const rotated = lines.slice(-LOG_MAX_LINES);
  writeFileSync(logPath(dir), rotated.join('\n') + '\n');
}
