import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, fakeStorage, plain } from '../../../tests/unit/load.mjs';

// shared/lang/lang.js without a page: which language, and the words scripts
// ask it for. (Translating a page is tested in tests/ui/languages.spec.mjs.)
const open = (saved, browser = ['en-US']) => load([], {
  localStorage: fakeStorage(saved ? { bdnix_lang: saved } : {}),
  navigator: { languages: browser }
}).bdnixLang;

// A language as lang.js has it once its pack has loaded.
function bangla(words = {}){
  const L = open('bn');
  L.pack(words);
  return L;
}

test('the language: the one picked, else the browser\'s if the site has it, else English', () => {
  assert.equal(open().lang, 'en');
  assert.equal(open('bn').lang, 'bn');
  assert.equal(open('bn').name, 'বাংলা');
  assert.equal(open(null, ['fr-FR', 'bn-BD']).lang, 'bn');
  assert.equal(open(null, ['fr-FR']).lang, 'en');
  assert.equal(open('en', ['bn']).lang, 'en');
  assert.equal(open('xx', ['bn']).lang, 'bn');   // a language the site no longer has
  assert.equal(load([], { navigator: { language: 'bn' } }).bdnixLang.lang, 'bn');   // only navigator.language
  assert.equal(load([], { localStorage: { getItem(){ throw new Error('blocked'); } } }).bdnixLang.lang, 'en');
  assert.deepEqual(plain(open().languages.map((l) => l.code)), ['en', 'bn']);
});

test('set() keeps the choice and shows the page again; a language the site lacks is ignored', () => {
  const localStorage = fakeStorage();
  let reloads = 0;
  const L = load([], { localStorage, location: { reload(){ reloads++; } } }).bdnixLang;
  L.set('xx');
  assert.equal(reloads, 0);
  assert.equal(localStorage.getItem('bdnix_lang'), null);
  L.set('bn');
  assert.equal(reloads, 1);
  assert.equal(localStorage.getItem('bdnix_lang'), 'bn');
  // Storage that's blocked still shows the page again.
  load([], { localStorage: { getItem: () => null, setItem(){ throw new Error('blocked'); } }, location: { reload(){ reloads++; } } }).bdnixLang.set('en');
  assert.equal(reloads, 2);
});

test('in English, t() fills in the values and leaves the words as they are', () => {
  const L = open();
  assert.equal(L.t('Hello'), 'Hello');
  assert.equal(L.t('{n} of {total}', { n: 3, total: 12 }), '3 of 12');
  assert.equal(L.t('{a} and {b}', { a: 'x' }), 'x and {b}');
  assert.equal(L.t('Draw|result'), 'Draw');
  assert.equal(L.num(2026), '2026');
  assert.equal(L.count(1, '{n} page', '{n} pages'), '1 page');
  assert.equal(L.count(0, '{n} page', '{n} pages'), '0 pages');
  assert.equal(L.count(2, '{n} match|found', '{n} matches|found'), '2 matches');
  assert.deepEqual(plain(L.missing), []);
});

test('in another language, its words and its digits, and a bar telling apart two meanings', () => {
  const L = bangla({ 'Hello': 'হ্যালো', '{n} of {total}': '{total}টির মধ্যে {n}', 'Draw|result': 'ড্র', 'Draw': 'আঁকুন' });
  assert.equal(L.t('Hello'), 'হ্যালো');
  assert.equal(L.t('{n} of {total}', { n: 3, total: 12 }), '১২টির মধ্যে ৩');
  // A value that's text is put in as it is, digits and all.
  assert.equal(L.t('{n} of {total}', { n: 'A1', total: '2' }), '2টির মধ্যে A1');
  assert.equal(L.t('Draw|result'), 'ড্র');
  assert.equal(L.t('Draw'), 'আঁকুন');
  assert.equal(L.num(2026), '২০২৬');
  assert.equal(L.num('1.5'), '১.৫');
});

test('counting: one and other, or every form a language has', () => {
  const L = bangla({ '{n} page': '{n} পৃষ্ঠা', '{n} pages': '{n} পৃষ্ঠা', '{n} file': 'ফাইল {n}টি' });
  assert.equal(L.count(1, '{n} page', '{n} pages'), '১ পৃষ্ঠা');
  assert.equal(L.count(5, '{n} page', '{n} pages'), '৫ পৃষ্ঠা');
  // No plural given: the one form isn't used for others.
  assert.equal(L.count(1, '{n} file', '{n} files'), 'ফাইল ১টি');
  assert.equal(L.count(2, '{n} file', '{n} files'), '২ files');
  assert.deepEqual(plain(L.missing), ['{n} files']);

  // A language with more forms than English gives them all (Intl.PluralRules
  // says which a number takes; Bangla has one and other).
  const M = bangla({ '{n} pages': { one: '{n} পাতা', other: '{n}টি পাতা' } });
  assert.equal(M.count(1, '{n} page', '{n} pages'), '১ পাতা');
  assert.equal(M.count(7, '{n} page', '{n} pages'), '৭টি পাতা');
  const N = bangla({ '{n} pages': { other: '{n}টি পাতা' } });
  assert.equal(N.count(1, '{n} page', '{n} pages'), '১টি পাতা');
});

test('English left untranslated is listed, but not names, formats or what was put in', () => {
  const L = bangla({ 'Saved {name}.': '{name} সেভ হয়েছে।' });
  L.t('Saved {name}.', { name: 'holiday photos.pdf' });
  for (const kept of ['bdnix', 'PDF', 'MP3 · 128 kbps', 'A1.pdf', 'root@bdnix.com', '12', '—', 'GitHub', 'Stockfish']) L.t(kept);
  L.t('Instagram ছবি');           // a name, in translated text
  L.t('holiday photos');          // what a visitor typed, put in before
  assert.deepEqual(plain(L.missing), []);
  L.t('Not translated');
  L.t('Not translated');
  L.t('also this');
  assert.deepEqual(plain(L.missing), ['Not translated', 'also this']);
});

test('before its words have loaded, nothing is listed and nothing is translated', () => {
  const L = open('bn');
  assert.equal(L.t('Hello {n}', { n: 5 }), 'Hello 5');
  assert.equal(L.num(5), '5');
  assert.deepEqual(plain(L.missing), []);
});

// In a page, lang.js writes in the visitor's language's font and pack before
// the rest of the page: the pack lang.js lists, or the page's own, which a
// module's page names on lang.js's tag (data-pack, tools/languages.mjs).
function inPage(script){
  const written = [];
  const document = {
    documentElement: { lang: 'en' },
    currentScript: script,
    write: (s) => written.push(s),
    addEventListener(){}
  };
  load([], { document, localStorage: fakeStorage({ bdnix_lang: 'bn' }) });
  return { written, html: document.documentElement };
}

test('in a page, the pack lang.js lists, or the one the page names', () => {
  const listed = inPage(null);
  assert.equal(listed.html.lang, 'bn');
  assert.match(listed.written[0], /^<link rel="stylesheet" href="\/assets\/css\/bangla\.css\?v=[0-9a-f]{10}">$/);
  assert.match(listed.written[1], /^<script src="\/assets\/lang\/bn\.js\?v=[0-9a-f]{10}"><\/script>$/);
  assert.equal(inPage({ getAttribute: () => null }).written[1], listed.written[1]);
  const own = inPage({ getAttribute: (name) => (name === 'data-pack' ? '/snake/lang/{code}.js?v=abc' : null) });
  assert.equal(own.written[1], '<script src="/snake/lang/bn.js?v=abc"></script>');
});
