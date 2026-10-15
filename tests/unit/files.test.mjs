import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const FILE = 'assets/js/files.js';
const { bdnixFiles: T } = load(FILE);

test('fmtSize', () => {
  assert.equal(T.fmtSize(0), '0 B');
  assert.equal(T.fmtSize(1023), '1023 B');
  assert.equal(T.fmtSize(1024), '1 KB');
  assert.equal(T.fmtSize(1536), '2 KB');
  assert.equal(T.fmtSize(1048576), '1.0 MB');
  assert.equal(T.fmtSize(5.5 * 1048576), '5.5 MB');
});

test('plural', () => {
  assert.equal(T.plural(0, 'page'), '0 pages');
  assert.equal(T.plural(1, 'page'), '1 page');
  assert.equal(T.plural(2, 'file'), '2 files');
});

test('readBytes: uses File.arrayBuffer when there is one', async () => {
  const buf = new ArrayBuffer(3);
  assert.equal(await T.readBytes({ arrayBuffer: async () => buf }), buf);
});

test('readBytes: falls back to a FileReader, and passes on its error', async () => {
  class FileReader {
    readAsArrayBuffer(file){
      setTimeout(() => {
        if (file.broken) { this.error = new Error('unreadable'); this.onerror(); }
        else { this.result = file.bytes; this.onload(); }
      });
    }
  }
  const { bdnixFiles } = load(FILE, { FileReader, setTimeout });
  const buf = new ArrayBuffer(2);
  assert.equal(await bdnixFiles.readBytes({ bytes: buf }), buf);
  await assert.rejects(bdnixFiles.readBytes({ broken: true }), /unreadable/);
});

test('onFileDrop: lights up the drop zone while files are dragged, and hands over dropped files', () => {
  const listeners = {};
  const document = { addEventListener: (type, fn) => { listeners[type] = fn; } };
  const { bdnixFiles } = load(FILE, { document });
  const classes = new Set();
  const zone = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
  const got = [];
  bdnixFiles.onFileDrop(zone, (files) => got.push(files));

  let prevented = 0;
  const event = (types, files) => ({ dataTransfer: { types, files, dropEffect: '' }, preventDefault: () => { prevented++; } });
  const withFiles = () => event(['Files']);

  // Text being dragged around the page is left alone.
  listeners.dragenter(event(['text/plain']));
  listeners.dragleave(event(['text/plain']));
  listeners.dragover(event(['text/plain']));
  assert.equal(classes.has('over'), false);
  assert.equal(prevented, 0);

  // Entering a child element fires another dragenter before the dragleave.
  listeners.dragenter(withFiles());
  listeners.dragenter(withFiles());
  listeners.dragleave(withFiles());
  assert.equal(classes.has('over'), true);
  const over = withFiles();
  listeners.dragover(over);
  assert.equal(over.dataTransfer.dropEffect, 'copy');
  listeners.dragleave(withFiles());
  assert.equal(classes.has('over'), false);

  listeners.dragenter(withFiles());
  listeners.drop(event(['Files'], ['a.pdf']));
  assert.equal(classes.has('over'), false);
  assert.deepEqual(got, [['a.pdf']]);
  listeners.drop(event(['text/plain'], ['b.txt']));
  assert.equal(got.length, 1);
});


// Just enough `document` for loadScript: a head that collects script tags,
// which the test then "runs" by calling their onload or onerror.
function scriptDocument(){
  const head = { tags: [], appendChild(t){ t.parentNode = head; head.tags.push(t); }, removeChild(t){ head.tags.splice(head.tags.indexOf(t), 1); t.parentNode = null; } };
  return { head, createElement: (name) => ({ name, parentNode: null }) };
}

test('loadScript: fetches a script once, and resolves to what it defines', async () => {
  const document = scriptDocument();
  const w = load(FILE, { document });
  const first = w.bdnixFiles.loadScript('/lib.js?v=1', 'Lib');
  const again = w.bdnixFiles.loadScript('/lib.js?v=1', 'Lib');
  assert.equal(first, again);
  assert.equal(document.head.tags.length, 1);
  const [tag] = document.head.tags;
  assert.deepEqual([tag.name, tag.src], ['script', '/lib.js?v=1']);
  w.Lib = { ok: true };
  tag.onload();
  assert.equal(await first, w.Lib);
  // Once it's there, no more tags.
  assert.equal(await w.bdnixFiles.loadScript('/lib.js?v=1', 'Lib'), w.Lib);
  assert.equal(document.head.tags.length, 1);
});

