import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from '../../../tests/unit/load.mjs';

const F = load('apps/street-kids/street-core.js').bdnixStreet;

// Runs the race for `seconds`.
function ride(w, seconds){ F.advance(w, seconds, 0); }
// A world with the player riding at `speed`, `z` metres in, and every rival
// put out of the way (stopped at the start, unless the test brings one in). It's late
// in the race, when the traffic has all driven on far ahead.
function alone(speed = 30, z = 100){
  const w = F.create(1);
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
// Compares values from the sandbox, made in another realm, as plain JSON.
const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);
const differ = (a, b, m) => assert.notDeepEqual(plain(a), plain(b), m);
const types = (w) => w.events.map((e) => e.type);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;

test('a new race: the player last on the grid, six rivals ahead, nobody moving', () => {
  const w = F.create(1);
  assert.equal(w.race, 1);
  assert.equal(w.length, 2400);
  same(w.player, { z: 0, x: 0, speed: 0, health: F.HEALTH, weapon: null, push: 0, attack: null, crash: 0, safe: 0, lean: 0 });
  assert.equal(w.rivals.length, 6);
  same(w.rivals.map((o) => o.name), ['Kalu', 'Bablu', 'Mintu', 'Rocky', 'Tinku', 'Pinky']);
  assert.ok(w.rivals.every((o) => o.z > 0 && o.speed === 0 && o.health === o.max && !o.down && !o.place));
  same(w.rivals.map((o) => o.weapon), [null, 'stick', null, null, 'chain', null]);
  assert.equal(F.position(w), 7);
  same([w.score, w.time, w.finished, w.place, w.over], [0, 0, 0, 0, null]);
  assert.equal(F.create().race, 1);
});

test('later races are longer, tougher and carry the score on', () => {
  same([1, 2, 3, 6, 20].map(F.raceLength), [2400, 2700, 3000, 3900, 4000]);
  const w = F.create(1);
  w.score = 1300;
  const next = F.nextRace(w);
  same([next.race, next.score, next.length], [2, 1300, 2700]);
  assert.ok(next.rivals[0].max > w.rivals[0].max, 'rivals take more knocking off');
  same(next.rivals.map((o) => o.weapon), [null, null, 'nunchaku', 'stick', null, 'chain']);
  assert.ok(Math.max(...F.create(5).rivals.map((o) => o.top)) > Math.max(...w.rivals.map((o) => o.top)), 'and ride faster');
  // Each race shares out the same speeds in its own order.
  const tops = (r) => F.create(r).rivals.map((o) => o.top - Math.min(8, (r - 1) * 1.2));
  same([...tops(1)].sort(), [...tops(2)].sort());
  differ(tops(1), tops(2));
});

test('the road: the same every time for a race, straight at the start, with posts on the kerb', () => {
  const T = F.track(1);
  assert.equal(T, F.track(1), 'made once');
  assert.equal(T.n, Math.ceil((2400 + F.RUN_OUT) / F.SEG));
  assert.equal(T.curve.length, T.n);
  assert.equal(T.y.length, T.n + 1);
  assert.ok(T.curve.slice(0, 30).every((c) => c === 0) && T.y.slice(0, 30).every((y) => y === 0));
  assert.ok(T.curve.some((c) => c > 0.3) && T.curve.some((c) => c < -0.3), 'bends both ways');
  assert.ok(T.curve.every((c) => Math.abs(c) <= 1));
  assert.ok(T.y.some((y) => Math.abs(y) > 5), 'and hills');
  for (let i = 1; i < T.y.length; i++) assert.ok(Math.abs(T.y[i] - T.y[i - 1]) < 2, 'with no steps');
  differ(F.track(2).curve.slice(0, 200), T.curve.slice(0, 200));
  // A lamp post every 40 metres, on alternate sides, and nothing solid
  // anywhere a bike can't reach, or on the road itself.
  same(T.scenery[0].find((o) => o.kind === 'lamp').x, 1.32);
  same(T.scenery[8].find((o) => o.kind === 'lamp').x, -1.32);
  const solid = T.scenery.flat().filter((o) => ['lamp', 'palm', 'tree'].includes(o.kind));
  assert.ok(solid.length > 100);
  assert.ok(solid.every((o) => Math.abs(o.x) > 1.2 && Math.abs(o.x) < F.EDGE));
  assert.ok(T.scenery.flat().filter((o) => !solid.includes(o)).every((o) => Math.abs(o.x) >= 2));
  assert.equal(F.segIndex(T, -10), 0);
  assert.equal(F.segIndex(T, 12), 2);
  assert.equal(F.segIndex(T, 1e9), T.n - 1);
  const i = T.y.findIndex((y, k) => k && y !== T.y[k - 1]);
  assert.ok(near(F.heightAt(T, i * F.SEG - F.SEG / 2), (T.y[i - 1] + T.y[i]) / 2), 'heights in between');
});

