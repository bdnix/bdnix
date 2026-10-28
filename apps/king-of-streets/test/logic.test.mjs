import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from '../../../tests/unit/load.mjs';

const F = load('apps/king-of-streets/street-core.js').bdnixStreet;

// Runs the race for `seconds`.
function ride(w, seconds){ F.advance(w, seconds, 0); }
// A world with the player riding at `speed`, `z` metres in, and every rival
// put out of the way (stopped at the start, unless the test brings one in). It's late
// in the race, when the traffic has all driven on far ahead (parked CNGs
// aside: the tests that ride far keep out of their way).
function alone(speed = 20, z = 100, race = 1, bike){
  const w = F.create(race, bike);
  w.time = 3000;
  w.player.z = z; w.player.speed = speed;
  w.rivals.forEach((o) => { o.z = 0; o.speed = 0; o.top = -10; o.cool = 99; });
  return w;
}
// Brings rival `i` alongside the player: `dz` metres ahead, `dx` across.
function beside(w, i, dz, dx, extra = {}){
  const o = w.rivals[i], p = w.player;
  Object.assign(o, { z: p.z + dz, x: p.x + dx, speed: p.speed, top: p.speed, cool: 99 }, extra);
  return o;
}
// A moving vehicle of `kind` in race `race`, and the time it's at z.
function vehicle(race, kind){ return F.traffic(race).find((v) => v.kind === kind && !v.parked); }
// Compares values from the sandbox, made in another realm, as plain JSON.
const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);
const differ = (a, b, m) => assert.notDeepEqual(plain(a), plain(b), m);
const types = (w) => w.events.map((e) => e.type);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;

test('a new race: the player last on the grid on the race\'s bike, six rivals ahead, nobody moving', () => {
  const w = F.create(1);
  same([w.race, w.bike, w.level, w.length], [1, 1, 1, 2000]);
  same(w.player, { z: 0, x: 0, speed: 0, health: F.HEALTH, weapon: null, push: 0, attack: null, crash: 0, safe: 0, lean: 0 });
  assert.equal(w.rivals.length, 6);
  same(w.rivals.map((o) => o.name), ['Kalu', 'Bablu', 'Mintu', 'Rocky', 'Tinku', 'Pinky']);
  assert.ok(w.rivals.every((o) => o.z > 0 && o.speed === 0 && o.health === o.max && !o.down && !o.place));
  same(w.rivals.map((o) => o.weapon), [null, 'stick', null, null, 'chain', null]);
  assert.equal(F.position(w), 7);
  same([w.score, w.time, w.finished, w.place, w.over], [0, 0, 0, 0, null]);
  same(w.shoved, {});
  // Any bike can ride any race; numbers out of range come back in range.
  same([F.create(13, 2).bike, F.create(13).bike, F.create().race, F.create(99).race, F.create(1, 9).bike], [2, 5, 1, 15, 5]);
});

test('fifteen races, three at each of five levels, each its route and time of day, longer as they go', () => {
  same([1, 3, 4, 7, 10, 13, 15].map(F.levelOf), [1, 1, 2, 3, 4, 5, 5]);
  same(F.LEVELS.map((l) => l.time), ['dawn', 'night', 'day', 'dusk', 'rush']);
  same(F.LEVELS.map((l) => l.raised), [null, null, 'bridge', 'flyover', 'expressway']);
  assert.ok(F.LEVELS.every((l, i) => !i || l.traffic > F.LEVELS[i - 1].traffic), 'busier as they go');
  same([1, 2, 3, 4, 13, 15].map(F.raceLength), [2000, 2400, 2800, 2300, 3200, 4000]);
  assert.equal(F.level(7), F.LEVELS[2]);
  // Rivals: tougher and faster as the levels go, on bikes of about the race's level.
  const a = F.create(1), b = F.create(13);
  assert.ok(b.rivals[0].max > a.rivals[0].max);
  assert.ok(Math.min(...b.rivals.map((o) => o.top)) > Math.max(...a.rivals.map((o) => o.top)));
  same(a.rivals.map((o) => o.bike), [1, 1, 2, 1, 1, 1]);
  same(b.rivals.map((o) => o.bike), [5, 5, 5, 4, 5, 5]);
  same(F.create(2).rivals.map((o) => o.weapon), [null, null, 'nunchaku', 'stick', null, 'chain']);
  // Each race shares out the same speeds in its own order.
  const skill = (r) => F.create(r).rivals.filter((o) => o.bike === F.levelOf(r)).map((o) => +(o.top - F.BIKES[o.bike - 1].top * 0.9).toFixed(6));
  differ(skill(1), skill(2));
});

