import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, pages } from '../../scripts/site.mjs';
import { schema, meta, footer, cards, scores, fill, sitemap, esc, CSP } from '../../scripts/parts.mjs';

// scripts/site.mjs lists every page; scripts/parts.mjs turns it into the
// parts of the pages that scripts/build.mjs writes.
const apps = pages.filter((p) => p.app);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('site: every page once, each with a title and description', () => {
  const paths = pages.map((p) => p.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths[0], '/');
  for (const p of pages) {
    assert.match(p.path, /^\/([a-z0-9-]+\/)?$/, p.path);
    assert.ok(p.title && p.description, p.path);
    // Our own names only: other games' trademarks stay out of titles and tags.
    assert.doesNotMatch(p.title + p.description, /Tetris|Pac-Man|Flappy|Crossy|Breakout|Blockade/, p.path);
  }
});

test('site: every game and tool has a card, and every game a best-score key', () => {
  for (const p of apps) {
    assert.ok(['game', 'tool'].includes(p.app.kind), p.path);
    assert.ok(p.app.name && p.app.blurb && p.app.keywords, p.path);
    assert.ok(p.app.icon.length > 0 && p.app.icon.every((l) => /^<(rect|circle|ellipse|path)\b[^>]*\/>$/.test(l)), p.path);
    assert.equal(p.schema, 'WebApplication', p.path);
    if (p.app.kind === 'game') assert.match(p.app.best, /^bdnix_[a-z]+_best$/, p.path);
    else assert.equal(p.app.best, undefined, p.path);
  }
  assert.equal(apps.filter((p) => p.app.kind === 'game').length, 7);
  assert.equal(apps.filter((p) => p.app.kind === 'tool').length, 9);
});

test('meta: title, description, canonical URL, share tags and structured data', () => {
  const p = { path: '/x/', title: 'X & Y — "fun" | bdnix', description: 'Plays <well>.', schema: 'WebApplication', category: 'GameApplication', app: { name: 'X' } };
  const tags = meta(p);
  assert.equal(tags[0], `<meta http-equiv="Content-Security-Policy" content="${CSP}">`);   // first, before anything loads
  assert.equal(tags[1], '<title>X &amp; Y — &quot;fun&quot; | bdnix</title>');
  assert.ok(tags.includes('<meta name="description" content="Plays &lt;well&gt;.">'));
  assert.ok(tags.includes(`<link rel="canonical" href="${SITE}/x/">`));
  assert.ok(tags.includes(`<meta property="og:url" content="${SITE}/x/">`));
  assert.ok(!tags.some((t) => t.includes('noindex')));
  const open = '<script type="application/ld+json">', close = '</script>';
  const ld = tags.find((t) => t.startsWith(open));
  assert.ok(ld.endsWith(close));
  assert.deepEqual(JSON.parse(ld.slice(open.length, -close.length)), schema(p));
  assert.equal(schema(p).description, 'Plays <well>.');
  assert.deepEqual(tags.slice(-3), [
    '<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
    '<meta name="theme-color" content="#080a12">'
  ]);
});

test('meta: a noindex page has no structured data; the landing page is a WebSite', () => {
  const tags = meta({ path: '/me/', title: 'Me', description: 'Mine.', noindex: true });
  assert.ok(tags.includes('<meta name="robots" content="noindex">'));
  assert.ok(!tags.some((t) => t.includes('ld+json')));
  assert.deepEqual(schema(pages[0]), { '@context': 'https://schema.org', '@type': 'WebSite', name: 'bdnix', url: SITE + '/', description: pages[0].description });
  const collage = pages.find((p) => p.path === '/photo-collage/');
  assert.equal(schema(collage).name, 'Photo Collage Maker');         // fullName, where given
  assert.equal(schema(pages.find((p) => p.path === '/snake/')).name, 'Snake');
});

