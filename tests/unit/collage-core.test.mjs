import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { bdnixCollage: C } = load('assets/js/collage-core.js');

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('layouts: 3, 6 and 9 photos each have a choice, with one cell per photo', () => {
  assert.deepEqual(plain(C.COUNTS), [3, 6, 9]);
  assert.equal(C.MAX, 9);
  for (const n of C.COUNTS) {
    const list = C.layoutsFor(n);
    assert.ok(list.length >= 4, `${n} photos have at least 4 layouts`);
    const ids = list.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length, `${n}: ids are unique`);
    for (const l of list) {
      assert.equal(l.cells.length, n, `${n} ${l.id}`);
      assert.ok(l.name);
    }
  }
});

test('layouts: the cells of every layout cover the collage exactly, without overlapping', () => {
  for (const n of C.COUNTS) {
    for (const l of C.layoutsFor(n)) {
      const area = l.cells.reduce((sum, [, , w, h]) => sum + w * h, 0);
      assert.ok(close(area, 1), `${n} ${l.id}: cells add up to the whole collage (${area})`);
      for (const [x, y, w, h] of l.cells) {
        assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 + 1e-9 && y + h <= 1 + 1e-9, `${n} ${l.id}: inside`);
      }
      l.cells.forEach((a, i) => l.cells.slice(i + 1).forEach((b) => {
        const overlap = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) *
          Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
        assert.ok(overlap < 1e-9, `${n} ${l.id}: cells overlap`);
      }));
    }
  }
});

test('layout: finds a layout by id, falls back to the first, and has none for other counts', () => {
  assert.equal(C.layout(6, 'feature').id, 'feature');
  assert.equal(C.layout(9, 'mosaic').name, 'Mosaic');
  assert.equal(C.layout(3, 'nope').id, 'row');
  assert.equal(C.layout(3, undefined).id, 'row');
  assert.equal(C.layout(6, 'mosaic').id, 'grid');
  assert.equal(C.layout(4, 'grid'), null);
  assert.equal(C.layout(0), null);
  assert.deepEqual(plain(C.layoutsFor(10)), []);
  assert.deepEqual(plain(C.layoutsFor('toString')), []);
});

test('layouts: rows and columns are laid out in reading order', () => {
  assert.deepEqual(plain(C.layout(6, 'grid').cells.map(([x, y]) => [+(x * 3).toFixed(6), +(y * 2).toFixed(6)])), [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]);
  // Columns: 2 photos down the left, 4 down the right.
  assert.deepEqual(plain(C.layout(6, 'columns').cells), [[0, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0, 0.5, 0.25], [0.5, 0.25, 0.5, 0.25], [0.5, 0.5, 0.5, 0.25], [0.5, 0.75, 0.5, 0.25]]);
  // Steps of 2, 3 and 4 photos.
  assert.deepEqual(plain(C.layout(9, 'steps').cells.map((c) => c[2])), [0.5, 0.5, 1 / 3, 1 / 3, 1 / 3, 0.25, 0.25, 0.25, 0.25]);
});

test('size: the longest side, in the shape’s proportions', () => {
  assert.deepEqual(plain(C.size('square', 2048)), { width: 2048, height: 2048 });
  assert.deepEqual(plain(C.size('portrait', 1080)), { width: 864, height: 1080 });
  assert.deepEqual(plain(C.size('story', 1080)), { width: 608, height: 1080 });
  assert.deepEqual(plain(C.size('landscape', 4096)), { width: 4096, height: 2731 });
  assert.deepEqual(plain(C.size('wide', 2048)), { width: 2048, height: 1152 });
  assert.deepEqual(plain(C.size('unknown', 900)), { width: 900, height: 900 });
  for (const longest of C.SIZES) {
    for (const shape of Object.keys(C.SHAPES)) {
      const s = C.size(shape, longest);
      assert.ok(s.width * s.height <= 4096 * 4096, `${shape} ${longest} fits an iPhone canvas`);
    }
  }
});

test('scaled: spacing and corners grow with the collage', () => {
  assert.equal(C.scaled(12, 2048), 25);
  assert.equal(C.scaled(12, 900), 11);
  assert.equal(C.scaled(40, 1080), 43);
  assert.equal(C.scaled(0, 4096), 0);
});

