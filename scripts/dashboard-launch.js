import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [, , projectDir, pluginData, flag] = process.argv;
if (!projectDir || !pluginData) {
  console.error('usage: dashboard-launch.js <projectDir> <pluginData>');
  process.exit(1);
}

process.env.CLAUDE_PROJECT_DIR = projectDir;
process.env.CLAUDE_PLUGIN_DATA = pluginData;

const { projectStateDir, ensureInitialized } = await import('../engine/state.js');
const dir = projectStateDir();
ensureInitialized(dir);

// Deterministic per-project port so re-launching finds the same server instead of scanning.
const hash = createHash('sha256').update(projectDir).digest('hex');
const port = 30000 + (parseInt(hash.slice(0, 4), 16) % 5000);

function isListening(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: '127.0.0.1' });
    sock.once('connect', () => {
      sock.end();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
  });
}

async function waitUntilListening(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isListening(port)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!(await isListening(port))) {
  const child = spawn('node', [join(__dirname, 'dashboard-server.js'), dir, String(port)], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const ready = await waitUntilListening(port, 4000);
  if (!ready) {
    console.error(`agent-emotions: dashboard server did not come up on port ${port}`);
    process.exit(1);
  }
}

const url = `http://localhost:${port}`;
if (flag === '--open') {
  // Open in the default browser on any platform.
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}
console.log(url);
