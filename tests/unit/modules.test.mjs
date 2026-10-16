import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, modules, relations, closure, publishMap, sourceOf, asPage, mergePages } from '../../tools/modules.mjs';

// tools/modules.mjs: every module.json in apps/, shared/ and site/, checked,
// with the graph of what uses what and where each module's files are
// published.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const json = (v) => JSON.stringify(v);
const CARD = { type: 'game', name: 'Snake', blurb: 'Eat', keywords: 'game', icon: ['<rect/>'], best: 'bdnix_snake_best' };
const PAGE = { title: 'Snake', description: 'Play Snake.', schema: 'WebApplication', category: 'GameApplication' };

test('parse: a shared module, its published files and its translations', () => {
  const m = parse('shared/sound', json({ name: 'sound', kind: 'shared', publish: { 'sound.js': '/assets/js/sound.js', 'fonts/': '/assets/fonts/' }, uses: ['base'] }), () => true, ['bn', 'xx']);
  assert.deepEqual(m.errors, []);
  assert.deepEqual(m.publish, [{ from: 'shared/sound/sound.js', to: 'assets/js/sound.js' }, { from: 'shared/sound/fonts/', to: 'assets/fonts/' }]);
  assert.deepEqual(m.uses, ['base']);
  assert.deepEqual(m.lang, { bn: 'shared/sound/lang/bn.json', xx: 'shared/sound/lang/xx.json' });
  // Only the translations that are there.
  assert.deepEqual(parse('shared/sound', json({ name: 'sound', kind: 'shared' }), (f) => !f.endsWith('xx.json'), ['bn', 'xx']).lang, { bn: 'shared/sound/lang/bn.json' });
  assert.deepEqual(parse('shared/sound', json({ name: 'sound', kind: 'shared' })).uses, []);
});

test('parse: an app module, with its page and its card', () => {
  const m = parse('apps/snake', json({ name: 'snake', kind: 'app', url: '/snake/', page: PAGE, card: CARD }));
  assert.deepEqual(m.errors, []);
  assert.equal(m.url, '/snake/');
  assert.deepEqual(asPage(m), {
    path: '/snake/', title: 'Snake', description: 'Play Snake.', module: 'snake', schema: 'WebApplication', category: 'GameApplication',
    app: { kind: 'game', name: 'Snake', blurb: 'Eat', keywords: 'game', icon: ['<rect/>'], best: 'bdnix_snake_best' }
  });
  const tool = parse('apps/x', json({ name: 'x', kind: 'app', url: '/x/', page: { ...PAGE, fullName: 'X Maker' }, card: { ...CARD, type: 'tool', best: undefined } }));
  assert.deepEqual(tool.errors, []);
  assert.equal(asPage(tool).app.fullName, 'X Maker');
  assert.equal(asPage(tool).app.best, undefined);
  const chess = asPage(parse('apps/chess', json({ name: 'chess', kind: 'app', url: '/chess/', page: PAGE, card: { ...CARD, bestLabel: 'Level' } })));
  assert.equal(chess.app.bestLabel, 'Level');
  const me = parse('site/profile', json({ name: 'profile', kind: 'site', url: '/profile/', page: { title: 'Me', description: 'Mine.', noindex: true } }));
  assert.deepEqual(me.errors, []);
  assert.deepEqual(asPage(me), { path: '/profile/', title: 'Me', description: 'Mine.', module: 'profile', noindex: true });
});