test('boxes: equal spacing between photos and at the edges', () => {
  const [a, b, c] = plain(C.boxes(C.layout(3, 'row').cells, 310, 100, 10));
  assert.deepEqual(a, { x: 10, y: 10, w: 90, h: 80 });
  assert.deepEqual(b, { x: 110, y: 10, w: 90, h: 80 });
  assert.deepEqual(c, { x: 210, y: 10, w: 90, h: 80 });
  // No spacing: the boxes fill the collage.
  assert.deepEqual(plain(C.boxes([[0, 0, 1, 1]], 50, 40)), [{ x: 0, y: 0, w: 50, h: 40 }]);
  // Big and small photos line up: the big one's edge meets the small ones'.
  const [big, top, bottom] = plain(C.boxes(C.layout(3, 'left').cells, 300, 200, 12));
  assert.equal(big.y, top.y);
  assert.equal(big.y + big.h, bottom.y + bottom.h);
  assert.equal(top.x - (big.x + big.w), 12);
  assert.equal(bottom.y - (top.y + top.h), 12);
  // Never smaller than a pixel, even when the spacing takes everything.
  assert.deepEqual(plain(C.boxes([[0, 0, 1, 1]], 10, 10, 20)), [{ x: 20, y: 20, w: 1, h: 1 }]);
});

test('cover: crops the middle of a photo to the box’s shape', () => {
  assert.deepEqual(plain(C.cover(400, 100, 100, 100)), { sx: 150, sy: 0, sw: 100, sh: 100 });
  assert.deepEqual(plain(C.cover(100, 400, 200, 100)), { sx: 0, sy: 175, sw: 100, sh: 50 });
  assert.deepEqual(plain(C.cover(300, 200, 600, 400)), { sx: 0, sy: 0, sw: 300, sh: 200 });
  // Or another part of it: the left edge, the bottom, a quarter of the way.
  assert.deepEqual(plain(C.cover(400, 100, 100, 100, { x: 0, y: 0.5 })), { sx: 0, sy: 0, sw: 100, sh: 100 });
  assert.deepEqual(plain(C.cover(400, 100, 100, 100, { x: 1, y: 0.5 })), { sx: 300, sy: 0, sw: 100, sh: 100 });
  assert.deepEqual(plain(C.cover(100, 400, 200, 100, { x: 0.5, y: 1 })), { sx: 0, sy: 350, sw: 100, sh: 50 });
  assert.deepEqual(plain(C.cover(400, 100, 100, 100, { x: 0.25, y: 0.5 })), { sx: 75, sy: 0, sw: 100, sh: 100 });
});

test('pan: the photo follows the drag and stops at its edges', () => {
  const mid = { x: 0.5, y: 0.5 };
  // A 400 x 100 photo in a 100 x 100 box: 300 px cropped off, drawn at full size.
  // Dragging right 75 px shows 75 px more of the left.
  assert.deepEqual(plain(C.pan(mid, 400, 100, 100, 100, 75, 0)), { x: 0.25, y: 0.5 });
  assert.deepEqual(plain(C.pan(mid, 400, 100, 100, 100, -150, 0)), { x: 1, y: 0.5 });
  assert.deepEqual(plain(C.pan(mid, 400, 100, 100, 100, 1000, 0)), { x: 0, y: 0.5 });
  assert.deepEqual(plain(C.pan(mid, 400, 100, 100, 100, -1000, 0)), { x: 1, y: 0.5 });
  // Drawn at half size: a drag moves it twice as far through the photo.
  assert.deepEqual(plain(C.pan(mid, 800, 200, 100, 100, 75, 0)), { x: 0.25, y: 0.5 });
  // Nothing is cropped top or bottom, so it can't move up or down, and
  // keeps its pos for a box that does crop it.
  assert.deepEqual(plain(C.pan({ x: 0.5, y: 0.2 }, 400, 100, 100, 100, 0, 40)), { x: 0.5, y: 0.2 });
  // A tall photo in a wide box moves up and down.
  assert.deepEqual(plain(C.pan(mid, 100, 400, 200, 100, 0, -50)), { x: 0.5, y: 0.5 + 25 / 350 });
  const c = C.cover(100, 400, 200, 100, C.pan(mid, 100, 400, 200, 100, 0, -50));
  assert.ok(close(c.sy, 175 + 25), 'up 50 box px is 25 photo px');
  // A photo the same shape as its box stays put.
  assert.deepEqual(plain(C.pan(mid, 300, 200, 600, 400, 50, 50)), mid);
});

