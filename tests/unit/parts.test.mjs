import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { schema, meta, footer, cards, scores, fill, sitemap, esc, CSP, SITE } from '../../scripts/parts.mjs';
import { sitePages } from '../../tools/page.mjs';

// scripts/parts.mjs turns the site's pages (each module's module.json, in the
// landing page's order) into the parts of the pages that tools/page.mjs fills
// in. What a module's page and card fields must be is tools/boundaries.mjs's.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pages = sitePages(root);
const apps = pages.filter((p) => p.app);

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
  // lang.js last, so the visitor's language is known before any of the
  // page's own scripts (analytics.js among them) runs.
  assert.deepEqual(tags.slice(-4), [
    '<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
    '<meta name="theme-color" content="#080a12">',
    '<script src="/assets/js/lang.js"></script>'
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

test('meta: the share image\'s alt text is the same on every page and says what the image is', () => {
  const alts = pages.map((p) => meta(p).find((l) => l.includes('og:image:alt')));
  assert.equal(new Set(alts).size, 1);
  assert.equal(alts[0], '<meta property="og:image:alt" content="The bdnix logo and headline">');
});

test('cards and scores follow the order of the list', () => {
  const html = cards(pages, 'games').join('\n');
  const hrefs = [...html.matchAll(/<a class="card panel" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, apps.filter((p) => p.app.kind === 'game').map((p) => p.path));
  const tools = [...cards(pages, 'tools').join('\n').matchAll(/<a class="card panel" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tools, apps.filter((p) => p.app.kind === 'tool').map((p) => p.path));
  assert.ok(tools.length > 0);
  assert.deepEqual(cards(pages, 'nothing'), []);
  const rows = scores(pages).filter((l) => l.startsWith('<div class="score panel"'));
  assert.deepEqual(rows.map((l) => l.match(/data-best="([^"]+)"/)[1]),
    ['bdnix_tetris_best', 'bdnix_pacman_best', 'bdnix_flappy_best', 'bdnix_hop_best', 'bdnix_snake_best', 'bdnix_bricks_best', 'bdnix_kingofstreets_best', 'bdnix_chess_best']);
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
  assert.match(footer().join('\n'), /<a href="\/about\/">About<\/a>/);
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
