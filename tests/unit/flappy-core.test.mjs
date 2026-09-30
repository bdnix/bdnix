import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const F = load('assets/js/flappy-core.js').bdnixFlappy;

// Steps until `done(world)` or the step limit; returns every event seen.
function run(w, steps, done = () => false){
  const events = [];
  for (let i = 0; i < steps && !done(w); i++) {
    const e = F.tick(w);
    if (e) events.push(e);
  }
  return events;
}

test('gap heights span the space between the top and the ground', () => {
  assert.equal(F.gapTop(0), 64);
  assert.equal(F.gapTop(0.5), Math.round(64 + 0.5 * (F.GROUND - 64 - F.GAP - 64)));
  assert.equal(F.gapTop(0.9999), F.GROUND - 64 - F.GAP);
  // Out-of-range numbers are clamped rather than putting a gap off the board.
  assert.equal(F.gapTop(-1), 64);
  assert.equal(F.gapTop(2), F.GROUND - 64 - F.GAP);
});

test('a new round: bird in the air, no pipes, nothing scored', () => {
  const w = F.create(() => 0);
  assert.equal(w.bird.y, 220);
  assert.equal(w.bird.vy, 0);
  assert.equal(w.pipes.length, 0);
  assert.equal(w.score, 0);
  assert.equal(w.dead, false);
  const r = F.create().rand();
  assert.ok(r >= 0 && r < 1, 'Math.random by default');
});

test('gravity pulls the bird down and a flap sends it up', () => {
  const w = F.create(() => 0);
  F.tick(w);
  assert.ok(w.bird.vy > 0 && w.bird.y > 220, 'falls');
  assert.equal(F.flap(w), true);
  assert.equal(w.bird.vy, F.FLAP);
  const y = w.bird.y;
  run(w, 30);
  assert.ok(w.bird.y < y - 30, 'rose after the flap');
  run(w, 40);
  assert.ok(w.bird.vy > 0 && !w.landed, 'and falls again');
});

test('falling speed is capped', () => {
  const w = F.create(() => 0);
  w.bird.y = 20;
  run(w, 80);
  assert.equal(w.bird.vy, 620);
});

test('the bird cannot fly off the top of the board', () => {
  const w = F.create(() => 0);
  w.bird.y = 20;
  for (let i = 0; i < 10; i++) { F.flap(w); F.tick(w); }
  assert.equal(w.bird.y, F.BIRD_R);
  assert.equal(w.dead, false);
});

test('hitting the ground ends the round once, and the dead bird can’t flap', () => {
  const w = F.create(() => 0);
  const events = run(w, 600, (w) => w.landed);
  assert.deepEqual(events, ['hit']);
  assert.equal(w.dead, true);
  assert.equal(w.bird.y, F.GROUND - F.BIRD_R);
  assert.equal(F.flap(w), false);
  assert.equal(F.tick(w), null, 'no second hit');
});

test('pipes appear every SPACING, scroll left, and are dropped off screen', () => {
  let calls = 0;
  const w = F.create(() => { calls++; return 0.5; });   // every gap: 154..278
  // Holds the bird in the middle of the gaps so it never hits anything.
  const hold = () => { w.bird.y = 216; w.bird.vy = 0; };
  const toFirst = Math.ceil(40 / (F.SPEED * F.STEP));
  for (let s = 0; s < toFirst; s++) { hold(); F.tick(w); }
  assert.equal(w.pipes.length, 1, 'first pipe at the right edge');
  assert.ok(w.pipes[0].x <= F.W && w.pipes[0].x > F.W - 2);
  assert.equal(w.pipes[0].top, F.gapTop(0.5));

  const between = Math.ceil(F.SPACING / (F.SPEED * F.STEP));
  for (let s = 0; s < between; s++) { hold(); F.tick(w); }
  assert.equal(w.pipes.length, 2);
  assert.ok(Math.abs(w.pipes[1].x - w.pipes[0].x - F.SPACING) < 1e-6);

  const events = [];
  for (let s = 0; s < 1200; s++) { hold(); const e = F.tick(w); if (e) events.push(e); }
  assert.equal(w.dead, false);
  assert.ok(w.pipes.every((p) => p.x + F.PIPE_W >= 0), 'pipes off the left edge are gone');
  assert.ok(w.pipes.length <= 3);
  assert.equal(events.length, w.score);
  assert.equal(w.score, calls - w.pipes.filter((p) => !p.scored).length, 'every passed pipe scored');
  assert.ok(w.score >= 5);
  assert.ok(Math.abs(w.distance - F.SPEED * F.STEP * (toFirst + between + 1200)) < 1e-6);
});

