import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, fakeStorage } from './load.mjs';

const FILE = 'assets/js/gamesave.js';

function setup(localStorage = fakeStorage()){
  const listeners = {};
  const w = load(FILE, {
    localStorage,
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }
  });
  return { S: w.bdnixSave, localStorage, fire: (type) => (listeners[type] || []).forEach((fn) => fn()) };
}

// Storage that throws on every call, as blocked storage does.
const blocked = {
  getItem(){ throw new Error('blocked'); },
  setItem(){ throw new Error('blocked'); },
  removeItem(){ throw new Error('blocked'); }
};

test('each game has its own key', () => {
  const { S } = setup();
  assert.equal(S.key('tetris'), 'bdnix_tetris_save');
  assert.equal(S.key('pacman'), 'bdnix_pacman_save');
  assert.equal(S.key('flappy'), 'bdnix_flappy_save');
});

test('a saved state loads back, versioned', () => {
  const { S, localStorage } = setup();
  const state = { score: 120, grid: [[null, 'T'], ['O', null]], piece: null };
  assert.equal(S.save('tetris', state), true);
  assert.deepEqual(JSON.parse(localStorage.getItem('bdnix_tetris_save')), { v: 1, data: state });
  assert.deepEqual(plain(S.load('tetris')), state);
  assert.equal(S.load('pacman'), null);                    // other games are separate
});

test('clear removes the save', () => {
  const { S, localStorage } = setup();
  S.save('flappy', { score: 3 });
  S.clear('flappy');
  assert.equal(localStorage.getItem('bdnix_flappy_save'), null);
  assert.equal(S.load('flappy'), null);
});

test('nothing saved, unreadable JSON, another version or no data all load as null', () => {
  for (const stored of [
    undefined,
    '{not json',
    'null',
    '42',
    JSON.stringify({ v: 2, data: { score: 1 } }),
    JSON.stringify({ v: 1 }),
    JSON.stringify({ v: 1, data: 'score' }),
    JSON.stringify({ data: { score: 1 } })
  ]) {
    const storage = fakeStorage(stored === undefined ? {} : { bdnix_tetris_save: stored });
    assert.equal(setup(storage).S.load('tetris'), null, String(stored));
  }
});

test('blocked storage: saving fails quietly, loading finds nothing', () => {
  const { S } = setup(blocked);
  assert.equal(S.save('tetris', { score: 1 }), false);
  assert.equal(S.load('tetris'), null);
  assert.doesNotThrow(() => S.clear('tetris'));
});

test('keep saves the snapshot when the page goes away, and clears it when there is none', () => {
  const { S, localStorage, fire } = setup();
  let snapshot = { score: 50 };
  const flush = S.keep('pacman', () => snapshot);
  fire('pagehide');
  assert.deepEqual(plain(S.load('pacman')), { score: 50 });

  snapshot = { score: 60 };
  flush();                                                 // the game can save any time too
  assert.deepEqual(plain(S.load('pacman')), { score: 60 });

  snapshot = null;                                         // game over: nothing to keep
  fire('pagehide');
  assert.equal(localStorage.getItem('bdnix_pacman_save'), null);
});

test('num accepts only finite numbers', () => {
  const { S } = setup();
  for (const n of [0, -3, 1.5, 1e9]) assert.equal(S.num(n), true, String(n));
  for (const n of [NaN, Infinity, -Infinity, null, undefined, '1', {}, []]) assert.equal(S.num(n), false, String(n));
});
