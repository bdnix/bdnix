import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { bdnixImages: I } = load('assets/js/images.js');

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

test('outName: adds the tool’s word and the new extension', () => {
  assert.equal(I.outName('holiday photo.png', 'jpeg', 'compressed'), 'holiday photo-compressed.jpg');
  assert.equal(I.outName('IMG_0001.HEIC', 'jpeg', 'compressed'), 'IMG_0001-compressed.jpg');
  assert.equal(I.outName('a.b.jpg', 'webp', 'compressed'), 'a.b-compressed.webp');
  assert.equal(I.outName('noext', 'png', 'compressed'), 'noext-compressed.png');
  assert.equal(I.outName('.hidden', 'png', 'compressed'), '.hidden-compressed.png');
  assert.equal(I.outName('holiday photo.png', 'png', 'framed'), 'holiday photo-framed.png');
});

test('cover: the middle square, for thumbnails', () => {
  assert.deepEqual(plain(I.cover(600, 400)), { x: 100, y: 0, size: 400 });
  assert.deepEqual(plain(I.cover(300, 1000)), { x: 0, y: 350, size: 300 });
  assert.deepEqual(plain(I.cover(5, 2)), { x: 1, y: 0, size: 2 });
  assert.deepEqual(plain(I.cover(50, 50)), { x: 0, y: 0, size: 50 });
  assert.deepEqual(plain(I.cover(1, 1)), { x: 0, y: 0, size: 1 });
});