test('passing a pipe scores a point, once', () => {
  const w = F.create(() => 0);
  w.pipes.push({ x: F.BIRD_X - F.PIPE_W + 0.5, top: 150, scored: false });
  w.nextPipe = 1e9;
  w.bird.y = 210;
  assert.equal(F.tick(w), 'score');
  assert.equal(w.score, 1);
  w.bird.vy = 0; w.bird.y = 210;
  assert.equal(F.tick(w), null);
  assert.equal(w.score, 1);
});

test('touching a pipe, above or below the gap, ends the round', () => {
  for (const y of [150, 290, -50]) {
    const w = F.create(() => 0);
    w.nextPipe = 1e9;
    w.pipes.push({ x: F.BIRD_X - 10, top: 160, scored: false });   // gap 160..284
    w.bird.y = y;
    const e = F.tick(w);
    assert.equal(e, 'hit', 'bird at ' + y);
    assert.equal(w.dead, true);
  }
  const w = F.create(() => 0);
  w.nextPipe = 1e9;
  w.pipes.push({ x: F.BIRD_X - 10, top: 160, scored: false });
  w.bird.y = 222;
  assert.equal(F.tick(w), null, 'through the middle of the gap is fine');
});

test('the caps at the ends of the pipes stick out, and hitting them counts', () => {
  const at = (y) => {
    const w = F.create(() => 0);
    w.nextPipe = 1e9;
    w.pipes.push({ x: F.BIRD_X + F.BIRD_R + 2, top: 160, scored: false }); // gap 160..284
    w.bird.y = y;
    return F.hitsPipe(w);
  };
  assert.equal(at(100), false, 'clear of the pipe itself');
  assert.equal(at(160 - F.CAP_H / 2), true, 'the top cap');
  assert.equal(at(284 + F.CAP_H / 2), true, 'the bottom cap');
  assert.equal(at(360), false, 'clear of the pipe below its cap');
});

test('after a hit the world stops while the bird falls to the ground', () => {
  const w = F.create(() => 0);
  w.nextPipe = 1e9;
  w.pipes.push({ x: F.BIRD_X - 10, top: 300, scored: false });
  w.bird.y = 200;
  assert.equal(F.tick(w), 'hit');
  const x = w.pipes[0].x;
  const events = run(w, 600, (w) => w.landed);
  assert.deepEqual(events, [], 'landing after a hit isn’t a second hit');
  assert.equal(w.pipes[0].x, x);
  assert.equal(w.landed, true);
});

// Runs a dead bird until it lands, checking it never overlaps a pipe.
function tumble(w){
  for (let i = 0; i < 2000 && !w.landed; i++) {
    assert.equal(F.tick(w), null, 'no second hit');
    assert.equal(F.hitsPipe(w), false, 'inside a pipe at step ' + i);
  }
  assert.equal(w.landed, true);
}

test('flying into the front of a pipe bounces the bird back, and it falls beside the pipe', () => {
  const w = F.create(() => 0);
  w.nextPipe = 1e9;
  const pipe = { x: F.BIRD_X + F.BIRD_R, top: 160, scored: false };   // top pipe down to 160
  w.pipes.push(pipe);
  w.bird.y = 100;
  assert.equal(F.tick(w), 'hit');
  assert.equal(w.impact.nx, -1, 'hit the front');
  assert.equal(w.impact.ny, 0);
  assert.equal(w.impact.x, pipe.x);
  assert.ok(w.bird.vx < 0 && w.bird.vy < 0, 'bounces back and up');
  assert.ok(w.bird.x <= pipe.x - F.BIRD_R, 'pushed out of the pipe');
  tumble(w);
  assert.equal(w.bird.y, F.GROUND - F.BIRD_R, 'down on the ground');
  assert.ok(w.bird.x < F.BIRD_X - 5 && w.bird.x > F.BIRD_X - 40, 'a little way back');
  assert.equal(w.bird.vx, 0);
});

test('falling onto the bottom pipe bounces, then lies on top of it', () => {
  const w = F.create(() => 0);
  w.nextPipe = 1e9;
  w.pipes.push({ x: F.BIRD_X - 26, top: 160, scored: false });       // bottom pipe from 284
  w.bird.y = 284 - F.BIRD_R;
  w.bird.vy = 300;
  assert.equal(F.tick(w), 'hit');
  assert.equal(w.impact.ny, -1, 'hit the top of it');
  assert.equal(w.impact.y, 284);
  assert.ok(w.bird.vy < 0, 'bounces up');
  tumble(w);
  assert.ok(Math.abs(w.bird.y - (284 - F.BIRD_R)) < 1e-5, 'lying on the pipe, not the ground');
  const at = { x: w.bird.x, y: w.bird.y };
  run(w, 200);
  assert.deepEqual({ x: w.bird.x, y: w.bird.y }, at, 'and stays there');
});

