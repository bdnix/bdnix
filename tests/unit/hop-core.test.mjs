import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const F = load('assets/js/hop-core.js').bdnixHop;

// With rand fixed at 0 the lanes go: grass, grass, road, grass, grass, river,
// grass, grass, road, ... Roads and rivers here are one lane each, with no
// trees on the grass. Sequences of numbers make other layouts.
function seq(...values){
  let i = 0;
  return () => values[i++ % values.length];
}
const types = (w, from, to) => {
  const out = [];
  for (let r = from; r <= to; r++) out.push(F.laneAt(w, r).type[0]);
  return out.join('');
};
// Steps until `done(world)` or the step limit; returns how the round ended.
function run(w, steps, done = () => false){
  for (let i = 0; i < steps && !done(w); i++) {
    const end = F.tick(w);
    if (end) return end;
  }
  return null;
}
// Puts the item of a lane at a board column (its left edge).
const place = (item, col) => { item.pos = ((col + F.MARGIN) % F.PERIOD + F.PERIOD) % F.PERIOD; };

test('a new round: the chicken on grass at the bottom middle, lanes past the top of the screen', () => {
  const w = F.create(() => 0);
  assert.equal(w.chicken.x, F.START_COL);
  assert.equal(w.chicken.row, 0);
  assert.equal(w.score, 0);
  assert.equal(w.dead, null);
  assert.equal(w.camera, -2);
  assert.equal(types(w, 0, 12), 'ggrggrggrggrg');
  assert.ok(w.gen.row >= w.camera + F.ROWS + 2);
  const r = F.create().rand();
  assert.ok(r >= 0 && r < 1, 'Math.random by default');
});

test('below the start is a hedge the chicken cannot hop into', () => {
  const w = F.create(() => 0);
  assert.equal(F.laneAt(w, -1).type, 'grass');
  assert.equal(F.laneAt(w, -1).trees.length, F.COLS);
  assert.equal(F.hop(w, 'down'), false);
  assert.equal(w.chicken.row, 0);
  assert.equal(w.started, false, 'a blocked hop does not start the round');
});

test('roads come in stretches of up to four, rivers up to three, with grass between', () => {
  const w = F.create(() => 0.99);
  const lanes = types(w, 0, 40);
  assert.match(lanes, /^gg/);
  assert.doesNotMatch(lanes, /r{5}/);
  assert.doesNotMatch(lanes, /v{4}/);
  // After a stretch of road, a small number picks a river; a river is never next to a river stretch.
  const mixed = F.create(seq(0.2, 0.9, 0.4, 0.1));
  const all = types(mixed, 0, 200).replace(/g+/g, ' ');
  for (const stretch of all.trim().split(' ')) assert.match(stretch, /^(r{1,4}|v{1,3})$/, all);
  assert.doesNotMatch(all, /v+ v+/, 'no two river stretches in a row');
});

test('neighbouring lanes run opposite ways, and speeds rise the further you go', () => {
  const w = F.create(() => 0);
  assert.ok(F.laneAt(w, 2).speed < 0);
  assert.ok(F.laneAt(w, 5).speed > 0);
  assert.equal(F.pace(0), 1);
  assert.ok(F.pace(50) > F.pace(10));
  assert.equal(F.pace(1000), F.pace(150), 'capped');
  assert.ok(Math.abs(F.laneAt(w, 8).speed) > Math.abs(F.laneAt(w, 2).speed));
});

test('grass gets up to three trees, and they block hops', () => {
  const w = F.create(seq(0.99, 0.2, 0.5, 0.8));
  const withTrees = [];
  for (let r = 2; r < w.gen.row; r++) {
    const l = F.laneAt(w, r);
    if (l.type === 'grass' && l.trees.length) withTrees.push(l);
    if (l.type === 'grass') assert.ok(l.trees.length <= 3);
  }
  assert.ok(withTrees.length > 0);

  const g = F.create(() => 0);
  g.lanes[1].trees = [F.START_COL];                 // a tree straight ahead
  assert.equal(F.hop(g, 'up'), false);
  assert.equal(g.chicken.row, 0);
  assert.equal(g.chicken.face, 'up', 'turns to face it anyway');
  g.lanes[0].trees = [F.START_COL - 1];
  assert.equal(F.hop(g, 'left'), false);
  assert.equal(F.hop(g, 'right'), true);
  assert.equal(g.chicken.x, F.START_COL + 1);
});