test('five bikes, each faster and dearer than the last', () => {
  same(F.BIKES.map((b) => b.id), ['k1_vino', 'k2_125', 'k3_pulsar', 'k4_zx6r', 'k5_h2']);
  same(F.BIKES.map((b) => b.price), [0, 1500, 4000, 10000, 22500]);
  assert.ok(F.BIKES.every((b, i) => !i || (b.top > F.BIKES[i - 1].top && b.accel >= F.BIKES[i - 1].accel)));
  assert.ok(F.BIKES.every((b) => b.grip > 0 && b.grip < 1 && b.steer > 0));
});

test('the road: the same every time for a race, straight at the start, flat, with poles and trees on the footpath', () => {
  const T = F.track(1);
  assert.equal(T, F.track(1), 'made once');
  assert.equal(T.n, Math.ceil((2000 + F.RUN_OUT) / F.SEG));
  assert.equal(T.curve.length, T.n);
  assert.ok(T.curve.slice(0, 30).every((c) => c === 0));
  assert.ok(T.curve.some((c) => Math.abs(c) > 0.2), 'bends');
  const all = [1, 2, 3].flatMap((r) => F.track(r).curve);
  assert.ok(all.some((c) => c > 0.2) && all.some((c) => c < -0.2), 'both ways');
  assert.ok(T.curve.every((c) => Math.abs(c) <= 0.75));
  same(T.raised, []);
  assert.ok([0, 500, 1999].every((z) => F.heightAt(T, z) === 0), 'no hills in Dhaka');
  differ(F.track(2).curve.slice(0, 200), T.curve.slice(0, 200));
  // A pole every 30 metres, on alternate sides, trees here and there, and
  // nothing solid on the road or past the footpath.
  same(T.scenery[6].find((o) => o.kind === 'pole').x, 7.6);
  same(T.scenery[12].find((o) => o.kind === 'pole').x, -7.6);
  const solid = T.scenery.flat().filter((o) => ['pole', 'tree'].includes(o.kind));
  assert.ok(solid.length > 70 && solid.some((o) => o.kind === 'tree'));
  assert.ok(solid.every((o) => Math.abs(o.x) > F.ROAD && Math.abs(o.x) < F.EDGE));
  assert.ok(T.scenery.flat().some((o) => o.kind === 'mosque'), 'and mosques along the way');
  assert.equal(F.segIndex(T, -10), 0);
  assert.equal(F.segIndex(T, 12), 2);
  assert.equal(F.segIndex(T, 1e9), T.n - 1);
  same(F.limits(T, 100), [-F.EDGE, F.EDGE]);
  assert.equal(F.offRoad(F.ROAD + 0.1), true);
  assert.equal(F.offRoad(-F.ROAD), false);
});

test('raised roads: bridges, a flyover and the expressway, up ramps, between barriers', () => {
  const lake = F.track(7), fly = F.track(10), exp = F.track(13);
  same(lake.raised.map((s) => s.kind), ['bridge', 'bridge']);
  same(fly.raised.map((s) => [s.kind, s.h]), [['flyover', 7.5]]);
  same(exp.raised.map((s) => [s.kind, s.h, s.z0]), [['expressway', 14, 250]]);
  const s = fly.raised[0];
  assert.equal(F.heightAt(fly, s.z0 - s.ramp - 1), 0);
  assert.ok(near(F.heightAt(fly, s.z0 - s.ramp / 2), s.h / 2));
  assert.equal(F.heightAt(fly, s.z0 + 10), s.h);
  assert.ok(near(F.heightAt(fly, s.z1 + s.ramp / 2), s.h / 2));
  assert.equal(F.heightAt(fly, s.z1 + s.ramp + 1), 0);
  for (let z = s.z0 - s.ramp; z < s.z0; z += 2) assert.ok(F.heightAt(fly, z + 2) >= F.heightAt(fly, z), 'a smooth ramp up');
  // Up there, barriers; and nothing on the footpath to hit, as there is none.
  same(F.limits(fly, s.z0 + 10), [-F.WALL, F.WALL]);
  const up = fly.scenery.slice(Math.ceil((s.z0 - s.ramp) / F.SEG), Math.floor((s.z1 + s.ramp) / F.SEG));
  assert.ok(up.flat().every((o) => o.kind === 'mosque'));
  // By the lake a railing on the left, the footpath on the right; trees only on the right.
  same(F.limits(lake, 100), [-F.WALL, F.EDGE]);
  assert.ok(lake.scenery.flat().filter((o) => o.kind === 'tree').every((o) => o.x > 0));
});