test('cover and pan: a zoomed photo shows less of itself, and moves further to reach its edges', () => {
  assert.equal(C.ZOOM_MAX, 4);
  assert.deepEqual(plain(C.cover(400, 100, 100, 100, { x: 0.5, y: 0.5 }, 2)), { sx: 175, sy: 25, sw: 50, sh: 50 });
  assert.deepEqual(plain(C.cover(100, 100, 100, 100, null, 4)), { sx: 37.5, sy: 37.5, sw: 25, sh: 25 });
  assert.deepEqual(plain(C.cover(100, 100, 100, 100, { x: 0, y: 1 }, 2)), { sx: 0, sy: 50, sw: 50, sh: 50 });
  // Not zoomed, a square photo in a square box can't move; zoomed 2x it
  // has 50 px to spare, drawn at twice the size, so 50 px of the box is half of it.
  assert.deepEqual(plain(C.pan({ x: 0.5, y: 0.5 }, 100, 100, 100, 100, 50, 0)), { x: 0.5, y: 0.5 });
  assert.deepEqual(plain(C.pan({ x: 0.5, y: 0.5 }, 100, 100, 100, 100, 50, -25, 2)), { x: 0, y: 0.75 });
});

test('zoomTo: zooms about the middle of what shows, as far as the photo’s edges', () => {
  const mid = { x: 0.5, y: 0.5 };
  assert.deepEqual(plain(C.zoomTo(mid, 1, 2, 100, 100, 100, 100)), { zoom: 2, pos: mid });
  // Zoomed 2x into the top left quarter, whose middle is at 25, 25: at 4x
  // that stays in the middle.
  const z = C.zoomTo({ x: 0, y: 0 }, 2, 4, 100, 100, 100, 100);
  assert.equal(z.zoom, 4);
  const c = C.cover(100, 100, 100, 100, z.pos, z.zoom);
  assert.ok(close(c.sx + c.sw / 2, 25) && close(c.sy + c.sh / 2, 25), 'the same middle');
  // Zooming out near an edge stops at the edge rather than leaving a gap.
  assert.deepEqual(plain(C.zoomTo({ x: 1, y: 1 }, 4, 2, 100, 100, 100, 100)), { zoom: 2, pos: { x: 1, y: 1 } });
  // All the way out, nothing is cropped from a square photo, so it keeps its pos.
  assert.deepEqual(plain(C.zoomTo({ x: 0.2, y: 0.9 }, 2, 1, 100, 100, 100, 100)), { zoom: 1, pos: { x: 0.2, y: 0.9 } });
  // A wide photo: it was cropped left and right, and now top and bottom too.
  assert.deepEqual(plain(C.zoomTo(mid, 1, 2, 400, 100, 100, 100)), { zoom: 2, pos: mid });
  // Kept from 1 to 4.
  assert.equal(C.zoomTo(mid, 1, 10, 100, 100, 100, 100).zoom, 4);
  assert.equal(C.zoomTo(mid, 2, 0.5, 100, 100, 100, 100).zoom, 1);
  assert.equal(C.zoomTo(mid, 2, NaN, 100, 100, 100, 100).zoom, 1);
});

test('hit: which box a point is in', () => {
  const boxes = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }];
  assert.equal(C.hit(boxes, 5, 5), 0);
  assert.equal(C.hit(boxes, 20, 9.9), 1);
  assert.equal(C.hit(boxes, 15, 5), -1);
  assert.equal(C.hit(boxes, 10, 5), -1);
  assert.equal(C.hit([], 0, 0), -1);
});

test('advice: how many photos to add or remove', () => {
  assert.equal(C.advice(0), 'Add 3, 6 or 9 photos.');
  assert.equal(C.advice(1), 'Add 2 more for a collage of 3.');
  assert.equal(C.advice(2), 'Add 1 more for a collage of 3.');
  assert.equal(C.advice(3), '');
  assert.equal(C.advice(4), 'Add 2 more for a collage of 6, or remove 1 for a collage of 3.');
  assert.equal(C.advice(5), 'Add 1 more for a collage of 6, or remove 2 for a collage of 3.');
  assert.equal(C.advice(6), '');
  assert.equal(C.advice(8), 'Add 1 more for a collage of 9, or remove 2 for a collage of 6.');
  assert.equal(C.advice(9), '');
});

test('outName: collage.jpg or collage.png', () => {
  assert.equal(C.outName('jpeg'), 'collage.jpg');
  assert.equal(C.outName('png'), 'collage.png');
  assert.equal(C.outName('gif'), 'collage.jpg');
});
