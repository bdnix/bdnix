import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, fakeStorage, fakeDocument } from './load.mjs';

const FILE = 'assets/js/profile.js';

function setup(stored = {}){
  const localStorage = fakeStorage(stored);
  const document = fakeDocument();
  const w = load(FILE, { localStorage, document, addEventListener(){} });
  return { P: w.bdnixProfile, localStorage, document };
}

test('name defaults to "User"', () => {
  assert.equal(setup().P.getName(), 'User');
});

test('setName tidies spaces, saves, and returns the name in use', () => {
  const { P, localStorage } = setup();
  assert.equal(P.setName('  Musa   Rahman '), 'Musa Rahman');
  assert.equal(localStorage.getItem('bdnix_name'), 'Musa Rahman');
  assert.equal(P.getName(), 'Musa Rahman');
});

test('setName keeps at most 24 characters', () => {
  const { P } = setup();
  assert.equal(P.setName('A'.repeat(30)), 'A'.repeat(24));
});

test('an empty name, or "User", goes back to the default and clears storage', () => {
  const { P, localStorage } = setup({ bdnix_name: 'Musa' });
  assert.equal(P.setName('   '), 'User');
  assert.equal(localStorage.getItem('bdnix_name'), null);
  P.setName('Musa');
  assert.equal(P.setName('User'), 'User');
  assert.equal(localStorage.getItem('bdnix_name'), null);
});

test('a stored name is tidied when read, too', () => {
  assert.equal(setup({ bdnix_name: '  Sam  ' }).P.getName(), 'Sam');
  assert.equal(setup({ bdnix_name: '   ' }).P.getName(), 'User');
});

test('initial: first character, uppercased, emoji-safe', () => {
  const { P } = setup();
  assert.equal(P.initial('musa'), 'M');
  assert.equal(P.initial('😀 Smile'), '😀');
  assert.equal(P.initial(''), '?');
});

test('scores come from the keys the games write', () => {
  const { P } = setup({ bdnix_tetris_best: '12450', bdnix_pacman_best: '3120' });
  assert.deepEqual(plain(P.scores()), [
    { id: 'tetris', name: 'Tetris', href: '/play/', best: 12450 },
    { id: 'pacman', name: 'Pac-Man', href: '/pacman/', best: 3120 }
  ]);
});

test('missing or junk scores count as not played', () => {
  const { P } = setup({ bdnix_tetris_best: 'abc', bdnix_pacman_best: '-5' });
  assert.deepEqual(plain(P.scores()).map((s) => s.best), [0, 0]);
});

test('visits come from the landing page counter', () => {
  assert.equal(setup({ bdnix_visits: '7' }).P.visits(), 7);
  assert.equal(setup().P.visits(), 0);
});

test('fill writes the name and initial into the page', () => {
  const { P, document } = setup({ bdnix_name: 'musa' });
  assert.equal(document.elements['[data-profile-name]'][0].textContent, 'musa', 'filled on load');
  assert.equal(document.elements['[data-profile-initial]'][0].textContent, 'M');
  P.setName('Zed');
  assert.equal(document.elements['[data-profile-name]'][0].textContent, 'Zed', 'refilled on save');
  assert.equal(document.elements['[data-profile-initial]'][0].textContent, 'Z');
});

test('blocked storage (e.g. private mode) falls back quietly', () => {
  const broken = { getItem(){ throw new Error('denied'); }, setItem(){ throw new Error('denied'); }, removeItem(){ throw new Error('denied'); } };
  const w = load(FILE, { localStorage: broken, document: fakeDocument(), addEventListener(){} });
  assert.equal(w.bdnixProfile.getName(), 'User');
  assert.equal(w.bdnixProfile.setName('Musa'), 'Musa');
  assert.deepEqual(plain(w.bdnixProfile.scores()).map((s) => s.best), [0, 0]);
});
