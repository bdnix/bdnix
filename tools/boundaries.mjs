// `node tools/boundaries.mjs` (part of `npm run lint`): the modules keep to
// their own files. Fails, naming each problem, unless:
//   - every module.json is right (tools/modules.mjs): its fields, its files,
//     what it uses, no published path claimed twice, no loops;
//   - an app or site page links only its own files and those of the modules
//     in its uses (and the site's images, vendored libraries and language
//     packs), and a module's stylesheets likewise;
//   - a shared module names no app: not its URL, its files, its storage keys
//     or its name as a string, in any of its files, tests included;
//   - no file belongs to two modules, or to a module and assets/ both;
//   - every translation has one owner: no English is translated in two of
//     the files that make a module's pack, or in two shared modules;
//   - every module has its test targets: an app the four in TARGETS (its
//     page target running checkPage(), and checkGame() for a game, in
//     English, its i18n target checkPageLanguages() and checkGameLanguages()),
//     a shared module at least one test. An app with one script (its page's)
//     has no pure logic, so no logic target.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules, TARGETS } from './modules.mjs';
import { languages, packs } from './languages.mjs';

const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');
// Every file in a module's folder, as repository paths.
function filesOf(root, dir){
  const out = [];
  (function walk(rel){
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${rel}/${e.name}`);
      else out.push(`${rel}/${e.name}`);
    }
  })(dir);
  return out.sort();
}
// What may be linked without belonging to a module.
const SITE_WIDE = /^assets\/(img|vendor|lang)\//;

// The site's own files a page or stylesheet links: published paths.
const links = (text) => [...text.matchAll(/(?:src|href)="\/(assets\/[^"?#]+)|url\(\/(assets\/[^)?#]+)\)/g)].map((m) => m[1] || m[2]);

export function boundaries(root){
  const { list, published, errors: own } = modules(root);
  const errors = [...own];
  const owner = (f) => (published.get(f) || {}).module;

  for (const m of list) {
    const allowed = new Set([m.name, ...m.uses]);
    // Its pages and stylesheets link only its own files and its uses'.
    for (const f of m.files.filter((x) => /\.(html|css)$/.test(x.source))) {
      for (const link of links(read(root, f.source))) {
        if (SITE_WIDE.test(link)) continue;
        const o = owner(link);
        if (!o) errors.push(`${f.source}: links /${link}, which no module publishes`);
        else if (!allowed.has(o)) errors.push(`${f.source}: links /${link}, from ${o}, which ${m.name} doesn't use`);
      }
    }
    // Every page's head links lang.js (tools/page.mjs), so uses its module.
    const lang = owner('assets/js/lang.js');
    if (m.kind !== 'shared' && lang && !m.uses.includes(lang)) errors.push(`${m.dir}/module.json: a page links lang.js, so it uses ${lang}`);
  }

  // A shared module names no app.
  const apps = list.filter((m) => m.kind === 'app');
  for (const m of list.filter((x) => x.kind === 'shared')) {
    for (const file of filesOf(root, m.dir).filter((f) => !f.includes('/lang/') && /\.(js|mjs|css|html|json)$/.test(f))) {
      const text = read(root, file);
      for (const app of apps) {
        const names = [app.url, `'${app.name}'`, `"${app.name}"`, ...app.files.filter((f) => !/\/(vendor|fonts)\//.test(f.source)).map((f) => path.posix.basename(f.published)).filter((b) => b !== 'index.html')];
        if (app.card && app.card.best) names.push(app.card.best);
        for (const n of names) if (text.includes(n)) errors.push(`${file}: names the app ${app.name} (${n}); a shared module is about no app`);
      }
    }
  }

  // One owner for every translation: in each module's pack, and among the
  // shared modules. (The pages that haven't moved share one pack, where each
  // app still keeps its own copy of the words it uses.)
  const codes = languages(root).map((l) => l.code);
  const sources = [
    ...packs(root).map((p) => ({ what: `/${p.path}`, files: p.files })),
    ...codes.map((code) => ({ what: `the shared modules' lang/${code}.json`, files: list.filter((m) => m.kind === 'shared' && m.langs[code]).map((m) => m.langs[code]) }))
  ];
  for (const { what, files } of sources) {
    const seen = new Map();
    for (const f of files) {
      for (const en of Object.keys(JSON.parse(read(root, f)))) {
        if (seen.has(en)) errors.push(`"${en}" is translated in both ${seen.get(en)} and ${f} (${what}): one of them owns it`);
        else seen.set(en, f);
      }
    }
  }

  // Every module's tests.
  for (const m of list) {
    const tests = fs.existsSync(path.join(root, m.dir, 'test')) ? fs.readdirSync(path.join(root, m.dir, 'test')) : [];
    if (m.kind === 'shared') {
      if (!tests.some((f) => /\.(test|spec)\.mjs$/.test(f))) errors.push(`${m.dir}: has no tests in test/`);
      continue;
    }
    // An app's logic target tests its pure logic, which an app with a single
    // script (its page's) doesn't have.
    const scripts = m.files.filter((f) => /\.js$/.test(f.source) && !f.source.includes('/vendor/'));
    for (const t of TARGETS) if (!tests.includes(t) && !(t === 'logic.test.mjs' && scripts.length < 2)) errors.push(`${m.dir}: has no test/${t}`);
    // A call of fn with the page's URL, not of a longer name ending in fn.
    const calls = (file, fn) => {
      if (!fs.existsSync(path.join(root, file))) return false;
      const text = read(root, file), call = `${fn}('${m.url}'`;
      for (let at = text.indexOf(call); at >= 0; at = text.indexOf(call, at + 1)) if (!/\w/.test(text[at - 1] || '')) return true;
      return false;
    };
    const game = m.card && m.card.kind === 'game';
    const page = `${m.dir}/test/page.spec.mjs`, i18n = `${m.dir}/test/i18n.spec.mjs`;
    if (!calls(page, 'checkPage')) errors.push(`${page}: should call checkPage('${m.url}', ...)`);
    if (game && !calls(page, 'checkGame')) errors.push(`${page}: should call checkGame('${m.url}', ...)`);
    if (!calls(i18n, 'checkPageLanguages')) errors.push(`${i18n}: should call checkPageLanguages('${m.url}')`);
    if (game && !calls(i18n, 'checkGameLanguages')) errors.push(`${i18n}: should call checkGameLanguages('${m.url}')`);
  }
  return [...new Set(errors)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const errors = boundaries(root);
  if (errors.length) {
    console.error('The modules cross their boundaries:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log(`${modules(root).list.length} modules keep to their boundaries.`);
}