test('hitting the underside of the top pipe knocks the bird down', () => {
  const w = F.create(() => 0);
  w.nextPipe = 1e9;
  w.pipes.push({ x: F.BIRD_X - 26, top: 160, scored: false });
  w.bird.y = 160 + F.BIRD_R + 1;
  w.bird.vy = -400;
  assert.equal(F.tick(w), 'hit');
  assert.equal(w.impact.ny, 1);
  assert.ok(w.bird.vy > 0, 'heading down');
  tumble(w);
  assert.ok(Math.abs(w.bird.y - (284 - F.BIRD_R)) < 1e-5, 'down onto the bottom pipe');
});

test('a bird on the corner of a pipe slides off it', () => {
  const w = F.create(() => 0);
  w.nextPipe = 1e9;
  w.dead = true;
  w.pipes.push({ x: F.BIRD_X + 4, top: 160, scored: false });        // bottom pipe from 284
  w.bird.y = 284 - 6;                                                 // over the corner
  tumble(w);
  assert.equal(w.bird.y, F.GROUND - F.BIRD_R, 'on the ground');
  assert.ok(w.bird.x <= F.BIRD_X + 4 - F.BIRD_R + 1e-6, 'beside the pipe');
});

test('pushOut: a bird inside a pipe goes out through the nearest side', () => {
  const inside = (x, y, c, to) => {
    const w = F.create(() => 0);
    w.pipes.push({ x: 100, top: 160, scored: false });                // x 100..152, bottom pipe from 284
    w.bird.x = x; w.bird.y = y;
    assert.deepEqual(plain(F.pushOut(w)), c);
    assert.ok(Math.abs(w.bird.x - to[0]) < 1e-5 && Math.abs(w.bird.y - to[1]) < 1e-5, 'bird at ' + [w.bird.x, w.bird.y]);
    assert.equal(F.hitsPipe(w), false);
  };
  inside(103, 50, { x: 100, y: 50, nx: -1, ny: 0 }, [100 - F.BIRD_R, 50]);
  inside(150, 50, { x: 152, y: 50, nx: 1, ny: 0 }, [152 + F.BIRD_R, 50]);
  inside(126, 157, { x: 126, y: 160, nx: 0, ny: 1 }, [126, 160 + F.BIRD_R]);
  inside(126, 287, { x: 126, y: 284, nx: 0, ny: -1 }, [126, 284 - F.BIRD_R]);
  const w = F.create(() => 0);
  w.pipes.push({ x: 200, top: 160, scored: false });
  assert.equal(F.pushOut(w), null, 'touching nothing');
  assert.equal(w.bird.x, F.BIRD_X);
});

test('circleHitsRect: overlap, touching corners and misses', () => {
  assert.equal(F.circleHitsRect(0, 0, 5, -1, -1, 2, 2), true, 'centre inside');
  assert.equal(F.circleHitsRect(0, 0, 5, 4, -1, 10, 2), true, 'edge overlap');
  assert.equal(F.circleHitsRect(0, 0, 5, 4, 4, 10, 10), false, 'corner just out of reach');
  assert.equal(F.circleHitsRect(0, 0, 5, 3, 3, 10, 10), true, 'corner in reach');
  assert.equal(F.circleHitsRect(0, 0, 5, 5, -1, 10, 2), false, 'exactly touching is not a hit');
});

test('advance runs whole steps and carries the rest', () => {
  const w = F.create(() => 0);
  let r = F.advance(w, F.STEP * 2.5);
  assert.ok(Math.abs(r.carry - F.STEP * 0.5) < 1e-9);
  const y = w.bird.y;
  r = F.advance(w, F.STEP * 0.4, r.carry);
  assert.equal(w.bird.y, y, 'not a whole step yet');
  r = F.advance(w, F.STEP * 0.2, r.carry);
  assert.ok(w.bird.y > y, 'now it is');
  assert.ok(r.carry < F.STEP);

  // Events come back in order.
  const d = F.create(() => 0);
  assert.deepEqual(plain(F.advance(d, 5).events), ['hit']);
});

test('the same inputs always play out the same way', () => {
  function play(){
    let n = 0;
    const w = F.create(() => [0.2, 0.7, 0.4][n++ % 3]);
    for (let i = 0; i < 1200; i++) { if (i % 67 === 0) F.flap(w); F.tick(w); }
    return JSON.stringify({ y: w.bird.y, pipes: w.pipes, score: w.score, dead: w.dead });
  }
  assert.equal(play(), play());
});

test('medals at 10, 20, 30 and 40 points', () => {
  assert.equal(F.medal(0), null);
  assert.equal(F.medal(9), null);
  assert.equal(F.medal(10), 'bronze');
  assert.equal(F.medal(19), 'bronze');
  assert.equal(F.medal(20), 'silver');
  assert.equal(F.medal(30), 'gold');
  assert.equal(F.medal(40), 'platinum');
  assert.equal(F.medal(250), 'platinum');
});