test('the traffic: the same every time, in lanes, driving on; CNGs parked at the kerb, but not up on a raised road', () => {
  const cars = F.traffic(1);
  assert.equal(cars, F.traffic(1));
  const moving = cars.filter((v) => !v.parked), parked = cars.filter((v) => v.parked);
  assert.ok(moving.length > 10 && parked.length > 5);
  assert.ok(cars.every((v, i) => v.id === i));
  assert.ok(moving.every((v) => v.z0 >= 160), 'none on the grid');
  assert.ok(moving.every((v) => F.LANES.includes(v.x) && v.speed > 4 && v.speed < 21 && F.VEHICLES[v.kind]));
  same([...new Set(moving.map((v) => v.kind))].sort(), ['bus', 'car', 'cng', 'truck']);
  assert.ok(parked.every((v) => v.kind === 'cng' && v.speed === 0 && Math.abs(v.x) === F.PARKED_X));
  const v = moving[0];
  assert.equal(F.at(v, 0), v.z0);
  assert.ok(near(F.at(v, 10), v.z0 + v.speed * 10));
  assert.ok(F.traffic(13).filter((c) => !c.parked).length > moving.length * 3, 'much busier at rush hour');
  const T = F.track(13);
  assert.ok(F.traffic(13).filter((c) => c.parked).every((c) => F.heightAt(T, c.z0) === 0));
  // Where a vehicle is now; those nearby.
  const w = F.create(1);
  w.time = 2;
  same(F.where(w, v), { z: F.at(v, 2), x: v.x });
  const near20 = F.nearby(w, F.at(v, 2), 20);
  assert.ok(near20.some((c) => c.id === v.id && c.speed === v.speed));
  assert.ok(near20.every((c) => Math.abs(c.z - F.at(v, 2)) < 20));
});

test('riding: up to the bike\'s top speed, braking, and slower off the road', () => {
  // Kept to the middle of the road, out of the bends' pull.
  const straight = (w, seconds) => { for (let t = 0; t < seconds; t += F.STEP) { F.step(w); w.player.x = 0; } };
  const w = alone(0, 50);
  straight(w, 1);
  assert.ok(w.player.speed > 5 && w.player.speed < 15, `${w.player.speed}`);
  straight(w, 25);
  const top = F.BIKES[0].top;
  assert.ok(w.player.speed > top - 1 && w.player.speed <= top);
  w.input.brake = true;
  ride(w, 0.5);
  assert.ok(near(w.player.speed, top - 12, 0.5));
  ride(w, 5);
  assert.equal(w.player.speed, 0);
  w.input.brake = false;
  // On the footpath the bike slows to its top speed there.
  const k = alone(25, 50);
  k.player.x = 8.5;
  ride(k, 3);
  assert.ok(k.player.speed < F.KERB_TOP + 1, `${k.player.speed}`);
  // A faster bike is faster.
  const h = alone(0, 50, 13, 5);
  straight(h, 30);
  assert.ok(h.player.speed > 60);
});

test('steering, as far as the footpath\'s edge or a barrier, and the bends pull a fast bike outwards', () => {
  const w = alone(20, 50);
  w.input.steer = 1;
  ride(w, 0.5);
  assert.ok(near(w.player.x, F.BIKES[0].steer * 0.5, 0.2), `${w.player.x}`);
  assert.ok(w.player.lean > 0.9);
  ride(w, 3);
  assert.equal(w.player.x, F.EDGE);
  w.input.steer = -3;                                  // no more than full lock
  ride(w, 0.5);
  assert.ok(near(w.player.x, F.EDGE - F.BIKES[0].steer * 0.5, 0.2));
  // Standing still, steering does nothing.
  const s = alone(0, 50);
  s.input.brake = true;
  s.input.steer = 1;
  ride(s, 1);
  assert.equal(s.player.x, 0);

  // Into a bend at speed, the bike drifts to the outside.
  const T = F.track(1), at = T.curve.findIndex((c) => c > 0.4);
  const b = alone(F.BIKES[0].top, at * F.SEG);
  F.step(b);
  assert.ok(b.player.x < 0, 'to the left, out of a bend to the right');

  // On the flyover, the barrier stops the bike and scrapes speed off.
  const fly = F.track(10).raised[0];
  const f = alone(40, fly.z0 + 20, 10);
  f.input.steer = 1;
  ride(f, 2);
  assert.equal(f.player.x, F.WALL);
  assert.ok(f.player.speed < 40);
  assert.ok(types(f).includes('scrape'));
});

test('advance runs whole steps and carries the rest over', () => {
  const w = F.create(1);
  let carry = F.advance(w, F.STEP * 2.5, 0);
  assert.ok(near(carry, F.STEP / 2));
  assert.ok(near(w.time, F.STEP * 2));
  carry = F.advance(w, F.STEP / 2, carry);
  assert.ok(near(w.time, F.STEP * 3));
  assert.ok(carry < 1e-9);
});