test('parse: what a module.json gets wrong', () => {
  const errors = (dir, v, exists) => parse(dir, typeof v === 'string' ? v : json(v), exists).errors;
  assert.match(errors('shared/x', '{ nope')[0], /^shared\/x\/module\.json: not JSON/);
  assert.deepEqual(errors('shared/x', '[]'), ['shared/x/module.json: not an object']);
  assert.deepEqual(errors('shared/x', { name: 'y', kind: 'app', url: '/' }), [
    'shared/x/module.json: name should be "x", its folder\'s name',
    'shared/x/module.json: kind should be "shared", since it\'s in shared/',
    'shared/x/module.json: unknown key "url"'
  ]);
  assert.deepEqual(errors('shared/x', { name: 'x', kind: 'shared', publish: { '/abs.js': '/a.js', 'a.js': 'no-slash.js', 'b/': '/b.js', 'c.js': '/../c.js', 'gone.js': '/gone.js' }, uses: 'base' }, (f) => !f.endsWith('gone.js')), [
    'shared/x/module.json: publish "/abs.js": "/a.js" should map a file to a path from the site\'s root (a folder, ending in /, to a folder)',
    'shared/x/module.json: publish "a.js": "no-slash.js" should map a file to a path from the site\'s root (a folder, ending in /, to a folder)',
    'shared/x/module.json: publish "b/": "/b.js" should map a file to a path from the site\'s root (a folder, ending in /, to a folder)',
    'shared/x/module.json: publish "c.js": "/../c.js" should map a file to a path from the site\'s root (a folder, ending in /, to a folder)',
    'shared/x/module.json: publish "gone.js" doesn\'t exist',
    'shared/x/module.json: uses should be a list of shared modules\' names'
  ]);
  assert.deepEqual(errors('shared/x', { name: 'x', kind: 'shared', publish: [] }), ['shared/x/module.json: publish should map files to the paths they\'re published at']);
  assert.deepEqual(errors('apps/x', { name: 'x', kind: 'app', url: 'x' }, (f) => !f.endsWith('index.html')), [
    'apps/x/module.json: url should be the page\'s path, such as "/snake/"',
    'apps/x/module.json: an app module\'s page is its index.html, which is missing',
    'apps/x/module.json: page should hold the page\'s title and description',
    'apps/x/module.json: card should hold the landing page\'s card for the app'
  ]);
  assert.deepEqual(errors('apps/x', { name: 'x', kind: 'app', url: '/x/', page: { title: 'X', colour: 'red' }, card: { type: 'game', name: 'X', size: 2 } }), [
    'apps/x/module.json: unknown page key "colour"',
    'apps/x/module.json: page needs a title and a description',
    'apps/x/module.json: unknown card key "size"',
    'apps/x/module.json: card needs a name, a blurb, keywords and an icon',
    'apps/x/module.json: a game\'s card needs the key of its best score, bdnix_<game>_best'
  ]);
  assert.deepEqual(errors('apps/x', { name: 'x', kind: 'app', url: '/x/', page: PAGE, card: { ...CARD, type: 'toy' } }), ['apps/x/module.json: card type should be "game" or "tool"']);
});

test('relations and closure: what a module uses, directly and through others', () => {
  const m = (name, uses, kind = 'shared') => ({ name, kind, dir: `${kind === 'shared' ? 'shared' : 'apps'}/${name}`, uses });
  const list = [m('base', []), m('shell', ['base']), m('sound', ['shell']), m('snake', ['sound', 'base'], 'app')];
  assert.deepEqual(relations(list), []);
  assert.deepEqual(closure(list, 'snake'), ['base', 'shell', 'snake', 'sound']);
  assert.deepEqual(closure(list, 'base'), ['base']);
  assert.deepEqual(relations([...list, m('bad', ['nothing', 'snake'])]), [
    'shared/bad/module.json: uses "nothing", which isn\'t a shared module',
    'shared/bad/module.json: uses "snake", which isn\'t a shared module'
  ]);
  assert.deepEqual(relations([m('me', ['me'])]), ['shared/me/module.json: uses itself', 'shared/me/module.json: uses itself through me']);
  assert.deepEqual(relations([m('a', ['b']), m('b', ['a'])]), ['shared/a/module.json: uses itself through b', 'shared/b/module.json: uses itself through a']);
});

test('mergePages: each { module } in the list is that module\'s page, in its place', () => {
  const snake = parse('apps/snake', json({ name: 'snake', kind: 'app', url: '/snake/', page: PAGE, card: CARD }));
  const sound = parse('shared/sound', json({ name: 'sound', kind: 'shared' }));
  const site = [{ path: '/' }, { module: 'snake' }, { path: '/flap/' }];
  assert.deepEqual(mergePages(site, [snake, sound]), { pages: [{ path: '/' }, asPage(snake), { path: '/flap/' }], errors: [] });
  assert.deepEqual(mergePages([{ path: '/' }, { module: 'sound' }], [snake, sound]), { pages: [{ path: '/' }], errors: [
    'scripts/site.mjs: { module: \'sound\' } isn\'t an app or site module',
    'scripts/site.mjs: no { module: \'snake\' } to say where snake\'s page goes'
  ] });
});