test('hops move one cell, stay on the board and score the furthest row reached', () => {
  const w = F.create(() => 0);
  assert.equal(F.hop(w, 'sideways'), false);
  assert.equal(F.hop(w, 'up'), true);
  assert.equal(w.started, true);
  assert.equal(w.score, 1);
  assert.equal(F.hop(w, 'down'), true);
  assert.equal(w.chicken.row, 0);
  assert.equal(w.score, 1, 'going back keeps the score');
  for (let i = 0; i < 10; i++) F.hop(w, 'left');
  assert.equal(w.chicken.x, 0);
  for (let i = 0; i < 20; i++) F.hop(w, 'right');
  assert.equal(w.chicken.x, F.COLS - 1);
});

test('a car hits the chicken in its lane, and hopping into one ends the round too', () => {
  const w = F.create(() => 0);
  const road = F.laneAt(w, 2);                       // traffic runs right to left
  place(road.items[0], F.START_COL + 3);
  place(road.items[1], F.START_COL + 3 + F.PERIOD / 2);
  F.hop(w, 'up');
  assert.equal(F.hop(w, 'up'), true);
  assert.equal(w.dead, null, 'the lane is clear for now');
  assert.equal(run(w, 1000), 'car');
  assert.equal(w.dead, 'car');
  assert.equal(F.tick(w), null, 'nothing moves after the end');
  assert.equal(F.hop(w, 'up'), false);

  const v = F.create(() => 0);
  place(F.laneAt(v, 2).items[0], F.START_COL);
  F.hop(v, 'up');
  F.hop(v, 'up');
  assert.equal(v.dead, 'car');
});

test('logs carry the chicken; missing them, or riding off the board, ends the round', () => {
  const w = F.create(() => 0);
  const river = F.laneAt(w, 5);                      // flows left to right
  place(river.items[0], F.START_COL - 1);            // a log under columns 3 to 5
  place(river.items[1], F.START_COL + 4);
  place(river.items[2], F.START_COL + 9);
  F.laneAt(w, 2).items.forEach((it) => place(it, 20)); // clear the road
  for (let i = 0; i < 4; i++) F.hop(w, 'up');
  assert.equal(F.hop(w, 'up'), true);
  assert.equal(w.dead, null);
  const x = w.chicken.x;
  F.tick(w);
  assert.ok(w.chicken.x > x, 'drifts with the log');
  assert.equal(F.hop(w, 'up'), true);                // back onto grass, landing on a whole cell
  assert.equal(w.chicken.x, Math.round(w.chicken.x));

  const miss = F.create(() => 0);
  place(F.laneAt(miss, 5).items[0], F.START_COL + 1);
  place(F.laneAt(miss, 5).items[1], F.START_COL + 6);
  place(F.laneAt(miss, 5).items[2], F.START_COL - 5);
  F.laneAt(miss, 2).items.forEach((it) => place(it, 20));
  for (let i = 0; i < 5; i++) F.hop(miss, 'up');
  assert.equal(miss.dead, 'water');

  const ride = F.create(() => 0);
  const logs = F.laneAt(ride, 5).items;
  place(logs[0], F.COLS - 3);
  place(logs[1], F.COLS - 3 - 5);
  place(logs[2], F.COLS - 3 - 10);
  F.laneAt(ride, 2).items.forEach((it) => place(it, 20));
  for (let i = 0; i < 4; i++) F.hop(ride, 'up');
  for (let i = 0; i < 4; i++) F.hop(ride, 'right');
  F.hop(ride, 'up');
  assert.equal(ride.dead, null);
  assert.equal(run(ride, 2000), 'swept');
});

test('sideways hops on a log keep the chicken between cells', () => {
  const w = F.create(() => 0);
  w.chicken.row = 5; w.chicken.x = 3.4;
  const logs = F.laneAt(w, 5).items;
  place(logs[0], 1);
  assert.equal(F.hop(w, 'left'), true);
  assert.ok(Math.abs(w.chicken.x - 2.4) < 1e-9);
  w.chicken.x = 0.3;
  assert.equal(F.hop(w, 'left'), false, 'the edge of the board is in the way');
});

test('the camera waits for the first hop, follows the chicken, then leaves it behind', () => {
  const w = F.create(() => 0);
  run(w, 600);
  assert.equal(w.camera, -2, 'nothing moves on before the first hop');
  F.hop(w, 'right');
  run(w, 120);
  assert.ok(Math.abs(w.camera - (-2 + F.CREEP)) < 0.01);
  for (let i = 0; i < 12; i++) F.laneAt(w, 2 + i).items.forEach((it) => place(it, 20));
  w.chicken.row = 7;                                 // grass, far ahead
  F.tick(w);
  assert.ok(w.camera >= 7 - F.AHEAD);
  w.chicken.row = 3;
  assert.equal(run(w, 60 * 120), 'behind');
});

