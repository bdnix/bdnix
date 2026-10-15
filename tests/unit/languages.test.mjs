import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The translations in assets/lang/<code>/*.json, which tools/languages.mjs
// bundles into the pack served at assets/lang/<code>.js. Adding a language
// is adding a folder; these check it's complete and that each translation
// fits its English.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LANG = path.join(root, 'assets', 'lang');
const codes = fs.readdirSync(LANG).filter((f) => fs.statSync(path.join(LANG, f)).isDirectory());

function words(code){
  const dir = path.join(LANG, code), all = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'language.json')) {
    Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  return all;
}
const holes = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
// Where the English counts something ("on {pages}"), scripts also pass the
// bare number as {count}, for a language that words it differently
// ("২ পৃষ্ঠায়", not "২ পৃষ্ঠা"-তে).
const EXTRA = ['count'];
const tags = (s) => [...s.matchAll(/<(\w+)[^>]*>/g)].map((m) => m[1]);

// What the site's scripts ask lang.js to translate: the words given to t()
// and count() as they're written in the code.
// A string may be written in pieces: 'one ' + 'two'.
const Q1 = "'(?:[^'\\\\]|\\\\.)*'";
const Q = `(${Q1}(?:\\s*\\+\\s*${Q1})*)`;
const unquote = (s) => [...s.matchAll(new RegExp(Q1, 'g'))].map((m) => m[0].slice(1, -1).replace(/\\(.)/g, '$1')).join('');
function asked(){
  const found = new Map();
  const dir = path.join(root, 'assets', 'js');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'lang.js')) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const add = (s, plural) => found.set(unquote(s), { file: f, plural });
    for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*${Q}`, 'g'))) add(m[1]);
    for (const m of src.matchAll(new RegExp(`\\bt\\([\\w.!=<>&|() ]+\\?\\s*${Q}\\s*:\\s*${Q}`, 'g'))) { add(m[1]); add(m[2]); }
    for (const m of src.matchAll(new RegExp(`\\bcount\\([^;']*?,\\s*${Q},\\s*${Q}\\s*\\)`, 'g'))) { add(m[1], 'one'); add(m[2], 'other'); }
  }
  return found;
}

test('each language has a name, and its digits and stylesheet if it has its own', () => {
  assert.ok(codes.length > 0);
  for (const code of codes) {
    assert.match(code, /^[a-z]{2,3}$/);
    const about = JSON.parse(fs.readFileSync(path.join(LANG, code, 'language.json'), 'utf8'));
    assert.equal(typeof about.name, 'string', code);
    assert.ok(about.name.length > 0, code);
    if (about.digits) assert.equal([...about.digits].length, 10, code);
    if (about.style) assert.ok(fs.existsSync(path.join(root, about.style)), about.style);
  }
});

test('every translation is there, with only the {values} its English has and the same elements', () => {
  for (const code of codes) {
    for (const [en, to] of Object.entries(words(code))) {
      const forms = typeof to === 'string' ? [to] : Object.values(to);
      if (typeof to !== 'string') assert.equal(typeof to.other, 'string', `${code}: "${en}" needs an "other" form`);
      for (const form of forms) {
        assert.equal(typeof form, 'string', `${code}: "${en}"`);
        assert.ok(form.trim() || !en.trim(), `${code}: "${en}" is empty`);
        const allowed = holes(en).concat(EXTRA);
        assert.deepEqual(holes(form).filter((h) => !allowed.includes(h)), [], `${code}: "${en}" → "${form}"`);
        assert.deepEqual(tags(form), tags(en), `${code}: "${en}" → "${form}"`);
      }
    }
  }
});

test('every language has the words every script asks for', () => {
  const wanted = asked();
  assert.ok(wanted.size > 300, `found only ${wanted.size}`);
  for (const code of codes) {
    const have = words(code);
    const lacking = [...wanted].filter(([en, { plural }]) => {
      if (plural === 'one') return false;   // a plural object, or the "one" checked below
      return have[en] === undefined;
    }).map(([en, { file }]) => `${file}: ${en}`);
    // The "one" form of a count, unless the other form covers them all.
    for (const [en, { file, plural }] of wanted) {
      if (plural !== 'one' || have[en] !== undefined) continue;
      const other = [...wanted].find(([o, w]) => w.plural === 'other' && w.file === file && typeof have[o] === 'object');
      if (!other) lacking.push(`${file}: ${en}`);
    }
    assert.deepEqual(lacking, [], `${code} has no translation for these`);
  }
});
