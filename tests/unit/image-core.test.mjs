import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { bdnixImages, bdnixImage: I } = load(['assets/js/images.js', 'assets/js/image-core.js']);

test('fit: limits the longest side, keeping the shape', () => {
  assert.deepEqual(plain(I.fit(4000, 3000, 1920)), { width: 1920, height: 1440, scaled: true });
  assert.deepEqual(plain(I.fit(3000, 4000, 1920)), { width: 1440, height: 1920, scaled: true });
  assert.deepEqual(plain(I.fit(1001, 333, 500)), { width: 500, height: 166, scaled: true });
  // Very thin images keep at least one pixel.
  assert.deepEqual(plain(I.fit(10000, 2, 100)), { width: 100, height: 1, scaled: true });
});

test('fit: never enlarges, and 0 means no limit', () => {
  assert.deepEqual(plain(I.fit(800, 600, 1920)), { width: 800, height: 600, scaled: false });
  assert.deepEqual(plain(I.fit(1920, 1080, 1920)), { width: 1920, height: 1080, scaled: false });
  assert.deepEqual(plain(I.fit(4000, 3000, 0)), { width: 4000, height: 3000, scaled: false });
});

test('fit: images too big for a phone’s canvas are scaled down to fit', () => {
  assert.equal(bdnixImages.MAX_AREA, 4096 * 4096);
  // A 48 megapixel phone photo.
  const big = I.fit(8064, 6048, 0);
  assert.equal(big.scaled, true);
  assert.ok(big.width * big.height <= bdnixImages.MAX_AREA);
  assert.ok(big.width * big.height > bdnixImages.MAX_AREA * 0.999);
  assert.ok(Math.abs(big.width / big.height - 8064 / 6048) < 0.001);
  // Exactly at the limit is fine.
  assert.deepEqual(plain(I.fit(4096, 4096, 0)), { width: 4096, height: 4096, scaled: false });
  // A custom limit, and the longest side applied first.
  assert.deepEqual(plain(I.fit(400, 100, 0, 10000)), { width: 200, height: 50, scaled: true });
  assert.deepEqual(plain(I.fit(8064, 6048, 1920)), { width: 1920, height: 1440, scaled: true });
});

test('keepOriginal: only when the result is no smaller, in the same format and size', () => {
  const jpg = { type: 'image/jpeg', name: 'a.jpg', size: 1000 };
  assert.equal(I.keepOriginal(jpg, 'jpeg', 1000, false), true);
  assert.equal(I.keepOriginal(jpg, 'jpeg', 1200, false), true);
  assert.equal(I.keepOriginal(jpg, 'jpeg', 999, false), false);
  // A resized or converted image is what was asked for, even if bigger.
  assert.equal(I.keepOriginal(jpg, 'jpeg', 1200, true), false);
  assert.equal(I.keepOriginal(jpg, 'png', 1200, false), false);
  assert.equal(I.keepOriginal({ type: 'image/gif', name: 'a.gif', size: 10 }, 'jpeg', 500, false), false);
});

test('saving: percent smaller, rounded down', () => {
  assert.equal(I.saving(1000, 380), '62% smaller');
  assert.equal(I.saving(1000, 999), 'under 1% smaller');
  assert.equal(I.saving(1000, 989), '1% smaller');
  assert.equal(I.saving(1000, 1), '99% smaller');
  assert.equal(I.saving(1000, 0), '99% smaller');
  assert.equal(I.saving(1000, 1000), 'no smaller');
  assert.equal(I.saving(1000, 2000), 'no smaller');
  assert.equal(I.saving(0, 0), 'no smaller');
});