test('the traffic: the same every time, in lanes on the road, driving on at its own speed', () => {
  const cars = F.traffic(1);
  assert.equal(cars, F.traffic(1));
  assert.ok(cars.length > 15);
  assert.ok(cars.every((v) => v.z0 >= 220), 'none on the grid');
  assert.ok(cars.every((v) => Math.abs(v.x) + v.half < 1), 'all on the road');
  assert.ok(cars.every((v) => v.speed > 4 && v.speed < 21 && F.VEHICLES[v.kind]));
  same(new Set(cars.map((v) => v.kind)).size, 5);
  const v = cars[0];
  assert.equal(F.at(v, 0), v.z0);
  assert.ok(near(F.at(v, 10), v.z0 + v.speed * 10));
  assert.ok(F.traffic(4).length > cars.length, 'busier later on');
});

test('riding: speeding up to the top speed, braking, and slower off the road', () => {
  // Kept to the middle of the road, out of the bends' pull.
  const straight = (w, seconds) => { for (let t = 0; t < seconds; t += F.STEP) { F.step(w); w.player.x = 0; } };
  const w = alone(0, 50);
  straight(w, 1);
  assert.ok(w.player.speed > 10 && w.player.speed < 25, `${w.player.speed}`);
  straight(w, 20);
  assert.ok(w.player.speed > F.TOP - 1 && w.player.speed <= F.TOP);
  assert.ok(w.player.z > 800);
  w.input.brake = true;
  ride(w, 1);
  assert.ok(near(w.player.speed, F.TOP - 28, 0.5));
  ride(w, 5);
  assert.equal(w.player.speed, 0);
  w.input.brake = false;
  // On the kerb the bike slows to its top speed there.
  const k = alone(F.TOP, 50);
  k.player.x = 1.1;
  ride(k, 3);
  assert.ok(k.player.speed < F.KERB_TOP + 1, `${k.player.speed}`);
  // Later races go a little faster.
  const r = F.create(3);
  r.rivals.forEach((o) => { o.z = 5000; o.top = 0; });
  r.time = 3000;
  straight(r, 25);
  assert.ok(r.player.speed > F.TOP);
});

