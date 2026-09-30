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
  // A final "s" goes, on words of three letters or more.
  assert.deepEqual(plain(S.terms('Games tools')), ['game', 'tool']);
  assert.deepEqual(plain(S.terms('game games')), ['game']);
  assert.deepEqual(plain(S.terms('is as ss')), ['is', 'as', 'ss']);
  assert.deepEqual(plain(S.terms('compress')), ['compres']);
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
  assert.equal(S.matches('Resize Without Cropping Add space to fit any shape', 'ape'), false);
  assert.equal(S.matches('Compress Images', 'comp im'), true);
  assert.equal(S.matches('MP4 to MP3', 'mp3'), true);
  assert.equal(S.matches('Café', 'cafe'), true);
});

test('matches: a plural finds the singular, as "games" finds "game"', () => {
  const games = 'Snake Eat, grow game arcade classic';
  assert.equal(S.matches(games, 'game'), true);
  assert.equal(S.matches(games, 'games'), true);
  assert.equal(S.matches(games, 'GAMES'), true);
  assert.equal(S.matches('Merge PDFs tool pdf', 'tools pdfs'), true);
  assert.equal(S.matches('Photo Collage image photo picture', 'photos images pictures'), true);
  // Words that end in "s" still find themselves.
  assert.equal(S.matches('Brick Bounce Smash the bricks', 'bricks'), true);
  assert.equal(S.matches('Compress Images', 'compress'), true);
  assert.equal(S.matches('Snake', 'snakes'), true);
  // Only a final "s" is dropped.
  assert.equal(S.matches('Snake game', 'gamez'), false);
  assert.equal(S.matches('Snake game', 'sgame'), false);
});

test('matches: an empty search matches everything', () => {
  assert.equal(S.matches('Snake', ''), true);
  assert.equal(S.matches('Snake', '   '), true);
  assert.equal(S.matches('', ''), true);
  assert.equal(S.matches('', 'x'), false);
});
