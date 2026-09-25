import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { processTurn } from '../engine/turn.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const description = readFileSync(join(__dirname, '..', 'prompts', 'update-emotional-state.md'), 'utf8').trim();

const axis = (neg, pos) =>
  z.number().min(-1).max(1).describe(`-1 = fully ${neg}, +1 = fully ${pos}, 0 = neither`);

const server = new McpServer({ name: 'agent-emotions', version: '0.2.0' });

// Key order matters: user_summary comes first so it's written before the ratings.
server.registerTool(
  'update_emotional_state',
  {
    description,
    inputSchema: {
      user_summary: z
        .string()
        .describe('One line: "The user said/wants [a few words]. They seem to be feeling [x]."'),
      frust_enl: axis('frustrated', 'enlightened'),
      humil_pride: axis('humiliated', 'proud'),
      anx_conf: axis('anxious', 'confident'),
      disap_enc: axis('disappointed', 'encouraged'),
      dread_hope: axis('dreading', 'hopeful'),
      bore_cur: axis('bored', 'curious'),
    },
  },
  async ({ user_summary, ...axes }) => {
    const text = processTurn({ userSummary: user_summary.trim().replace(/\n+/g, ' '), axes });
    return { content: [{ type: 'text', text }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
