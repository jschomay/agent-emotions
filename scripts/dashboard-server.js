import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { readState, readDisposition, readLogTail, readTurns } from '../engine/state.js';

const [, , dir, portArg] = process.argv;
if (!dir || !portArg) {
  console.error('usage: dashboard-server.js <stateDir> <port>');
  process.exit(1);
}
const port = Number(portArg);

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = join(__dirname, '..', 'dashboard', 'template.html');

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
let lastRequest = Date.now();

const server = createServer((req, res) => {
  lastRequest = Date.now();

  if (req.url === '/api/data') {
    try {
      const body = JSON.stringify({
        state: readState(dir),
        disposition: readDisposition(dir),
        log: readLogTail(dir, 40).reverse(),
        turns: readTurns(dir, 200),
      });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(String(err));
    }
    return;
  }

  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(readFileSync(templatePath, 'utf8'));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(port, '127.0.0.1');

// Self-cleanup: exit if nobody's had the page open for a while, rather than running forever.
setInterval(() => {
  if (Date.now() - lastRequest > IDLE_TIMEOUT_MS) process.exit(0);
}, 60 * 1000).unref();
