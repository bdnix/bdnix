import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const F = load('assets/js/snake-core.js').bdnixSnake;

// Steps `n` times; returns how the round ended, if it did.
function run(w, n){
  for (let i = 0; i < n; i++) {
    const end = F.step(w);
    if (end) return end;
  }
  return null;
}
// Every cell of the board in one winding path, row by row: right along the
// top row, left along the next, and so on.
function winding(){
  const path = [];
  for (let y = 0; y < F.ROWS; y++) {
    for (let i = 0; i < F.COLS; i++) path.push({ x: y % 2 ? F.COLS - 1 - i : i, y });
  }
  return path;
}

test('a new round: three long, heading right, with the food straight ahead', () => {
  const w = F.create(() => 0);
  assert.deepEqual(plain(w.body), [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }]);
  assert.equal(w.dir, 'right');
  assert.deepEqual(plain(w.food), plain(F.FIRST_FOOD));
  assert.equal(w.score, 0);
  assert.equal(w.dead, null);
  const r = F.create().rand();
  assert.ok(r >= 0 && r < 1, 'Math.random by default');
});

test('each step moves the head on and the tail along', () => {
  const w = F.create(() => 0);
  assert.equal(F.step(w), null);
  assert.deepEqual(plain(w.body), [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }]);
});

test('the trail is where the tail was before the last step, for drawing the tail gliding', () => {
  const w = F.create(() => 0);
  assert.deepEqual(plain(w.trail), { x: 4, y: 8 }, 'still at the start');
  F.step(w);
  assert.deepEqual(plain(w.trail), { x: 4, y: 8 });
  assert.deepEqual(plain(w.body[w.body.length - 1]), { x: 5, y: 8 });
  run(w, 5);                                              // eats on the last of these
  assert.equal(w.score, 1);
  assert.deepEqual(plain(w.trail), plain(w.body[w.body.length - 1]), 'growing: the tail stays put');
});

test('turns: not the way it is going, not straight back, and at most two queued', () => {
  const w = F.create(() => 0);
  assert.equal(F.turn(w, 'right'), false);
  assert.equal(F.turn(w, 'left'), false, 'straight back into itself');
  assert.equal(F.turn(w, 'sideways'), false);
  assert.equal(F.turn(w, 'up'), true);
  assert.equal(F.turn(w, 'up'), false, 'already queued');
  assert.equal(F.turn(w, 'down'), false, 'back on the queued turn');
  assert.equal(F.turn(w, 'left'), true);
  assert.equal(F.turn(w, 'down'), false, 'queue full');
  F.step(w);
  assert.deepEqual(plain(w.body[0]), { x: 6, y: 7 });
  F.step(w);
  assert.deepEqual(plain(w.body[0]), { x: 5, y: 7 }, 'a quick up-then-left makes a U-turn over two steps');
  assert.equal(w.dir, 'left');
  assert.deepEqual(plain(w.queue), []);
});

test('eating grows the snake, scores a point and drops new food on a free cell', () => {
  const w = F.create(() => 0);
  assert.equal(run(w, 5), null);
  assert.equal(w.score, 0);
  assert.equal(F.step(w), null);                          // onto the food at x 12
  assert.equal(w.score, 1);
  assert.equal(w.body.length, 4);
  assert.deepEqual(plain(w.food), { x: 0, y: 0 }, 'rand 0 picks the first free cell');
  // The last free cell with rand just under 1, never a cell the snake is on.
  const w2 = F.create(() => 0.9999);
  run(w2, 6);
  assert.deepEqual(plain(w2.food), { x: F.COLS - 1, y: F.ROWS - 1 });
  assert.equal(F.onBody(w2.body, w2.food.x, w2.food.y), false);
});

test('hitting a wall ends the round, and nothing moves after that', () => {
  const w = F.create(() => 0);
  F.turn(w, 'up');
  assert.equal(run(w, 20), 'wall');
  assert.deepEqual(plain(w.body[0]), { x: 6, y: 0 }, 'the head stops at the edge');
  assert.equal(F.step(w), null);
  assert.equal(F.turn(w, 'left'), false);
  assert.deepEqual(plain(w.body[0]), { x: 6, y: 0 });
  for (const [dir, turn] of [['down', 'down'], ['left', 'up'], ['right', null]]) {
    const v = F.create(() => 0);
    v.food = null;
    if (turn) F.turn(v, turn);
    if (dir === 'left') { run(v, 1); F.turn(v, 'left'); }
    assert.equal(run(v, 40), 'wall', dir);
  }
});

test('running into its own body ends the round, but chasing its tail is fine', () => {
  // Five long, turning in a tight square: the head meets the body.
  const w = F.create(() => 0);
  w.body = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }];
  w.food = null;
  F.turn(w, 'up'); F.step(w);
  F.turn(w, 'left'); F.step(w);
  F.turn(w, 'down');
  assert.equal(F.step(w), 'self');

  // Four long, going round a square: the head takes the cell the tail leaves.
  const v = F.create(() => 0);
  v.body = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 9 }, { x: 6, y: 9 }];
  v.dir = 'right';
  v.food = null;
  F.turn(v, 'down');
  assert.equal(F.step(v), null);
  assert.deepEqual(plain(v.body[0]), { x: 6, y: 9 });
  // Unless it's growing: then the tail stays put.
  const u = F.create(() => 0);
  u.body = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 9 }, { x: 6, y: 9 }];
  u.food = { x: 6, y: 9 };
  F.turn(u, 'down');
  assert.equal(F.step(u), 'self');
});

test('filling the whole board wins', () => {
  const path = winding();
  const w = F.create(() => 0);
  w.body = path.slice(0, -1).reverse();
  w.dir = 'right';                                        // the last row runs right
  w.food = path[path.length - 1];
  assert.equal(F.step(w), 'full');
  assert.equal(w.body.length, F.COLS * F.ROWS);
  assert.equal(w.food, null);
  assert.equal(F.placeFood(w), false);
});

test('the snake starts at a gentle pace and speeds up as it eats, to a limit', () => {
  assert.equal(F.interval(0), F.SLOW);
  assert.ok(F.SLOW >= 0.2, 'no more than five cells a second to start');
  assert.ok(F.interval(10) < F.interval(5));
  assert.equal(F.interval(1000), F.FAST);
});

test('advance runs whole steps and carries the rest over', () => {
  const w = F.create(() => 0);
  let r = F.advance(w, 0.1);
  assert.deepEqual([r.steps, r.end], [0, null]);
  assert.ok(Math.abs(r.carry - 0.1) < 1e-9);
  r = F.advance(w, 0.4, r.carry);                         // 0.5s: two steps
  assert.equal(r.steps, 2);
  assert.ok(Math.abs(r.carry - (0.5 - 2 * F.SLOW)) < 1e-9);
  assert.deepEqual(plain(w.body[0]), { x: 8, y: 8 });
  // A crash stops it early and drops the leftover time.
  F.turn(w, 'up');
  r = F.advance(w, 10, r.carry);
  assert.equal(r.end, 'wall');
  assert.equal(r.carry, 0);
  assert.equal(r.steps, 9);
});
