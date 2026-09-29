import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const F = load('assets/js/bricks-core.js').bdnixBricks;

// A game with the ball in flight at (x, y), heading along (dx, dy).
function flying(x, y, dx, dy, extra = {}){
  const w = F.create(() => 0);
  w.bricks = F.fullWall();               // every brick, unless a test says otherwise
  w.loot = w.loot.map(() => '');         // no powers unless a test hides some
  Object.assign(w, extra);
  w.stuck = false;
  const len = Math.hypot(dx, dy);
  w.balls = [{ x, y, dx: dx / len, dy: dy / len }];
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

test('a new game: the first wall, three balls, the ball waiting on the middle of the paddle', () => {
  const w = F.create(() => 0);
  assert.deepEqual(plain(w.bricks), plain(F.wall(1)));
  assert.equal(w.bricks.filter(Boolean).length, 56, 'a house, not a full wall');
  assert.deepEqual([w.level, w.lives, w.score, w.small, w.stuck, w.dead], [1, 3, 0, false, true, null]);
  assert.deepEqual(plain([w.drops, w.shots, w.fire, w.laser, w.wide, w.reload]), [[], [], 0, 0, 0, 0], 'no powers yet');
  assert.equal(w.paddle, F.W / 2);
  assert.deepEqual(plain(w.balls), [{ x: F.W / 2, y: F.PADDLE_Y - F.R, dx: 0, dy: -1 }]);
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
  assert.equal(w.balls[0].x, 100);
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
  assert.equal(f.balls[0].x, 50, 'a ball in flight stays where it is');
  f.dead = 'out';
  F.movePaddle(f, 200);
  assert.equal(f.paddle, 100, 'nothing moves once the game is over');
});

test('launching sends the ball up at 30°, to the side the coin toss picks, once', () => {
  const w = F.create(() => 0);
  assert.equal(F.advance(w, 1).bricks.length, 0, 'a waiting ball stays put');
  assert.deepEqual(plain(w.balls), [{ x: F.W / 2, y: F.PADDLE_Y - F.R, dx: 0, dy: -1 }]);
  assert.equal(F.launch(w), true);
  close(w.balls[0].dx, -0.5, 'left');
  close(w.balls[0].dy, -Math.cos(Math.PI / 6), 'up');
  assert.equal(F.launch(w), false, 'already in flight');
  const r = F.create(() => 0.7);
  F.launch(r);
  close(r.balls[0].dx, 0.5, 'right');
  r.dead = 'out'; r.stuck = true;
  assert.equal(F.launch(r), false, 'not once the game is over');
});

test('the ball bounces off the side and top walls; the top wall shrinks the paddle, once', () => {
  let w = flying(20, 300, -1, -1);
  let ev = runUntil(w, (_, e) => e.wall);
  assert.ok(w.balls[0].dx > 0 && w.balls[0].dy < 0, 'off the left wall');
  assert.equal(ev.shrink, false);

  w = flying(F.W - 20, 300, 1, 1);
  runUntil(w, (_, e) => e.wall);
  assert.ok(w.balls[0].dx < 0 && w.balls[0].dy > 0, 'off the right wall');

  w = flying(180, 40, 0.3, -1, { bricks: F.fullWall().map((_, i) => (i === 79 ? 1 : 0)) });
  ev = runUntil(w, (_, e) => e.wall);
  assert.ok(w.balls[0].dy > 0, 'off the top');
  assert.equal(ev.shrink, true);
  assert.equal(w.small, true);
  assert.equal(F.paddleWidth(w), F.SMALL_W);
  w.balls = [{ x: 180, y: 30, dx: 0, dy: -1 }];
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
  assert.ok(w.balls[0].dy > 0, 'back down');
  assert.equal(w.balls[0].dx, 0);

  // From above, down onto a top-row brick with the ones below it gone.
  w = flying(center(3).x, 30, 0, 1);
  ev = runUntil(w, (_, e) => e.bricks.length);
  assert.deepEqual(plain(ev.bricks), [3]);
  assert.equal(w.score, 7);
  assert.ok(w.balls[0].dy < 0, 'back up');

  // From the side, into the end of a brick with the one next to it gone.
  const row = 5 * F.COLS;
  const bricks = F.fullWall();
  bricks[row + 1] = 0;
  w = flying(center(row + 1).x, center(row).y, -1, 0.0001, { bricks });
  ev = runUntil(w, (_, e) => e.bricks.length);
  assert.deepEqual(plain(ev.bricks), [row]);
  assert.equal(w.score, 3);
  assert.ok(w.balls[0].dx > 0, 'back to the right');

  // And from the other side.
  const from = F.fullWall();
  from[row + 3] = 0;
  w = flying(center(row + 3).x, center(row).y, 1, 0.0001, { bricks: from });
  ev = runUntil(w, (_, e) => e.bricks.length);
  assert.deepEqual(plain(ev.bricks), [row + 4]);
  assert.ok(w.balls[0].dx < 0, 'back to the left');
});

test('a ball clipping a brick corner bounces back up or down', () => {
  const r = F.brickRect((F.ROWS - 1) * F.COLS + 4);
  const w = flying(r.x + r.w + 4, r.y + r.h + 4, -1, -1, { bricks: F.fullWall().map((_, i) => (i === (F.ROWS - 1) * F.COLS + 4 || i === 0 ? 1 : 0)) });
  const ev = runUntil(w, (_, e) => e.bricks.length);
  assert.equal(ev.bricks.length, 1);
  assert.ok(w.balls[0].dy > 0 && w.balls[0].dx < 0, 'down, still heading left');
});

test('the paddle sends the ball back up at an angle set by where it lands', () => {
  for (const [off, angle] of [[0, 0], [0.5, 30], [-1, -60], [1.1, 60]]) {
    const w = flying(F.W / 2 + off * F.PADDLE_W / 2, 400, 0, 1);
    const ev = runUntil(w, (_, e) => e.paddle);
    close(w.balls[0].dx, Math.sin(angle * Math.PI / 180), `dx at ${off}`);
    close(w.balls[0].dy, -Math.cos(angle * Math.PI / 180), `dy at ${off}`);
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
  assert.deepEqual(plain(w.balls), [{ x: w.paddle, y: F.PADDLE_Y - F.R, dx: 0, dy: -1 }]);
  w.lives = 1; w.stuck = false; w.balls = [{ x: 20, y: 460, dx: 0, dy: 1 }];
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
  assert.deepEqual(plain(w.bricks), plain(F.wall(2)), 'the second wall’s shape');
});

test('every wall has its own shape, eight rows of ten, and they come round again', () => {
  assert.ok(F.SHAPES.length >= 5);
  const seen = new Set();
  F.SHAPES.forEach((shape, n) => {
    assert.equal(shape.length, F.ROWS, `wall ${n + 1} rows`);
    assert.ok(shape.every((row) => row.length === F.COLS && /^[#.]+$/.test(row)), `wall ${n + 1} columns`);
    const bricks = F.wall(n + 1);
    assert.equal(bricks.length, F.ROWS * F.COLS);
    assert.ok(bricks.filter(Boolean).length >= F.LOOT.length * 3, `wall ${n + 1} has room for its powers`);
    assert.ok(bricks.filter(Boolean).length < F.ROWS * F.COLS, `wall ${n + 1} isn’t just a full wall`);
    seen.add(bricks.join(''));
  });
  assert.equal(seen.size, F.SHAPES.length, 'no two alike');
  assert.deepEqual(plain(F.wall(F.SHAPES.length + 1)), plain(F.wall(1)));
  // The first wall's bottom row is whole, so the first shots always find a brick.
  assert.ok(F.wall(1).slice((F.ROWS - 1) * F.COLS).every(Boolean));
});

test('the ball speeds up after 10 and 25 bricks, in the upper rows, and on each new wall', () => {
  const w = F.create(() => 0);
  assert.equal(F.speed(w), F.BASE);
  const breakAt = (...idx) => idx.forEach((i) => { w.bricks[i] = 0; });
  breakAt(70, 71, 72, 73, 74, 75, 76, 77, 78);
  assert.equal(F.speed(w), F.BASE);
  breakAt(79);
  assert.equal(F.speed(w), F.BASE + F.BOOST, 'the 10th brick');
  breakAt(60, 61, 63, 64, 65, 66, 68, 69, 50, 51, 53, 54, 55, 56);
  assert.equal(F.speed(w), F.BASE + F.BOOST, 'the 24th brick');
  breakAt(58);
  assert.equal(F.speed(w), F.BASE + F.BOOST * 2, 'the 25th brick');
  w.bricks[0] = 0;                                      // not part of this wall: doesn't count
  breakAt(31);
  assert.deepEqual(plain(F.progress(w)), { broken: 26, reach: 1 });
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
  close(a.balls[0].y, 400 - F.BASE * 0.4, 'one big step');
  close(b.balls[0].y, a.balls[0].y, 'many small steps');
});

test('brickAt finds the brick under the ball, and only one that is still there', () => {
  const w = F.create(() => 0);
  const c = center(14);
  assert.equal(F.brickAt(w, c.x, c.y), 14);
  assert.equal(F.brickAt(w, 180, 300), -1);
  assert.equal(F.brickAt(w, center(12).x, center(12).y), -1, 'not part of the first wall');
  w.bricks[14] = 0;
  assert.equal(F.brickAt(w, c.x, c.y), -1);
});

// Every brick but those listed gone, for a wall of just a few.
const only = (...keep) => F.fullWall().map((_, i) => (keep.includes(i) ? 1 : 0));
const noLoot = () => F.fullWall().map(() => '');

test('each wall hides its powers in different bricks, where the dice say', () => {
  const low = F.hideLoot(() => 0, F.fullWall());
  assert.deepEqual(plain(low.slice(0, F.LOOT.length)), plain(F.LOOT), 'the first free brick each time');
  assert.equal(low.filter(Boolean).length, F.LOOT.length);
  const high = F.hideLoot(() => 0.99999, F.fullWall());
  assert.deepEqual(plain(high.slice(-F.LOOT.length)), plain(F.LOOT).reverse(), 'the last free brick each time');
  const cut = F.hideLoot(() => 1, F.fullWall());         // a rand of exactly 1 still lands on a brick
  assert.equal(cut.filter(Boolean).length, F.LOOT.length);
  assert.equal(cut.length, F.ROWS * F.COLS);

  // Only in the wall's bricks: the first wall's first six are 4, 5 and 13 to 16.
  const house = F.create(() => 0).loot;
  assert.deepEqual(plain([4, 5, 13, 14, 15, 16].map((i) => house[i])), plain(F.LOOT));
  assert.equal(house.filter(Boolean).length, F.LOOT.length);
  const shaped = F.hideLoot(Math.random, F.wall(2));
  assert.ok(shaped.every((kind, i) => !kind || F.wall(2)[i]), 'never in an empty slot');

  // A cleared wall hides a new set.
  const i = (F.ROWS - 1) * F.COLS + 2;
  const w = flying(center(i).x, 300, 0, -1, { bricks: only(i) });
  runUntil(w, (_, e) => e.cleared);
  assert.deepEqual(plain(w.loot), plain(F.hideLoot(() => 0, F.wall(2))));
});

test('a brick with a power drops it; the capsule falls and the paddle catches it', () => {
  const i = (F.ROWS - 1) * F.COLS + 4, c = center(i);
  const loot = noLoot(); loot[i] = 'life';
  const w = flying(c.x, 300, 0, -1, { loot, paddle: c.x });
  let ev = runUntil(w, (_, e) => e.bricks.length);
  assert.equal(w.loot[i], '', 'only once');
  assert.deepEqual(plain(w.drops), [{ x: c.x, y: c.y + F.DROP_SPEED / 60, kind: 'life' }]);
  const y = w.drops[0].y;
  F.advance(w, 0.5);
  close(w.drops[0].y, y + F.DROP_SPEED * 0.5, 'falls at its speed');
  ev = runUntil(w, (_, e) => e.powers.length);
  assert.deepEqual(plain(ev.powers), ['life']);
  assert.deepEqual(plain(w.drops), []);
  assert.equal(w.lives, 4, 'an extra ball');

  // One the paddle misses falls off the board.
  const miss = flying(c.x, 300, 0, -1, { loot: loot.map((_, j) => (j === i ? 'fire' : '')), paddle: 40 });
  runUntil(miss, (_, e) => e.bricks.length);
  miss.balls[0] = { x: 300, y: 200, dx: 1, dy: 0 };    // keep the ball out of the way, side to side
  runUntil(miss, (m) => !m.drops.length);
  assert.equal(miss.fire, 0, 'not caught');
  assert.equal(miss.lives, 3);
});

test('an extra ball goes up to five', () => {
  const w = F.create(() => 0);
  for (let i = 0; i < 4; i++) F.power(w, 'life');
  assert.equal(w.lives, F.MAX_LIVES);
});

test('multi splits every ball in three, never flatter than the limit or more than twelve', () => {
  const w = flying(180, 300, 0, -1);
  F.power(w, 'multi');
  assert.equal(w.balls.length, 3);
  close(w.balls[1].dx, Math.sin(F.SPLIT), 'one to the right');
  close(w.balls[2].dx, -Math.sin(F.SPLIT), 'one to the left');
  for (const b of w.balls) {
    close(Math.hypot(b.dx, b.dy), 1, 'a direction');
    assert.deepEqual([b.x, b.y], [180, 300]);
  }
  F.power(w, 'multi');
  assert.equal(w.balls.length, 9);
  F.power(w, 'multi');
  assert.equal(w.balls.length, F.MAX_BALLS);

  // Turned flat, a ball is sent back up at the limit instead.
  const side = Math.sqrt(1 - F.MIN_DY * F.MIN_DY);
  const right = flying(180, 300, Math.cos(F.SPLIT), Math.sin(F.SPLIT));
  F.power(right, 'multi');
  close(right.balls[2].dx, side, 'right');
  close(right.balls[2].dy, -F.MIN_DY, 'up');
  const left = flying(180, 300, -Math.cos(F.SPLIT), Math.sin(F.SPLIT));
  F.power(left, 'multi');
  close(left.balls[1].dx, -side, 'left');
  close(left.balls[1].dy, -F.MIN_DY, 'up');
  const down = flying(180, 300, Math.cos(F.SPLIT + 0.1), Math.sin(F.SPLIT + 0.1));
  F.power(down, 'multi');
  close(down.balls[2].dx, side, 'right');
  close(down.balls[2].dy, F.MIN_DY, 'still down');
});

test('losing one of several balls plays on; losing the last loses a life and every power', () => {
  const w = flying(20, 460, 0, 1, { fire: 5, laser: 5, wide: 5, drops: [{ x: 100, y: 200, kind: 'multi' }] });
  w.balls.push({ x: 180, y: 200, dx: 0, dy: -1 });
  let ev = runUntil(w, (m) => m.balls.length === 1);
  assert.deepEqual([ev.lost, w.lives, w.stuck], [false, 3, false]);
  assert.deepEqual(plain(ev.gone), [20], 'where it fell off');
  w.balls[0] = { x: 20, y: 460, dx: 0, dy: 1 };
  ev = runUntil(w, (_, e) => e.lost);
  assert.deepEqual(plain(ev.gone), [20]);
  assert.deepEqual([w.lives, w.stuck, w.fire, w.laser, w.wide, w.drops.length, w.shots.length], [2, true, 0, 0, 0, 0, 0]);
  assert.equal(w.balls.length, 1);
});

test('a fireball burns through the bricks it meets without bouncing, for a while', () => {
  const col = 3, x = center(col).x;
  const w = flying(x, 300, 0, -1, { paddle: x });
  F.power(w, 'fire');
  assert.equal(w.fire, F.FIRE_TIME);
  const ev = runUntil(w, (_, e) => e.wall);            // straight up through the column to the top
  assert.deepEqual(Array.from({ length: F.ROWS }, (_, r) => w.bricks[r * F.COLS + col]), Array(F.ROWS).fill(0));
  assert.equal(w.score, 7 + 7 + 5 + 5 + 3 + 3 + 1 + 1);
  assert.equal(ev.shrink, true);
  assert.ok(w.fire < F.FIRE_TIME && w.fire > 0);
  runUntil(w, (m) => m.fire === 0);
  // Out of fire, it bounces off the next brick again.
  w.balls[0] = { x: center(col + 1).x, y: 300, dx: 0, dy: -1 };
  runUntil(w, (_, e) => e.bricks.length);
  assert.ok(w.balls[0].dy > 0);
});

test('the laser fires from both ends of the paddle; each shot breaks the first brick above it', () => {
  const w = flying(300, 300, 1, 0, { paddle: center(2).x + F.PADDLE_W / 2 - 4 }); // the ball side to side, out of the way
  F.power(w, 'laser');
  assert.equal(w.laser, F.LASER_TIME);
  let ev = F.advance(w, 1 / 60);
  assert.equal(ev.shot, true);
  const half = F.PADDLE_W / 2;
  assert.deepEqual(plain(w.shots.map((s) => s.x)), [w.paddle - half + 4, w.paddle + half - 4]);
  ev = F.advance(w, 1 / 60);
  assert.equal(ev.shot, false, 'not again straight away');
  ev = runUntil(w, (_, e) => e.bricks.length);
  const bottom = (F.ROWS - 1) * F.COLS;
  assert.deepEqual(plain(ev.bricks).sort((a, b) => a - b), [bottom + 2, bottom + 4]);
  assert.ok(w.shots.every((s) => s.y > F.TOP + F.ROWS * F.BH), 'the shots are used up; only the next pair flies');
  ev = runUntil(w, (_, e) => e.shot);
  close(w.reload, F.SHOT_EVERY, 'reloaded');

  // A power caught again tops the time up without waiting on a reload.
  w.laser = 1; w.reload = 0.3;
  F.power(w, 'laser');
  assert.deepEqual([w.laser, w.reload], [F.LASER_TIME, 0.3]);
  runUntil(w, (m) => m.laser === 0, 5000);
  const n = w.shots.length;
  F.advance(w, 1);
  assert.ok(w.shots.length <= n, 'no more shots');

  // A shot that misses every brick flies off the top.
  const clear = flying(300, 300, 1, 0, { bricks: only(0), paddle: 200 });
  F.power(clear, 'laser');
  F.advance(clear, 1 / 60);
  clear.laser = 0;
  runUntil(clear, (m) => !m.shots.length);
  assert.equal(clear.bricks[0], 1);
});

test('a laser shot can clear the wall', () => {
  const i = (F.ROWS - 1) * F.COLS;
  const w = flying(300, 300, 0, -1, { bricks: only(i), paddle: center(i).x - 4 + F.PADDLE_W / 2 });
  w.shots = [{ x: center(i).x, y: 400 }];
  const ev = runUntil(w, (_, e) => e.cleared);
  assert.deepEqual([w.level, w.stuck, w.shots.length], [2, true, 0]);
  assert.deepEqual(plain(ev.bricks), [i]);
});

test('the wide paddle is half as wide again, until it runs out', () => {
  const w = flying(180, 200, 0, -1, { paddle: 40 });
  F.power(w, 'wide');
  assert.equal(F.paddleWidth(w), F.PADDLE_W * F.WIDE_GROW);
  assert.equal(w.paddle, F.PADDLE_W * F.WIDE_GROW / 2, 'moved in off the wall');
  w.small = true;
  assert.equal(F.paddleWidth(w), F.SMALL_W * F.WIDE_GROW);
  w.small = false;
  F.movePaddle(w, 0);
  w.balls[0] = { x: 180, y: 200, dx: 0, dy: -1 };
  runUntil(w, (m) => !m.wide, 5000);
  assert.equal(F.paddleWidth(w), F.PADDLE_W);
  assert.equal(w.paddle, F.PADDLE_W * F.WIDE_GROW / 2, 'still on the board');
});

test('powers stop while the ball waits, and a new wall starts without them', () => {
  const w = F.create(() => 0);
  F.power(w, 'fire');
  F.advance(w, 1);
  assert.equal(w.fire, F.FIRE_TIME, 'no time passes on the paddle');
  const i = (F.ROWS - 1) * F.COLS + 2;
  const c = flying(center(i).x, 300, 0, -1, { bricks: only(i), wide: 3, laser: 3, drops: [{ x: 10, y: 10, kind: 'fire' }] });
  runUntil(c, (_, e) => e.cleared);
  assert.deepEqual([c.wide, c.laser, c.drops.length, c.balls.length], [0, 0, 0, 1]);
});

test('a board can be wider: the bricks and the paddle widen with it', () => {
  assert.equal(F.fitWidth(), F.W);
  assert.equal(F.fitWidth(200), F.W);
  assert.equal(F.fitWidth(500.9), 500);
  assert.equal(F.fitWidth(5000), F.MAX_W);
  assert.equal(F.slot(), F.BW);
  assert.equal(F.slot(720), (720 - F.SIDE * 2) / F.COLS);
  assert.deepEqual(F.brickRect(9), F.brickRect(9, F.W));
  const r = F.brickRect(9, 720);
  assert.ok(Math.abs(r.x + r.w + F.GAP / 2 - (720 - F.SIDE)) < 1e-9, 'the last column ends at the wide board\'s side');

  const w = F.create(() => 0, 720);
  assert.equal(w.width, 720);
  assert.equal(w.paddle, 360);
  assert.equal(F.paddleWidth(w), F.PADDLE_W * 2);
  F.movePaddle(w, 10000);
  assert.equal(w.paddle, 720 - F.PADDLE_W);
  assert.equal(F.create().width, F.W);
});

test('a ball bounces off the far side of a wide board and breaks wide bricks', () => {
  const w = F.create(() => 0, 720);
  w.stuck = false;
  w.balls = [{ x: 700, y: 300, dx: 1, dy: 0 }];
  F.advance(w, 0.2);
  assert.ok(w.balls[0].dx < 0, 'bounced back off the right-hand side');
  assert.ok(w.balls[0].x <= 720 - F.R);

  // A ball rising into the bottom-right brick, which only a wide board has there.
  const v = F.create(() => 0, 720);
  v.stuck = false;
  const r = F.brickRect(79, 720);
  v.balls = [{ x: r.x + r.w - 4, y: r.y + r.h + 20, dx: 0, dy: -1 }];
  const ev = F.advance(v, 0.2);
  assert.deepEqual(plain(ev.bricks), [79]);
});

test('turning the board wider mid-game keeps everything in its place across it', () => {
  const w = F.create(() => 0);
  w.stuck = false;
  w.balls = [{ x: 90, y: 300, dx: 0.6, dy: -0.8 }];
  w.drops = [{ x: 180, y: 200, kind: 'wide' }];
  w.shots = [{ x: 270, y: 400 }];
  F.movePaddle(w, 270);
  F.setWidth(w, 720);
  assert.equal(w.width, 720);
  assert.equal(w.balls[0].x, 180);
  assert.equal(w.balls[0].dx, 0.6, 'the ball keeps its heading');
  assert.equal(w.drops[0].x, 360);
  assert.equal(w.shots[0].x, 540);
  assert.equal(w.paddle, 540);
  F.setWidth(w, 720);                  // no change
  assert.equal(w.paddle, 540);
  F.setWidth(w, 100);                  // back to the narrowest
  assert.equal(w.width, F.W);
  assert.equal(w.paddle, 270);
  assert.equal(w.balls[0].x, 90);

  // A ball waiting on the paddle moves with it.
  const s = F.create(() => 0);
  F.setWidth(s, 540);
  assert.equal(s.paddle, 270);
  assert.equal(s.balls[0].x, 270);
});
