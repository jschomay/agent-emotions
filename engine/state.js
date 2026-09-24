import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { BOTTOM } from './graph.js';

const LOG_MAX_LINES = 40;
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
function logPath(dir) {
  return join(dir, 'emotion-log.md');
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
  if (!existsSync(logPath(dir))) {
    writeFileSync(logPath(dir), '');
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

/** Dashboard/debug data only — not read by the live pipeline. One record per interpreted
 * turn: the (truncated) message, the axes Haiku produced, and the resulting emotion values. */
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

/** Links a log entry to the turn it describes: log_emotion runs at the end of the same
 * turn whose record the hook appended at its start, so that's always the latest record. */
export function attachLogToLatestTurn(dir, entry) {
  const lines = readFileSync(turnsPath(dir), 'utf8').split('\n').filter(Boolean);
  if (!lines.length) return;
  const last = JSON.parse(lines[lines.length - 1]);
  last.log = entry.trim().replace(/\n+/g, ' ');
  lines[lines.length - 1] = JSON.stringify(last);
  writeFileSync(turnsPath(dir), lines.join('\n') + '\n');
}

export function readTurns(dir, n = TURNS_MAX) {
  const text = readFileSync(turnsPath(dir), 'utf8');
  return text
    .split('\n')
    .filter(Boolean)
    .slice(-n)
    .map((line) => JSON.parse(line));
}
