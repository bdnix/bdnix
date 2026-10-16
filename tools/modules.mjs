// The site's modules. Each app (apps/<name>/), each part apps share
// (shared/<name>/) and each of the site's own pages (site/<name>/) is a
// folder with a module.json saying what it is:
//   name      the folder's name
//   kind      'app', 'shared' or 'site' (its folder's parent says which)
//   url       where an app or site page is published ('/snake/'); a shared
//             module has none
//   publish   which of its files are published, and where: { "snake.js":
//             "/assets/js/snake.js" }. A folder ("fonts/": "/assets/fonts/")
//             publishes every file in it. Anything not listed (its tests, its
//             translations) isn't published.
//   uses      the shared modules it uses
//   page      an app or site page's title, description, schema and category
//             (what tools/page.mjs makes its head tags from)
//   card      an app's card on the landing page: kind ('game' or 'tool'),
//             name, blurb, keywords, icon and, for a game, its best-score key
// Its translations are lang/<code>.json beside module.json, and its tests are
// in test/. Pages that haven't moved yet are still listed in scripts/site.mjs,
// where a moved app keeps its place as { module: '<name>' }.
import fs from 'node:fs';
import path from 'node:path';

export const KINDS = { app: 'apps', shared: 'shared', site: 'site' };
// The test targets every app has, in its test/ folder.
export const TARGETS = ['logic.test.mjs', 'behaviour.spec.mjs', 'i18n.spec.mjs', 'page.spec.mjs'];
const FIELDS = ['name', 'kind', 'url', 'publish', 'uses', 'page', 'card'];
const PAGE = ['title', 'description', 'schema', 'category', 'noindex'];
const CARD = ['kind', 'name', 'fullName', 'blurb', 'keywords', 'icon', 'best', 'bestLabel'];

// Every file under a folder, as paths relative to it, sorted.
function walk(dir, rel = ''){
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walk(dir, r) : [r];
  }).sort();
}

// One module.json, checked: { name, kind, dir, url, uses, page, card, files
// (each { source, published }, repository paths without a leading slash),
// langs ({ code: file }) }, and the problems found with it.
function read(root, dir, kind){
  const errors = [];
  const where = `${dir}/module.json`;
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(root, where), 'utf8')); }
  catch (e) { return { errors: [`${where}: ${e.message}`] }; }
  const fail = (msg) => errors.push(`${where}: ${msg}`);
  for (const k of Object.keys(m)) if (!FIELDS.includes(k)) fail(`unknown field "${k}"`);
  const name = path.posix.basename(dir);
  if (m.name !== name) fail(`name should be "${name}"`);
  if (m.kind !== kind) fail(`kind should be "${kind}"`);
  if (kind === 'shared') {
    if (m.url !== undefined) fail('a shared module has no url');
  } else if (typeof m.url !== 'string' || !/^\/([a-z0-9-]+\/)?$/.test(m.url)) fail('url should be like "/name/"');
  const uses = m.uses === undefined ? [] : m.uses;
  if (!Array.isArray(uses) || uses.some((u) => typeof u !== 'string')) fail('uses should be a list of names');
  const files = [];
  if (!m.publish || typeof m.publish !== 'object' || Array.isArray(m.publish)) fail('publish should be an object');
  else {
    for (const [from, to] of Object.entries(m.publish)) {
      if (typeof to !== 'string' || !to.startsWith('/') || to.includes('..') || from.includes('..') || from.startsWith('/')) {
        fail(`can't publish "${from}" at "${to}"`);
        continue;
      }
      const src = path.join(root, dir, from);
      if (from.endsWith('/') !== to.endsWith('/')) { fail(`"${from}" and "${to}" should both be folders or both files`); continue; }
      if (!fs.existsSync(src)) { fail(`publishes ${from}, which doesn't exist`); continue; }
      if (from.endsWith('/')) {
        for (const f of walk(src)) files.push({ source: `${dir}/${from}${f}`, published: `${to.slice(1)}${f}` });
      } else files.push({ source: `${dir}/${from}`, published: to.slice(1) });
    }
  }
  if (kind !== 'shared') {
    const p = m.page;
    if (!p || typeof p !== 'object') fail('an app or site page needs its page fields');
    else {
      for (const k of Object.keys(p)) if (!PAGE.includes(k)) fail(`unknown page field "${k}"`);
      if (!p.title || !p.description) fail('page needs a title and description');
    }
    if (!files.some((f) => f.published === `${(m.url || '/').slice(1)}index.html`)) fail(`publishes no page at ${m.url}`);
  } else if (m.page) fail('a shared module has no page');
  if (kind === 'app') {
    const c = m.card;
    if (!c || typeof c !== 'object') fail('an app needs its card');
    else {
      for (const k of Object.keys(c)) if (!CARD.includes(k)) fail(`unknown card field "${k}"`);
      if (!['game', 'tool'].includes(c.kind)) fail('card kind should be "game" or "tool"');
      if (!c.name || !c.blurb || !c.keywords || !Array.isArray(c.icon)) fail('card needs a name, blurb, keywords and icon');
    }
  } else if (m.card) fail('only an app has a card');
  const langs = {};
  const langDir = path.join(root, dir, 'lang');
  if (fs.existsSync(langDir)) {
    for (const f of fs.readdirSync(langDir).sort()) {
      const code = /^([a-z]{2,3})\.json$/.exec(f);
      if (code) langs[code[1]] = `${dir}/lang/${f}`;
      else fail(`lang/${f} should be lang/<code>.json`);
    }
  }
  return { name, kind, dir, url: m.url, uses: Array.isArray(uses) ? uses : [], page: m.page, card: m.card, files, langs, errors };
}

