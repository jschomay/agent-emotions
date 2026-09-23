import { readFileSync } from 'node:fs';

/** Hooks receive their input as JSON on stdin. Reading fd 0 synchronously is fine here —
 * these scripts do no other I/O before this and must exit before the hook timeout. */
export function readHookInput() {
  const raw = readFileSync(0, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

export function writeHookOutput(hookEventName, fields) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName, ...fields } }));
}
