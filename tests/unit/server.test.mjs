import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The test server (tests/server.mjs) keeps an idle connection open for as
// long as a run lasts. Playwright reuses its connections, and a server that
// closes one after Node's default five idle seconds can do it just as the
// next request goes out on it, which the test sees as ECONNRESET.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The server runs in a process of its own, where the unit test cache
// (scripts/unit-cache.mjs) can't see what it reads, so read its code here:
// a change to it runs this test again.
for (const f of ['tests/server.mjs', 'tools/page.mjs', 'scripts/test-deps.mjs']) fs.readFileSync(path.join(root, f));

test('an idle connection is still open after Node\'s default five seconds', { timeout: 20000 }, async () => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = spawn(process.execPath, ['tests/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), SERVED_LOG: '' } });
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on('data', (d) => { if (String(d).includes('Serving')) resolve(); });
      server.on('exit', reject);
    });
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    const socket = await new Promise((resolve, reject) => {
      const req = http.get({ port, path: '/robots.txt', agent }, (res) => { res.resume(); res.on('end', () => resolve(req.socket)); });
      req.on('error', reject);
    });
    assert.ok(socket instanceof net.Socket);
    let closed = false;
    socket.on('close', () => { closed = true; });
    await new Promise((r) => setTimeout(r, 6500));
    assert.equal(closed, false, 'the server closed the idle connection');
    // And it answers on it.
    const status = await new Promise((resolve, reject) => {
      const req = http.get({ port, path: '/robots.txt', agent }, (res) => { res.resume(); resolve([res.statusCode, req.reusedSocket]); });
      req.on('error', reject);
    });
    assert.deepEqual(status, [200, true]);
    agent.destroy();
  } finally {
    server.kill();
  }
});