test('loadScript: a script already on the page is used as it is', async () => {
  const document = scriptDocument();
  const w = load(FILE, { document });
  w.Lib = { ok: true };
  assert.equal(await w.bdnixFiles.loadScript('/lib.js', 'Lib'), w.Lib);
  assert.equal(document.head.tags.length, 0);
});

test('loadScript: a failed fetch rejects, removes its tag and is tried again next time', async () => {
  const document = scriptDocument();
  const w = load(FILE, { document });
  const failed = w.bdnixFiles.loadScript('/lib.js', 'Lib');
  document.head.tags[0].onerror();
  await assert.rejects(failed, /\/lib\.js did not load/);
  assert.equal(document.head.tags.length, 0);

  // A script that runs but doesn't define what was asked for fails too.
  const empty = w.bdnixFiles.loadScript('/lib.js', 'Lib');
  document.head.tags[0].onload();
  await assert.rejects(empty, /did not load/);

  const retry = w.bdnixFiles.loadScript('/lib.js', 'Lib');
  assert.notEqual(retry, failed);
  w.Lib = 42;
  document.head.tags[0].onload();
  assert.equal(await retry, 42);
});

test('offer: a download link that opens in a new window', () => {
  const w = load(FILE);
  const listeners = [];
  const a = { addEventListener: (type, fn) => listeners.push([type, fn]) };
  assert.equal(w.bdnixFiles.offer(a, 'blob:x', 'report-signed.pdf'), a);
  assert.deepEqual([a.href, a.download, a.target, a.rel], ['blob:x', 'report-signed.pdf', '_blank', 'noopener']);
  // Pointed at a newer file, it still opens one window per click.
  w.bdnixFiles.offer(a, 'blob:y', 'report-signed.pdf');
  assert.equal(a.href, 'blob:y');
  assert.deepEqual(listeners.map(([type]) => type), ['click']);
});

test('words: English unless the page is in Bangla', () => {
  assert.equal(T.lang, 'en');
  assert.equal(T.words({ en: 'hi', bn: 'হ্যালো' }), 'hi');
  assert.equal(T.num(2026), '2026');
  assert.equal(T.fillIn('{n} of {total} for {name}', { n: 3, total: 10, name: 'A.pdf' }), '3 of 10 for A.pdf');
  assert.equal(T.fillIn('{missing} stays', {}), '{missing} stays');
  assert.equal(T.fillIn('no values'), 'no values');
  assert.equal(T.count(1, ['{n} page', '{n} pages']), '1 page');
  assert.equal(T.count(0, ['{n} page', '{n} pages']), '0 pages');
});

test('words: a page in Bangla gets its Bangla words and Bangla digits', () => {
  const { bdnixFiles: B } = load(FILE, { document: { documentElement: { lang: 'bn' } } });
  assert.equal(B.lang, 'bn');
  assert.equal(B.words({ en: 'hi', bn: 'হ্যালো' }), 'হ্যালো');
  assert.equal(B.words({ en: 'only English' }), 'only English');
  assert.equal(B.num(2026), '২০২৬');
  assert.equal(B.num('1.5 MB'), '১.৫ MB');
  assert.equal(B.fillIn('পৃষ্ঠা {page} / {pages}', { page: 3, pages: 12 }), 'পৃষ্ঠা ৩ / ১২');
  assert.equal(B.fillIn('{name}', { name: 'A1.pdf' }), 'A1.pdf', 'only numbers get Bangla digits, not text');
  assert.equal(B.count(5, ['{n}টি ফাইল', '{n}টি ফাইল']), '৫টি ফাইল');
  assert.equal(B.fmtSize(512), '৫১২ B');
  assert.equal(B.fmtSize(1536), '২ KB');
  assert.equal(B.fmtSize(5.5 * 1048576), '৫.৫ MB');
});
