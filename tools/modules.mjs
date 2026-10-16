// The site's modules: each is a folder with a module.json, under apps/ (a
// game or tool, with its own page), shared/ (what several apps use) or site/
// (the site's own pages). See docs/development.md#modules for the format.
//
// This finds them all, checks each module.json, and gives:
//   - the module graph: what each module uses, directly and through others;
//   - where each module's files are published (publish: source → published
//     path), so a file can move into its module and still be served at the
//     URL it always had (shared/sound/sound.js at /assets/js/sound.js);
//   - the pages of app and site modules, in the form scripts/site.mjs lists
//     pages in, to merge with the pages that haven't moved yet.
// Pure functions of the repository's files, so they can be unit tested.
import fs from 'node:fs';
import path from 'node:path';

// Where modules live, and the kind of module each folder holds.
export const FOLDERS = { apps: 'app', shared: 'shared', site: 'site' };
const KEYS = { app: ['name', 'kind', 'url', 'publish', 'uses', 'page', 'card'], shared: ['name', 'kind', 'publish', 'uses'], site: ['name', 'kind', 'url', 'publish', 'uses', 'page'] };
const PAGE = ['title', 'description', 'schema', 'category', 'fullName', 'noindex'];
const CARD = ['type', 'name', 'blurb', 'keywords', 'icon', 'best', 'bestLabel'];

// A repository path for a file in a module's folder: no leading slash, no
// way out of the folder.
const inside = (rel) => typeof rel === 'string' && rel.length > 0 && !rel.startsWith('/') && !rel.split('/').includes('..');

// One module from its folder and the text of its module.json: { name, kind,
// dir, url, publish: [{ from, to }], uses, page, card, lang } and the
// problems with it. from and to are repository-style paths (to without its
// leading slash); a folder ends in '/'. lang maps a language to the module's
// translations into it (lang/<code>.json), and exists(rel) says whether a
// repository file or folder is there.
export function parse(dir, text, exists = () => true, langs = []){
  const errors = [];
  const where = `${dir}/module.json`;
  let m;
  try { m = JSON.parse(text); } catch (e) { return { errors: [`${where}: not JSON (${e.message})`] }; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { errors: [`${where}: not an object`] };
  const [folder, name] = dir.split('/');
  const kind = FOLDERS[folder];
  if (m.name !== name) errors.push(`${where}: name should be "${name}", its folder's name`);
  if (m.kind !== kind) errors.push(`${where}: kind should be "${kind}", since it's in ${folder}/`);
  for (const k of Object.keys(m)) if (!(KEYS[kind] || []).includes(k)) errors.push(`${where}: unknown key "${k}"`);
  if (kind !== 'shared') {
    if (typeof m.url !== 'string' || !/^\/([a-z0-9-]+\/)?$/.test(m.url)) errors.push(`${where}: url should be the page's path, such as "/snake/"`);
    if (!exists(`${dir}/index.html`)) errors.push(`${where}: an ${kind} module's page is its index.html, which is missing`);
  }
  const publish = [];
  if (m.publish !== undefined && (!m.publish || typeof m.publish !== 'object' || Array.isArray(m.publish))) errors.push(`${where}: publish should map files to the paths they're published at`);
  for (const [from, to] of Object.entries(m.publish || {})) {
    if (!inside(from) || typeof to !== 'string' || !to.startsWith('/') || to.split('/').includes('..') || from.endsWith('/') !== to.endsWith('/')) {
      errors.push(`${where}: publish "${from}": "${to}" should map a file to a path from the site's root (a folder, ending in /, to a folder)`);
    } else if (!exists(`${dir}/${from}`)) errors.push(`${where}: publish "${from}" doesn't exist`);
    else publish.push({ from: `${dir}/${from}`, to: to.slice(1) });
  }
  const uses = m.uses === undefined ? [] : m.uses;
  if (!Array.isArray(uses) || !uses.every((u) => typeof u === 'string')) errors.push(`${where}: uses should be a list of shared modules' names`);
  const page = {}, card = {};
  if (kind !== 'shared') {
    if (!m.page || typeof m.page !== 'object') errors.push(`${where}: page should hold the page's title and description`);
    else {
      for (const k of Object.keys(m.page)) if (!PAGE.includes(k)) errors.push(`${where}: unknown page key "${k}"`);
      if (!m.page.title || !m.page.description) errors.push(`${where}: page needs a title and a description`);
      Object.assign(page, m.page);
    }
  }
  if (kind === 'app') {
    if (!m.card || typeof m.card !== 'object') errors.push(`${where}: card should hold the landing page's card for the app`);
    else {
      for (const k of Object.keys(m.card)) if (!CARD.includes(k)) errors.push(`${where}: unknown card key "${k}"`);
      if (!['game', 'tool'].includes(m.card.type)) errors.push(`${where}: card type should be "game" or "tool"`);
      if (!m.card.name || !m.card.blurb || !m.card.keywords || !Array.isArray(m.card.icon) || !m.card.icon.length) errors.push(`${where}: card needs a name, a blurb, keywords and an icon`);
      if (m.card.type === 'game' && !/^bdnix_[a-z]+_best$/.test(m.card.best || '')) errors.push(`${where}: a game's card needs the key of its best score, bdnix_<game>_best`);
      Object.assign(card, m.card);
    }
  }
  const lang = {};
  for (const code of langs) if (exists(`${dir}/lang/${code}.json`)) lang[code] = `${dir}/lang/${code}.json`;
  return { name, kind, dir, url: m.url, publish, uses: Array.isArray(uses) ? uses : [], page, card, lang, errors };
}

const isDir = (root, rel) => { try { return fs.statSync(path.join(root, rel)).isDirectory(); } catch (e) { return false; } };

// The languages the site has besides English (assets/lang/<code>/).
export function languageCodes(root){
  const dir = path.join(root, 'assets/lang');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => isDir(root, `assets/lang/${f}`)).sort();
}

