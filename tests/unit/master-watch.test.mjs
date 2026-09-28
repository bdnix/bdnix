import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missing, client, watch, TESTS, PAGES } from '../../scripts/master-watch.mjs';

const HEAD = 'abc123';
const tests = { path: TESTS };
const pages = { path: PAGES };
const codeql = { path: 'dynamic/github-code-scanning/codeql' };

// A fake GitHub API: master is at HEAD, and each check for runs gets the
// next entry of `checks` (the last one repeats). Records every call.
function fakeApi(checks){
  const calls = [];
  let n = 0;
  async function api(method, route, body){
    calls.push(body ? [method, route, body] : [method, route]);
    if (route === '/branches/master') return { commit: { sha: HEAD } };
    if (route.startsWith('/actions/runs?')) return { workflow_runs: checks[Math.min(n++, checks.length - 1)] };
    return null;
  }
  api.calls = calls;
  api.posts = () => calls.filter((c) => c[0] === 'POST');
  return api;
}

const quiet = { sleep: async () => {}, log: () => {} };

test('missing: what a push to master starts that has no run for the commit', () => {
  assert.deepEqual(missing([]), { tests: true, pages: true });
  assert.deepEqual(missing([codeql]), { tests: true, pages: true });
  assert.deepEqual(missing([tests]), { tests: false, pages: true });
  assert.deepEqual(missing([pages, codeql]), { tests: true, pages: false });
  assert.deepEqual(missing([codeql, tests, pages]), { tests: false, pages: false });
  // Another workflow of the same name doesn't count.
  assert.deepEqual(missing([{ path: '.github/workflows/other.yml', name: 'Tests' }]), { tests: true, pages: true });
});

test('watch: nothing to do when master was tested and deployed', async () => {
  const api = fakeApi([[tests, pages, codeql]]);
  assert.deepEqual(await watch({ api, ...quiet }), { head: HEAD, started: [] });
  assert.deepEqual(api.calls, [
    ['GET', '/branches/master'],
    ['GET', `/actions/runs?head_sha=${HEAD}&per_page=100`]
  ]);
});

test('watch: waits for runs that start late, without starting them again', async () => {
  const slept = [];
  const api = fakeApi([[], [tests], [tests, pages]]);
  const result = await watch({ api, wait: 300, every: 30, sleep: async (s) => { slept.push(s); }, log: () => {} });
  assert.deepEqual(result.started, []);
  assert.deepEqual(slept, [30, 30]);
  assert.deepEqual(api.posts(), []);
});

test('watch: starts the Tests workflow and a Pages build when the push was lost', async () => {
  const slept = [];
  const log = [];
  const api = fakeApi([[]]);
  const result = await watch({ api, wait: 90, every: 30, sleep: async (s) => { slept.push(s); }, log: (m) => log.push(m) });
  assert.deepEqual(result, { head: HEAD, started: ['tests', 'pages'] });
  // Checked at 0, 30, 60 and 90 seconds, then gave up.
  assert.deepEqual(slept, [30, 30, 30]);
  assert.deepEqual(api.posts(), [
    ['POST', '/actions/workflows/tests.yml/dispatches', { ref: 'master' }],
    ['POST', '/pages/builds']
  ]);
  assert.deepEqual(log, [`master is at ${HEAD}.`, 'No Tests run for it: starting one.', 'No Pages build for it: asking for one.']);
});

test('watch: starts only what is missing', async () => {
  const api = fakeApi([[pages]]);
  assert.deepEqual((await watch({ api, wait: 0, ...quiet })).started, ['tests']);
  assert.deepEqual(api.posts(), [['POST', '/actions/workflows/tests.yml/dispatches', { ref: 'master' }]]);

  const api2 = fakeApi([[tests]]);
  assert.deepEqual((await watch({ api: api2, wait: 0, ...quiet })).started, ['pages']);
  assert.deepEqual(api2.posts(), [['POST', '/pages/builds']]);
});

test('watch: a dry run reports without starting anything', async () => {
  const api = fakeApi([[]]);
  assert.deepEqual((await watch({ api, wait: 0, dryRun: true, ...quiet })).started, ['tests', 'pages']);
  assert.deepEqual(api.posts(), []);
});

test('client: calls the repository API with the token, and fails on an HTTP error', async () => {
  const seen = [];
  const replies = [
    { ok: true, status: 200, text: '{"commit":{"sha":"x"}}' },
    { ok: true, status: 204, text: '' },
    { ok: false, status: 403, text: '{"message":"Resource not accessible by integration"}' }
  ];
  const fetch = async (url, init) => {
    seen.push([url, init]);
    const r = replies.shift();
    return { ok: r.ok, status: r.status, text: async () => r.text };
  };
  const api = client({ token: 'T', repo: 'o/r', fetch });

  assert.deepEqual(await api('GET', '/branches/master'), { commit: { sha: 'x' } });
  assert.equal(seen[0][0], 'https://api.github.com/repos/o/r/branches/master');
  assert.equal(seen[0][1].method, 'GET');
  assert.equal(seen[0][1].headers.authorization, 'Bearer T');
  assert.equal(seen[0][1].body, undefined);
  assert.equal(seen[0][1].headers['content-type'], undefined);

  assert.equal(await api('POST', '/actions/workflows/tests.yml/dispatches', { ref: 'master' }), null);
  assert.equal(seen[1][1].body, '{"ref":"master"}');
  assert.equal(seen[1][1].headers['content-type'], 'application/json');

  await assert.rejects(api('POST', '/pages/builds'), /POST \/pages\/builds: 403 .*not accessible/);
});