test('a punch lands on a rival in reach, and one move at a time', () => {
  const w = alone();
  const o = beside(w, 0, 1, 1.2);
  assert.equal(F.attack(w, 'punch'), true);
  same(w.player.attack, { move: 'punch', t: 0, side: 1, done: false, aim: 0 });
  assert.equal(F.attack(w, 'kick'), false, 'already punching');
  same(types(w), ['swing']);
  ride(w, F.MOVES.punch.at + F.STEP);
  assert.equal(o.health, o.max - F.MOVES.punch.dmg);
  same(w.events[1], { type: 'hit', move: 'punch', rival: 0 });
  assert.ok(o.push > 0, 'shoved away');
  assert.equal(o.flinchSide, 1, 'reeling away from the blow');
  assert.ok(o.flinch > 0 && o.flinch <= F.FLINCH);
  ride(w, F.FLINCH);
  assert.equal(o.flinch, 0, 'and over it');
  ride(w, F.MOVES.punch.time);
  assert.equal(w.player.attack, null);
  assert.equal(F.attack(w, 'kick'), true, 'free again');
  assert.equal(F.attack(w, 'headbutt'), false);
});

test('a kick reaches further, hits harder and shoves harder; a punch out of reach misses', () => {
  const w = alone();
  const o = beside(w, 1, 0, -3.6);
  F.attack(w, 'punch');
  assert.equal(w.player.attack.aim, null, 'too far to lock on to');
  ride(w, F.MOVES.punch.time + F.STEP);
  assert.equal(o.health, o.max, 'too far for a fist');
  same(types(w), ['swing', 'miss']);
  w.events.length = 0;
  beside(w, 1, 0, -2.2, { push: 0 });
  F.attack(w, 'kick');
  assert.equal(w.player.attack.side, -1, 'aimed at the rival on the left');
  ride(w, F.MOVES.kick.at + F.STEP);
  assert.equal(o.health, o.max - F.MOVES.kick.dmg);
  assert.ok(o.push < -F.MOVES.punch.push);
  same(types(w), ['swing', 'hit']);
  // Too far ahead or behind, nothing lands either.
  for (const dz of [F.AHEAD + 1, -F.BEHIND - 1]) {
    const v = alone();
    const a = beside(v, 2, dz, 0.5);
    F.attack(v, 'kick');
    ride(v, 0.3);
    assert.equal(a.health, a.max, `${dz}`);
  }
});

test('knocking a rival off scores, takes their weapon, and they stay down', () => {
  const w = alone();
  const o = beside(w, 1, 0.5, 1, { health: 5 });     // Bablu, who has the stick
  F.attack(w, 'punch');
  ride(w, F.MOVES.punch.at + F.STEP);
  assert.equal(o.health, 0);
  assert.ok(o.down > 0);
  assert.equal(w.score, F.KO_POINTS);
  same((w.events.find((e) => e.type === 'ko')), { type: 'ko', rival: 1, weapon: 'stick' });
  assert.equal(w.player.weapon, 'stick');
  assert.equal(o.weapon, null);
  // Down, they slide to a stop and are out of the race.
  ride(w, 4);
  assert.equal(o.speed, 0);
  assert.ok(o.down > 4);
  const before = o.z;
  ride(w, 1);
  assert.equal(o.z, before);
  w.player.z = before - 1;
  w.player.x = 0;
  assert.equal(F.position(w), 1, 'only those still riding count');
  // And a punch with a weapon in hand is a swing of it.
  F.attack(w, 'punch');
  assert.equal(w.player.attack.move, 'stick');
  const x = beside(w, 2, 1, -2);
  ride(w, F.MOVES.stick.at + F.STEP);
  assert.equal(x.health, x.max - F.MOVES.stick.dmg);
  assert.ok(F.MOVES.stick.dmg > F.MOVES.kick.dmg && F.MOVES.chain.dmg > F.MOVES.stick.dmg && F.MOVES.nunchaku.dmg > F.MOVES.chain.dmg);
  // A fallen rival can't be hit again.
  w.events.length = 0;
  w.rivals.forEach((r) => { if (r !== o) r.z = 5000; });
  o.z = w.player.z + 0.5; o.x = w.player.x;
  ride(w, 1);
  F.attack(w, 'kick');
  ride(w, 1);
  same(types(w).filter((t) => t !== 'shove' && t !== 'clang'), ['swing', 'miss']);
});

