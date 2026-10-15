import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from '../../scripts/site.mjs';
import { publishedFiles, build, ROOT_FILES } from '../../tools/site.mjs';
import { generated } from '../../tools/page.mjs';

// tools/site.mjs lists what's published to www.bdnix.com: the pages, assets/,
// a few root files and the files only the build makes, and nothing else in
// the repository.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('publish: every page, every asset and the root files', () => {
  const files = publishedFiles(root);
  for (const p of pages) assert.ok(files.includes(p.path.slice(1) + 'index.html'), p.path);
  for (const f of ROOT_FILES) assert.ok(files.includes(f), f);
  assert.ok(files.includes('sitemap.xml'));
  assert.ok(files.includes('assets/lang/bn.js'));
  assert.ok(files.includes('assets/js/lang.js'));
  assert.ok(files.includes('assets/vendor/pdf-lib.min.js'));
  assert.deepEqual(files, [...files].sort());
});

test('publish: nothing but the site', () => {
  const files = publishedFiles(root);
  const site = new Set(['index.html', ...ROOT_FILES, ...generated(root)]);
  for (const f of files) {
    const top = f.split('/')[0];
    assert.ok(site.has(f) || top === 'assets' || pages.some((p) => f === p.path.slice(1) + 'index.html'), f);
  }
  for (const f of ['package.json', 'eslint.config.mjs', 'AGENTS.md', 'README.md', 'codecov.yml']) assert.ok(!files.includes(f), f);
  assert.ok(!files.some((f) => /^(tests|scripts|tools|docs|node_modules|\.github)\//.test(f) || f.split('/').some((part) => part.startsWith('.'))));
});

// A small repository of its own: one page beside the landing page.
const PAGE = '<head>\n<!-- build:meta -->\n<!-- /build:meta -->\n<script src="/assets/js/a.js"></script>\n</head>\n';
function repo(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-publish-'));
  const write = (f, s = f) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  for (const f of [...ROOT_FILES, 'snake/notes.txt', 'assets/js/a.js', 'assets/js/lang.js', 'assets/css/.hidden', 'tests/x.mjs', 'README.md']) write(f);
  for (const f of ['index.html', 'snake/index.html']) write(f, PAGE);
  return { dir, write };
}
const list = [{ path: '/', title: 'Home', description: 'Home.' }, { path: '/snake/', title: 'Snake', description: 'Snake.' }];

test('publish: a page is its index.html; dotfiles and anything unlisted stay out', () => {
  const { dir } = repo();
  assert.deepEqual(publishedFiles(dir, list), ['CNAME', 'LICENSE', 'assets/js/a.js', 'assets/js/lang.js', 'index.html', 'robots.txt', 'sitemap.xml', 'snake/index.html']);
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
  assert.ok(!fs.existsSync(path.join(out, 'stale.html')));
  // Pages get their head tags and stamps; the sitemap is made; other files are copied.
  const snake = fs.readFileSync(path.join(out, 'snake/index.html'), 'utf8');
  assert.match(snake, /<title>Snake<\/title>/);
  assert.match(snake, /<script src="\/assets\/js\/a\.js\?v=[0-9a-f]{10}"><\/script>/);
  assert.match(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/www\.bdnix\.com\/snake\/<\/loc>/);
  assert.equal(fs.readFileSync(path.join(out, 'assets/js/a.js'), 'utf8'), 'assets/js/a.js');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('publish: a broken page fails the build, naming every problem, and leaves the last build alone', () => {
  const { dir, write } = repo();
  const out = path.join(dir, '_site');
  write('_site/last.html');
  write('snake/index.html', PAGE.replace('a.js', 'gone.js'));
  write('flap/index.html', PAGE);
  assert.throws(() => build(dir, out, list), (e) => /snake\/index\.html: \/assets\/js\/gone\.js doesn't exist/.test(e.message) && /flap\/index\.html: not in scripts\/site\.mjs/.test(e.message));
  assert.ok(fs.existsSync(path.join(out, 'last.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

// Only master is ever published: the workflow runs on a push to master or by
// hand, and its one job only for refs/heads/master, so a run started by hand
// on another branch deploys nothing.
test('publish: only master deploys', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  const on = /\non:\n((?: {2}.*\n)*)/.exec(workflow)[1];
  assert.equal(on, '  push:\n    branches: [master]\n  workflow_dispatch:\n');
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n'));
  assert.deepEqual(jobs.match(/^ {2}[\w-]+:$/gm), ['  deploy:'], 'one job');
  assert.match(jobs, /\n {4}if: github\.ref == 'refs\/heads\/master'\n/);
  assert.equal(workflow.match(/actions\/deploy-pages@/g).length, 1);
  assert.equal(workflow.match(/actions\/upload-pages-artifact@/g).length, 1);
});
