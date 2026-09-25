import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { readHookInput, writeHookOutput } from '../engine/hookIO.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The agent does the interpretation itself via the update_emotional_state tool; this hook
// just makes sure it happens every turn.
readHookInput();
const reminder = readFileSync(join(__dirname, '..', 'prompts', 'turn-reminder.md'), 'utf8').trim();
writeHookOutput('UserPromptSubmit', { additionalContext: reminder });