test('a blow locks on to the rival alongside: the bike edges in, and it lands a little beyond its reach', () => {
  // Alongside on the right, just out of a fist's reach, and edging away.
  const w = alone();
  const o = beside(w, 0, 0.5, F.MOVES.punch.reach + 0.9);
  F.attack(w, 'punch');
  assert.equal(w.player.attack.aim, 0);
  const x = w.player.x;
  ride(w, F.MOVES.punch.at / 2);
  assert.ok(w.player.x > x, 'the bike edges in towards them');
  o.x += 0.2;
  ride(w, F.MOVES.punch.at / 2 + 2 * F.STEP);
  assert.equal(o.health, o.max - F.MOVES.punch.dmg, 'and it lands');
  // Once it's landed, the bike stops edging in.
  const after = w.player.x;
  ride(w, 0.1);
  assert.ok(Math.abs(w.player.x - after) < 0.01);
  // Locked on, but they got clean away: a miss.
  const v = alone();
  const a = beside(v, 0, 0.5, 2.5);
  F.attack(v, 'punch');
  a.x = 9; a.push = 0;
  ride(v, F.MOVES.punch.time);
  assert.equal(a.health, a.max);
  assert.ok(types(v).includes('miss'));
});

test('a kick sends a CNG beside the bike off to the kerb; a car, a bus or a truck does not budge', () => {
  const cng = F.traffic(1).find((v) => v.kind === 'cng' && !v.parked && v.x > 0);
  const w = alone(cng.speed, 0);
  w.time = 1;
  const at = F.where(w, cng);
  w.player.z = at.z; w.player.x = at.x - cng.half - 1;
  assert.equal(F.attack(w, 'kick'), true);
  same(w.player.attack.side, 1, 'towards it');
  ride(w, F.MOVES.kick.at + F.STEP);
  assert.ok(types(w).includes('shove'));
  const s = w.shoved[cng.id];
  assert.ok(s.vx > 0);
  ride(w, 4);
  assert.ok(near(Math.abs(s.x), F.ROAD + 0.6 - cng.half, 1e-6), 'stopped against the kerb');
  assert.equal(s.vx, 0);
  ride(w, 4);
  assert.equal(s.speed, 0, 'and stays');
  const z = s.z;
  ride(w, 2);
  assert.equal(s.z, z);
  same(F.where(w, cng), { z: s.z, x: s.x });
  // A second kick sends it on again, from where it is.
  w.player.z = s.z; w.player.x = s.x - cng.half - 1; w.player.attack = null; w.player.speed = 0; w.input.brake = true;
  F.attack(w, 'kick');
  ride(w, F.MOVES.kick.time);
  assert.ok(types(w).filter((t) => t === 'shove').length === 2);

  for (const kind of ['car', 'bus', 'truck']) {
    const v = vehicle(1, kind);
    const k = alone(v.speed, 0);
    k.time = 1;
    const p = F.where(k, v);
    k.player.z = p.z; k.player.x = p.x + v.half + 1;
    F.attack(k, 'kick');
    ride(k, F.MOVES.kick.at + F.STEP);
    same(types(k), ['swing', 'clang'], kind);
    same(k.shoved, {});
  }
  // A punch at a CNG does nothing, and a kick with nothing beside it neither.
  const p = alone(cng.speed, 0);
  p.time = 1;
  const pc = F.where(p, cng);
  p.player.z = pc.z; p.player.x = pc.x - cng.half - 1;
  F.attack(p, 'punch');
  ride(p, F.MOVES.punch.time);
  same(p.shoved, {});
  const n = alone(20, 50);
  F.attack(n, 'kick');
  ride(n, F.MOVES.kick.time);
  same(types(n), ['swing', 'miss']);
});

test('a keen rival kicks a CNG out of the way too', () => {
  const cng = vehicle(1, 'cng');
  const w = alone(cng.speed, 0);
  w.time = 1;
  const at = F.where(w, cng);
  w.player.z = at.z - 100;
  const o = Object.assign(w.rivals[1], { z: at.z, x: at.x + cng.half + 1, speed: cng.speed, top: cng.speed, cool: 0 });   // Bablu, keen
  F.step(w);
  assert.equal(o.attack.move, 'kick');
  assert.equal(o.attack.car, cng.id);
  ride(w, F.MOVES.kick.at + F.STEP);
  assert.ok(w.shoved[cng.id], 'shoved');
  assert.ok(w.shoved[cng.id].vx < 0, 'away from the rival');
});

test('rivals fight back, when they can reach and their arm is free', () => {
  const w = alone();
  const o = beside(w, 4, 0.5, 1.5, { cool: 0 });   // Tinku, with the chain
  ride(w, F.MOVES.chain.at + F.STEP * 2);
  assert.equal(w.player.health, F.HEALTH - Math.round(F.MOVES.chain.dmg * F.RIVAL_HURT));
  same((w.events.find((e) => e.type === 'hurt')), { type: 'hurt', move: 'chain', rival: 4 });
  assert.ok(o.cool > 0.5, 'then a moment before the next');
  // Not while the player is just back on the bike after a crash.
  const s = alone();
  s.player.safe = 1;
  beside(s, 0, 0.5, 1, { cool: 0 });
  ride(s, 0.5);
  assert.equal(s.player.health, F.HEALTH);
  // A rival without a weapon punches, or kicks from further off if they're keen.
  const k = alone();
  const r = beside(k, 3, 0.5, 2, { cool: 0 });
  F.step(k);
  assert.equal(r.attack.move, 'kick');
  const p = alone();
  const q = beside(p, 0, 0.5, 1, { cool: 0 });
  F.step(p);
  assert.equal(q.attack.move, 'punch');
});

