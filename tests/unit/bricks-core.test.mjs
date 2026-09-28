import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const F = load('assets/js/bricks-core.js').bdnixBricks;

// A game with the ball in flight at (x, y), heading along (dx, dy).
function flying(x, y, dx, dy, extra = {}){
  const w = F.create(() => 0);
  Object.assign(w, extra);
  w.stuck = false;
  const len = Math.hypot(dx, dy);
  w.ball = { x, y, dx: dx / len, dy: dy / len };
  return w;
}
// Runs the game in 1/60 s frames until `done(w, ev)` says so; returns the last events.
function runUntil(w, done, frames = 2000){
  for (let i = 0; i < frames; i++) {
    const ev = F.advance(w, 1 / 60);
    if (done(w, ev)) return ev;
  }
  throw new Error('never happened');
}
const center = (i) => { const r = F.brickRect(i); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} is not ${b}`);

test('a new game: a full wall, three balls, the ball waiting on the middle of the paddle', () => {
  const w = F.create(() => 0);
  assert.equal(w.bricks.length, F.ROWS * F.COLS);
  assert.ok(w.bricks.every((b) => b === 1));
  assert.deepEqual([w.level, w.lives, w.score, w.small, w.stuck, w.dead], [1, 3, 0, false, true, null]);
  assert.equal(w.paddle, F.W / 2);
  assert.deepEqual(plain(w.ball), { x: F.W / 2, y: F.PADDLE_Y - F.R, dx: 0, dy: -1 });
  const r = F.create().rand();
  assert.ok(r >= 0 && r < 1, 'Math.random by default');
});

test('the bricks fill the board side to side with a gap around each', () => {
  const first = F.brickRect(0), last = F.brickRect(F.ROWS * F.COLS - 1);
  assert.equal(first.x, F.SIDE + F.GAP / 2);
  assert.equal(first.y, F.TOP + F.GAP / 2);
  close(last.x + last.w, F.W - F.SIDE - F.GAP / 2, 'right edge');
  assert.equal(last.y + last.h, F.TOP + F.ROWS * F.BH - F.GAP / 2);
  assert.deepEqual(plain(F.brickRect(F.COLS + 1)), { x: F.SIDE + F.BW + F.GAP / 2, y: F.TOP + F.BH + F.GAP / 2, w: F.BW - F.GAP, h: F.BH - F.GAP });
});

test('the paddle stays on the board, and carries a waiting ball with it', () => {
  const w = F.create(() => 0);
  F.movePaddle(w, 100);
  assert.equal(w.paddle, 100);
  assert.equal(w.ball.x, 100);
  F.movePaddle(w, -50);
  assert.equal(w.paddle, F.PADDLE_W / 2);
  F.movePaddle(w, 1000);
  assert.equal(w.paddle, F.W - F.PADDLE_W / 2);
  w.small = true;
  F.movePaddle(w, 1000);
  assert.equal(w.paddle, F.W - F.SMALL_W / 2, 'a small paddle goes further');
  assert.equal(F.paddleWidth(w), F.SMALL_W);

  const f = flying(50, 300, 0, -1);
  F.movePaddle(f, 100);
  assert.equal(f.ball.x, 50, 'a ball in flight stays where it is');
  f.dead = 'out';
  F.movePaddle(f, 200);
  assert.equal(f.paddle, 100, 'nothing moves once the game is over');
});

test('launching sends the ball up at 30°, to the side the coin toss picks, once', () => {
  const w = F.create(() => 0);
  assert.equal(F.advance(w, 1).bricks.length, 0, 'a waiting ball stays put');
  assert.deepEqual(plain(w.ball), { x: F.W / 2, y: F.PADDLE_Y - F.R, dx: 0, dy: -1 });
  assert.equal(F.launch(w), true);
  close(w.ball.dx, -0.5, 'left');
  close(w.ball.dy, -Math.cos(Math.PI / 6), 'up');
  assert.equal(F.launch(w), false, 'already in flight');
  const r = F.create(() => 0.7);
  F.launch(r);
  close(r.ball.dx, 0.5, 'right');
  r.dead = 'out'; r.stuck = true;
  assert.equal(F.launch(r), false, 'not once the game is over');
});

test('the ball bounces off the side and top walls; the top wall shrinks the paddle, once', () => {
  let w = flying(20, 300, -1, -1);
  let ev = runUntil(w, (_, e) => e.wall);
  assert.ok(w.ball.dx > 0 && w.ball.dy < 0, 'off the left wall');
  assert.equal(ev.shrink, false);

  w = flying(F.W - 20, 300, 1, 1);
  runUntil(w, (_, e) => e.wall);
  assert.ok(w.ball.dx < 0 && w.ball.dy > 0, 'off the right wall');

  w = flying(180, 40, 0.3, -1, { bricks: F.fullWall().map((_, i) => (i === 79 ? 1 : 0)) });
  ev = runUntil(w, (_, e) => e.wall);
  assert.ok(w.ball.dy > 0, 'off the top');
  assert.equal(ev.shrink, true);
  assert.equal(w.small, true);
  assert.equal(F.paddleWidth(w), F.SMALL_W);
  w.ball = { x: 180, y: 30, dx: 0, dy: -1 };
  ev = runUntil(w, (_, e) => e.wall);
  assert.equal(ev.shrink, false, 'only the first time');
});

test('breaking a brick scores its row, and the ball bounces back the way it came', () => {
  // From below, straight up into the bottom-left brick.
  const i = (F.ROWS - 1) * F.COLS;
  const c = center(i);
  let w = flying(c.x, 300, 0, -1);
  let ev = runUntil(w, (_, e) => e.bricks.length);
  assert.deepEqual(plain(ev.bricks), [i]);
  assert.equal(w.bricks[i], 0);
  assert.equal(w.score, 1);
  assert.ok(w.ball.dy > 0, 'back down');
  assert.equal(w.ball.dx, 0);

  // From above, down onto a top-row brick with the ones below it gone.
  w = flying(center(3).x, 30, 0, 1);
  ev = runUntil(w, (_, e) => e.bricks.length);
  assert.deepEqual(plain(ev.bricks), [3]);
  assert.equal(w.score, 7);
  assert.ok(w.ball.dy < 0, 'back up');

  // From the side, into the end of a brick with the one next to it gone.
  const row = 5 * F.COLS;
  const bricks = F.fullWall();
  bricks[row + 1] = 0;
  w = flying(center(row + 1).x, center(row).y, -1, 0.0001, { bricks });
  ev = runUntil(w, (_, e) => e.bricks.length);
  assert.deepEqual(plain(ev.bricks), [row]);
  assert.equal(w.score, 3);
  assert.ok(w.ball.dx > 0, 'back to the right');

  // And from the other side.
  const from = F.fullWall();
  from[row + 3] = 0;
  w = flying(center(row + 3).x, center(row).y, 1, 0.0001, { bricks: from });
  ev = runUntil(w, (_, e) => e.bricks.length);
  assert.deepEqual(plain(ev.bricks), [row + 4]);
  assert.ok(w.ball.dx < 0, 'back to the left');
});

test('a ball clipping a brick corner bounces back up or down', () => {
  const r = F.brickRect((F.ROWS - 1) * F.COLS + 4);
  const w = flying(r.x + r.w + 4, r.y + r.h + 4, -1, -1, { bricks: F.fullWall().map((_, i) => (i === (F.ROWS - 1) * F.COLS + 4 || i === 0 ? 1 : 0)) });
  const ev = runUntil(w, (_, e) => e.bricks.length);
  assert.equal(ev.bricks.length, 1);
  assert.ok(w.ball.dy > 0 && w.ball.dx < 0, 'down, still heading left');
});

test('the paddle sends the ball back up at an angle set by where it lands', () => {
  for (const [off, angle] of [[0, 0], [0.5, 30], [-1, -60], [1.1, 60]]) {
    const w = flying(F.W / 2 + off * F.PADDLE_W / 2, 400, 0, 1);
    const ev = runUntil(w, (_, e) => e.paddle);
    close(w.ball.dx, Math.sin(angle * Math.PI / 180), `dx at ${off}`);
    close(w.ball.dy, -Math.cos(angle * Math.PI / 180), `dy at ${off}`);
    assert.equal(ev.bricks.length, 0);
  }
  // Past the end of the paddle it goes by.
  const w = flying(F.W / 2 + F.PADDLE_W / 2 + F.R + 2, 400, 0, 1);
  const ev = runUntil(w, (_, e) => e.lost);
  assert.equal(ev.paddle, false);
});

test('losing a ball puts the next on the paddle; losing the last ends the game', () => {
  const w = flying(20, 460, 0, 1);
  let ev = runUntil(w, (_, e) => e.lost);
  assert.deepEqual([w.lives, w.stuck, w.dead, ev.end], [2, true, null, null]);
  assert.deepEqual(plain(w.ball), { x: w.paddle, y: F.PADDLE_Y - F.R, dx: 0, dy: -1 });
  w.lives = 1; w.stuck = false; w.ball = { x: 20, y: 460, dx: 0, dy: 1 };
  ev = runUntil(w, (_, e) => e.lost);
  assert.deepEqual([w.lives, w.dead, ev.end], [0, 'out', 'out']);
  assert.equal(F.advance(w, 1).lost, false, 'nothing happens after');
});

test('clearing the wall puts up a new one, with a full-size paddle and the ball waiting', () => {
  const i = (F.ROWS - 1) * F.COLS + 2;
  const bricks = F.fullWall().map((_, j) => (j === i ? 1 : 0));
  const w = flying(center(i).x, 300, 0, -1, { bricks, small: true, score: 319 });
  const ev = runUntil(w, (_, e) => e.cleared);
  assert.deepEqual(plain(ev.bricks), [i]);
  assert.deepEqual([w.level, w.score, w.small, w.stuck, w.lives], [2, 320, false, true, 3]);
  assert.ok(w.bricks.every((b) => b === 1));
});

test('the ball speeds up after 4 and 12 bricks, in the upper rows, and on each new wall', () => {
  const w = F.create(() => 0);
  assert.equal(F.speed(w), F.BASE);
  const breakAt = (...idx) => idx.forEach((i) => { w.bricks[i] = 0; });
  breakAt(70, 71, 72);
  assert.equal(F.speed(w), F.BASE);
  breakAt(73);
  assert.equal(F.speed(w), F.BASE + F.BOOST, 'the 4th brick');
  breakAt(74, 75, 76, 77, 78, 79, 60, 61);
  assert.equal(F.speed(w), F.BASE + F.BOOST * 2, 'the 12th brick');
  breakAt(30);
  assert.deepEqual(plain(F.progress(w)), { broken: 13, reach: 1 });
  assert.equal(F.speed(w), F.BASE + F.BOOST * 3, 'into the upper rows');
  breakAt(5);
  assert.equal(F.progress(w).reach, 2);
  assert.equal(F.speed(w), F.BASE + F.BOOST * 4, 'into the top rows');
  w.level = 3;
  assert.equal(F.speed(w), F.BASE + F.BOOST * 6, 'two walls on');
  w.level = 50;
  assert.equal(F.speed(w), F.MAX, 'up to a limit');
});

test('the ball moves at its speed, however the time is split up', () => {
  const a = flying(180, 400, 0, -1);
  const b = flying(180, 400, 0, -1, { bricks: a.bricks.slice() });
  F.advance(a, 0.4);
  for (let i = 0; i < 40; i++) F.advance(b, 0.01);
  close(a.ball.y, 400 - F.BASE * 0.4, 'one big step');
  close(b.ball.y, a.ball.y, 'many small steps');
});

test('brickAt finds the brick under the ball, and only one that is still there', () => {
  const w = F.create(() => 0);
  const c = center(12);
  assert.equal(F.brickAt(w, c.x, c.y), 12);
  assert.equal(F.brickAt(w, 180, 300), -1);
  w.bricks[12] = 0;
  assert.equal(F.brickAt(w, c.x, c.y), -1);
});