test('steering, as far as the kerb, and the bends pull a fast bike outwards', () => {
  const w = alone(30, 50);
  w.input.steer = 1;
  ride(w, 0.5);
  assert.ok(near(w.player.x, 0.85, 0.05), `${w.player.x}`);
  assert.ok(w.player.lean > 0.9);
  ride(w, 3);
  assert.equal(w.player.x, F.EDGE);
  w.input.steer = -3;                                  // no more than full lock
  ride(w, 0.5);
  assert.ok(near(w.player.x, F.EDGE - 0.85, 0.05));
  // Standing still, steering does nothing.
  const s = alone(0, 50);
  s.input.brake = true;
  s.input.steer = 1;
  ride(s, 1);
  assert.equal(s.player.x, 0);

  // Into a bend at speed, the bike drifts to the outside.
  const T = F.track(1), at = T.curve.findIndex((c) => c > 0.5);
  const b = alone(F.TOP, at * F.SEG);
  b.input.brake = false;
  F.step(b);
  assert.ok(b.player.x < 0, 'to the left, out of a bend to the right');
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
  const o = beside(w, 0, 1, 0.25);
  assert.equal(F.attack(w, 'punch'), true);
  same(w.player.attack, { move: 'punch', t: 0, side: 1, done: false });
  assert.equal(F.attack(w, 'kick'), false, 'already punching');
  same(types(w), ['swing']);
  ride(w, F.MOVES.punch.at + F.STEP);
  assert.equal(o.health, o.max - F.MOVES.punch.dmg);
  same(w.events[1], { type: 'hit', move: 'punch', rival: 0 });
  assert.ok(o.push > 0, 'shoved away');
  ride(w, F.MOVES.punch.time);
  assert.equal(w.player.attack, null);
  assert.equal(F.attack(w, 'kick'), true, 'free again');
  assert.equal(F.attack(w, 'headbutt'), false);
});

test('a kick reaches further, hits harder and shoves harder; a punch out of reach misses', () => {
  const w = alone();
  const o = beside(w, 1, 0, -0.45);
  F.attack(w, 'punch');
  assert.equal(w.player.attack.side, -1, 'aimed at the rival on the left');
  ride(w, F.MOVES.punch.time + F.STEP);
  assert.equal(o.health, o.max, 'too far for a fist');
  same(types(w), ['swing']);
  w.events.length = 0;
  beside(w, 1, 0, -0.45, { push: 0 });
  F.attack(w, 'kick');
  ride(w, F.MOVES.kick.at + F.STEP);
  assert.equal(o.health, o.max - F.MOVES.kick.dmg);
  assert.ok(o.push < -F.MOVES.punch.push);
  same(types(w), ['swing', 'hit']);
  // Too far ahead or behind, nothing lands either.
  for (const dz of [F.AHEAD + 1, -F.BEHIND - 1]) {
    const v = alone();
    const a = beside(v, 2, dz, 0.1);
    F.attack(v, 'kick');
    ride(v, 0.3);
    assert.equal(a.health, a.max, `${dz}`);
  }
});

test('knocking a rival off scores, takes their weapon, and they stay down', () => {
  const w = alone();
  const o = beside(w, 1, 0.5, 0.2, { health: 5 });   // Bablu, who has the stick
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
  const x = beside(w, 2, 1, -0.5);
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
  same(types(w), ['swing']);
});

test('rivals fight back, when they can reach and their arm is free', () => {
  const w = alone();
  const o = beside(w, 4, 0.5, 0.3, { cool: 0 });   // Tinku, with the chain
  ride(w, F.MOVES.chain.at + F.STEP * 2);
  assert.equal(w.player.health, F.HEALTH - Math.round(F.MOVES.chain.dmg * F.RIVAL_HURT));
  same((w.events.find((e) => e.type === 'hurt')), { type: 'hurt', move: 'chain', rival: 4 });
  assert.ok(o.cool > 0.5, 'then a moment before the next');
  // Not while the player is just back on the bike after a crash.
  const s = alone();
  s.player.safe = 1;
  beside(s, 0, 0.5, 0.2, { cool: 0 });
  ride(s, 0.5);
  assert.equal(s.player.health, F.HEALTH);
  // A rival without a weapon punches, or kicks from further off if they're keen.
  const k = alone();
  const r = beside(k, 3, 0.5, 0.4, { cool: 0 });
  F.step(k);
  assert.equal(r.attack.move, 'kick');
  const p = alone();
  const q = beside(p, 0, 0.5, 0.2, { cool: 0 });
  F.step(p);
  assert.equal(q.attack.move, 'punch');
});