// The folders that hold a module.json, as repository paths.
function folders(root){
  const found = [];
  for (const [kind, top] of Object.entries(KINDS)) {
    const dir = path.join(root, top);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'module.json'))) found.push([`${top}/${e.name}`, kind]);
    }
  }
  return found.sort();
}

// The modules, read once for as long as no module.json changes (the test
// server asks on every request).
const memo = new Map();
function signature(root){
  return folders(root).map(([dir]) => {
    try { return dir + ':' + fs.statSync(path.join(root, dir, 'module.json')).mtimeMs; } catch (e) { return dir; }
  }).join('|');
}

// Every module, sorted by folder, and what's wrong with them as a whole:
// { list, byName, published (published path → { source, module }), errors }.
export function modules(root){
  const sig = signature(root);
  const known = memo.get(root);
  if (known && known.sig === sig) return known.value;
  const all = folders(root).map(([dir, kind]) => read(root, dir, kind));
  const list = all.filter((m) => m.name);
  const errors = all.filter((m) => !m.name).flatMap((m) => m.errors);
  const byName = new Map(list.map((m) => [m.name, m]));
  const published = new Map();
  for (const m of list) {
    errors.push(...m.errors);
    if (list.filter((o) => o.name === m.name).length > 1) errors.push(`${m.dir}: another module is called ${m.name}`);
    for (const u of m.uses) {
      const used = byName.get(u);
      if (!used) errors.push(`${m.dir}/module.json: uses ${u}, which isn't a module`);
      else if (used.kind !== 'shared') errors.push(`${m.dir}/module.json: uses ${u}, which isn't a shared module`);
      else if (u === m.name) errors.push(`${m.dir}/module.json: uses itself`);
    }
    for (const f of m.files) {
      const other = published.get(f.published);
      if (other) errors.push(`/${f.published} is published by both ${other.module} and ${m.name}`);
      else published.set(f.published, { source: f.source, module: m.name });
      if (fs.existsSync(path.join(root, f.published))) errors.push(`/${f.published} is published by ${m.name}, but ${f.published} is still there too`);
    }
  }
  for (const m of list) {
    try { closure(byName, m.name); } catch (e) { errors.push(e.message); }
  }
  const value = { list, byName, published, errors: [...new Set(errors)] };
  memo.set(root, { sig, value });
  return value;
}

