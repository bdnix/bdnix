import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../../tests/unit/load.mjs';

const W = load(['apps/king-of-streets/street-core.js', 'apps/king-of-streets/street-scene-core.js']);
const F = W.bdnixStreet, S = W.bdnixStreetScene;
const near = (a, b, d = 1e-6, m) => assert.ok(Math.abs(a - b) <= d, (m || '') + ` ${a} vs ${b}`);

test('the road sets off along +z from the start line, and a straight start stays straight', () => {
  const P = S.path(1), a = S.place(P, 0, 0), b = S.place(P, 100, 0);
  near(a.x, 0); near(a.z, 0); near(a.heading, 0);
  // Every race starts with 30 straight segments.
  near(b.x, 0); near(b.z, 100); near(b.heading, 0);
  assert.equal(S.path(1), P, 'made once for each race');
});

test('across the road: the rider’s right is the map’s -x while it heads along +z', () => {
  const P = S.path(1);
  near(S.place(P, 50, 3).x, -3);
  near(S.place(P, 50, -3).x, 3);
  near(S.place(P, 50).x, 0, 1e-6, 'no x is the middle');
});

test('bends turn the road, the way the rules bend it, and it never doubles back', () => {
  for (let race = 1; race <= 15; race++) {
    const P = S.path(race), T = F.track(race);
    let max = 0;
    for (let i = 0; i <= P.n; i++) max = Math.max(max, Math.abs(P.heading[i]));
    assert.ok(max <= S.MAX_TURN + 1e-9, `race ${race} turns ${max}`);
    // A bend to the right (positive) turns the heading down (towards the rider's right).
    const i = T.curve.findIndex((c) => c > 0.2), h = P.heading;
    if (i >= 0 && h[i] < S.MAX_TURN * 0.5 && h[i] > -S.MAX_TURN * 0.5) assert.ok(h[i + 1] < h[i], `race ${race} bends right at ${i}`);
    // Each step along the road is a segment long.
    for (let k = 0; k < P.n; k += 37) near(Math.hypot(P.x[k + 1] - P.x[k], P.z[k + 1] - P.z[k]), F.SEG, 1e-6, `race ${race} segment ${k}`);
  }
});

test('a point within a segment follows the arc, and the road rises on a raised stretch', () => {
  const P = S.path(10), T = F.track(10), s = T.raised[0];
  const z = 1234.5, i = Math.floor(z / F.SEG), p = S.place(P, z, 0), a = S.place(P, i * F.SEG, 0), b = S.place(P, (i + 1) * F.SEG, 0);
  assert.ok(Math.hypot(p.x - a.x, p.z - a.z) < F.SEG && Math.hypot(p.x - b.x, p.z - b.z) < F.SEG);
  near(p.heading, a.heading + (b.heading - a.heading) * (z / F.SEG - i));
  near(S.place(P, (s.z0 + s.z1) / 2).y, s.h);
  near(S.place(P, 10).y, 0);
});

test('before the start line the road comes straight, and past its end it carries on', () => {
  const P = S.path(1), back = S.place(P, -20, 0), end = P.n * F.SEG, past = S.place(P, end + 10, 0), last = S.place(P, end, 0);
  near(back.z, -20); near(back.x, 0);
  near(Math.hypot(past.x - last.x, past.z - last.z), 10, 1e-6);
});

test('chunks: those the camera sees, from the one before the start to the road’s end', () => {
  const P = S.path(1), C = S.CHUNK, last = Math.floor((P.n * F.SEG - 1) / C);
  assert.deepEqual([...S.chunks(P, 0, 100, 30)], [-1, 0, 1]);
  assert.deepEqual([...S.chunks(P, 300, 130, 40)], [4, 5, 6, 7]);
  assert.equal(S.chunks(P, P.n * F.SEG, 500, 10).at(-1), last);
});

test('the chase camera rides low behind the rider, looking up the road, wider as it speeds', () => {
  const P = S.path(1), wide = S.chase(P, 100, 2, false), tall = S.chase(P, 100, 2, true);
  assert.ok(wide.from.z < 100 && wide.to.z > 100);
  assert.ok(wide.from.y > 1 && wide.from.y < 1.8 && wide.to.y < wide.from.y, 'low, looking a little down');
  assert.ok(tall.from.z > wide.from.z, 'closer on a tall screen');
  assert.ok(tall.from.y > wide.from.y, 'and higher');
  assert.ok(tall.fov > wide.fov, 'and wider');
  // x 2 is to the rider's right: the map's -x.
  assert.ok(wide.from.x < 0);
  const fast = S.chase(P, 100, 2, false, 1);
  assert.ok(fast.fov > wide.fov + 10 && fast.from.z < wide.from.z, 'flat out: wider, drawn back');
  assert.deepEqual({ ...S.chase(P, 100, 2, false, 3) }, { ...fast }, 'no faster than flat out');
  // A phone on its side: no more than 96 degrees across, so the bike stays big.
  const across = (c, aspect) => 2 * Math.atan(Math.tan(c.fov * Math.PI / 360) * aspect) * 180 / Math.PI;
  const side = S.chase(P, 100, 2, false, 0, 852 / 393);
  near(across(side, 852 / 393), 96, 1e-6);
  assert.ok(side.fov < wide.fov);
  near(across(S.chase(P, 100, 2, false, 1, 852 / 393), 852 / 393), 106, 1e-6, 'flat out, a little wider');
  assert.equal(S.chase(P, 100, 2, false, 0, 16 / 9).fov, wide.fov, 'a computer’s screen: as it was');
});

