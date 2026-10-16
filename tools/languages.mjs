// The site's languages, as the build and the test server make them. Each
// folder in assets/lang/ is one language, with its name (and its digits and
// font stylesheet, if it has its own) in language.json. Translations
// (English text → translation) are in that folder's other .json files, for
// the pages that haven't moved into modules yet, and in each module's
// lang/<code>.json (tools/modules.mjs). They become:
//   - packs that lang.js loads for a visitor who reads that language: one at
//     /assets/lang/<code>.js with every translation, for the pages that
//     haven't moved, and one for each module's page, at <its url>lang/<code>.js,
//     with the translations of the modules it needs (itself and what it uses);
//   - the list of languages in lang.js, filled in between its
//     build:languages markers, on one line so the script's lines stay where
//     they are in the source (coverage reports them against it).
// Nothing of this is committed: tools/page.mjs makes it for every response.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { modules, closure, sourceOf, languageCodes, FOLDERS } from './modules.mjs';

export const LANG_DIR = 'assets/lang';

// The first 10 hex digits of a hash of some content: a file's ?v= stamp.
export const stamp = (content) => crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// A pack: the translations in files, in one script. { pack, errors }, where
// the same English translated two ways is an error.
export function makePack(root, code, files){
  const words = {}, errors = [];
  for (const file of files) {
    for (const [en, to] of Object.entries(JSON.parse(read(root, file)))) {
      if (en in words && JSON.stringify(words[en]) !== JSON.stringify(to)) errors.push(`${file}: "${en}" is translated differently elsewhere`);
      words[en] = to;
    }
  }
  const sorted = Object.fromEntries(Object.keys(words).sort().map((k) => [k, words[k]]));
  return { pack: `// Made by tools/languages.mjs from the site's translations into ${code}. Don't edit it here.\nwindow.bdnixLang.pack(${JSON.stringify(sorted, null, 1)});\n`, errors };
}

// The translation files into a language of the pages that haven't moved
// into modules: assets/lang/<code>/*.json, and every module's.
function allFiles(root, code, mods){
  const dir = path.join(root, LANG_DIR, code);
  const own = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'language.json').sort().map((f) => `${LANG_DIR}/${code}/${f}`);
  return [...own, ...mods.filter((m) => m.lang[code]).map((m) => m.lang[code])];
}

// Every language but English: { code, about (language.json), files (the
// translation files of its pack for the pages that haven't moved), pack (that
// pack's script), errors }, sorted by code.
export function languages(root, mods = modules(root).list){
  return languageCodes(root).map((code) => {
    const about = JSON.parse(read(root, `${LANG_DIR}/${code}/language.json`));
    const files = allFiles(root, code, mods);
    return { code, about, files, ...makePack(root, code, files) };
  });
}

// The pack into a language of an app or site module's page: the
// translations of the modules it needs.
export function pagePack(root, code, mods, name){
  const files = closure(mods, name).map((n) => mods.find((m) => m.name === n).lang[code]).filter(Boolean);
  return { files, ...makePack(root, code, files) };
}

// Where a module's page finds its packs: data-pack on its lang.js tag, with
// {code} for the language and a stamp of all its packs. null for a page
// that hasn't moved, which gets the pack lang.js lists.
export function packTemplate(root, mods, name){
  const m = mods.find((x) => x.name === name);
  if (!m || !m.url) return null;
  const packs = languageCodes(root).map((code) => pagePack(root, code, mods, name).pack).join('\n');
  return `${m.url}lang/{code}.js?v=${stamp(packs)}`;
}

// The list lang.js has, English first: each language's code, name and
// digits, and the pack for the pages that haven't moved and its stylesheet,
// with their ?v= stamps.
export function list(root, langs = languages(root), mods = modules(root).list){
  return [{ code: 'en', name: 'English' }, ...langs.map(({ code, about, pack }) => {
    const entry = { code, name: about.name };
    if (about.digits) entry.digits = about.digits;
    entry.file = `/${LANG_DIR}/${code}.js?v=${stamp(pack)}`;
    if (about.style) entry.style = `${about.style}?v=${stamp(fs.readFileSync(path.join(root, sourceOf(root, about.style.replace(/^\//, ''), mods).file)))}`;
    return entry;
  })];
}

// lang.js's source with the list filled in between its markers, replacing
// the one line there.
export function fillLanguages(source, entries){
  return source.replace(/^( *)\/\/ build:languages\n.*\n\1\/\/ \/build:languages$/m, (all, indent) =>
    `${indent}// build:languages\n${indent}var LANGUAGES = ${JSON.stringify(entries)};\n${indent}// /build:languages`);
}

// The packs a module page has, as their published paths.
export function pagePackPaths(root, mods = modules(root).list){
  return mods.filter((m) => m.url).flatMap((m) => languageCodes(root).map((code) => `${m.url.slice(1)}lang/${code}.js`));
}

// What the site serves at a language's path, if it's one: lang.js with its
// list, or a pack. { body, from, errors } where from is the repository files
// it was made from (not those only its ?v= stamps come from: a stamp changes
// with them, but nothing it does does). null for any other path.
export function serveLanguage(root, rel, mods = modules(root).list){
  if (rel === 'assets/js/lang.js') {
    const src = sourceOf(root, rel, mods);
    if (!fs.existsSync(path.join(root, src.file))) return null;
    const langs = languages(root, mods);
    return {
      body: fillLanguages(read(root, src.file), list(root, langs, mods)),
      from: [src.file, ...src.from, `${LANG_DIR}/`, ...langs.map((l) => `${LANG_DIR}/${l.code}/language.json`)],
      errors: []
    };
  }
  const codes = languageCodes(root);
  const full = new RegExp(`^${LANG_DIR}/([a-z]+)\\.js$`).exec(rel);
  if (full && codes.includes(full[1])) {
    const lang = languages(root, mods).find((l) => l.code === full[1]);
    const dirs = [...Object.keys(FOLDERS).map((f) => `${f}/`), ...mods.map((m) => `${m.dir}/lang/`)];
    return { body: lang.pack, from: [`${LANG_DIR}/${lang.code}/`, `${LANG_DIR}/${lang.code}/language.json`, ...dirs, ...lang.files], errors: lang.errors };
  }
  const own = /^(.*\/)?lang\/([a-z]+)\.js$/.exec(rel);
  const m = own && codes.includes(own[2]) && mods.find((x) => x.url && x.url === '/' + (own[1] || ''));
  if (!m) return null;
  const { pack, files, errors } = pagePack(root, own[2], mods, m.name);
  const needs = closure(mods, m.name).map((n) => mods.find((x) => x.name === n));
  return { body: pack, from: [`${LANG_DIR}/${own[2]}/language.json`, ...needs.flatMap((x) => [`${x.dir}/module.json`, `${x.dir}/lang/`]), ...files], errors };
}
