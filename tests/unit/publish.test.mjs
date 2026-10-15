import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from '../../scripts/site.mjs';
import { publishedFiles, build, ROOT_FILES } from '../../tools/site.mjs';

// tools/site.mjs lists what's published to www.bdnix.com: the pages, assets/
// and a few root files, and nothing else in the repository.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('publish: every page, every asset and the root files', () => {
  const files = publishedFiles(root);
  for (const p of pages) assert.ok(files.includes(p.path.slice(1) + 'index.html'), p.path);
  for (const f of ROOT_FILES) assert.ok(files.includes(f), f);
  assert.ok(files.includes('assets/js/lang.js'));
  assert.ok(files.includes('assets/vendor/pdf-lib.min.js'));
  assert.deepEqual(files, [...files].sort());
});

test('publish: nothing but the site', () => {
  const files = publishedFiles(root);
  const site = new Set(['index.html', ...ROOT_FILES]);
  for (const f of files) {
    const top = f.split('/')[0];
    assert.ok(site.has(f) || top === 'assets' || pages.some((p) => f === p.path.slice(1) + 'index.html'), f);
  }
  for (const f of ['package.json', 'eslint.config.mjs', 'AGENTS.md', 'README.md', 'codecov.yml']) assert.ok(!files.includes(f), f);
  assert.ok(!files.some((f) => /^(tests|scripts|tools|docs|node_modules|\.github)\//.test(f) || f.split('/').some((part) => part.startsWith('.'))));
});

// A small repository of its own: one page beside the landing page.
function repo(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-publish-'));
  const write = (f, s = f) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  for (const f of [...ROOT_FILES, 'index.html', 'snake/index.html', 'snake/notes.txt', 'assets/js/a.js', 'assets/css/.hidden', 'tests/x.mjs', 'README.md']) write(f);
  return { dir, write };
}
const list = [{ path: '/' }, { path: '/snake/' }];

test('publish: a page is its index.html; dotfiles and anything unlisted stay out', () => {
  const { dir } = repo();
  assert.deepEqual(publishedFiles(dir, list), ['CNAME', 'LICENSE', 'assets/js/a.js', 'index.html', 'robots.txt', 'sitemap.xml', 'snake/index.html']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('publish: a missing page or root file fails the build', () => {
  const { dir } = repo();
  assert.throws(() => publishedFiles(dir, [...list, { path: '/flap/' }]), /flap\/index\.html is published but doesn't exist/);
  fs.rmSync(path.join(dir, 'CNAME'));
  assert.throws(() => publishedFiles(dir, list), /CNAME/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('publish: build copies exactly the published files, replacing the last build', () => {
  const { dir, write } = repo();
  const out = path.join(dir, '_site');
  write('_site/stale.html');
  const files = build(dir, out, list);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(out, path.join(d, e.name)).split(path.sep).join('/')]);
  assert.deepEqual(walk(out).sort(), files);
  assert.equal(fs.readFileSync(path.join(out, 'snake/index.html'), 'utf8'), 'snake/index.html');
  fs.rmSync(dir, { recursive: true, force: true });
});