test('rivals ride the race: catching up from behind, round traffic, and in at the finish in order', () => {
  // Far behind, a rival rides faster than their top speed.
  const w = alone(25, 1000);
  const o = beside(w, 0, -300, 0, { speed: 25, top: 25 });
  ride(w, 5);
  assert.ok(o.speed > 27, `${o.speed}`);
  // Traffic ahead in their line: they move over.
  const t = F.create(1), car = vehicle(1, 'car');
  t.player.z = 0; t.player.speed = 0;
  t.rivals.forEach((r) => { r.z = 5000; r.top = 0; r.speed = 0; });
  const r = Object.assign(t.rivals[2], { z: car.z0 - 30, x: car.x, speed: 30, top: 30 });
  ride(t, 1.5);
  assert.ok(Math.abs(r.x - F.at(car, t.time)) > 0 && Math.abs(r.x - car.x) > car.half, 'out of its way');
  // Into it anyway: thrown back, not out.
  const u = F.create(1);
  u.player.z = 0;
  u.rivals.forEach((x) => { x.z = 5000; x.top = 0; x.speed = 0; });
  const into = Object.assign(u.rivals[0], { z: car.z0 - 1, x: car.x, speed: 40, top: 40, push: 0 });
  F.step(u);
  assert.ok(into.speed < car.speed && into.down === 0);
  // Across the line: first, second...
  const f = alone(20, 100);
  const a = beside(f, 0, f.length - 100 - 1, 0, { speed: 40, top: 40 });
  const b = beside(f, 1, f.length - 100 - 3, 2, { speed: 40, top: 40 });
  ride(f, 0.2);
  same([a.place, b.place, f.finished], [1, 2, 2]);
  assert.equal(F.position(f), 3);
});

test('bikes side by side bump apart', () => {
  const w = alone();
  const o = beside(w, 0, 0.5, 0.3);
  F.step(w);
  assert.ok(w.player.push < 0 && o.push > 0);
  assert.ok(types(w).includes('bump'));
});

test('riding into the back of traffic is a crash: off the bike, hurt, and the weapon dropped', () => {
  const car = vehicle(1, 'bus');
  const w = alone(30, car.z0 - car.len / 2 - 0.5);
  w.time = 0;
  w.player.x = car.x;
  w.player.weapon = 'chain';
  F.step(w);
  same(w.events, [{ type: 'crash', what: 'bus' }]);
  assert.equal(w.player.crash, F.CRASH_TIME);
  assert.equal(w.player.health, F.HEALTH - F.CRASH_HURT);
  assert.equal(w.player.weapon, null);
  assert.equal(F.attack(w, 'punch'), false, 'no fighting from the tarmac');
  w.input.steer = 1;
  ride(w, F.CRASH_TIME - F.STEP * 2);
  assert.ok(w.player.crash > 0);
  assert.equal(w.player.speed, 0, 'slid to a stop');
  ride(w, F.STEP * 2);
  assert.equal(w.player.crash, 0);
  assert.ok(Math.abs(w.player.x) <= F.ROAD - 1, 'back on the road');
  assert.ok(near(w.player.safe, F.SAFE_TIME));
  // Nothing can hit it until it's going again.
  w.events.length = 0;
  ride(w, 1);
  same(types(w), []);
  // Overtaken by a faster vehicle isn't a crash.
  const s = alone(2, car.z0);
  s.time = 0;
  s.player.x = car.x;
  F.step(s);
  same(types(s), []);
  // A parked CNG is a crash too.
  const pc = F.traffic(1).find((v) => v.parked);
  const p = alone(20, pc.z0 - 2);
  p.player.x = pc.x;
  F.step(p);
  same(types(p), ['crash']);
});

test('a pole on the footpath is a crash too', () => {
  const w = alone(F.KERB_TOP, 6 * F.SEG - 0.5);       // a pole stands at 30 metres, on the right
  w.player.x = 7.6;
  F.step(w);
  same(w.events, [{ type: 'crash', what: 'pole' }]);
  const v = alone(F.KERB_TOP, 6 * F.SEG - 0.5);
  v.player.x = 6.5;                                    // on the road, inside it
  F.step(v);
  same(types(v), []);
});

