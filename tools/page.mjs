// What the site serves at each path, made from the source tree. `npm run
// build` (tools/site.mjs) writes it to _site/, and the test server
// (tests/server.mjs) answers every request with it, so the tests see exactly
// what visitors get.
//
// A file is served from the module that publishes it there (module.json's
// publish, tools/modules.mjs), or else from the same path in the repository,
// where the pages that haven't moved into modules still are.
//
// Source files carry nothing generated. A page keeps its markers with
// nothing between them, and links the site's own scripts and styles as
// /assets/js/x.js and /assets/css/x.css. Here, from the site's pages
// (scripts/site.mjs and the modules) and scripts/parts.mjs, a page gets:
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
import { pages as listed } from '../scripts/site.mjs';
import { meta, footer, cards, scores, fill, sitemap } from '../scripts/parts.mjs';
import { languages, packs, serveLanguage, stamp } from './languages.mjs';
import { modules, pages as merged, placement } from './modules.mjs';

// What a page's generated parts are made from.
export const PARTS = ['scripts/site.mjs', 'scripts/parts.mjs'];
// Folders that hold no pages: tooling, the site's assets and the modules
// (whose pages are served where they're published).
const NOT_PAGES = new Set(['node_modules', 'tests', 'scripts', 'tools', 'assets', 'coverage', 'docs', '_site', 'apps', 'shared', 'site']);

// Is this repository path a page (an .html file outside NOT_PAGES)?
export const isPage = (rel) => rel.endsWith('.html') && !NOT_PAGES.has(rel.split('/')[0]) && !rel.split('/').some((p) => p.startsWith('.'));

// The site's pages: scripts/site.mjs's list with the modules' pages in it.
export const sitePages = (root) => merged(root, listed);

// A page with its generated parts filled in and its links stamped.
// { html, errors }; stampOf(rel) is the ?v= stamp of what's served at rel.
export function transformPage(rel, html, stampOf, list){
  const errors = [];
  const route = '/' + path.posix.dirname(rel).replace(/^\.$/, '') + '/';
  const entry = list.find((p) => p.path === route.replace('//', '/'));
  let next = html;
  if (entry) next = fill(next, 'meta', () => meta(entry));
  else if (next.includes('<!-- build:meta')) errors.push(`${rel}: not in scripts/site.mjs`);
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
  if (mod ? rel.endsWith('.html') : isPage(rel)) {
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
export const generated = (root) => ['sitemap.xml', ...languages(root).map((l) => `assets/lang/${l.code}.js`), ...packs(root).map((p) => p.path)];

// What's wrong with how the pages, the modules and scripts/site.mjs fit
// together: a page in the list without its file or its build:meta markers, a
// page with markers that isn't in the list, a module that's wrong or out of
// place, or a language with a string translated two ways.
// With no list given, the site's own, whose places for modules are checked too.
export function check(root, given){
  const list = given || sitePages(root);
  const errors = [...modules(root).errors, ...(given ? [] : placement(root, listed))];
  const folders = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const rel of ['index.html', ...folders.map((d) => `${d}/index.html`)]) {
    if (!isPage(rel) || !fs.existsSync(path.join(root, rel))) continue;
    const route = rel === 'index.html' ? '/' : `/${path.posix.dirname(rel)}/`;
    if (!list.some((p) => p.path === route) && fs.readFileSync(path.join(root, rel), 'utf8').includes('<!-- build:meta')) errors.push(`${rel}: not in scripts/site.mjs`);
  }
  const published = modules(root).published;
  for (const p of list) {
    const rel = path.posix.join(p.path.slice(1), 'index.html');
    const from = published.get(rel);
    const file = path.join(root, from ? from.source : rel);
    if (!fs.existsSync(file)) errors.push(`scripts/site.mjs: ${p.path} has no index.html`);
    else if (!fs.readFileSync(file, 'utf8').includes('<!-- build:meta -->')) errors.push(`${from ? from.source : rel}: no <!-- build:meta --> markers`);
  }
  for (const l of languages(root)) errors.push(...l.errors);
  for (const p of packs(root)) errors.push(...p.errors);
  return [...new Set(errors)];
}