test('rivals ride the race: catching up from behind, round traffic, and in at the finish in order', () => {
  // Far behind, a rival rides faster than their top speed.
  const w = alone(50, 1000);
  const o = beside(w, 0, -300, 0, { speed: 50, top: 50 });
  ride(w, 5);
  assert.ok(o.speed > 53, `${o.speed}`);
  // Traffic ahead in their line: they move over.
  const t = F.create(1), car = F.traffic(1)[0];
  t.player.z = 0; t.player.speed = 0;
  t.time = 0;
  t.rivals.forEach((r) => { r.z = 5000; r.top = 0; r.speed = 0; });
  const r = Object.assign(t.rivals[2], { z: car.z0 - 30, x: car.x, speed: 40, top: 40 });
  ride(t, 1.2);
  assert.ok(Math.abs(r.x - car.x) > car.half, 'out of its way');
  // Across the line: first, second...
  const f = alone(30, 100);
  const a = beside(f, 0, f.length - 100 - 1, 0, { speed: 40, top: 40 });
  const b = beside(f, 1, f.length - 100 - 3, 0.5, { speed: 40, top: 40 });
  ride(f, 0.2);
  same([a.place, b.place, f.finished], [1, 2, 2]);
  assert.equal(F.position(f), 3);
});

test('bikes side by side bump apart', () => {
  const w = alone();
  const o = beside(w, 0, 0.5, 0.05);
  F.step(w);
  assert.ok(w.player.push < 0 && o.push > 0);
  assert.ok(types(w).includes('bump'));
});

test('riding into the back of traffic is a crash: off the bike, hurt, and the weapon dropped', () => {
  const car = F.traffic(1)[0];
  const w = alone(50, car.z0 - 1.5);
  w.time = 0;
  w.player.x = car.x;
  w.player.weapon = 'chain';
  F.step(w);
  same(w.events, [{ type: 'crash', what: 'traffic' }]);
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
  assert.ok(Math.abs(w.player.x) <= 0.8, 'back on the road');
  assert.equal(w.player.safe, F.SAFE_TIME - 0 * F.STEP);
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
});

test('a post on the kerb is a crash too', () => {
  const w = alone(F.KERB_TOP, 8 * F.SEG - 0.5);      // a lamp stands at 40 metres, on the left
  w.player.x = -1.32;
  F.step(w);
  same(w.events, [{ type: 'crash', what: 'lamp' }]);
  const v = alone(F.KERB_TOP, 8 * F.SEG - 0.5);
  v.player.x = -1.1;                                   // inside the post
  F.step(v);
  same(types(v), []);
});

