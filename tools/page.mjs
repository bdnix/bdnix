// What the site serves at each path, made from the source tree. `npm run
// build` (tools/site.mjs) writes it to _site/, and the test server
// (tests/server.mjs) answers every request with it, so the tests see exactly
// what visitors get.
//
// A file is served from the module that publishes it there (module.json's
// publish, tools/modules.mjs), or else from the same path in the repository
// (the site's images, its root files).
//
// Source files carry nothing generated. A page keeps its markers with
// nothing between them, and links the site's own scripts and styles as
// /assets/js/x.js and /assets/css/x.css. Here, from the site's pages (each
// app and site module's module.json) and scripts/parts.mjs, a page gets:
//   - its head tags (<!-- build:meta -->), the footer (<!-- build:footer -->),
//     the landing page's cards (<!-- build:cards games|tools -->) and the
//     profile page's scores (<!-- build:scores -->);
//   - ?v=<hash> on every link to one of the site's own scripts or styles: a
//     hash of what's served there, so its URL changes exactly when it does
//     and browsers never keep a stale copy. Vendored libraries keep their
//     version number as ?v=, written by hand.
// sitemap.xml is made from the pages, and lang.js and the language packs by
// tools/languages.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { meta, footer, cards, scores, fill, sitemap } from '../scripts/parts.mjs';
import { languages, packs, packPaths, about, serveLanguage, stamp } from './languages.mjs';
import { modules, pages as sitePagesOf } from './modules.mjs';

// What a page's generated parts are made from.
export const PARTS = ['scripts/parts.mjs'];
// The site's pages, from the modules (tools/modules.mjs).
export const sitePages = (root) => sitePagesOf(root);

// A page with its generated parts filled in and its links stamped.
// { html, errors }; stampOf(rel) is the ?v= stamp of what's served at rel.
export function transformPage(rel, html, stampOf, list){
  const errors = [];
  const route = '/' + path.posix.dirname(rel).replace(/^\.$/, '') + '/';
  const entry = list.find((p) => p.path === route.replace('//', '/'));
  let next = html;
  if (entry) next = fill(next, 'meta', () => meta(entry));
  else if (next.includes('<!-- build:meta')) errors.push(`${rel}: no module.json describes this page`);
  next = fill(next, 'footer', footer);
  next = fill(next, 'cards', (kind) => cards(list, kind));
  next = fill(next, 'scores', () => scores(list));
  next = next.replace(/\/assets\/(js|css)\/([\w-]+)\.(js|css)(?=["'])/g, (match) => {
    const v = stampOf(match.slice(1));
    if (v === null) { errors.push(`${rel}: ${match} doesn't exist`); return match; }
    return `${match}?v=${v}`;
  });
  return { html: next, errors };
}

// What's served at a published path (no leading slash): { body, from,
// errors }, or null if nothing is. body is a string or a Buffer; from lists
// the repository files it was made from (a folder, ending in '/', counts as
// its list of names). A page's from is the page and what its parts come
// from, not the files behind its ?v= stamps: those are fetched in their own
// right by whatever uses them. A file from a module also comes from its
// module.json, which says where it's published.
export function serve(root, rel, list = sitePages(root)){
  if (rel === 'sitemap.xml') return { body: sitemap(list), from: [...PARTS, ...appModules(root)], errors: [] };
  const mod = modules(root).published.get(rel);
  const source = mod ? mod.source : rel;
  const owner = mod ? [`${modules(root).byName.get(mod.module).dir}/module.json`] : [];
  const lang = serveLanguage(root, rel, source);
  if (lang) return { ...lang, from: [...new Set([...lang.from, ...owner])] };
  const file = path.join(root, source);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  if (mod && rel.endsWith('.html')) {
    const html = fs.readFileSync(file, 'utf8');
    const { html: body, errors } = transformPage(rel, html, (dep) => {
      const served = dep === rel ? null : serve(root, dep, list);
      return served ? stamp(served.body) : null;
    }, list);
    // The landing page's cards and the profile page's scores come from every app.
    const all = /<!-- build:(cards|scores)/.test(html) ? appModules(root) : [];
    return { body, from: [...new Set([source, ...PARTS, ...owner, ...all])], errors };
  }
  return { body: fs.readFileSync(file), from: [source, ...owner], errors: [] };
}

// The module.json of every app and site module.
const appModules = (root) => modules(root).list.filter((m) => m.kind !== 'shared').map((m) => `${m.dir}/module.json`);

// The files only the build makes, as paths they're served at.
// Reads no translations, only which languages and modules there are.
export const generated = (root) => ['sitemap.xml', ...about(root).map((l) => `assets/lang/${l.code}.js`), ...packPaths(root)];

// What's wrong with the pages and the modules: a module that's wrong, a page
// without its file or its build:meta markers, or a pack with a string
// translated two ways.
export function check(root, given){
  const list = given || sitePages(root);
  const errors = [...modules(root).errors];
  const published = modules(root).published;
  for (const p of list) {
    const rel = path.posix.join(p.path.slice(1), 'index.html');
    const from = published.get(rel);
    const file = path.join(root, from ? from.source : rel);
    if (!fs.existsSync(file)) errors.push(`${p.path} has no index.html`);
    else if (!fs.readFileSync(file, 'utf8').includes('<!-- build:meta -->')) errors.push(`${from ? from.source : rel}: no <!-- build:meta --> markers`);
  }
  for (const l of languages(root)) errors.push(...l.errors);
  for (const p of packs(root)) errors.push(...p.errors);
  return [...new Set(errors)];
}

// The content type of each kind of file the site serves.
export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// The whole answer to a request for a URL's path (its query ignored, as
// GitHub Pages ignores ?v=): { status, type, body, from, errors }. A folder
// answers with its index.html, whether it's in the repository or a module
// publishes it. The test server answers every request with this, and the UI
// result cache (scripts/ui-cache.mjs) asks it again to see whether what a
// spec was served has changed, so the two can't differ.
export function respond(root, urlPath, list){
  const url = decodeURIComponent(urlPath.split('?')[0]);
  const file = path.join(root, url);
  if (!file.startsWith(root)) return { status: 403, type: 'text/plain', body: '', from: [], errors: [] };
  let rel = path.relative(root, file).split(path.sep).join('/');
  if (url.endsWith('/') || (fs.existsSync(file) && fs.statSync(file).isDirectory())) rel = path.posix.join(rel, 'index.html');
  const pages = list || sitePages(root);
  let served = serve(root, rel, pages);
  const page = !served && !rel.endsWith('.html') && serve(root, rel + '/index.html', pages);
  if (page) { served = page; rel += '/index.html'; }
  if (!served) return { status: 404, type: 'text/plain', body: 'Not found', from: [rel], errors: [] };
  if (served.errors.length) return { status: 500, type: 'text/plain', body: served.errors.join('\n'), from: served.from, errors: served.errors };
  return { status: 200, type: TYPES[path.extname(rel)] || 'application/octet-stream', body: served.body, from: served.from, errors: [] };
}