// A small repository of its own.
function repo(files){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-modules-'));
  for (const [f, s] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), typeof s === 'string' ? s : json(s));
  }
  return { dir, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('modules: every module.json in apps/, shared/ and site/, and where their files are published', () => {
  const { dir, done } = repo({
    'assets/lang/bn/language.json': { name: 'Bn' },
    'shared/base/module.json': { name: 'base', kind: 'shared', publish: { 'base.css': '/assets/css/base.css', 'fonts/': '/assets/fonts/' } },
    'shared/base/base.css': '',
    'shared/base/fonts/a.woff2': '',
    'shared/base/fonts/b/c.woff2': '',
    'shared/base/fonts/.hidden': '',
    'shared/base/lang/bn.json': {},
    'shared/notes/README.md': 'not a module',
    'apps/snake/module.json': { name: 'snake', kind: 'app', url: '/snake/', uses: ['base'], page: PAGE, card: CARD, publish: { 'snake.js': '/assets/js/snake.js' } },
    'apps/snake/index.html': '',
    'apps/snake/snake.js': ''
  });
  const { list, errors } = modules(dir);
  assert.deepEqual(errors, []);
  assert.deepEqual(list.map((m) => m.dir), ['apps/snake', 'shared/base']);
  assert.deepEqual(list.find((m) => m.name === 'base').lang, { bn: 'shared/base/lang/bn.json' });
  assert.deepEqual([...publishMap(dir, list)], [
    ['assets/css/base.css', 'shared/base/base.css'],
    ['assets/fonts/a.woff2', 'shared/base/fonts/a.woff2'],
    ['assets/fonts/b/c.woff2', 'shared/base/fonts/b/c.woff2'],
    ['assets/js/snake.js', 'apps/snake/snake.js'],
    ['snake/index.html', 'apps/snake/index.html']
  ]);
  assert.deepEqual(sourceOf(dir, 'assets/css/base.css', list), { file: 'shared/base/base.css', from: ['shared/base/module.json'] });
  assert.deepEqual(sourceOf(dir, 'assets/css/other.css', list), { file: 'assets/css/other.css', from: [] });
  assert.deepEqual(sourceOf(dir, 'snake/index.html'), { file: 'apps/snake/index.html', from: ['apps/snake/module.json'] });
  done();
});

test('modules: two modules publishing one path, a path that\'s a file of its own, or two pages at one URL', () => {
  const { dir, done } = repo({
    'shared/a/module.json': { name: 'a', kind: 'shared', publish: { 'x.js': '/assets/js/x.js' } },
    'shared/a/x.js': '',
    'shared/b/module.json': { name: 'b', kind: 'shared', publish: { 'x.js': '/assets/js/x.js', 'y.js': '/assets/js/y.js' }, uses: ['a', 'c'] },
    'shared/b/x.js': '',
    'shared/b/y.js': '',
    'assets/js/y.js': 'still here',
    'site/home/module.json': { name: 'home', kind: 'site', url: '/', page: PAGE },
    'site/home/index.html': '',
    'site/also/module.json': { name: 'also', kind: 'site', url: '/', page: PAGE },
    'site/also/index.html': ''
  });
  assert.deepEqual(modules(dir).errors, [
    'shared/b/module.json: uses "c", which isn\'t a shared module',
    '/assets/js/x.js is published by both shared/a/x.js and shared/b/x.js',
    'shared/b/y.js is published at /assets/js/y.js, which is also a file of its own',
    '/index.html is published by both site/also/index.html and site/home/index.html',
    'site/home/module.json: url / is also site/also\'s'
  ]);
  done();
});

// The site's own modules.
test('site: the shared modules make sense, and publish every file they hold at the URL it always had', () => {
  const { list, errors } = modules(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(list.filter((m) => m.kind === 'shared').map((m) => m.name),
    ['analytics', 'backdrop', 'base', 'game-shell', 'gamepad', 'gamesave', 'lang', 'sound', 'upright']);
  const map = publishMap(root, list);
  assert.equal(map.get('assets/js/sound.js'), 'shared/sound/sound.js');
  assert.equal(map.get('assets/css/base.css'), 'shared/base/base.css');
  assert.equal(map.get('assets/fonts/inter-latin-400-normal.woff2'), 'shared/base/fonts/inter-latin-400-normal.woff2');
  // Every file in a module is published, but its module.json, its
  // translations and its tests.
  const published = new Set(map.values());
  const walk = (rel) => fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${rel}/${e.name}`) : [`${rel}/${e.name}`]));
  for (const m of list) {
    for (const f of walk(m.dir)) {
      if (/\/(module\.json|lang\/[a-z]+\.json|test\/[^/]+)$/.test(f.slice(m.dir.length))) continue;
      assert.ok(published.has(f), `${f} isn't published`);
    }
  }
});
