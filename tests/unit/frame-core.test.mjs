import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { bdnixFrame: F } = load('assets/js/frame-core.js');

test('side: whole numbers of pixels from 1 to MAX_SIDE', () => {
  assert.equal(F.MAX_SIDE, 10000);
  assert.equal(F.side('1080'), 1080);
  assert.equal(F.side(' 1350 '), 1350);
  assert.equal(F.side('1'), 1);
  assert.equal(F.side('10000'), 10000);
  assert.equal(F.side(640), 640);
  assert.equal(F.side('0'), null);
  assert.equal(F.side('10001'), null);
  assert.equal(F.side('1234567'), null);
  assert.equal(F.side('12.5'), null);
  assert.equal(F.side('-5'), null);
  assert.equal(F.side('1e3'), null);
  assert.equal(F.side('abc'), null);
  assert.equal(F.side(''), null);
  assert.equal(F.side(null), null);
  assert.equal(F.side(undefined), null);
});

test('shapeOf: the preset of exactly that size, or custom', () => {
  assert.equal(F.shapeOf(1080, 1080), 'square');
  assert.equal(F.shapeOf(1080, 1350), 'portrait');
  assert.equal(F.shapeOf(1080, 1920), 'story');
  assert.equal(F.shapeOf(1200, 630), 'landscape');
  assert.equal(F.shapeOf(1920, 1080), 'wide');
  assert.equal(F.shapeOf(1000, 1500), 'tall');
  // Same shape, different size.
  assert.equal(F.shapeOf(500, 500), 'custom');
  assert.equal(F.shapeOf(1350, 1080), 'custom');
});

test('layout, full size: space is added to the sides or to the top and bottom', () => {
  // A landscape photo in a square: space above and below.
  assert.deepEqual(plain(F.layout(600, 400, 1080, 1080)), { width: 600, height: 600, x: 0, y: 100, w: 600, h: 400 });
  // A portrait photo in a square: space left and right.
  assert.deepEqual(plain(F.layout(300, 500, 1, 1)), { width: 500, height: 500, x: 100, y: 0, w: 300, h: 500 });
  // 4:5 and 9:16.
  assert.deepEqual(plain(F.layout(600, 400, 1080, 1350)), { width: 600, height: 750, x: 0, y: 175, w: 600, h: 400 });
  assert.deepEqual(plain(F.layout(1080, 1080, 1080, 1920)), { width: 1080, height: 1920, x: 0, y: 420, w: 1080, h: 1080 });
  // A tall image in a wide frame.
  assert.deepEqual(plain(F.layout(400, 900, 1920, 1080)), { width: 1600, height: 900, x: 600, y: 0, w: 400, h: 900 });
  // Already the right shape: nothing added.
  assert.deepEqual(plain(F.layout(1600, 900, 16, 9)), { width: 1600, height: 900, x: 0, y: 0, w: 1600, h: 900 });
  // An odd pixel of space goes after the image.
  assert.deepEqual(plain(F.layout(10, 7, 1, 1)), { width: 10, height: 10, x: 0, y: 1, w: 10, h: 7 });
});

test('layout, full size: an awkward shape still holds the whole image', () => {
  const L = F.layout(600, 400, 1200, 630);
  assert.deepEqual([L.w, L.h], [600, 400]);
  assert.equal(L.height, 400);
  assert.ok(L.width >= 600);
  assert.ok(Math.abs(L.width / L.height - 1200 / 630) < 0.005);
});

test('layout, full size: a margin adds the same space on every side', () => {
  // 10% of the frame's shorter side on each side.
  const L = F.layout(800, 800, 1, 1, { margin: 10 });
  assert.deepEqual(plain(L), { width: 1000, height: 1000, x: 100, y: 100, w: 800, h: 800 });
  // In a wide frame the margin is measured from its height.
  const W = F.layout(800, 400, 2, 1, { margin: 10 });
  assert.deepEqual(plain(W), { width: 1000, height: 500, x: 100, y: 50, w: 800, h: 400 });
  // Margins are limited to 0 to 25%.
  assert.deepEqual(plain(F.layout(500, 500, 1, 1, { margin: 90 })), { width: 1000, height: 1000, x: 250, y: 250, w: 500, h: 500 });
  assert.deepEqual(plain(F.layout(500, 500, 1, 1, { margin: -5 })), { width: 500, height: 500, x: 0, y: 0, w: 500, h: 500 });
});

test('layout, exact size: the image is scaled to fit the frame', () => {
  // Shrunk.
  assert.deepEqual(plain(F.layout(4000, 3000, 1080, 1080, { exact: true })), { width: 1080, height: 1080, x: 0, y: 135, w: 1080, h: 810 });
  // Enlarged.
  assert.deepEqual(plain(F.layout(300, 200, 1080, 1350, { exact: true })), { width: 1080, height: 1350, x: 0, y: 315, w: 1080, h: 720 });
  // Tall into wide.
  assert.deepEqual(plain(F.layout(1000, 2000, 1920, 1080, { exact: true })), { width: 1920, height: 1080, x: 690, y: 0, w: 540, h: 1080 });
  // With a margin of 10% of 1080 on every side.
  assert.deepEqual(plain(F.layout(1000, 1000, 1080, 1080, { exact: true, margin: 10 })), { width: 1080, height: 1080, x: 108, y: 108, w: 864, h: 864 });
  // A very thin image keeps at least one pixel.
  assert.deepEqual(plain(F.layout(10000, 1, 100, 100, { exact: true })), { width: 100, height: 100, x: 0, y: 49, w: 100, h: 1 });
});

test('layout: a frame bigger than the area limit is scaled down, image and all', () => {
  const area = 4096 * 4096;
  // A 48 megapixel photo in a 9:16 frame.
  const L = F.layout(8064, 6048, 1080, 1920, { area });
  assert.ok(L.width * L.height <= area);
  assert.ok(L.width * L.height > area * 0.998);
  assert.ok(Math.abs(L.height / L.width - 1920 / 1080) < 0.002);
  assert.equal(L.w, L.width);
  assert.ok(Math.abs(L.w / L.h - 8064 / 6048) < 0.002);
  assert.ok(L.y + L.h <= L.height);

  // An exact size too big to draw.
  const E = F.layout(100, 100, 10000, 10000, { exact: true, area });
  assert.deepEqual(plain(E), { width: 4096, height: 4096, x: 0, y: 0, w: 4096, h: 4096 });
  // Within the limit, nothing changes.
  assert.deepEqual(plain(F.layout(600, 400, 1, 1, { area })), { width: 600, height: 600, x: 0, y: 100, w: 600, h: 400 });
});
