// The site's languages, as the build and the test server make them from
// assets/lang/. Each folder there is one language, with its name (and its
// digits and font stylesheet, if it has its own) in language.json and its
// translations (English text → translation) in its other .json files. They
// become:
//   - a pack, served at /assets/lang/<code>.js, that assets/js/lang.js loads
//     for a visitor who reads that language;
//   - the list of languages in lang.js, filled in between its
//     build:languages markers, on one line so the script's lines stay where
//     they are in the source (coverage reports them against it).
// Nothing of this is committed: tools/page.mjs makes it for every response.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const LANG_DIR = 'assets/lang';

// The first 10 hex digits of a hash of some content: a file's ?v= stamp.
export const stamp = (content) => crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// Every language but English: { code, about (language.json), files (its
// translation files, repository paths), pack (the script it's served as),
// errors }, sorted by code.
export function languages(root){
  const dir = path.join(root, LANG_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort().map((code) => {
    const about = JSON.parse(read(root, `${LANG_DIR}/${code}/language.json`));
    const files = fs.readdirSync(path.join(dir, code)).filter((f) => f.endsWith('.json') && f !== 'language.json').sort()
      .map((f) => `${LANG_DIR}/${code}/${f}`);
    const words = {}, errors = [];
    for (const file of files) {
      for (const [en, to] of Object.entries(JSON.parse(read(root, file)))) {
        if (en in words && JSON.stringify(words[en]) !== JSON.stringify(to)) errors.push(`${file}: "${en}" is translated differently elsewhere`);
        words[en] = to;
      }
    }
    const sorted = Object.fromEntries(Object.keys(words).sort().map((k) => [k, words[k]]));
    const pack = `// Made by tools/languages.mjs from ${LANG_DIR}/${code}/*.json. Don't edit it here.\nwindow.bdnixLang.pack(${JSON.stringify(sorted, null, 1)});\n`;
    return { code, about, files, pack, errors };
  });
}

// The list lang.js has, English first: each language's code, name and
// digits, and its pack and stylesheet with their ?v= stamps.
export function list(root, langs = languages(root)){
  return [{ code: 'en', name: 'English' }, ...langs.map(({ code, about, pack }) => {
    const entry = { code, name: about.name };
    if (about.digits) entry.digits = about.digits;
    entry.file = `/${LANG_DIR}/${code}.js?v=${stamp(pack)}`;
    if (about.style) entry.style = `${about.style}?v=${stamp(fs.readFileSync(path.join(root, about.style)))}`;
    return entry;
  })];
}

// lang.js's source with the list filled in between its markers, replacing
// the one line there.
export function fillLanguages(source, entries){
  return source.replace(/^( *)\/\/ build:languages\n.*\n\1\/\/ \/build:languages$/m, (all, indent) =>
    `${indent}// build:languages\n${indent}var LANGUAGES = ${JSON.stringify(entries)};\n${indent}// /build:languages`);
}

// What the site serves at a language's path, if it's one: lang.js with its
// list, or a language's pack. { body, from } where from is the repository
// files it was made from (not those only its ?v= stamps come from: a stamp
// changes with them, but nothing it does does). null for any other path.
export function serveLanguage(root, rel){
  if (rel === 'assets/js/lang.js' && fs.existsSync(path.join(root, rel))) {
    const langs = languages(root);
    return {
      body: fillLanguages(read(root, rel), list(root, langs)),
      from: [rel, `${LANG_DIR}/`, ...langs.map((l) => `${LANG_DIR}/${l.code}/language.json`)],
      errors: []
    };
  }
  const m = new RegExp(`^${LANG_DIR}/([a-z]+)\\.js$`).exec(rel);
  const lang = m && fs.existsSync(path.join(root, LANG_DIR, m[1], 'language.json')) && languages(root).find((l) => l.code === m[1]);
  if (!lang) return null;
  return { body: lang.pack, from: [`${LANG_DIR}/${lang.code}/`, `${LANG_DIR}/${lang.code}/language.json`, ...lang.files], errors: lang.errors };
}
