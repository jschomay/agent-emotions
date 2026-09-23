import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { projectStateDir, ensureInitialized, appendLog } from '../engine/state.js';

const server = new McpServer({ name: 'agent-emotions', version: '0.1.0' });

server.registerTool(
  'log_emotion',
  {
    description:
      'Record one short line to the running emotional log at the end of your turn — e.g. "I did X, Y happened, it made me feel Z". Loose is fine, just make it specific enough to be useful context next time.',
    inputSchema: { entry: z.string().describe('One line describing what happened and how it felt.') },
  },
  async ({ entry }) => {
    const dir = projectStateDir();
    ensureInitialized(dir);
    appendLog(dir, entry);
    return { content: [{ type: 'text', text: 'logged' }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