test('old lanes are dropped as the camera moves on', () => {
  const w = F.create(() => 0);
  w.camera = 20;
  w.chicken.row = 22;
  F.fill(w);
  assert.equal(w.base, 17);
  assert.equal(w.lanes.length, w.gen.row - w.base);
  assert.equal(F.laneAt(w, 3).type, 'grass', 'dropped rows read as hedge');
  assert.equal(F.laneAt(w, 3).trees.length, F.COLS);
});

test('advance runs whole steps and keeps the rest for next time', () => {
  const w = F.create(() => 0);
  const road = F.laneAt(w, 2), pos = road.items[0].pos;
  const r = F.advance(w, F.STEP * 2.5);
  assert.equal(r.end, null);
  assert.ok(Math.abs(r.carry - F.STEP / 2) < 1e-9);
  assert.ok(Math.abs(road.items[0].pos - (pos + road.speed * F.STEP * 2 + F.PERIOD) % F.PERIOD) < 1e-9);
  const again = F.advance(w, F.STEP * 0.6, r.carry);
  assert.ok(Math.abs(again.carry - F.STEP * 0.1) < 1e-9);

  // Stops at the end of the round and drops the leftover time.
  const v = F.create(() => 0);
  place(F.laneAt(v, 2).items[0], F.START_COL + 2);
  place(F.laneAt(v, 2).items[1], F.START_COL + 2 + F.PERIOD / 2);
  F.hop(v, 'up'); F.hop(v, 'up');
  assert.equal(v.dead, null);
  const end = F.advance(v, 10);
  assert.equal(end.end, 'car');
  assert.equal(end.carry, 0);
});

test('danger reads the chicken where it stands', () => {
  const w = F.create(() => 0);
  assert.equal(F.danger(w), null);
  w.chicken.row = 5;
  w.chicken.x = -1;
  assert.equal(F.danger(w), 'swept');
  w.chicken.x = F.COLS;
  assert.equal(F.danger(w), 'swept');
  assert.equal(F.left({ pos: F.MARGIN }), 0);
});

// Equal to within rounding (and -0 is 0).
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' is not ' + b);

test('a car hit: the chicken squashes and is shoved with the car, the board shakes, then settles', () => {
  const start = F.hitPose(0, 1);
  near(start.sx, 1);
  near(start.sy, 1);
  near(start.dx, 0);
  near(start.flash, 1);
  near(start.shakeX, 0);
  near(start.shakeY, 3);

  const flat = F.hitPose(0.2, 1);
  near(flat.sx, 1.35);
  near(flat.sy, 0.35);
  near(flat.dx, 0.3);
  near(flat.flash, 0);
  assert.ok(Math.abs(flat.shakeX) > 0);

  near(F.hitPose(0.2, -2).dx, -0.3);          // a car driving left shoves it left
  assert.ok(F.hitPose(0.05, 1).dx < 0.3);      // still on its way

  const end = F.hitPose(5, 1);
  near(end.shakeX, 0);
  near(end.shakeY, 0);
  near(end.dx, 0.3);
});

test('a car hit: feathers burst out from the chicken, drift down and fade', () => {
  const at = (t) => F.hitPose(t, 1).feathers;
  assert.equal(at(0).length, 7);
  for (const f of at(0)) {
    near(f.x, 0);
    near(f.y, 0);
    near(f.alpha, 1);
  }
  const dist = (f) => Math.hypot(f.x, f.y);
  const mid = at(0.3), late = at(0.6);
  mid.forEach((f, i) => {
    assert.ok(dist(f) > 0.3 && Math.abs(late[i].x) >= Math.abs(f.x));  // flying outwards
    assert.ok(late[i].alpha < f.alpha && f.alpha < 1);
    assert.notEqual(late[i].spin, f.spin);                    // they spin as they go
  });
  // Spread all round the chicken, a little lower once they've drifted.
  assert.ok(mid.some((f) => f.x < 0) && mid.some((f) => f.x > 0));
  assert.ok(late.reduce((s, f) => s + f.y, 0) > 0);
  assert.ok(at(0.8).every((f) => f.alpha === 0));
  assert.deepEqual(at(0.6), at(0.6));                         // the same every time
});