test('cards and scores follow the order of the list', () => {
  const html = cards(pages, 'games').join('\n');
  const hrefs = [...html.matchAll(/<a class="card panel" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, apps.filter((p) => p.app.kind === 'game').map((p) => p.path));
  assert.equal(cards(pages, 'tools').filter((l) => l.startsWith('<a ')).length, 9);
  assert.deepEqual(cards(pages, 'nothing'), []);
  const rows = scores(pages).filter((l) => l.startsWith('<div class="score panel"'));
  assert.deepEqual(rows.map((l) => l.match(/data-best="([^"]+)"/)[1]),
    ['bdnix_tetris_best', 'bdnix_pacman_best', 'bdnix_flappy_best', 'bdnix_hop_best', 'bdnix_snake_best', 'bdnix_bricks_best', 'bdnix_chess_best']);
  // Only a game with a label for its best score says it.
  assert.deepEqual(rows.filter((l) => l.includes('data-best-label')), ['<div class="score panel" data-best="bdnix_chess_best" data-best-label="Level">']);
});

test('fill: replaces what is between the markers, indented like them, and nothing else', () => {
  const html = '<main>\n    <!-- build:cards games -->\n    old\n    <!-- /build:cards -->\n    <!-- build:cards tools -->\n    <!-- /build:cards -->\n</main>';
  const out = fill(html, 'cards', (list) => [list, '  ' + list.toUpperCase()]);
  assert.equal(out, '<main>\n    <!-- build:cards games -->\n    games\n      GAMES\n    <!-- /build:cards -->\n    <!-- build:cards tools -->\n    tools\n      TOOLS\n    <!-- /build:cards -->\n</main>');
  assert.equal(fill(out, 'cards', (list) => [list, '  ' + list.toUpperCase()]), out);   // stable
  assert.equal(fill('<p>no markers</p>', 'footer', footer), '<p>no markers</p>');
});

test('the footer and sitemap', () => {
  assert.equal(footer()[0], '<footer class="foot">');
  const xml = sitemap(pages);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, pages.filter((p) => !p.noindex).map((p) => SITE + p.path));
  assert.ok(!locs.includes(SITE + '/profile/'));
  assert.equal(esc('a&b<c>"d"'), 'a&amp;b&lt;c&gt;&quot;d&quot;');
});

test('the content security policy: the site\'s own files, Google Analytics, nothing inline', () => {
  const rules = Object.fromEntries(CSP.split('; ').map((r) => { const [k, ...v] = r.split(' '); return [k, v]; }));
  assert.deepEqual(rules['default-src'], ["'self'"]);
  assert.deepEqual(rules['object-src'], ["'none'"]);
  assert.deepEqual(rules['script-src'], ["'self'", "'wasm-unsafe-eval'", 'https://www.googletagmanager.com']);
  // The fonts are the site's own (assets/fonts), so no font service.
  assert.deepEqual(rules['style-src'], ["'self'"]);
  assert.deepEqual(rules['font-src'], ["'self'", 'data:']);
  for (const [k, v] of Object.entries(rules)) {
    assert.ok(!v.includes("'unsafe-inline'") && !v.includes("'unsafe-eval'"), k);
    assert.ok(!v.includes('*') && !v.includes('https:'), k);        // no wide-open sources
  }
  assert.ok(!CSP.includes('"'));                                     // safe inside content="..."
});

test('site: titles and descriptions are unique, and short enough for search results', () => {
  assert.equal(new Set(pages.map((p) => p.title)).size, pages.length);
  assert.equal(new Set(pages.map((p) => p.description)).size, pages.length);
  for (const p of pages) {
    assert.ok(p.title.length <= 60, p.path);
    assert.ok(p.description.length <= 230, p.path);
    if (!p.noindex) assert.ok(p.description.length >= 70, p.path);
  }
});

test('site: sitemap.xml lists exactly the public pages', () => {
  assert.equal(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'), sitemap(pages));
});

// Every page runs the checks every page gets (checkPage in tests/ui/checks.mjs),
// and every game the checks every game gets (checkGame), from its own
// tests/ui/<app>.site.spec.mjs. There are no lists of pages to keep up to
// date in the shared specs, so adding an app only runs its own tests.
test('site: every page has its own site spec, which runs the shared checks for it', () => {
  const dir = path.join(root, 'tests/ui');
  const specs = fs.readdirSync(dir).filter((f) => f.endsWith('.site.spec.mjs'))
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
  const calls = (fn) => specs.flatMap((s) => [...s.text.matchAll(new RegExp(`\\b${fn}\\('([^']*)'`, 'g'))].map((m) => [m[1], s.file]));
  const pageChecks = calls('checkPage'), gameChecks = calls('checkGame');
  for (const p of pages) {
    const own = pageChecks.filter(([url]) => url === p.path);
    assert.equal(own.length, 1, `${p.path}: one checkPage() in a tests/ui/*.site.spec.mjs`);
    const games = gameChecks.filter(([url]) => url === p.path);
    assert.equal(games.length, p.app && p.app.kind === 'game' ? 1 : 0, `${p.path}: checkGame() for a game only`);
    if (games.length) assert.equal(games[0][1], own[0][1], `${p.path}: both in the same spec`);
  }
  // Nothing checked that isn't a page, and one page per site spec.
  for (const [url, file] of pageChecks) assert.ok(pages.some((p) => p.path === url), `${file}: ${url} isn't in scripts/site.mjs`);
  assert.equal(new Set(pageChecks.map(([, file]) => file)).size, pageChecks.length);
});
