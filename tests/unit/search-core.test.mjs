import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { bdnixSearch: S } = load('assets/js/search-core.js');

test('fold: lower case, no accents, only letters and digits split by single spaces', () => {
  assert.equal(S.fold('Merge PDFs'), 'merge pdfs');
  assert.equal(S.fold('  Café—PDF!  '), 'cafe pdf');
  assert.equal(S.fold('MP4 to MP3'), 'mp4 to mp3');
  assert.equal(S.fold('Eat, grow, don’t bite your tail'), 'eat grow don t bite your tail');
  assert.equal(S.fold(''), '');
  assert.equal(S.fold(null), '');
  assert.equal(S.fold(undefined), '');
  assert.equal(S.fold(42), '42');
});

test('terms: the words of a search, once each', () => {
  assert.deepEqual(plain(S.terms('Photo  collage')), ['photo', 'collage']);
  assert.deepEqual(plain(S.terms('pdf PDF pdf')), ['pdf']);
  assert.deepEqual(plain(S.terms('  ')), []);
  assert.deepEqual(plain(S.terms('--')), []);
  assert.deepEqual(plain(S.terms(null)), []);
});

test('matches: every word starts a word of the text', () => {
  const merge = 'Merge PDFs Combine PDFs into one tool pdf';
  assert.equal(S.matches(merge, 'pdf'), true);
  assert.equal(S.matches(merge, 'PDF'), true);
  assert.equal(S.matches(merge, 'merge pdf'), true);
  assert.equal(S.matches(merge, 'pdf merge'), true);
  assert.equal(S.matches(merge, 'me'), true);
  assert.equal(S.matches(merge, 'erge'), false);
  assert.equal(S.matches(merge, 'merge photo'), false);
  assert.equal(S.matches('Fit to Frame Add space to fit any shape', 'ape'), false);
  assert.equal(S.matches('Compress Images', 'comp im'), true);
  assert.equal(S.matches('MP4 to MP3', 'mp3'), true);
  assert.equal(S.matches('Café', 'cafe'), true);
});

test('matches: an empty search matches everything', () => {
  assert.equal(S.matches('Snake', ''), true);
  assert.equal(S.matches('Snake', '   '), true);
  assert.equal(S.matches('', ''), true);
  assert.equal(S.matches('', 'x'), false);
});