// Every module in the repository, sorted by folder: { list, errors }. Also
// checks what they say about each other: uses naming a shared module, no
// cycles, no two modules publishing the same path, and no published path
// that's also a file of the repository outside the modules.
export function modules(root){
  const list = [], errors = [];
  const langs = languageCodes(root);
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  for (const folder of Object.keys(FOLDERS)) {
    if (!isDir(root, folder)) continue;
    for (const name of fs.readdirSync(path.join(root, folder)).sort()) {
      const dir = `${folder}/${name}`;
      if (!isDir(root, dir) || !exists(`${dir}/module.json`)) continue;
      const m = parse(dir, fs.readFileSync(path.join(root, dir, 'module.json'), 'utf8'), exists, langs);
      errors.push(...m.errors);
      if (m.name) list.push(m);
    }
  }
  errors.push(...relations(list));
  const seen = new Map();
  for (const [to, from] of published(root, list)) {
    if (exists(to) && !list.some((m) => to.startsWith(m.dir + '/'))) errors.push(`${from} is published at /${to}, which is also a file of its own`);
    if (seen.has(to) && seen.get(to) !== from) errors.push(`/${to} is published by both ${seen.get(to)} and ${from}`);
    seen.set(to, from);
  }
  const urls = new Map();
  for (const m of list) {
    if (!m.url) continue;
    if (urls.has(m.url)) errors.push(`${m.dir}/module.json: url ${m.url} is also ${urls.get(m.url)}'s`);
    urls.set(m.url, m.dir);
  }
  return { list, errors };
}

