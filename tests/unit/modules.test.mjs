import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { modules, closure, moduleOf, declared, undeclared, pages, placement } from '../../tools/modules.mjs';
import { serve, check, generated } from '../../tools/page.mjs';
import { languages, packs, list, stamp } from '../../tools/languages.mjs';
import { publishedFiles } from '../../tools/site.mjs';
import { boundaries } from '../../tools/boundaries.mjs';

// tools/modules.mjs reads each module's module.json; tools/page.mjs serves
// its files where it publishes them, and tools/languages.mjs makes its pack.
// Each test has a small repository of its own: a game (apps/game) using two
// shared modules (shared/look, shared/words, which uses look), in a site
// whose scripts/site.mjs places it after the landing page.

const PAGE = (extra = '') => [
  '<head>',
  '  <!-- build:meta -->',
  '  <!-- /build:meta -->',
  '  <link rel="stylesheet" href="/assets/css/look.css">',
  extra,
  '</head>',
  ''
].join('\n');
const LANG_JS = '(function(){\n  // build:languages\n  var LANGUAGES = [{"code":"en","name":"English"}];\n  // /build:languages\n})();\n';
const json = (v) => JSON.stringify(v, null, 2);
const GAME = {
  name: 'game', kind: 'app', url: '/game/',
  publish: { 'index.html': '/game/index.html', 'game.js': '/assets/js/game.js' },
  uses: ['look', 'words'],
  page: { title: 'Game | bdnix', description: 'A game.', schema: 'WebApplication', category: 'GameApplication' },
  card: { kind: 'game', name: 'Game', blurb: 'Play it', keywords: 'game', icon: ['<rect/>'], best: 'bdnix_game_best' }
};

