import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pages, SITE } from '../../scripts/site.mjs';
import { sitemap } from '../../scripts/parts.mjs';
import { transformPage, serve, check, PARTS, context, generated, modulePaths } from '../../tools/page.mjs';
import { languages, list, fillLanguages, stamp } from '../../tools/languages.mjs';
import { build } from '../../tools/site.mjs';

// tools/page.mjs makes what the site serves from the source tree, for the
// build and the test server alike: pages with their generated parts and ?v=
// stamps, lang.js with its list of languages, the language packs and the
// sitemap. tools/languages.mjs makes the languages.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// A small repository of its own: a landing page, lang.js, a stylesheet and
// one language, xx.
const LANG_JS = '(function(){\n  // build:languages\n  var LANGUAGES = [{"code":"en","name":"English"}];\n  // /build:languages\n  window.L = LANGUAGES;\n})();\n';
const PAGE = [
  '<head>',
  '  <!-- build:meta -->',
  '  <!-- /build:meta -->',
  '  <link rel="stylesheet" href="/assets/css/a.css">',
  '  <script src="/assets/vendor/lib.js?v=1.2.3"></script>',
  '</head>',
  '<main>',
  '  <!-- build:cards games -->',
  '  <!-- /build:cards -->',
  '  <!-- build:footer -->',
  '  <!-- /build:footer -->',
  '</main>',
  ''
].join('\n');
const LIST = [
  { path: '/', title: 'Home', description: 'The home page.', schema: 'WebSite' },
  { path: '/snake/', title: 'Snake', description: 'Snake.', app: { kind: 'game', name: 'Snake', blurb: 'Eat', keywords: 'k', icon: ['<rect/>'], best: 'b' } }
];
function repo(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-page-'));
  const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  write('index.html', PAGE);
  write('assets/js/lang.js', LANG_JS);
  write('assets/css/a.css', 'a {}');
  write('assets/css/xx.css', 'x {}');
  write('assets/lang/xx/language.json', JSON.stringify({ name: 'Xx', digits: '0123456789', style: '/assets/css/xx.css' }));
  write('assets/lang/xx/one.json', JSON.stringify({ Play: 'Plai', Hello: 'Helo' }));
  write('assets/lang/xx/two.json', JSON.stringify({ Hello: 'Helo' }));
  return { dir, write, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const text = (served) => String(served.body);

test('a page: its blocks are filled, and the site\'s own scripts and styles stamped', () => {
  const { dir, done } = repo();
  const html = text(serve(dir, 'index.html', LIST));
  assert.match(html, /\n {2}<!-- build:meta -->\n {2}<meta http-equiv="Content-Security-Policy"[^\n]*\n {2}<title>Home<\/title>\n/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.bdnix\.com\/">/);
  assert.match(html, /<a class="card panel" href="\/snake\/" data-keywords="k">/);
  assert.match(html, /<footer class="foot">/);
  // A stamp is a hash of what's served there: lang.js with its list.
  assert.ok(html.includes(`<link rel="stylesheet" href="/assets/css/a.css?v=${stamp('a {}')}">`));
  assert.ok(html.includes(`<script src="/assets/js/lang.js?v=${stamp(serve(dir, 'assets/js/lang.js').body)}"></script>`));
  assert.notEqual(stamp(serve(dir, 'assets/js/lang.js').body), stamp(LANG_JS));
  // Vendored libraries keep the version they're linked with.
  assert.ok(html.includes('<script src="/assets/vendor/lib.js?v=1.2.3"></script>'));
  // Made from the page and what its parts come from.
  assert.deepEqual(serve(dir, 'index.html', LIST).from, ['index.html', ...PARTS]);
  done();
});

test('a page: a missing file, or markers on a page the list lacks, are errors', () => {
  const stampOf = (rel) => (rel === 'assets/js/here.js' ? 'abc' : null);
  const page = '<script src="/assets/js/here.js"></script>\n<script src="/assets/js/gone.js"></script>\n';
  assert.deepEqual(transformPage('snake/index.html', page, stampOf, LIST), {
    html: '<script src="/assets/js/here.js?v=abc"></script>\n<script src="/assets/js/gone.js"></script>\n',
    errors: ['snake/index.html: /assets/js/gone.js doesn\'t exist']
  });
  assert.deepEqual(transformPage('flap/index.html', '<!-- build:meta -->\n<!-- /build:meta -->\n', stampOf, LIST).errors, ['flap/index.html: not in scripts/site.mjs']);
  const { dir, write, done } = repo();
  write('flap/index.html', PAGE);
  assert.deepEqual(check(dir, LIST), ['flap/index.html: not in scripts/site.mjs', 'scripts/site.mjs: /snake/ has no index.html']);
  write('snake/index.html', '<p>no markers</p>');
  assert.ok(check(dir, LIST).includes('snake/index.html: no <!-- build:meta --> markers'));
  done();
});

test('languages: each folder\'s translations in one pack, and lang.js lists them on its one line', () => {
  const { dir, done } = repo();
  const [xx] = languages(dir);
  assert.equal(xx.code, 'xx');
  assert.deepEqual(xx.files, ['assets/lang/xx/one.json', 'assets/lang/xx/two.json']);
  assert.deepEqual(xx.errors, []);
  assert.equal(xx.pack, '// Made by tools/languages.mjs from the site\'s translations into xx. Don\'t edit it here.\nwindow.bdnixLang.pack({\n "Hello": "Helo",\n "Play": "Plai"\n});\n');
  assert.deepEqual(list(dir), [
    { code: 'en', name: 'English' },
    { code: 'xx', name: 'Xx', digits: '0123456789', file: `/assets/lang/xx.js?v=${stamp(xx.pack)}`, style: `/assets/css/xx.css?v=${stamp('x {}')}` }
  ]);
  // lang.js keeps every line where it is in the source (coverage reports against it).
  const js = text(serve(dir, 'assets/js/lang.js'));
  assert.equal(js.split('\n').length, LANG_JS.split('\n').length);
  assert.equal(js, fillLanguages(LANG_JS, list(dir)));
  assert.equal(js.split('\n')[2], `  var LANGUAGES = ${JSON.stringify(list(dir))};`);
  assert.equal(text(serve(dir, 'assets/lang/xx.js')), xx.pack);
  done();
});

test('languages: what each is made from, not counting the files behind its stamps', () => {
  const { dir, write, done } = repo();
  assert.deepEqual(serve(dir, 'assets/js/lang.js').from, ['assets/js/lang.js', 'assets/lang/', 'assets/lang/xx/language.json']);
  assert.deepEqual(serve(dir, 'assets/lang/xx.js').from, ['assets/lang/xx/', 'assets/lang/xx/language.json', 'apps/', 'shared/', 'site/', 'assets/lang/xx/one.json', 'assets/lang/xx/two.json']);
  assert.equal(serve(dir, 'assets/lang/yy.js'), null);
  // A changed translation changes the pack's stamp, so lang.js and every
  // page's stamp of it, but not what either is made from.
  const before = text(serve(dir, 'index.html', LIST));
  write('assets/lang/xx/two.json', JSON.stringify({ Hello: 'Halo' }));
  assert.notEqual(text(serve(dir, 'index.html', LIST)), before);
  assert.deepEqual(serve(dir, 'index.html', LIST).from, ['index.html', ...PARTS]);
  // The same English translated two ways is an error.
  assert.deepEqual(languages(dir)[0].errors, ['assets/lang/xx/two.json: "Hello" is translated differently elsewhere']);
  assert.deepEqual(serve(dir, 'assets/lang/xx.js').errors, languages(dir)[0].errors);
  assert.deepEqual(check(dir, LIST.slice(0, 1)), languages(dir)[0].errors);
  done();
});

test('other files are served as they are; a missing one or a folder is nothing', () => {
  const { dir, done } = repo();
  assert.deepEqual(serve(dir, 'assets/css/a.css'), { body: Buffer.from('a {}'), from: ['assets/css/a.css'], errors: [] });
  assert.equal(serve(dir, 'assets/css/gone.css'), null);
  assert.equal(serve(dir, 'assets'), null);
  assert.deepEqual(serve(dir, 'sitemap.xml', LIST), { body: sitemap(LIST), from: PARTS, errors: [] });
  done();
});

// An app module: its page from its module.json, its files at the paths it
// publishes them at, and its own pack of the translations it needs.
test('a module\'s page and files, and its own language pack', () => {
  const { dir, write, done } = repo();
  write('shared/ui/module.json', JSON.stringify({ name: 'ui', kind: 'shared', publish: { 'ui.js': '/assets/js/ui.js' } }));
  write('shared/ui/ui.js', 'ui()');
  write('shared/ui/lang/xx.json', JSON.stringify({ Close: 'Klose' }));
  write('apps/snake/module.json', JSON.stringify({
    name: 'snake', kind: 'app', url: '/snake/', uses: ['ui'],
    page: { title: 'Snake game', description: 'Eat.', schema: 'WebApplication', category: 'GameApplication' },
    card: { type: 'game', name: 'Snake', blurb: 'Eat', keywords: 'k', icon: ['<rect/>'], best: 'bdnix_snake_best' }
  }));
  write('apps/snake/index.html', PAGE.replace('/assets/css/a.css', '/assets/js/ui.js'));
  write('apps/snake/lang/xx.json', JSON.stringify({ Eat: 'Iit' }));
  const list = [LIST[0], { module: 'snake' }];
  // Its files, at their published paths, made from the module's.
  assert.deepEqual(serve(dir, 'assets/js/ui.js', list), { body: Buffer.from('ui()'), from: ['shared/ui/ui.js', 'shared/ui/module.json'], errors: [] });
  // Its page: head tags from its module.json, and lang.js told where its packs are.
  const page = serve(dir, 'snake/index.html', list);
  assert.deepEqual(page.errors, []);
  assert.deepEqual(page.from, ['apps/snake/index.html', 'apps/snake/module.json', ...PARTS]);
  const html = text(page);
  assert.match(html, /<title>Snake game<\/title>/);
  assert.ok(html.includes(`<link rel="stylesheet" href="/assets/js/ui.js?v=${stamp('ui()')}">`));
  const pack = /<script src="\/assets\/js\/lang\.js\?v=[0-9a-f]{10}" data-pack="\/snake\/lang\/\{code\}\.js\?v=([0-9a-f]{10})"><\/script>/.exec(html);
  assert.ok(pack, 'lang.js names the page\'s pack');
  // The landing page lists it, and has no pack of its own.
  const home = text(serve(dir, 'index.html', list));
  assert.match(home, /<a class="card panel" href="\/snake\/"/);
  assert.doesNotMatch(home, /data-pack/);
  // Its pack has what it and what it uses translate, and nothing else; the
  // pack for the other pages has everything.
  const own = serve(dir, 'snake/lang/xx.js', list);
  assert.match(text(own), /"Close": "Klose",\n "Eat": "Iit"\n\}/);
  assert.doesNotMatch(text(own), /Hello/);
  assert.deepEqual(own.from, ['assets/lang/xx/language.json', 'apps/snake/module.json', 'apps/snake/lang/', 'shared/ui/module.json', 'shared/ui/lang/', 'apps/snake/lang/xx.json', 'shared/ui/lang/xx.json']);
  assert.match(text(serve(dir, 'assets/lang/xx.js', list)), /"Close": "Klose",\n "Eat": "Iit",\n "Hello": "Helo",\n "Play": "Plai"\n\}/);
  assert.equal(serve(dir, 'flap/lang/xx.js', list), null);
  assert.equal(serve(dir, 'snake/lang/yy.js', list), null);
  // A change to its translations changes its pack's stamp.
  write('shared/ui/lang/xx.json', JSON.stringify({ Close: 'Shut' }));
  assert.notEqual(/data-pack="[^"]*v=([0-9a-f]+)"/.exec(text(serve(dir, 'snake/index.html', list)))[1], pack[1]);
  // What the build publishes: the module's files and page, and its pack.
  const ctx = context(dir, list);
  assert.deepEqual(modulePaths(dir, ctx), ['assets/js/ui.js', 'snake/index.html']);
  assert.deepEqual(generated(dir, ctx), ['sitemap.xml', 'assets/lang/xx.js', 'snake/lang/xx.js']);
  assert.deepEqual(check(dir, list), []);
  assert.deepEqual(check(dir, LIST), ['scripts/site.mjs: no { module: \'snake\' } to say where snake\'s page goes']);
  done();
});

// The source tree carries nothing generated: pages keep their markers with
// nothing between them and link the site's own files without a stamp, and
// lang.js has only English.
test('site: the sources carry nothing generated, and fit scripts/site.mjs', () => {
  assert.deepEqual(check(root), []);
  for (const p of pages) {
    const html = fs.readFileSync(path.join(root, p.path, 'index.html'), 'utf8');
    for (const m of html.matchAll(/^( *)<!-- build:(\w+)(?: \w+)? -->\n(.*)$/gm)) assert.equal(m[3], `${m[1]}<!-- /build:${m[2]} -->`, `${p.path}: ${m[2]}`);
    assert.doesNotMatch(html, /\/assets\/(js|css)\/[\w-]+\.(js|css)\?v=/, p.path);
  }
  const js = fs.readFileSync(path.join(root, 'shared/lang/lang.js'), 'utf8');
  assert.match(js, /\n {2}\/\/ build:languages\n {2}var LANGUAGES = \[\{"code":"en","name":"English"\}\];\n {2}\/\/ \/build:languages\n/);
  assert.deepEqual(text(serve(root, 'sitemap.xml')).match(/<loc>[^<]+<\/loc>/g), pages.filter((p) => !p.noindex).map((p) => `<loc>${SITE}${p.path}</loc>`));
});

// The test server answers with exactly what the build publishes, for every
// published file.
test('site: the test server serves exactly what _site/ has', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-site-'));
  const files = build(root, out);
  const port = 20000 + Math.floor(Math.random() * 20000);
  // The server runs in a process of its own, which the unit test cache
  // (scripts/unit-cache.mjs) doesn't watch; reading it here makes it one of
  // this test's inputs. (What it imports, tools/page.mjs, this test imports.)
  assert.match(fs.readFileSync(path.join(root, 'tests/server.mjs'), 'utf8'), /from '\.\.\/tools\/page\.mjs'/);
  const server = spawn(process.execPath, [path.join(root, 'tests/server.mjs')], { env: { ...process.env, PORT: String(port), SERVED_LOG: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('exit', reject); });
    for (const f of files) {
      const res = await fetch(`http://localhost:${port}/${f.replace(/(^|\/)index\.html$/, '$1')}`);
      assert.equal(res.status, 200, f);
      assert.ok(Buffer.from(await res.arrayBuffer()).equals(fs.readFileSync(path.join(out, f))), f);
    }
    // Pages, at their own URL and with a stamp on it.
    assert.ok(files.includes('snake/index.html') && files.includes('assets/lang/bn.js') && files.includes('sitemap.xml'));
    assert.equal(await (await fetch(`http://localhost:${port}/assets/css/base.css?v=whatever`)).text(), fs.readFileSync(path.join(out, 'assets/css/base.css'), 'utf8'));
    assert.equal((await fetch(`http://localhost:${port}/nowhere.js`)).status, 404);
  } finally {
    server.kill();
    fs.rmSync(out, { recursive: true, force: true });
  }
});
