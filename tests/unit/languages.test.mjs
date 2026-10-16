import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { languages } from '../../tools/languages.mjs';
import { modules } from '../../tools/modules.mjs';
import { asked, misfits, lacking } from '../strings.mjs';

// The translations of the pages that haven't moved into modules: those in
// assets/lang/<code>/*.json and the shared modules' lang/<code>.json, which
// tools/languages.mjs bundles into the pack served at assets/lang/<code>.js.
// Adding a language is adding a folder; these check it's complete and that
// each translation fits its English. (A moved app checks its own pack, in
// its i18n target.)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LANG = path.join(root, 'assets', 'lang');
const codes = fs.readdirSync(LANG).filter((f) => fs.statSync(path.join(LANG, f)).isDirectory());
const packs = languages(root);

const words = (code) => {
  const all = {};
  for (const f of packs.find((l) => l.code === code).files) Object.assign(all, JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')));
  return all;
};

// The scripts of those pages: the ones still in assets/js, and the shared
// modules', but not lang.js itself.
function scripts(){
  const files = fs.readdirSync(path.join(root, 'assets/js')).filter((f) => f.endsWith('.js')).map((f) => `assets/js/${f}`);
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
  // (The shared modules' scripts ask for a few dozen; each app checks its own.)
  assert.ok(wanted.size > 20, `found only ${wanted.size}`);
  for (const code of codes) assert.deepEqual(lacking(wanted, words(code)), [], `${code} has no translation for these`);
});