// The shared modules a module uses, and those they use, by name, sorted.
// Fails on a loop.
export function closure(byName, name, seen = []){
  if (seen.includes(name)) throw new Error(`modules use each other in a loop: ${[...seen, name].join(' → ')}`);
  const m = byName.get(name);
  if (!m) return [];
  const out = new Set();
  for (const u of m.uses) {
    if (!byName.has(u)) continue;
    out.add(u);
    for (const v of closure(byName, u, [...seen, name])) out.add(v);
  }
  return [...out].sort();
}

// The module a repository file belongs to, if any.
export function moduleOf(root, file){
  const m = /^(apps|shared|site)\/([^/]+)\//.exec(file);
  if (!m) return null;
  const mod = modules(root).byName.get(m[2]);
  return mod && mod.dir === `${m[1]}/${m[2]}` ? mod : null;
}

// What every page is made from, besides its own module: the parts every
// page shares, the list of languages lang.js has (assets/lang/'s list of
// names, and each language.json), and the site's images (assets/img/).
export const SITE_INPUTS = ['scripts/site.mjs', 'scripts/parts.mjs', 'assets/lang/'];

// Whether a repository file is one a module's tests may use: the module's
// own files, those of the modules it uses, what every page is made from
// (SITE_INPUTS, each language's folder and its language.json), and the test
// helpers and build tools (tests/, tools/).
export function declared(root, mod, file){
  const { byName } = modules(root);
  const dirs = [mod.name, ...closure(byName, mod.name)].map((n) => byName.get(n).dir + '/');
  if (dirs.some((d) => file.startsWith(d) || file === d.slice(0, -1))) return true;
  if (/^(tests|tools)\//.test(file)) return true;
  if (/^assets\/lang(\/|\/[a-z]+(\/language\.json)?)?$/.test(file) || file.startsWith('assets/img/')) return true;
  return SITE_INPUTS.includes(file);
}

// The files a module's test used that it doesn't declare (see declared()),
// sorted. A test outside a module declares nothing, so has none.
export function undeclared(root, test, files){
  const mod = moduleOf(root, test);
  if (!mod) return [];
  return [...new Set(files)].filter((f) => f && !declared(root, mod, f.replace(/^\?/, ''))).sort();
}

// The site's pages: scripts/site.mjs's list, with each moved app or site
// page in its place ({ module: name }) as its module.json describes it, in
// the form scripts/parts.mjs takes ({ path, title, ..., app, module }).
// A module the list doesn't place comes at the end.
export function pages(root, list){
  const { list: mods } = modules(root);
  const entry = (m) => ({ path: m.url, ...m.page, ...(m.card ? { app: m.card } : {}), module: m.name });
  const placed = new Set();
  const out = list.flatMap((p) => {
    if (!p.module) return [p];
    const m = mods.find((x) => x.name === p.module && x.kind !== 'shared');
    if (!m) return [];
    placed.add(m.name);
    return [entry(m)];
  });
  for (const m of mods) if (m.kind !== 'shared' && !placed.has(m.name)) out.push(entry(m));
  return out;
}

// What's wrong with how scripts/site.mjs places the modules: a module it
// names that isn't an app or site page, and one it doesn't place.
export function placement(root, list){
  const { list: mods } = modules(root);
  const errors = [];
  for (const p of list) {
    if (p.module && !mods.some((m) => m.name === p.module && m.kind !== 'shared')) errors.push(`scripts/site.mjs: ${p.module} isn't an app or site module`);
  }
  for (const m of mods) {
    if (m.kind !== 'shared' && !list.some((p) => p.module === m.name)) errors.push(`scripts/site.mjs: ${m.dir} has no place in the list`);
  }
  return errors;
}
