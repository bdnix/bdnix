// The site's languages, as the build and the test server make them. Each
// folder in assets/lang/ is one language, with its name (and its digits and
// font stylesheet, if it has its own) in language.json. Translations
// (English text → translation) are in the other .json files there, for the
// pages that haven't moved into modules yet, and in each module's
// lang/<code>.json (tools/modules.mjs). They become:
//   - for each language, the pack served at /assets/lang/<code>.js: what's in
//     assets/lang/<code>/ and every shared module's translations, for the
//     pages that haven't moved;
//   - for each app or site module and language, its own pack, served at
//     /assets/lang/<module>.<code>.js: the module's translations and those of
//     the shared modules it uses, and nothing else;
//   - the list of languages in lang.js, filled in between its
//     build:languages markers, on one line so the script's lines stay where
//     they are in the source (coverage reports them against it). A page names
//     its own pack (data-pack on its lang.js script) and lang.js loads it.
// Nothing of this is committed: tools/page.mjs makes it for every response.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { modules, closure } from './modules.mjs';

export const LANG_DIR = 'assets/lang';

// The first 10 hex digits of a hash of some content: a file's ?v= stamp.
export const stamp = (content) => crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// Every language but English, as language.json describes it: { code,
// about }, sorted by code. Reads nothing else.
export function about(root){
  const dir = path.join(root, LANG_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort()
    .map((code) => ({ code, about: JSON.parse(read(root, `${LANG_DIR}/${code}/language.json`)) }));
}

// The translations in some files, one pack: { words (sorted by English),
// errors (a string translated two ways) }.
function bundle(root, files){
  const words = {}, errors = [];
  for (const file of files) {
    for (const [en, to] of Object.entries(JSON.parse(read(root, file)))) {
      if (en in words && JSON.stringify(words[en]) !== JSON.stringify(to)) errors.push(`${file}: "${en}" is translated differently elsewhere`);
      words[en] = to;
    }
  }
  return { words: Object.fromEntries(Object.keys(words).sort().map((k) => [k, words[k]])), errors };
}
const script = (from, words) => `// Made by tools/languages.mjs from ${from}. Don't edit it here.\nwindow.bdnixLang.pack(${JSON.stringify(words, null, 1)});\n`;

// Every language but English: { code, about (language.json), files (the
// translation files of its pack for pages that haven't moved, repository
// paths), pack (that pack's script), errors }, sorted by code.
export function languages(root){
  const shared = modules(root).list.filter((m) => m.kind === 'shared');
  return about(root).map(({ code, about }) => {
    const own = fs.readdirSync(path.join(root, LANG_DIR, code)).filter((f) => f.endsWith('.json') && f !== 'language.json').sort()
      .map((f) => `${LANG_DIR}/${code}/${f}`);
    const files = [...own, ...shared.filter((m) => m.langs[code]).map((m) => m.langs[code])];
    const { words, errors } = bundle(root, files);
    return { code, about, files, pack: script(`${LANG_DIR}/${code}/*.json and the shared modules' lang/${code}.json`, words), errors };
  });
}

// Each app and site module's own pack in each language: { module, code,
// path (where it's served), files, pack, errors }.
export function packs(root){
  const { list, byName } = modules(root);
  const codes = about(root).map((l) => l.code);
  return list.filter((m) => m.kind !== 'shared').flatMap((m) => codes.map((code) => {
    const files = [m, ...closure(byName, m.name).map((n) => byName.get(n))].filter((x) => x.langs[code]).map((x) => x.langs[code]);
    const { words, errors } = bundle(root, files);
    return { module: m.name, code, path: `${LANG_DIR}/${m.name}.${code}.js`, files, pack: script(`${m.dir}/lang/${code}.json and its shared modules'`, words), errors };
  }));
}

// Where each module's own packs are served, without making them: reads only
// the modules and each language.json.
export const packPaths = (root) => modules(root).list.filter((m) => m.kind !== 'shared')
  .flatMap((m) => about(root).map(({ code }) => `${LANG_DIR}/${m.name}.${code}.js`));

// The list lang.js has, English first: each language's code, name and
// digits, its pack and stylesheet with their ?v= stamps, and each module's
// own pack (packs) by the module's name. With stamps off, nothing but
// language.json is read: the files are named without their stamps, and the
// modules' packs left out.
export function list(root, { stamps = true } = {}){
  const own = stamps ? packs(root) : [];
  const general = stamps ? languages(root) : [];
  return [{ code: 'en', name: 'English' }, ...about(root).map(({ code, about }) => {
    const entry = { code, name: about.name };
    if (about.digits) entry.digits = about.digits;
    const v = (body) => (stamps ? `?v=${stamp(body)}` : '');
    entry.file = `/${LANG_DIR}/${code}.js${stamps ? v(general.find((l) => l.code === code).pack) : ''}`;
    const mine = own.filter((p) => p.code === code);
    if (mine.length) entry.packs = Object.fromEntries(mine.map((p) => [p.module, `/${p.path}${v(p.pack)}`]));
    if (about.style) entry.style = `${about.style}${stamps ? v(served(root, about.style)) : ''}`;
    return entry;
  })];
}

// The content served at a published path such as /assets/css/bangla.css.
function served(root, published){
  const rel = published.replace(/^\//, '');
  const from = modules(root).published.get(rel);
  return fs.readFileSync(path.join(root, from ? from.source : rel));
}

// lang.js's source with the list filled in between its markers, replacing
// the one line there.
export function fillLanguages(source, entries){
  return source.replace(/^( *)\/\/ build:languages\n.*\n\1\/\/ \/build:languages$/m, (all, indent) =>
    `${indent}// build:languages\n${indent}var LANGUAGES = ${JSON.stringify(entries)};\n${indent}// /build:languages`);
}

// What the site serves at a language's path, if it's one: lang.js with its
// list (source is where lang.js's source is), or a pack. { body, from } where
// from is the repository files it was made from (not those only its ?v=
// stamps come from: a stamp changes with them, but nothing it does does).
// null for any other path.
export function serveLanguage(root, rel, source = rel){
  if (rel === 'assets/js/lang.js' && fs.existsSync(path.join(root, source))) {
    const langs = about(root);
    return {
      body: fillLanguages(read(root, source), list(root)),
      from: [source, `${LANG_DIR}/`, ...langs.map((l) => `${LANG_DIR}/${l.code}/language.json`)],
      errors: []
    };
  }
  const general = new RegExp(`^${LANG_DIR}/([a-z]+)\\.js$`).exec(rel);
  if (general) {
    const lang = fs.existsSync(path.join(root, LANG_DIR, general[1], 'language.json')) && languages(root).find((l) => l.code === general[1]);
    if (!lang) return null;
    return { body: lang.pack, from: [`${LANG_DIR}/${lang.code}/`, `${LANG_DIR}/${lang.code}/language.json`, 'shared/', ...lang.files], errors: lang.errors };
  }
  if (new RegExp(`^${LANG_DIR}/[\\w-]+\\.[a-z]+\\.js$`).test(rel)) {
    const own = packs(root).find((p) => p.path === rel);
    if (!own) return null;
    const { byName } = modules(root);
    const mods = [own.module, ...closure(byName, own.module)].flatMap((n) => [`${byName.get(n).dir}/module.json`, `${byName.get(n).dir}/lang/`]);
    return { body: own.pack, from: [...mods, `${LANG_DIR}/${own.code}/language.json`, ...own.files], errors: own.errors };
  }
  return null;
}