test('the engine: idle when stopped, revs rising with speed, and a dip at each gear change', () => {
  for (const B of F.BIKES) {
    const idle = S.engine(B.id, 0), top = S.engine(B.id, B.top);
    assert.equal(idle.revs, S.ENGINES[B.id].idle, B.id);
    assert.ok(top.revs > 0.6 && top.revs <= 1, B.id + ' near the red line at top speed');
    assert.ok(top.hz > idle.hz);
    assert.equal(top.voice, S.ENGINES[B.id].voice);
  }
  // The scooter's belt has no gears.
  assert.equal(S.engine('k1_vino', 20).gear, 0);
  assert.ok(S.engine('k1_vino', 20).revs > S.engine('k1_vino', 5).revs);
  // The ZX-6R changes from first to second at 92% of first's top.
  const G = S.ENGINES.k4_zx6r.gears, before = S.engine('k4_zx6r', G[0] * 0.92 - 0.01), after = S.engine('k4_zx6r', G[0] * 0.92 + 0.01);
  assert.equal(before.gear, 1); assert.equal(after.gear, 2);
  assert.ok(after.revs < before.revs - 0.2, 'the revs dip');
  assert.equal(S.engine('k5_h2', 200).gear, 6, 'top gear past the last change');
  assert.equal(S.engine('k5_h2', 200).revs, 1, 'and no further than the red line');
  // An inline four fires twice a turn: its note is four times a single's at the same revs.
  assert.equal(S.engine('k4_zx6r', 0).hz, S.engine('k4_zx6r', 0).rpm / 60 * 2);
  assert.equal(S.engine('k2_125', -5).revs, S.ENGINES.k2_125.idle, 'no speed below 0');
  assert.equal(S.engine('nope', 0).voice, 'buzz', 'an unknown bike sounds like the scooter');
});

test('heard: louder near, panned to its side, higher closing in and lower going away', () => {
  // A listener at the origin heading along +z: the map's +x is to their left.
  const left = S.heard(0, 0, 0, 5, 0, 20, 20), right = S.heard(0, 0, 0, -5, 0, 20, 20), far = S.heard(0, 0, 0, 0, 80, 20, 20);
  assert.ok(left.pan < 0 && right.pan > 0);
  assert.ok(left.gain > far.gain);
  near(left.distance, 5);
  near(left.pitch, 1, 1e-9, 'same speeds: no shift');
  // A faster rival coming up from behind, then pulling away ahead.
  assert.ok(S.heard(0, 0, 0, 0, -10, 30, 20).pitch > 1);
  assert.ok(S.heard(0, 0, 0, 0, 10, 30, 20).pitch < 1);
  // Overtaking a slower vehicle ahead closes the gap.
  assert.ok(S.heard(0, 0, 0, 0, 10, 10, 30).pitch > 1);
  assert.equal(S.heard(0, 0, 0, 0, 0, 10, 10).pan, 0, 'right on top of the listener: the middle');
});

test('quality: low on a weak machine, high otherwise, phones included', () => {
  assert.equal(S.quality({ touch: true, cores: 8, memory: 8 }), 'high');
  assert.equal(S.quality({ cores: 2, memory: 8 }), 'low');
  assert.equal(S.quality({ cores: 8, memory: 2 }), 'low');
  assert.equal(S.quality({ cores: 8, memory: 8 }), 'high');
  assert.equal(S.quality({}), 'high', 'unknown counts as enough');
  assert.ok(S.QUALITY.low.ahead < S.QUALITY.high.ahead && !S.QUALITY.low.shadows && S.QUALITY.high.shadows);
  assert.ok(S.QUALITY.high.pixels >= 2, 'sharp on a phone’s screen');
});

