import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, variants } from './load.mjs';

for (const [kind, file] of variants('assets/js/pdftools.js')) describe(kind, () => {
  const { bdnixPdf: T } = load(file);
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
});
