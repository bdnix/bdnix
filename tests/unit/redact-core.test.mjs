import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const FILE = 'assets/js/redact-core.js';
const { bdnixRedact: R } = load(FILE);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const nearBox = (a, b) => { for (const k of ['x', 'y', 'w', 'h']) near(a[k], b[k], k); };

test('boxFrom: corners in any order, clipped to the page', () => {
  nearBox(R.boxFrom(0.2, 0.3, 0.6, 0.5), { x: 0.2, y: 0.3, w: 0.4, h: 0.2 });
  nearBox(R.boxFrom(0.6, 0.5, 0.2, 0.3), { x: 0.2, y: 0.3, w: 0.4, h: 0.2 });
  assert.deepEqual(plain(R.boxFrom(-0.5, 1.4, 0.5, 0.75)), { x: 0, y: 0.75, w: 0.5, h: 0.25 });
  assert.deepEqual(plain(R.boxFrom(2, 2, 3, 3)), { x: 1, y: 1, w: 0, h: 0 });
});

test('addBoxes: skips boxes that are already there', () => {
  const list = [R.boxFrom(0, 0, 0.5, 0.5)];
  assert.equal(R.addBoxes(list, [R.boxFrom(0.5, 0.5, 0, 0), R.boxFrom(0, 0, 1, 1), R.boxFrom(0, 0, 1, 1)]), 1);
  assert.equal(list.length, 2);
  assert.equal(R.sameBox(list[0], list[1]), false);
  assert.equal(R.addBoxes(list, []), 0);
});

test('pixelRect: rounds outwards so nothing peeks out', () => {
  assert.deepEqual(plain(R.pixelRect({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 100, 200)), { x: 25, y: 100, w: 50, h: 50 });
  // 10.3..20.7 px across must cover pixels 10 to 20.
  assert.deepEqual(plain(R.pixelRect({ x: 0.103, y: 0.103, w: 0.104, h: 0.104 }, 100, 100)), { x: 10, y: 10, w: 11, h: 11 });
  assert.deepEqual(plain(R.pixelRect({ x: 0, y: 0, w: 1, h: 1 }, 1191, 1684)), { x: 0, y: 0, w: 1191, h: 1684 });
});

test('outputScale: 144 dpi, but never a side over 5000 pixels', () => {
  assert.equal(R.outputScale(595, 842), 2);
  assert.equal(R.outputScale(842, 595), 2);
  assert.equal(R.outputScale(5000, 1000), 1);
  assert.equal(R.outputScale(1000, 10000), 0.5);
});

test('pattern: nothing to find in an empty query; special characters are literal', () => {
  assert.equal(R.pattern(''), null);
  assert.equal(R.pattern('   '), null);
  const re = R.pattern('$5.00 (net)');
  assert.ok(re.test('Total: $5.00 (net)'));
  re.lastIndex = 0;
  assert.equal(re.test('Total: $5a00 net'), false);
});

const items = (...strs) => strs.map((s) => (typeof s === 'string' ? { str: s, hasEOL: false } : s));

test('findMatches: inside a piece, ignoring capitals, every occurrence', () => {
  assert.deepEqual(plain(R.findMatches(items('Jane Doe and JANE DOE'), 'jane doe')), [
    [{ item: 0, start: 0, end: 8 }],
    [{ item: 0, start: 13, end: 21 }]
  ]);
  assert.deepEqual(plain(R.findMatches(items('nothing here'), 'jane')), []);
  assert.deepEqual(plain(R.findMatches(items('Jane'), '  ')), []);
});

test('findMatches: across pieces, with or without the space between words', () => {
  // PDFs often split a line into pieces and leave spaces out.
  assert.deepEqual(plain(R.findMatches(items('Name: Ja', 'ne', 'Doe'), 'jane doe')), [[
    { item: 0, start: 6, end: 8 }, { item: 1, start: 0, end: 2 }, { item: 2, start: 0, end: 3 }
  ]]);
  assert.deepEqual(plain(R.findMatches(items('Jane', ' ', 'Doe'), 'Jane   Doe')), [[
    { item: 0, start: 0, end: 4 }, { item: 1, start: 0, end: 1 }, { item: 2, start: 0, end: 3 }
  ]]);
});

test('findMatches: runs over a line break, which belongs to no piece', () => {
  const lines = items({ str: 'Jane', hasEOL: true }, { str: 'Doe', hasEOL: true }, 'Doe');
  assert.deepEqual(plain(R.findMatches(lines, 'jane doe')), [[
    { item: 0, start: 0, end: 4 }, { item: 1, start: 0, end: 3 }
  ]]);
  // The break stops "DoeDoe" from being one word.
  assert.equal(R.findMatches(lines, 'doedoe').length, 0);
});

// Upright 10pt text whose baseline starts at (100, 200) on a 400 x 500 page
// (y down), 40 units long for its 4 characters.
const piece = { str: 'abcd', width: 40, tx: [10, 0, 0, -10, 100, 200] };

test('textBox: upright text, padded around the characters', () => {
  const box = R.textBox(piece, 1, 3, 400, 500);
  // Characters 1-2 run from x 110 to 130; padding is 1.2 each side.
  nearBox(box, { x: 108.8 / 400, y: (200 - 10.5) / 500, w: 22.4 / 400, h: 13.5 / 500 });
});

test('textBox: uses measure() to place characters of different widths', () => {
  // "i" is narrow: 1 unit to "w"'s 3, so "iw" = 4 units and "w" starts a quarter in.
  const narrow = { str: 'iw', width: 40, tx: [10, 0, 0, -10, 0, 20], font: 'serif' };
  const seen = [];
  const measure = (s, it) => { seen.push(it.font); return [...s].reduce((n, c) => n + (c === 'i' ? 1 : 3), 0); };
  const box = R.textBox(narrow, 1, 2, 100, 100, measure);
  near(box.x, (10 - 1.2) / 100, 'x');
  near(box.w, (30 + 2.4) / 100, 'w');
  assert.deepEqual([...new Set(seen)], ['serif']);
});

test('textBox: text turned sideways covers the right area', () => {
  // Reads downwards: the baseline runs along +y, "up" points to +x.
  const down = { str: 'ab', width: 20, tx: [0, 10, 10, 0, 50, 100] };
  nearBox(R.textBox(down, 0, 2, 200, 200), { x: 47 / 200, y: 98.8 / 200, w: 13.5 / 200, h: 22.4 / 200 });
});

test('textBox: an empty piece or a zero-size matrix gives a finite box', () => {
  const box = R.textBox({ str: '', width: 0, tx: [0, 0, 0, 0, 10, 10] }, 0, 0, 100, 100);
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(box[k]), k);
});

test('matchBoxes: one box for each piece of each match', () => {
  const its = [piece, { str: 'ef', width: 20, tx: [10, 0, 0, -10, 140, 200] }];
  const boxes = R.matchBoxes(its, [[{ item: 0, start: 2, end: 4 }, { item: 1, start: 0, end: 1 }], [{ item: 1, start: 1, end: 2 }]], 400, 500);
  assert.equal(boxes.length, 3);
  nearBox(boxes[0], R.textBox(piece, 2, 4, 400, 500));
  near(boxes[2].x, (150 - 1.2) / 400, 'second match x');
  assert.deepEqual(plain(R.matchBoxes(its, [], 400, 500)), []);
});
