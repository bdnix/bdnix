// What the site serves at each path, made from the source tree. `npm run
// build` (tools/site.mjs) writes it to _site/, and the test server
// (tests/server.mjs) answers every request with it, so the tests see exactly
// what visitors get.
//
// Source files carry nothing generated. A page keeps its markers with
// nothing between them, and links the site's own scripts and styles as
// /assets/js/x.js and /assets/css/x.css. Here, from scripts/site.mjs and
// scripts/parts.mjs, a page gets:
//   - its head tags (<!-- build:meta -->), the footer (<!-- build:footer -->),
//     the landing page's cards (<!-- build:cards games|tools -->) and the
//     profile page's scores (<!-- build:scores -->);
//   - ?v=<hash> on every link to one of the site's own scripts or styles: a
//     hash of what's served there, so its URL changes exactly when it does
//     and browsers never keep a stale copy. Vendored libraries keep their
//     version number as ?v=, written by hand.
// sitemap.xml is made from scripts/site.mjs, and lang.js and the language
// packs by tools/languages.mjs. The pages are those in scripts/site.mjs and
// those of app and site modules, merged (tools/modules.mjs), and a module's
// files are served at the paths its module.json publishes them at.
import fs from 'node:fs';
import path from 'node:path';
import { pages as site } from '../scripts/site.mjs';
import { meta, footer, cards, scores, fill, sitemap } from '../scripts/parts.mjs';
import { languages, serveLanguage, stamp, packTemplate, pagePackPaths } from './languages.mjs';
import { modules, mergePages, publishMap, sourceOf } from './modules.mjs';

// What a page's generated parts are made from.
export const PARTS = ['scripts/site.mjs', 'scripts/parts.mjs'];

// The modules, and the pages: scripts/site.mjs's list (or another, for a
// test) with the modules' pages merged in. { mods, pages, errors }.
export function context(root, list = site){
  const { list: mods, errors } = modules(root);
  const merged = mergePages(list, mods);
  return { mods, pages: merged.pages, errors: [...errors, ...merged.errors] };
}
const ctxOf = (root, list) => (list && list.mods ? list : context(root, list || site));
// Folders that hold no pages: tooling, the site's assets and shared modules.
const NOT_PAGES = new Set(['node_modules', 'tests', 'scripts', 'tools', 'assets', 'shared', 'coverage', 'docs', '_site']);

// Is this repository path a page (an .html file outside NOT_PAGES)?
export const isPage = (rel) => rel.endsWith('.html') && !NOT_PAGES.has(rel.split('/')[0]) && !rel.split('/').some((p) => p.startsWith('.'));

// A page with its generated parts filled in and its links stamped.
// { html, errors }; stampOf(rel) is the ?v= stamp of what's served at rel,
// and packOf(entry) where a module's page finds its language packs.
export function transformPage(rel, html, stampOf, list = site, packOf = () => null){
  const errors = [];
  const route = '/' + path.posix.dirname(rel).replace(/^\.$/, '') + '/';
  const entry = list.find((p) => p.path === route.replace('//', '/'));
  let next = html;
  if (entry) {
    const pack = packOf(entry);
    next = fill(next, 'meta', () => meta(entry).map((tag) => (pack && tag === '<script src="/assets/js/lang.js"></script>'
      ? `<script src="/assets/js/lang.js" data-pack="${pack}"></script>` : tag)));
  }
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

// What's served at a repository path (no leading slash): { body, from,
// errors }, or null if nothing is. body is a string or a Buffer; from lists
// the repository files it was made from (a folder, ending in '/', counts as
// its list of names). A page's from is the page and what its parts come
// from, not the files behind its ?v= stamps: those are fetched in their own
// right by whatever uses them.
// A file published by a module is served from the module's folder, and
// counts its module.json among what it's made from. list is a list of pages
// as scripts/site.mjs has them, or a context().
export function serve(root, rel, list = site){
  const ctx = ctxOf(root, list);
  if (rel === 'sitemap.xml') return { body: sitemap(ctx.pages), from: PARTS, errors: [] };
  const lang = serveLanguage(root, rel, ctx.mods);
  if (lang) return lang;
  const src = sourceOf(root, rel, ctx.mods);
  const file = path.join(root, src.file);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  if (isPage(rel)) {
    const { html, errors } = transformPage(rel, fs.readFileSync(file, 'utf8'), (dep) => {
      const served = dep === rel ? null : serve(root, dep, ctx);
      return served ? stamp(served.body) : null;
    }, ctx.pages, (entry) => (entry.module ? packTemplate(root, ctx.mods, entry.module) : null));
    return { body: html, from: [src.file, ...src.from, ...PARTS], errors };
  }
  return { body: fs.readFileSync(file), from: [src.file, ...src.from], errors: [] };
}

// The files only the build makes, as paths they're served at.
export const generated = (root, ctx = context(root)) => ['sitemap.xml', ...languages(root, ctx.mods).map((l) => `assets/lang/${l.code}.js`), ...pagePackPaths(root, ctx.mods)];

// Every file the modules publish, as paths they're served at.
export const modulePaths = (root, ctx = context(root)) => [...publishMap(root, ctx.mods).keys()];

// What's wrong with how the pages, the modules and scripts/site.mjs fit
// together: a module.json that doesn't make sense, a page in the list
// without its file or its build:meta markers, a page with markers that
// isn't in the list, or a language with a string translated two ways.
export function check(root, list = site){
  const ctx = ctxOf(root, list);
  const errors = [...ctx.errors];
  const folders = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const rel of ['index.html', ...folders.map((d) => `${d}/index.html`)]) {
    if (!isPage(rel) || !fs.existsSync(path.join(root, rel))) continue;
    const route = rel === 'index.html' ? '/' : `/${path.posix.dirname(rel)}/`;
    if (!ctx.pages.some((p) => p.path === route) && fs.readFileSync(path.join(root, rel), 'utf8').includes('<!-- build:meta')) errors.push(`${rel}: not in scripts/site.mjs`);
  }
  for (const p of ctx.pages) {
    const src = sourceOf(root, p.path.slice(1) + 'index.html', ctx.mods).file;
    const file = path.join(root, src);
    if (!fs.existsSync(file)) errors.push(`scripts/site.mjs: ${p.path} has no index.html`);
    else if (!fs.readFileSync(file, 'utf8').includes('<!-- build:meta -->')) errors.push(`${src}: no <!-- build:meta --> markers`);
  }
  for (const l of languages(root, ctx.mods)) errors.push(...l.errors);
  return errors;
}
