import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { bdnixImage: I } = load('assets/js/image-core.js');

test('isImage: by type or by extension, but not SVG', () => {
  assert.equal(I.isImage({ type: 'image/jpeg', name: 'x' }), true);
  assert.equal(I.isImage({ type: 'image/heic', name: 'x' }), true);
  assert.equal(I.isImage({ type: '', name: 'IMG_0001.HEIC' }), true);
  assert.equal(I.isImage({ name: 'scan.tif' }), true);
  assert.equal(I.isImage({ type: '', name: 'photo.jpeg' }), true);
  assert.equal(I.isImage({ type: 'image/svg+xml', name: 'logo.svg' }), false);
  assert.equal(I.isImage({ type: '', name: 'logo.svg' }), false);
  assert.equal(I.isImage({ type: 'application/pdf', name: 'a.pdf' }), false);
  assert.equal(I.isImage({ type: '', name: 'png' }), false);
  assert.equal(I.isImage({}), false);
});

test('formatOf: JPEG, PNG and WebP by type or extension; others are null', () => {
  assert.equal(I.formatOf({ type: 'image/jpeg', name: 'x' }), 'jpeg');
  assert.equal(I.formatOf({ type: '', name: 'a.JPG' }), 'jpeg');
  assert.equal(I.formatOf({ type: '', name: 'a.jfif' }), 'jpeg');
  assert.equal(I.formatOf({ type: 'image/png', name: 'x' }), 'png');
  assert.equal(I.formatOf({ type: '', name: 'a.png' }), 'png');
  assert.equal(I.formatOf({ type: 'image/webp', name: 'x' }), 'webp');
  assert.equal(I.formatOf({ type: '', name: 'a.webp' }), 'webp');
  assert.equal(I.formatOf({ type: 'image/gif', name: 'a.gif' }), null);
  assert.equal(I.formatOf({ type: 'image/heic', name: 'a.heic' }), null);
  assert.equal(I.formatOf({}), null);
});

test('target: a chosen format wins; "same" keeps JPEG, PNG and WebP, and makes the rest JPEG', () => {
  const png = { type: 'image/png', name: 'a.png' }, gif = { type: 'image/gif', name: 'a.gif' };
  assert.equal(I.target('webp', png), 'webp');
  assert.equal(I.target('jpeg', png), 'jpeg');
  assert.equal(I.target('png', gif), 'png');
  assert.equal(I.target('same', png), 'png');
  assert.equal(I.target('same', { type: 'image/webp', name: 'a' }), 'webp');
  assert.equal(I.target('same', { type: 'image/jpeg', name: 'a' }), 'jpeg');
  assert.equal(I.target('same', gif), 'jpeg');
  assert.equal(I.target('same', { type: 'image/heic', name: 'IMG.heic' }), 'jpeg');
  // Only real formats count as a choice, not inherited object keys.
  assert.equal(I.target('toString', png), 'png');
});

test('outName: adds -compressed and the new extension', () => {
  assert.equal(I.outName('holiday photo.png', 'jpeg'), 'holiday photo-compressed.jpg');
  assert.equal(I.outName('IMG_0001.HEIC', 'jpeg'), 'IMG_0001-compressed.jpg');
  assert.equal(I.outName('a.b.jpg', 'webp'), 'a.b-compressed.webp');
  assert.equal(I.outName('noext', 'png'), 'noext-compressed.png');
  assert.equal(I.outName('.hidden', 'png'), '.hidden-compressed.png');
});

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
  assert.equal(I.MAX_AREA, 4096 * 4096);
  // A 48 megapixel phone photo.
  const big = I.fit(8064, 6048, 0);
  assert.equal(big.scaled, true);
  assert.ok(big.width * big.height <= I.MAX_AREA);
  assert.ok(big.width * big.height > I.MAX_AREA * 0.999);
  assert.ok(Math.abs(big.width / big.height - 8064 / 6048) < 0.001);
  // Exactly at the limit is fine.
  assert.deepEqual(plain(I.fit(4096, 4096, 0)), { width: 4096, height: 4096, scaled: false });
  // A custom limit, and the longest side applied first.
  assert.deepEqual(plain(I.fit(400, 100, 0, 10000)), { width: 200, height: 50, scaled: true });
  assert.deepEqual(plain(I.fit(8064, 6048, 1920)), { width: 1920, height: 1440, scaled: true });
});

test('cover: the middle square, for thumbnails', () => {
  assert.deepEqual(plain(I.cover(600, 400)), { x: 100, y: 0, size: 400 });
  assert.deepEqual(plain(I.cover(300, 1000)), { x: 0, y: 350, size: 300 });
  assert.deepEqual(plain(I.cover(5, 2)), { x: 1, y: 0, size: 2 });
  assert.deepEqual(plain(I.cover(50, 50)), { x: 0, y: 0, size: 50 });
  assert.deepEqual(plain(I.cover(1, 1)), { x: 0, y: 0, size: 1 });
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