function repo(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-modules-'));
  const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  write('index.html', PAGE());
  write('apps/game/module.json', json(GAME));
  write('apps/game/index.html', PAGE('  <script src="/assets/js/game.js"></script>'));
  write('apps/game/game.js', 'window.game = 1;\n');
  write('apps/game/lang/xx.json', json({ Play: 'Plai' }));
  write('shared/look/module.json', json({ name: 'look', kind: 'shared', publish: { 'look.css': '/assets/css/look.css', 'fonts/': '/assets/fonts/' } }));
  write('shared/look/look.css', 'a { font: url(/assets/fonts/f.woff2) }\n');
  write('shared/look/fonts/f.woff2', 'font');
  write('shared/look/lang/xx.json', json({ Look: 'Luk' }));
  write('shared/words/module.json', json({ name: 'words', kind: 'shared', publish: { 'lang.js': '/assets/js/lang.js' }, uses: ['look'] }));
  write('shared/words/lang.js', LANG_JS);
  write('shared/words/lang/xx.json', json({ Hello: 'Helo' }));
  write('assets/lang/xx/language.json', json({ name: 'Xx' }));
  write('assets/lang/xx/site.json', json({ Home: 'Hom' }));
  for (const f of ['CNAME', 'LICENSE', 'robots.txt']) write(f, f);
  return { dir, write, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const LISTED = [{ path: '/', title: 'Home', description: 'The home page.', schema: 'WebSite' }, { module: 'game' }];

test('modules: each module.json, what it publishes where, and the modules it uses', () => {
  const { dir, done } = repo();
  const { list: mods, byName, published, errors } = modules(dir);
  assert.deepEqual(errors, []);
  assert.deepEqual(mods.map((m) => m.dir), ['apps/game', 'shared/look', 'shared/words']);
  assert.deepEqual(byName.get('look').files, [
    { source: 'shared/look/look.css', published: 'assets/css/look.css' },
    { source: 'shared/look/fonts/f.woff2', published: 'assets/fonts/f.woff2' }
  ]);
  assert.deepEqual(published.get('assets/js/game.js'), { source: 'apps/game/game.js', module: 'game' });
  assert.deepEqual(byName.get('game').langs, { xx: 'apps/game/lang/xx.json' });
  assert.deepEqual(closure(byName, 'game'), ['look', 'words']);
  assert.deepEqual(closure(byName, 'words'), ['look']);
  assert.equal(moduleOf(dir, 'apps/game/test/page.spec.mjs').name, 'game');
  assert.equal(moduleOf(dir, 'tests/ui/a.spec.mjs'), null);
  assert.equal(moduleOf(dir, 'apps/nothing/x.js'), null);
  done();
});

test('modules: a wrong module.json says what\'s wrong', () => {
  const { dir, write, done } = repo();
  write('apps/game/module.json', json({ ...GAME, name: 'other', kind: 'shared', extra: 1, url: 'game', uses: ['nothing', 'game'], publish: { 'gone.js': '/assets/js/gone.js', 'game.js': 'assets/js/game.js' }, page: undefined, card: { kind: 'toy' } }));
  write('shared/look/module.json', json({ name: 'look', kind: 'shared', url: '/look/', publish: { 'look.css': '/assets/css/look.css', 'fonts/': '/assets/fonts/f.woff2' }, uses: ['words'], page: {}, card: {} }));
  write('shared/look/lang/notes.txt', '');
  write('site/bad/module.json', '{ nope');
  write('assets/css/look.css', 'still here');
  const { errors } = modules(dir);
  for (const e of [
    'apps/game/module.json: unknown field "extra"',
    'apps/game/module.json: name should be "game"',
    'apps/game/module.json: kind should be "app"',
    'apps/game/module.json: url should be like "/name/"',
    'apps/game/module.json: publishes gone.js, which doesn\'t exist',
    'apps/game/module.json: can\'t publish "game.js" at "assets/js/game.js"',
    'apps/game/module.json: an app or site page needs its page fields',
    'apps/game/module.json: card kind should be "game" or "tool"',
    'apps/game/module.json: card needs a name, blurb, keywords and icon',
    'shared/look/module.json: a shared module has no url',
    'shared/look/module.json: "fonts/" and "/assets/fonts/f.woff2" should both be folders or both files',
    'shared/look/module.json: a shared module has no page',
    'shared/look/module.json: only an app has a card',
    'shared/look/module.json: lang/notes.txt should be lang/<code>.json',
    '/assets/css/look.css is published by look, but assets/css/look.css is still there too',
    'modules use each other in a loop: words → look → words'
  ]) assert.ok(errors.includes(e), e + '\n' + errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith('site/bad/module.json: ')));
  write('apps/game/module.json', json({ ...GAME, uses: ['nothing', 'game'] }));
  write('shared/look/module.json', json({ name: 'look', kind: 'shared', publish: { 'look.css': '/assets/js/game.js' } }));
  const again = modules(dir).errors;
  assert.ok(again.includes('apps/game/module.json: uses nothing, which isn\'t a module'));
  assert.ok(again.includes('apps/game/module.json: uses game, which isn\'t a shared module'));
  assert.ok(again.includes('/assets/js/game.js is published by both game and look'));
  done();
});

test('modules: a module.json read again only once it changes', () => {
  const { dir, write, done } = repo();
  const first = modules(dir);
  assert.equal(modules(dir), first);
  write('shared/look/module.json', json({ name: 'look', kind: 'shared', publish: { 'look.css': '/assets/css/looks.css' } }));
  fs.utimesSync(path.join(dir, 'shared/look/module.json'), new Date(), new Date(Date.now() + 5000));
  assert.notEqual(modules(dir), first);
  assert.ok(modules(dir).published.has('assets/css/looks.css'));
  done();
});

test('pages: a moved app in its place in scripts/site.mjs, as its module.json describes it', () => {
  const { dir, done } = repo();
  const all = pages(dir, LISTED);
  assert.deepEqual(all.map((p) => p.path), ['/', '/game/']);
  assert.deepEqual(all[1], { path: '/game/', ...GAME.page, app: GAME.card, module: 'game' });
  // One the list doesn't place still has its page, at the end, and is an error.
  assert.deepEqual(pages(dir, LISTED.slice(0, 1)).map((p) => p.path), ['/', '/game/']);
  assert.deepEqual(placement(dir, LISTED.slice(0, 1)), ['scripts/site.mjs: apps/game has no place in the list']);
  assert.deepEqual(placement(dir, [...LISTED, { module: 'look' }]), ['scripts/site.mjs: look isn\'t an app or site module']);
  assert.deepEqual(pages(dir, [...LISTED, { module: 'look' }]).length, 2);
  assert.deepEqual(placement(dir, LISTED), []);
  done();
});

test('serving: a module\'s files where it publishes them, its page with its parts and its own pack', () => {
  const { dir, write, done } = repo();
  const list = pages(dir, LISTED);
  assert.deepEqual(serve(dir, 'assets/fonts/f.woff2', list), { body: Buffer.from('font'), from: ['shared/look/fonts/f.woff2', 'shared/look/module.json'], errors: [] });
  assert.equal(serve(dir, 'shared/look/fonts/f.woff2', list).body.toString(), 'font');   // its source too, as it is
  const page = serve(dir, 'game/index.html', list);
  assert.deepEqual(page.errors, []);
  assert.deepEqual(page.from, ['apps/game/index.html', 'scripts/site.mjs', 'scripts/parts.mjs', 'apps/game/module.json']);
  const html = String(page.body);
  assert.match(html, /<title>Game \| bdnix<\/title>/);
  assert.ok(html.includes(`<script src="/assets/js/lang.js?v=${stamp(serve(dir, 'assets/js/lang.js', list).body)}" data-pack="game"></script>`));
  assert.ok(html.includes(`<script src="/assets/js/game.js?v=${stamp('window.game = 1;\n')}"></script>`));
  // A page with cards or scores is made from every app's module.json too.
  assert.deepEqual(serve(dir, 'index.html', list).from, ['index.html', 'scripts/site.mjs', 'scripts/parts.mjs']);
  write('index.html', PAGE('  <!-- build:cards games -->\n  <!-- /build:cards -->'));
  assert.deepEqual(serve(dir, 'index.html', list).from, ['index.html', 'scripts/site.mjs', 'scripts/parts.mjs', 'apps/game/module.json']);
  assert.match(String(serve(dir, 'index.html', list).body), /<a class="card panel" href="\/game\/" data-keywords="game">/);
  assert.deepEqual(serve(dir, 'sitemap.xml', list).from, ['scripts/site.mjs', 'scripts/parts.mjs', 'apps/game/module.json']);
  assert.deepEqual(check(dir, list), []);
  done();
});

test('packs: the pages that haven\'t moved get assets/lang and every shared module; a module its own and its uses\'', () => {
  const { dir, write, done } = repo();
  const [xx] = languages(dir);
  assert.deepEqual(xx.files, ['assets/lang/xx/site.json', 'shared/look/lang/xx.json', 'shared/words/lang/xx.json']);
  const [own] = packs(dir);
  assert.deepEqual({ ...own, pack: undefined }, { module: 'game', code: 'xx', path: 'assets/lang/game.xx.js', files: ['apps/game/lang/xx.json', 'shared/look/lang/xx.json', 'shared/words/lang/xx.json'], pack: undefined, errors: [] });
  assert.match(own.pack, /\{\n "Hello": "Helo",\n "Look": "Luk",\n "Play": "Plai"\n\}/);
  assert.deepEqual(generated(dir), ['sitemap.xml', 'assets/lang/xx.js', 'assets/lang/game.xx.js']);
  const served = serve(dir, 'assets/lang/game.xx.js');
  assert.equal(served.body, own.pack);
  assert.deepEqual(served.from, ['apps/game/module.json', 'apps/game/lang/', 'shared/look/module.json', 'shared/look/lang/', 'shared/words/module.json', 'shared/words/lang/', 'assets/lang/xx/language.json', ...own.files]);
  assert.equal(serve(dir, 'assets/lang/nothing.xx.js'), null);
  // lang.js lists every module's pack, and the stamps of all of them.
  const [, entry] = list(dir);
  assert.deepEqual(entry, { code: 'xx', name: 'Xx', file: `/assets/lang/xx.js?v=${stamp(xx.pack)}`, packs: { game: `/assets/lang/game.xx.js?v=${stamp(own.pack)}` } });
  // Without stamps (the unit tests' load()), nothing but language.json is read.
  assert.deepEqual(list(dir, { stamps: false })[1], { code: 'xx', name: 'Xx', file: '/assets/lang/xx.js' });
  // The same English two ways in one pack is an error.
  write('apps/game/lang/xx.json', json({ Play: 'Plai', Hello: 'Halo' }));
  assert.deepEqual(packs(dir)[0].errors, ['shared/words/lang/xx.json: "Hello" is translated differently elsewhere']);
  assert.ok(check(dir, pages(dir, LISTED)).includes('shared/words/lang/xx.json: "Hello" is translated differently elsewhere'));
  done();
});

test('publishing: a module\'s files at their published paths, and its pack', () => {
  const { dir, done } = repo();
  assert.deepEqual(publishedFiles(dir, pages(dir, LISTED)), [
    'CNAME', 'LICENSE', 'assets/css/look.css', 'assets/fonts/f.woff2', 'assets/js/game.js', 'assets/js/lang.js',
    'assets/lang/game.xx.js', 'assets/lang/xx.js', 'assets/lang/xx/language.json', 'assets/lang/xx/site.json',
    'game/index.html', 'index.html', 'robots.txt', 'sitemap.xml'
  ]);
  done();
});

test('declared: a module\'s tests may use its files, its uses\' and what every page is made from', () => {
  const { dir, done } = repo();
  const game = modules(dir).byName.get('game');
  for (const f of ['apps/game/game.js', 'shared/look/look.css', 'shared/words/lang/xx.json', 'scripts/parts.mjs', 'assets/lang/', 'assets/lang/xx/language.json', 'assets/img/og.png', 'tests/ui/fixtures.mjs', 'tools/page.mjs']) {
    assert.ok(declared(dir, game, f), f);
  }
  for (const f of ['assets/lang/xx/site.json', 'assets/lang/xx/', 'assets/js/other.js', 'apps/other/x.js', 'package.json']) assert.ok(!declared(dir, game, f), f);
  // A file only checked for ('?') counts as much as one read.
  assert.deepEqual(undeclared(dir, 'apps/game/test/page.spec.mjs', ['apps/game/game.js', 'assets/js/other.js', '?apps/other/', 'assets/js/other.js', '?apps/game/']), ['?apps/other/', 'assets/js/other.js']);
  assert.deepEqual(undeclared(dir, 'tests/ui/any.spec.mjs', ['assets/js/other.js']), []);
  done();
});

test('boundaries: links, names, owners and tests, each failing and passing', () => {
  const { dir, write, done } = repo();
  assert.deepEqual(boundaries(dir), [
    'apps/game: has no test/logic.test.mjs', 'apps/game: has no test/behaviour.spec.mjs', 'apps/game: has no test/i18n.spec.mjs', 'apps/game: has no test/page.spec.mjs',
    'apps/game/test/page.spec.mjs: should call checkPage(\'/game/\', ...)', 'apps/game/test/page.spec.mjs: should call checkGame(\'/game/\', ...)',
    'apps/game/test/i18n.spec.mjs: should call checkPageLanguages(\'/game/\')', 'apps/game/test/i18n.spec.mjs: should call checkGameLanguages(\'/game/\')',
    'shared/look: has no tests in test/', 'shared/words: has no tests in test/'
  ]);
  write('apps/game/test/logic.test.mjs', '');
  write('apps/game/test/behaviour.spec.mjs', '');
  write('apps/game/test/page.spec.mjs', "checkPage('/game/', {}); checkGame('/game/', {});");
  write('apps/game/test/i18n.spec.mjs', "checkPageLanguages('/game/'); checkGameLanguages('/game/');");
  write('shared/look/test/look.spec.mjs', '');
  write('shared/words/test/words.test.mjs', '');
  assert.deepEqual(boundaries(dir), []);

  // A link to a module it doesn't use, or to a file no module publishes; and
  // a page links lang.js, so its app uses the module that publishes that.
  write('apps/game/module.json', json({ ...GAME, uses: ['look'] }));
  write('apps/game/index.html', PAGE('  <script src="/assets/js/nowhere.js"></script>\n  <script src="/assets/js/lang.js"></script>'));
  assert.deepEqual(boundaries(dir), [
    'apps/game/index.html: links /assets/js/nowhere.js, which no module publishes',
    'apps/game/index.html: links /assets/js/lang.js, from words, which game doesn\'t use',
    'apps/game/module.json: a page links lang.js, so it uses words'
  ]);
  write('apps/game/module.json', json(GAME));
  write('apps/game/index.html', PAGE());
  assert.deepEqual(boundaries(dir), []);

  // A shared module naming an app, in its code or its tests.
  write('shared/look/look.css', '.x { background: url(/assets/fonts/f.woff2) } /* see /game/ */\n');
  write('shared/words/test/words.test.mjs', "load('game.js'); localStorage.bdnix_game_best; save('game');");
  assert.deepEqual(boundaries(dir), [
    'shared/look/look.css: names the app game (/game/); a shared module is about no app',
    'shared/words/test/words.test.mjs: names the app game (\'game\'); a shared module is about no app',
    'shared/words/test/words.test.mjs: names the app game (game.js); a shared module is about no app',
    'shared/words/test/words.test.mjs: names the app game (bdnix_game_best); a shared module is about no app'
  ]);
  write('shared/look/look.css', 'a {}\n');
  write('shared/words/test/words.test.mjs', '');

  // One owner for each translation: in a module's pack, and among the
  // shared modules.
  write('apps/game/lang/xx.json', json({ Play: 'Plai', Look: 'Luk' }));
  write('shared/words/lang/xx.json', json({ Hello: 'Helo', Look: 'Luk' }));
  assert.deepEqual(boundaries(dir), [
    '"Look" is translated in both apps/game/lang/xx.json and shared/look/lang/xx.json (/assets/lang/game.xx.js): one of them owns it',
    '"Look" is translated in both apps/game/lang/xx.json and shared/words/lang/xx.json (/assets/lang/game.xx.js): one of them owns it',
    '"Look" is translated in both shared/look/lang/xx.json and shared/words/lang/xx.json (the shared modules\' lang/xx.json): one of them owns it'
  ]);
  // Words in assets/lang (the pages that haven't moved) may repeat a module's.
  write('apps/game/lang/xx.json', json({ Play: 'Plai' }));
  write('shared/words/lang/xx.json', json({ Hello: 'Helo' }));
  write('assets/lang/xx/site.json', json({ Home: 'Hom', Look: 'Luk' }));
  assert.deepEqual(boundaries(dir), []);
  done();
});

// After the UI tests, tests/ui/inputs.mjs reads the test server's log and
// fails the run if a module's spec was served a file its module doesn't
// declare.
test('inputs: a module\'s spec served an undeclared file is a problem; other specs and declared files aren\'t', async () => {
  const { servedBySpec, problems } = await import('../ui/inputs.mjs');
  const log = [
    'apps/snake/test/page.spec.mjs\tapps/snake/snake.js',
    'apps/snake/test/page.spec.mjs\tshared/sound/sound.js',
    'apps/snake/test/page.spec.mjs\tassets/js/merge.js',
    'tests/ui/merge.spec.mjs\tassets/js/merge.js',
    ''
  ].join('\n');
  assert.deepEqual([...servedBySpec(log).keys()], ['apps/snake/test/page.spec.mjs', 'tests/ui/merge.spec.mjs']);
  assert.deepEqual(problems(log), ['apps/snake/test/page.spec.mjs used assets/js/merge.js, which its module doesn\'t declare (its own files, or a module in its uses)']);
  assert.deepEqual(problems(log.replace('assets/js/merge.js\n', 'shared/base/base.css\n')), []);
});