test('sharpness: kept while frames are quick, coarser when slow, shadows last to go', () => {
  assert.deepEqual({ ...S.sharpness(2, 2, 16.7) }, { pixels: 2, shadows: true }, 'smooth: as it is');
  assert.deepEqual({ ...S.sharpness(2, 2, 20) }, { pixels: 2, shadows: true }, '50 a second is smooth enough');
  assert.deepEqual({ ...S.sharpness(2, 2, 30) }, { pixels: 1.7, shadows: true }, 'slow: a step coarser');
  assert.deepEqual({ ...S.sharpness(0.8, 2, 30) }, { pixels: 0.75, shadows: true });
  assert.deepEqual({ ...S.sharpness(0.75, 2, 30) }, { pixels: 0.75, shadows: false }, 'as coarse as it goes: the shadows go');
  assert.deepEqual({ ...S.sharpness(0.6, 0.6, 30) }, { pixels: 0.6, shadows: false }, 'never below a screen’s own least');
  let px = 2;
  for (let i = 0; i < 20; i++) px = S.sharpness(px, 2, 40).pixels;
  assert.equal(px, 0.75);
});

test('the rider’s view: just above the head, both hands in view, wider or higher only as it needs', () => {
  const head = { x: 0, y: 1.5, z: -0.1 };
  // Bars well ahead and in front: the plain view fits them.
  const easy = S.cockpit(head, [{ x: 0.3, y: 1.0, z: 0.4 }, { x: -0.3, y: 1.0, z: 0.4 }], 16 / 9);
  assert.equal(easy.fov, 75);
  near(easy.eye.y, 1.58); near(easy.eye.z, -0.12);
  assert.ok(easy.look.z > easy.eye.z && easy.look.y < easy.eye.y, 'looking ahead and a little down');
  // A phone held upright sits the eye higher and sees wider.
  const phone = S.cockpit(head, [{ x: 0.3, y: 1.0, z: 0.4 }, { x: -0.3, y: 1.0, z: 0.4 }], 9 / 19);
  assert.ok(phone.eye.y > easy.eye.y && phone.fov >= 88);
  // Low, close, wide clip-ons on a tall screen: the view widens and the eye draws back.
  const hard = S.cockpit(head, [{ x: 0.36, y: 0.9, z: 0.2 }, { x: -0.36, y: 0.9, z: 0.2 }], 9 / 19);
  assert.ok(hard.fov > 88 || hard.eye.z < phone.eye.z, 'wider or further back');
  // Hands that can never fit: the furthest the search goes.
  const never = S.cockpit(head, [{ x: 5, y: 0, z: 0 }, { x: -5, y: 0, z: 0 }], 1);
  assert.equal(never.fov, 86);
  near(never.eye.z, head.z - 0.02 - 0.22);
});

test('tilt: the phone turned like a handlebar steers, held upright or sideways', () => {
  const deg = Math.PI / 180;
  // Upright (beta 90), screen facing the rider: straight ahead.
  near(S.turned(90, 0, 0), 0, 1e-9);
  // Leaning back from upright doesn't steer.
  near(S.turned(50, 0, 0), 0, 1e-9);
  // Turned 20 degrees to the right, upright and leaning back: its right side drops.
  const right = (b, turn) => {
    // beta and gamma of a phone leaning back to `b` from flat, then turned `turn` degrees about its screen.
    const t = turn * deg, bb = b * deg, ux = -Math.sin(t) * Math.sin(bb), uy = Math.cos(t) * Math.sin(bb), uz = Math.cos(bb);
    return [Math.atan2(uy, Math.hypot(ux, uz)) / deg, Math.atan2(-ux, uz) / deg];
  };
  for (const back of [90, 60, 40]) {
    const [b, g] = right(back, 20);
    near(S.turned(b, g, 0), 20 * deg, 1e-6, 'upright, leaning back ' + back);
  }
  // Sideways, turned on its left side (screen angle 90): its top is to the left, so
  // turning it right lifts its top: gamma and beta swap roles.
  near(S.turned(0, -90, 90), 0, 1e-9, 'sideways, straight');
  near(S.turned(20, -90, 90), 20 * deg, 1e-6, 'sideways, turned right');
  near(S.turned(-20, -90, 90), -20 * deg, 1e-6, 'sideways, turned left');
  near(S.turned(-20, 90, 270), 20 * deg, 1e-6, 'the other way round, turned right');
  // The steering: none in the dead zone, full lock at 25 degrees, against where it was held.
  assert.equal(S.tilt(2 * deg), 0);
  near(S.tilt(25 * deg), 1, 1e-9);
  near(S.tilt(-40 * deg), -1, 1e-9);
  near(S.tilt(14 * deg), 0.5, 1e-9);
  near(S.tilt(24 * deg, 10 * deg), 0.5, 1e-9, 'from where it was held');
  near(S.tilt(-170 * deg, 170 * deg), 17 / 22, 1e-9, '20 degrees right, across the half turn');
  near(S.tilt(170 * deg, -170 * deg), -17 / 22, 1e-9);
});
