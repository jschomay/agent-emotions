import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { readHookInput, writeHookOutput } from '../engine/hookIO.js';
import { projectStateDir, ensureInitialized } from '../engine/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

readHookInput(); // { source: "startup"|"resume"|"clear"|"compact"|"fork", ... } — not branched on yet

const dir = projectStateDir();
ensureInitialized(dir);

const orientation = readFileSync(join(__dirname, '..', 'prompts', 'orientation.md'), 'utf8').trim();

writeHookOutput('SessionStart', { additionalContext: orientation });