test('out of health, the player is knocked out and the race is over', () => {
  const w = alone();
  w.player.health = 3;
  beside(w, 0, 0.5, 1, { cool: 0 });
  ride(w, 1);
  assert.equal(w.player.health, 0);
  assert.equal(w.over, 'ko');
  assert.ok(types(w).includes('out'));
  assert.equal(F.attack(w, 'punch'), false);
  // A crash can do it as well, and then the player stays down.
  const c = vehicle(1, 'car');
  const v = alone(30, c.z0 - c.len / 2 - 0.5);
  v.time = 0;
  v.player.x = c.x;
  v.player.health = F.CRASH_HURT;
  F.step(v);
  same(types(v), ['crash', 'out']);
  assert.equal(v.over, 'ko');
  ride(v, F.CRASH_TIME + 1);
  assert.equal(v.player.safe, 0);
  assert.equal(v.player.speed, 0);
});

test('finishing in the top three scores for the place; a win on a smaller bike scores more', () => {
  for (const [ahead, place, bike, points] of [[0, 1, 2, 1000], [1, 2, 2, 600], [2, 3, 2, 300], [3, 4, 2, 0], [0, 1, 1, 2000], [1, 2, 1, 600]]) {
    const w = F.create(4, bike);
    w.score = 100;
    w.rivals.forEach((o, i) => { o.speed = 0; o.top = 0; o.cool = 99; if (i < ahead) { o.place = ++w.finished; o.z = w.length + 10; } else o.z = 10; });
    w.player.z = w.length - 0.1; w.player.speed = 30;
    F.step(w);
    assert.equal(w.place, place);
    assert.equal(w.score, 100 + points, `${place} on ${bike}`);
    assert.equal(w.over, null);
    same((w.events.filter((e) => e.type === 'finish')), [{ type: 'finish', place }]);
    assert.equal(F.position(w), place);
    // Past the line, the player can't steer or fight, and eases off.
    w.input.steer = 1;
    const x = w.player.x;
    ride(w, 5);
    assert.equal(w.player.x, x);
    assert.ok(w.player.speed < 21);
    assert.equal(F.attack(w, 'punch'), false);
  }
});

test('the career: points from races, bikes bought with them, levels opened by the best bike', () => {
  const c = F.career();
  same(c, { points: 0, owned: [1], done: [] });
  assert.equal(F.best(c), 1);
  assert.ok(F.open(c, 3) && !F.open(c, 4));
  assert.equal(F.buy(c, 2), false, 'not enough points');
  const w = F.create(2);
  w.score = 1700; w.place = 1;
  F.bank(c, w);
  same(c, { points: 1700, owned: [1], done: [2] });
  F.bank(c, w);
  same(c.done, [2], 'counted once');
  assert.equal(F.buy(c, 2), true);
  same(c, { points: 1900, owned: [1, 2], done: [2] });
  assert.equal(F.buy(c, 2), false, 'already owned');
  assert.equal(F.buy(c, 9), false);
  assert.ok(F.open(c, 6) && !F.open(c, 7));
  // A race lost earns its knockouts but isn't done.
  const l = F.create(5);
  l.score = 200; l.place = 5;
  F.bank(c, l);
  same([c.points, c.done], [2100, [2]]);
  // Bought out of order, they're kept in order.
  c.points = 40000;
  F.buy(c, 5); F.buy(c, 3);
  same(c.owned, [1, 2, 3, 5]);
  assert.equal(F.best(c), 5);
  assert.ok(F.open(c, 15));
});

test('a career from storage, or a new one if it does not make sense', () => {
  same(F.careerFrom({ points: 300, owned: [2, 1], done: [4, 1] }), { points: 300, owned: [1, 2], done: [1, 4] });
  for (const bad of [null, 'x', { points: -1, owned: [1], done: [] }, { points: 1.5, owned: [1], done: [] }, { points: 0, owned: [2], done: [] },
    { points: 0, owned: [1, 1], done: [] }, { points: 0, owned: [1, 6], done: [] }, { points: 0, owned: [1], done: [16] }, { points: 0, owned: [1], done: [2, 2] },
    { points: 0, owned: 1, done: [] }, { points: 0, owned: [1] }]) same(F.careerFrom(bad), F.career(), JSON.stringify(bad));
});

test('a race comes out the same every time it is ridden the same way', () => {
  const a = F.create(4), b = F.create(4);
  for (const w of [a, b]) {
    for (let i = 0; i < 40; i++) {
      w.input.steer = Math.sin(i) * 0.6;
      ride(w, 0.5);
      if (i % 3 === 0) F.attack(w, i % 2 ? 'kick' : 'punch');
    }
  }
  same(F.snapshot(a), F.snapshot(b));
  assert.ok(a.player.z > 300);
});

