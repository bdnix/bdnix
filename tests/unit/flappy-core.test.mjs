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

test('a board can be wider, from W to MAX_W', () => {
  assert.equal(F.fitWidth(), F.W);
  assert.equal(F.fitWidth(100), F.W);
  assert.equal(F.fitWidth(640.7), 640);
  assert.equal(F.fitWidth(5000), F.MAX_W);
  assert.equal(F.fitWidth(NaN), F.W);
  assert.equal(F.create().width, F.W);
  const w = F.create(() => 0.5, 640);
  assert.equal(w.width, 640);
  assert.equal(w.nextPipe, 680, 'the first pipe comes in from beyond the right edge');
});

test('a wide board fills with pipes, and one that grows wider fills the new space', () => {
  const wide = F.create(() => 0.5, 640);
  const toFirst = Math.ceil(40 / (F.SPEED * F.STEP));
  for (let s = 0; s < toFirst; s++) { wide.bird.y = 216; wide.bird.vy = 0; F.tick(wide); }
  assert.equal(wide.pipes.length, 1);
  assert.ok(wide.pipes[0].x <= 640 && wide.pipes[0].x > 638, 'first pipe at the wide right edge');

  // Turned sideways mid-round: the board grows, and pipes fill it at the
  // usual spacing on the next step, rather than one at a time.
  const w = F.create(() => 0.5);
  for (let s = 0; s < toFirst; s++) { w.bird.y = 216; w.bird.vy = 0; F.tick(w); }
  assert.equal(w.pipes.length, 1);
  w.width = F.MAX_W;
  w.bird.y = 216; w.bird.vy = 0; F.tick(w);
  const xs = w.pipes.map((p) => p.x);
  assert.equal(xs.length, Math.floor((F.MAX_W - xs[0]) / F.SPACING) + 1);
  assert.ok(xs.length >= 4);
  for (let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - F.SPACING) < 1e-6);
  assert.ok(w.nextPipe > F.MAX_W && w.nextPipe <= F.MAX_W + F.SPACING);
});
