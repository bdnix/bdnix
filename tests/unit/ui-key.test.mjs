import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { respond } from '../../tools/page.mjs';
import { responseDigest, uiInputs, keyOf } from '../../scripts/test-deps.mjs';

// The UI result cache (scripts/ui-cache.mjs) keeps a spec's result against
// each path it fetched and a digest of the answer, and asks respond() again
// to see whether any answer changed. These check the answers, the digests,
// and that a spec's key changes exactly when something it fetched does.

const PAGE = '<head>\n<!-- build:meta -->\n<!-- /build:meta -->\n<link rel="stylesheet" href="/assets/css/a.css">\n</head>\n<p>Home</p>\n';
const LIST = [{ path: '/', title: 'Home', description: 'The home page.' }, { path: '/b/', title: 'B', description: 'Page B.' }];
function repo(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-ui-key-'));
  const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  write('index.html', PAGE);
  write('b/index.html', PAGE.replace('Home', 'B'));
  write('assets/css/a.css', 'a {}');
  write('assets/js/lang.js', '(function(){\n  // build:languages\n  var LANGUAGES = [{"code":"en","name":"English"}];\n  // /build:languages\n})();\n');
  return { dir, write, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
// What a spec would be keyed on now, having fetched these paths.
const keyNow = (dir, spec, paths) => keyOf(uiInputs(spec, Object.fromEntries(paths.map((p) => [p, responseDigest(respond(dir, p, LIST))])), { read: () => '', node: '22' }));

test('respond: a page, a file, a folder\'s index, a missing file and a path outside the site', () => {
  const { dir, done } = repo();
  const home = respond(dir, '/', LIST);
  assert.equal(home.status, 200);
  assert.equal(home.type, 'text/html; charset=utf-8');
  assert.match(String(home.body), /<title>Home<\/title>/);
  assert.match(String(home.body), /a\.css\?v=[0-9a-f]{10}/);
  assert.deepEqual(respond(dir, '/b', LIST).body, respond(dir, '/b/', LIST).body);
  const css = respond(dir, '/assets/css/a.css?v=anything', LIST);
  assert.deepEqual([css.status, css.type, String(css.body), css.from], [200, 'text/css; charset=utf-8', 'a {}', ['assets/css/a.css']]);
  assert.deepEqual([respond(dir, '/gone.js', LIST).status, respond(dir, '/gone.js', LIST).from], [404, ['gone.js']]);
  assert.equal(respond(dir, '/../etc/passwd', LIST).status, 403);
  assert.equal(respond(dir, '/%2e%2e/%2e%2e/etc/passwd', LIST).status, 403);
  done();
});

test('responseDigest: status, type and body count; the site\'s ?v= stamps don\'t, a vendored library\'s version does', () => {
  const r = { status: 200, type: 'text/html; charset=utf-8', body: '<script src="/assets/js/a.js?v=0123456789"></script>' };
  const d = responseDigest(r);
  assert.match(d, /^[0-9a-f]{32}$/);
  assert.equal(responseDigest({ ...r, body: r.body.replace('0123456789', 'abcdefabcd') }), d);
  assert.equal(responseDigest({ ...r, body: Buffer.from(r.body) }), d);
  assert.notEqual(responseDigest({ ...r, body: r.body.replace('a.js', 'b.js') }), d);
  assert.notEqual(responseDigest({ ...r, status: 404 }), d);
  assert.notEqual(responseDigest({ ...r, type: 'text/plain' }), d);
  const lib = { status: 200, type: 'text/html', body: '<script src="/assets/vendor/x.js?v=1.17.1"></script>' };
  assert.notEqual(responseDigest({ ...lib, body: lib.body.replace('1.17.1', '1.17.2') }), responseDigest(lib));
  // Binary files are digested as they are.
  const png = { status: 200, type: 'image/png', body: Buffer.from('?v=0123456789') };
  assert.notEqual(responseDigest({ ...png, body: Buffer.from('?v=abcdefabcd') }), responseDigest(png));
});

test('a spec\'s key changes exactly when something it fetched answers differently', () => {
  const { dir, write, done } = repo();
  const home = ['/', '/assets/css/a.css'], b = ['/b/'];
  const before = { home: keyNow(dir, 'tests/ui/home.spec.mjs', home), b: keyNow(dir, 'tests/ui/b.spec.mjs', b) };
  // The same site made again: nothing changes.
  assert.deepEqual({ home: keyNow(dir, 'tests/ui/home.spec.mjs', home), b: keyNow(dir, 'tests/ui/b.spec.mjs', b) }, before);
  // A change to the stylesheet: the spec that fetched it, not the one that
  // only fetched a page linking it (that page's stamp changes, but the stamp
  // isn't part of the digest).
  write('assets/css/a.css', 'a { color: red }');
  assert.notEqual(keyNow(dir, 'tests/ui/home.spec.mjs', home), before.home);
  assert.equal(keyNow(dir, 'tests/ui/b.spec.mjs', b), before.b);
  // A change to page B: only the spec that fetched it.
  write('assets/css/a.css', 'a {}');
  write('b/index.html', PAGE.replace('Home', 'Bee'));
  assert.equal(keyNow(dir, 'tests/ui/home.spec.mjs', home), before.home);
  assert.notEqual(keyNow(dir, 'tests/ui/b.spec.mjs', b), before.b);
  // A file that a spec found missing appears, and one it found goes.
  const gone = keyNow(dir, 'tests/ui/c.spec.mjs', ['/c.js']);
  write('c.js', 'x');
  assert.notEqual(keyNow(dir, 'tests/ui/c.spec.mjs', ['/c.js']), gone);
  fs.rmSync(path.join(dir, 'c.js'));
  assert.equal(keyNow(dir, 'tests/ui/c.spec.mjs', ['/c.js']), gone);
  done();
});

test('uiInputs: the spec\'s code and what every spec runs on, then each response; not the code that made them', () => {
  const files = { 'tests/ui/a.spec.mjs': "import { test } from './fixtures.mjs';", 'tests/ui/fixtures.mjs': "import { test } from '@playwright/test';", 'playwright.config.mjs': '', 'package-lock.json': '{}' };
  const read = (f) => (f in files ? files[f] : null);
  const lines = uiInputs('tests/ui/a.spec.mjs', { '/b/': 'b2', '/': 'a1' }, { global: ['playwright.config.mjs'], read, node: '22' });
  assert.equal(lines[0], 'node 22');
  assert.deepEqual(lines.filter((l) => /^(tests|playwright)/.test(l)).map((l) => l.split(' ')[0]), ['playwright.config.mjs', 'tests/ui/a.spec.mjs', 'tests/ui/fixtures.mjs']);
  assert.deepEqual(lines.filter((l) => l.startsWith('GET ')), ['GET / a1', 'GET /b/ b2']);
  assert.ok(!lines.some((l) => /tools\/|server\.mjs/.test(l)));
});
