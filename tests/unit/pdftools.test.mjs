import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const FILE = 'assets/js/pdftools.js';
const { bdnixPdf: T } = load(FILE);
const pages = (text, max) => plain(T.parseRange(text, max));

test('parseRange: empty means every page', () => {
  assert.deepEqual(pages('', 4), { pages: [0, 1, 2, 3] });
  assert.deepEqual(pages('   ', 2), { pages: [0, 1] });
});

test('parseRange: single pages and ranges, in the order written', () => {
  assert.deepEqual(pages('1-3, 5', 10), { pages: [0, 1, 2, 4] });
  assert.deepEqual(pages('5, 1', 10), { pages: [4, 0] });
  assert.deepEqual(pages('2', 2), { pages: [1] });
});

test('parseRange: open-ended and backwards ranges', () => {
  assert.deepEqual(pages('8-', 10), { pages: [7, 8, 9] });
  assert.deepEqual(pages('-3', 10), { pages: [0, 1, 2] });
  assert.deepEqual(pages('5-3', 10), { pages: [4, 3, 2] });
});

test('parseRange: forgiving about separators, spaces and dashes', () => {
  assert.deepEqual(pages('1 - 3', 5), { pages: [0, 1, 2] });
  assert.deepEqual(pages('1–3', 5), { pages: [0, 1, 2] }, 'en dash');
  assert.deepEqual(pages('1—2', 5), { pages: [0, 1] }, 'em dash');
  assert.deepEqual(pages('1;3 4', 5), { pages: [0, 2, 3] });
  assert.deepEqual(pages(' 1,,2, ', 5), { pages: [0, 1] });
});

test('parseRange: repeated pages are kept', () => {
  assert.deepEqual(pages('1,1', 3), { pages: [0, 0] });
});

test('parseRange: pages outside the file are an error', () => {
  assert.equal(pages('12', 10).error, 'No page 12 (this file has 10 pages)');
  assert.equal(pages('0', 10).error, 'No page 0 (this file has 10 pages)');
  assert.equal(pages('1-2', 1).error, 'No page 2 (this file has 1 page)');
  assert.equal(pages('3-', 2).error, 'No page 3 (this file has 2 pages)');
});

test('parseRange: things that are not pages are an error', () => {
  assert.equal(pages('abc', 5).error, '“abc” isn’t a page or range');
  assert.equal(pages('-', 5).error, '“-” isn’t a page or range');
  assert.equal(pages('1-2-3', 5).error, '“1-2-3” isn’t a page or range');
  assert.equal(pages('1.5', 5).error, '“1.5” isn’t a page or range');
});

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

test('isPdf: by type or by extension', () => {
  assert.equal(T.isPdf({ type: 'application/pdf', name: 'x' }), true);
  assert.equal(T.isPdf({ type: '', name: 'Report.PDF' }), true);
  assert.equal(T.isPdf({ type: 'text/plain', name: 'notes.txt' }), false);
  assert.equal(T.isPdf({ type: '', name: 'pdf' }), false);
});

test('readBytes: uses File.arrayBuffer when there is one', async () => {
  const buf = new ArrayBuffer(3);
  assert.equal(await T.readBytes({ arrayBuffer: async () => buf }), buf);
});

test('onFileDrop: lights up the drop zone while files are dragged, and hands over dropped files', () => {
  const listeners = {};
  const document = { addEventListener: (type, fn) => { listeners[type] = fn; } };
  const { bdnixPdf } = load(FILE, { document });
  const classes = new Set();
  const zone = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
  const got = [];
  bdnixPdf.onFileDrop(zone, (files) => got.push(files));

  let prevented = 0;
  const event = (types, files) => ({ dataTransfer: { types, files, dropEffect: '' }, preventDefault: () => { prevented++; } });
  const withFiles = () => event(['Files']);

  // Text being dragged around the page is left alone.
  listeners.dragenter(event(['text/plain']));
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

test('loadPdfjs: resolves to null when pdf.js can’t be loaded, and only tries once', async () => {
  // The sandbox has no module loader, so its import() always fails. (The
  // browser tests cover pdf.js loading for real.)
  const { bdnixPdf } = load(FILE);
  const first = bdnixPdf.loadPdfjs();
  assert.equal(bdnixPdf.loadPdfjs(), first);
  assert.equal(await first, null);
});

// A stream like Safari's: it has a reader but can't be used with `for await`.
function safariStream(){
  return class {
    constructor(chunks){ this.chunks = chunks; this.log = []; }
    getReader(){
      const s = this;
      s.log.push('lock');
      return {
        read: async () => (s.chunks.length ? { done: false, value: s.chunks.shift() } : { done: true, value: undefined }),
        cancel: async () => { s.log.push('cancel'); },
        releaseLock: () => { s.log.push('release'); }
      };
    }
  };
}

test('streamIterable: lets `for await` read a stream that lacks it', async () => {
  const Stream = safariStream();
  assert.equal(T.streamIterable(Stream), true);
  const s = new Stream(['a', 'b', 'c']);
  const got = [];
  for await (const chunk of s) got.push(chunk);
  assert.deepEqual(got, ['a', 'b', 'c']);
  assert.deepEqual(s.log, ['lock', 'release']);
  const it = new Stream([])[Symbol.asyncIterator]();
  assert.equal(it[Symbol.asyncIterator](), it);
});

test('streamIterable: stopping early cancels the stream', async () => {
  const Stream = safariStream();
  T.streamIterable(Stream);
  const s = new Stream(['a', 'b', 'c']);
  for await (const chunk of s) { assert.equal(chunk, 'a'); break; }
  assert.deepEqual(s.log, ['lock', 'cancel', 'release']);
  assert.deepEqual(s.chunks, ['b', 'c']);
});

test('streamIterable: leaves streams that already support it, and missing ones, alone', () => {
  const own = function(){ return 'native'; };
  const Stream = safariStream();
  Stream.prototype[Symbol.asyncIterator] = own;
  assert.equal(T.streamIterable(Stream), false);
  assert.equal(Stream.prototype[Symbol.asyncIterator], own);
  assert.equal(T.streamIterable(undefined), false);
});