test('a race saves as plain numbers and comes back the same, kicked CNGs and all', () => {
  const w = F.create(4, 3);
  w.input.steer = 0.4;
  ride(w, 6);
  F.attack(w, 'kick');
  ride(w, 0.1);
  w.rivals[1].health = 0; w.rivals[1].down = 2;
  const cng = vehicle(4, 'cng');
  w.shoved[cng.id] = { z: 300, x: 2, vx: 3, speed: 4 };
  w.rivals[2].attack = { move: 'kick', t: 0.1, side: 1, done: false, car: cng.id };
  const s = JSON.parse(JSON.stringify(F.snapshot(w)));
  const back = F.restore(s);
  same(F.snapshot(back), s);
  same([back.bike, back.score], [3, w.score]);
  // And carries on exactly as the original does.
  w.input.steer = back.input.steer = -0.2;
  ride(w, 3); ride(back, 3);
  same(F.snapshot(back), F.snapshot(w));
});

test('saves that do not make sense are not restored', () => {
  const w = F.create(1);
  ride(w, 4);
  w.rivals[0].place = 0;
  const cng = vehicle(1, 'cng'), car = vehicle(1, 'car');
  w.shoved[cng.id] = { z: 300, x: 2, vx: 3, speed: 4 };
  const good = JSON.parse(JSON.stringify(F.snapshot(w)));
  assert.ok(F.restore(good));
  const bad = (change) => {
    const s = JSON.parse(JSON.stringify(good));
    change(s);
    return F.restore(s);
  };
  assert.equal(F.restore(null), null);
  assert.equal(F.restore('race'), null);
  for (const change of [
    (s) => { s.race = 0; },
    (s) => { s.race = 16; },
    (s) => { s.race = 1.5; },
    (s) => { s.bike = 0; },
    (s) => { s.bike = 6; },
    (s) => { s.time = -1; },
    (s) => { s.score = -10; },
    (s) => { s.score = '5'; },
    (s) => { delete s.player; },
    (s) => { s.player.z = 2001; },                     // past the finish
    (s) => { s.player.x = 11; },                       // off the edge
    (s) => { s.player.speed = 500; },
    (s) => { s.player.health = 0; },                   // out already
    (s) => { s.player.health = 101; },
    (s) => { s.player.weapon = 'sword'; },
    (s) => { s.player.attack = { move: 'kick', t: 9, side: 1, done: false }; },
    (s) => { s.player.attack = { move: 'kick', t: 0.1, side: 0, done: false }; },
    (s) => { s.player.attack = { move: 'kick', t: 0.1, side: 1, done: false, car: 2 }; },
    (s) => { s.player.attack = { move: 'punch', t: 0.1, side: 1, done: false }; s.player.weapon = 'chain'; },
    (s) => { s.player.crash = 9; },
    (s) => { s.player.safe = -1; },
    (s) => { s.rivals.pop(); },
    (s) => { s.rivals[0] = null; },
    (s) => { s.rivals[0].x = 8; },
    (s) => { s.rivals[0].health = 999; },
    (s) => { s.rivals[0].health = 0; },                // out, but still riding
    (s) => { s.rivals[0].down = 1; },                  // down, but not hurt
    (s) => { s.rivals[0].place = 1; s.finished = 1; }, // in, but short of the line
    (s) => { s.rivals[0].z = 2100; },                  // over the line, but not in
    (s) => { s.rivals[0].z = 2100; s.rivals[0].place = 2; s.finished = 1; }, // second with nobody first
    (s) => { s.finished = 3; },
    (s) => { s.rivals[2].weapon = 'bat'; },
    (s) => { s.rivals[2].cool = -1; },
    (s) => { s.rivals[2].attack = { move: 'stick', t: 0.1 }; },
    (s) => { s.rivals[2].attack = { move: 'punch', t: 0.1, side: 1, done: false, car: 3 }; },
    (s) => { s.rivals[2].attack = { move: 'kick', t: 0.1, side: 1, done: false, car: 99999 }; },
    (s) => { s.shoved = null; },
    (s) => { s.shoved = []; },
    (s) => { s.shoved[car.id] = { z: 10, x: 0, vx: 0, speed: 0 }; },   // only CNGs
    (s) => { s.shoved['x'] = { z: 10, x: 0, vx: 0, speed: 0 }; },
    (s) => { s.shoved[cng.id].x = 20; },
    (s) => { s.shoved[cng.id].vx = 50; },
    (s) => { s.shoved[cng.id] = null; }
  ]) assert.equal(bad(change), null, change.toString());
  // A rival who finished, and one who fell, are kept.
  assert.ok(bad((s) => { s.rivals[0].z = 2100; s.rivals[0].place = 1; s.finished = 1; }));
  assert.ok(bad((s) => { s.rivals[3].health = 0; s.rivals[3].down = 0.5; }));
  assert.ok(bad((s) => { s.player.attack = { move: 'kick', t: 0.1, side: -1, done: true }; s.player.weapon = 'nunchaku'; }));
});
