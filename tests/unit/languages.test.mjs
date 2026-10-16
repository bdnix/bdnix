import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { languages } from '../../tools/languages.mjs';
import { modules } from '../../tools/modules.mjs';
import { asked, misfits, lacking } from '../strings.mjs';

// The shared modules' translations (each module's lang/<code>.json), and
// each language's assets/lang/<code>/language.json. Adding a language is
// adding those; these check they're complete and that each translation fits
// its English. (An app or site page checks its own pack, in its i18n target.)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LANG = path.join(root, 'assets', 'lang');
const codes = fs.readdirSync(LANG).filter((f) => fs.statSync(path.join(LANG, f)).isDirectory());
const packs = languages(root);

const words = (code) => {
  const all = {};
  for (const f of packs.find((l) => l.code === code).files) Object.assign(all, JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')));
  return all;
};

// The shared modules' scripts, but not lang.js itself.
function scripts(){
  const files = [];
  for (const m of fs.readdirSync(path.join(root, 'shared'))) {
    const dir = path.join(root, 'shared', m);
    if (!fs.statSync(dir).isDirectory()) continue;
    files.push(...fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'lang.js').map((f) => `shared/${m}/${f}`));
  }
  return Object.fromEntries(files.map((f) => [path.basename(f), fs.readFileSync(path.join(root, f), 'utf8')]));
}

test('each language has a name, and its digits and stylesheet if it has its own', () => {
  assert.ok(codes.length > 0);
  for (const code of codes) {
    assert.match(code, /^[a-z]{2,3}$/);
    const about = JSON.parse(fs.readFileSync(path.join(LANG, code, 'language.json'), 'utf8'));
    assert.equal(typeof about.name, 'string', code);
    assert.ok(about.name.length > 0, code);
    if (about.digits) assert.equal([...about.digits].length, 10, code);
    // Its stylesheet is published by a module (shared/lang/bangla.css) or in assets/.
    if (about.style) assert.ok(modules(root).published.has(about.style.slice(1)) || fs.existsSync(path.join(root, about.style)), about.style);
  }
});

test('every translation is there, with only the {values} its English has and the same elements', () => {
  for (const code of codes) assert.deepEqual(misfits(words(code)), [], code);
});

test('every language has the words every script asks for', () => {
  const wanted = asked(scripts());
  // (Each app checks its own, in its i18n target.) The scripts with words
  // in them are all found:
  const from = new Set([...wanted.values()].map((w) => w.file));
  for (const f of ['analytics.js', 'files.js', 'pdftools.js', 'profile.js']) assert.ok(from.has(f), `no words found in ${f}`);
  for (const code of codes) assert.deepEqual(lacking(wanted, words(code)), [], `${code} has no translation for these`);
});