test('out of health, the player is knocked out and the game is over', () => {
  const w = alone();
  w.player.health = 3;
  beside(w, 0, 0.5, 0.2, { cool: 0 });
  ride(w, 1);
  assert.equal(w.player.health, 0);
  assert.equal(w.over, 'ko');
  assert.ok(types(w).includes('out'));
  assert.equal(F.attack(w, 'punch'), false);
  // A crash can do it as well, and then the player stays down.
  const c = F.traffic(1)[0];
  const v = alone(50, c.z0 - 1.5);
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

test('finishing in the top three scores for the place, times the race; any lower ends the game', () => {
  for (const [ahead, place] of [[0, 1], [1, 2], [2, 3]]) {
    const w = F.create(2);
    w.score = 100;
    w.rivals.forEach((o, i) => { o.speed = 0; o.top = 0; o.cool = 99; if (i < ahead) { o.place = ++w.finished; o.z = w.length + 10; } else o.z = 10; });
    w.player.z = w.length - 0.1; w.player.speed = 30;
    F.step(w);
    assert.equal(w.place, place);
    assert.equal(w.score, 100 + F.PLACE_POINTS[place - 1] * 2);
    assert.equal(w.over, null);
    same((w.events.filter((e) => e.type === 'finish')), [{ type: 'finish', place }]);
    assert.equal(F.position(w), place);
    // Past the line, the player can't steer or fight, and eases off.
    w.input.steer = 1;
    const x = w.player.x;
    ride(w, 5);
    assert.equal(w.player.x, x);
    assert.ok(w.player.speed < 26);
    assert.equal(F.attack(w, 'punch'), false);
  }
  const w = F.create(1);
  w.rivals.forEach((o, i) => { o.speed = 0; o.top = 0; if (i < 3) { o.place = ++w.finished; o.z = w.length + 10; } });
  w.player.z = w.length - 0.1; w.player.speed = 30;
  F.step(w);
  assert.equal(w.place, 4);
  assert.equal(w.over, 'lost');
  assert.equal(w.score, 0);
});

test('a race comes out the same every time it is ridden the same way', () => {
  const a = F.create(2), b = F.create(2);
  for (const w of [a, b]) {
    for (let i = 0; i < 40; i++) {
      w.input.steer = Math.sin(i) * 0.6;
      ride(w, 0.5);
      if (i % 3 === 0) F.attack(w, i % 2 ? 'kick' : 'punch');
    }
  }
  same(F.snapshot(a), F.snapshot(b));
  assert.ok(a.player.z > 500);
});

test('a race saves as plain numbers and comes back the same', () => {
  const w = F.create(2);
  w.input.steer = 0.4;
  ride(w, 6);
  F.attack(w, 'kick');
  ride(w, 0.1);
  w.rivals[1].health = 0; w.rivals[1].down = 2;
  const s = JSON.parse(JSON.stringify(F.snapshot(w)));
  const back = F.restore(s);
  same(F.snapshot(back), s);
  // And carries on exactly as the original does.
  w.input.steer = back.input.steer = -0.2;
  ride(w, 3); ride(back, 3);
  same(F.snapshot(back), F.snapshot(w));
});

test('saves that do not make sense are not restored', () => {
  const w = F.create(1);
  ride(w, 4);
  w.rivals[0].place = 0;
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
    (s) => { s.race = 1.5; },
    (s) => { s.time = -1; },
    (s) => { s.score = -10; },
    (s) => { s.score = '5'; },
    (s) => { delete s.player; },
    (s) => { s.player.z = 2401; },                     // past the finish
    (s) => { s.player.x = 2; },                        // off the edge
    (s) => { s.player.speed = 500; },
    (s) => { s.player.health = 0; },                   // out already
    (s) => { s.player.health = 101; },
    (s) => { s.player.weapon = 'sword'; },
    (s) => { s.player.attack = { move: 'kick', t: 9, side: 1, done: false }; },
    (s) => { s.player.attack = { move: 'kick', t: 0.1, side: 0, done: false }; },
    (s) => { s.player.attack = { move: 'punch', t: 0.1, side: 1, done: false }; s.player.weapon = 'chain'; },
    (s) => { s.player.crash = 9; },
    (s) => { s.player.safe = -1; },
    (s) => { s.rivals.pop(); },
    (s) => { s.rivals[0] = null; },
    (s) => { s.rivals[0].x = 3; },
    (s) => { s.rivals[0].health = 999; },
    (s) => { s.rivals[0].health = 0; },                // out, but still riding
    (s) => { s.rivals[0].down = 1; },                  // down, but not hurt
    (s) => { s.rivals[0].place = 1; s.finished = 1; }, // in, but short of the line
    (s) => { s.rivals[0].z = 2500; },                  // over the line, but not in
    (s) => { s.rivals[0].z = 2500; s.rivals[0].place = 2; s.finished = 1; }, // second with nobody first
    (s) => { s.finished = 3; },
    (s) => { s.rivals[2].weapon = 'bat'; },
    (s) => { s.rivals[2].cool = -1; },
    (s) => { s.rivals[2].attack = { move: 'stick', t: 0.1 }; }
  ]) assert.equal(bad(change), null, change.toString());
  // A rival who finished, and one who fell, are kept.
  assert.ok(bad((s) => { s.rivals[0].z = 2500; s.rivals[0].place = 1; s.finished = 1; }));
  assert.ok(bad((s) => { s.rivals[3].health = 0; s.rivals[3].down = 0.5; }));
  assert.ok(bad((s) => { s.player.attack = { move: 'kick', t: 0.1, side: -1, done: true }; s.player.weapon = 'nunchaku'; }));
});
