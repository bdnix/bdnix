// What scripts ask lang.js to translate, and whether a set of translations
// has it all and fits its English. tests/unit/languages.test.mjs checks the
// pack of the pages that haven't moved into modules with it, and each app's
// i18n target (tests/ui/strings.mjs) checks the app's own pack.

const holes = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
// Where the English counts something ("on {pages}"), scripts also pass the
// bare number as {count}, for a language that words it differently
// ("২ পৃষ্ঠায়", not "২ পৃষ্ঠা"-তে).
const EXTRA = ['count'];
const tags = (s) => [...s.matchAll(/<(\w+)[^>]*>/g)].map((m) => m[1]);

// The words given to t() and count() in some scripts, as they're written in
// the code: English → { file, plural ('one' or 'other' for count()) }.
// A string may be written in pieces: 'one ' + 'two'. sources is { file: source }.
const Q1 = "'(?:[^'\\\\]|\\\\.)*'";
const Q = `(${Q1}(?:\\s*\\+\\s*${Q1})*)`;
const unquote = (s) => [...s.matchAll(new RegExp(Q1, 'g'))].map((m) => m[0].slice(1, -1).replace(/\\(.)/g, '$1')).join('');
export function asked(sources){
  const found = new Map();
  for (const [file, src] of Object.entries(sources)) {
    const add = (s, plural) => found.set(unquote(s), { file, plural });
    for (const m of src.matchAll(new RegExp(`\\bt\\(\\s*${Q}`, 'g'))) add(m[1]);
    for (const m of src.matchAll(new RegExp(`\\bt\\([\\w.!=<>&|() ]+\\?\\s*${Q}\\s*:\\s*${Q}`, 'g'))) { add(m[1]); add(m[2]); }
    for (const m of src.matchAll(new RegExp(`\\bcount\\([^;']*?,\\s*${Q},\\s*${Q}\\s*\\)`, 'g'))) { add(m[1], 'one'); add(m[2], 'other'); }
  }
  return found;
}

// What's wrong with some translations (English → translation, or plural
// forms { one, other, ... }): an empty one, a missing "other" form, {values}
// its English doesn't have, or different elements. One line each.
export function misfits(words){
  const out = [];
  for (const [en, to] of Object.entries(words)) {
    if (typeof to !== 'string' && (!to || typeof to.other !== 'string')) { out.push(`"${en}" needs an "other" form`); continue; }
    for (const form of typeof to === 'string' ? [to] : Object.values(to)) {
      if (typeof form !== 'string') { out.push(`"${en}": ${JSON.stringify(form)} isn't text`); continue; }
      if (!form.trim() && en.trim()) out.push(`"${en}" is empty`);
      const allowed = holes(en).concat(EXTRA);
      if (holes(form).some((h) => !allowed.includes(h))) out.push(`"${en}" → "${form}" has {values} its English doesn't`);
      if (JSON.stringify(tags(form)) !== JSON.stringify(tags(en))) out.push(`"${en}" → "${form}" has different elements`);
    }
  }
  return out;
}

// The words scripts ask for (asked()) that some translations lack, as
// "file: English". A count()'s "one" form may be left out when its "other"
// form has every plural form.
export function lacking(wanted, have){
  const out = [];
  for (const [en, { file, plural }] of wanted) {
    if (have[en] !== undefined) continue;
    if (plural === 'one' && [...wanted].some(([o, w]) => w.plural === 'other' && w.file === file && typeof have[o] === 'object')) continue;
    out.push(`${file}: ${en}`);
  }
  return out;
}