// What's wrong with how modules use each other: a name that isn't a shared
// module, a module using itself, or a cycle.
export function relations(list){
  const errors = [];
  const byName = new Map(list.map((m) => [m.name, m]));
  for (const m of list) {
    for (const u of m.uses) {
      const used = byName.get(u);
      if (!used || used.kind !== 'shared') errors.push(`${m.dir}/module.json: uses "${u}", which isn't a shared module`);
      else if (u === m.name) errors.push(`${m.dir}/module.json: uses itself`);
    }
  }
  // A cycle: following uses from a module comes back to it.
  for (const m of list) {
    const todo = [...m.uses], seen = new Set();
    while (todo.length) {
      const u = todo.pop();
      if (u === m.name) { errors.push(`${m.dir}/module.json: uses itself through ${[...seen].join(', ') || u}`); break; }
      if (seen.has(u) || !byName.has(u)) continue;
      seen.add(u);
      todo.push(...byName.get(u).uses);
    }
  }
  return [...new Set(errors)];
}

// The modules a module needs: itself and everything it uses, directly or
// through another, sorted by name.
export function closure(list, name){
  const byName = new Map(list.map((m) => [m.name, m]));
  const seen = new Set(), todo = [name];
  while (todo.length) {
    const n = todo.pop();
    if (seen.has(n) || !byName.has(n)) continue;
    seen.add(n);
    todo.push(...byName.get(n).uses);
  }
  return [...seen].sort();
}

// Every file the modules publish, as [published path, repository path]
// pairs (no leading slashes), folders listed file by file. An app or site
// module's page is its index.html, published at its url.
function published(root, list){
  const pairs = [];
  const walk = (rel) => fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    return e.isDirectory() ? walk(`${rel}/${e.name}`) : [`${rel}/${e.name}`];
  });
  for (const m of list) {
    if (m.url) pairs.push([m.url.slice(1) + 'index.html', `${m.dir}/index.html`]);
    for (const { from, to } of m.publish) {
      if (!from.endsWith('/')) { pairs.push([to, from]); continue; }
      if (!isDir(root, from.slice(0, -1))) continue;
      for (const f of walk(from.slice(0, -1))) pairs.push([to + f.slice(from.length), f]);
    }
  }
  return pairs;
}

// The same as published path → repository path, sorted by published path.
export function publishMap(root, list){
  return new Map(published(root, list).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// The repository file served at a published path: a module's, or the path
// itself for anything that hasn't moved into a module. With the module's
// module.json, for whoever needs to know what the answer came from.
export function sourceOf(root, rel, list = modules(root).list){
  const from = publishMap(root, list).get(rel);
  if (!from) return { file: rel, from: [] };
  const owner = list.find((m) => from.startsWith(m.dir + '/'));
  return { file: from, from: [`${owner.dir}/module.json`] };
}

// An app or site module's page, as scripts/site.mjs lists pages.
export function asPage(m){
  const { title, description, schema, category, fullName, noindex } = m.page;
  const p = { path: m.url, title, description, module: m.name };
  if (schema) p.schema = schema;
  if (category) p.category = category;
  if (noindex) p.noindex = true;
  if (m.kind === 'app') {
    const { type, name, blurb, keywords, icon, best, bestLabel } = m.card;
    p.app = { kind: type, name, blurb, keywords, icon };
    if (fullName) p.app.fullName = fullName;
    if (best) p.app.best = best;
    if (bestLabel) p.app.bestLabel = bestLabel;
  }
  return p;
}

// scripts/site.mjs's pages with the modules' merged in: each { module:
// '<name>' } there is replaced by that module's page, so the list keeps the
// order cards and scores are shown in. { pages, errors }: a placeholder for
// a module that has no page, or a module page the list doesn't place, is an
// error.
export function mergePages(site, list){
  const errors = [];
  const byName = new Map(list.filter((m) => m.kind !== 'shared').map((m) => [m.name, m]));
  const placed = new Set();
  const pages = site.map((p) => {
    if (!p.module) return p;
    const m = byName.get(p.module);
    if (!m) { errors.push(`scripts/site.mjs: { module: '${p.module}' } isn't an app or site module`); return null; }
    placed.add(p.module);
    return asPage(m);
  }).filter(Boolean);
  for (const name of byName.keys()) if (!placed.has(name)) errors.push(`scripts/site.mjs: no { module: '${name}' } to say where ${name}'s page goes`);
  return { pages, errors };
}
