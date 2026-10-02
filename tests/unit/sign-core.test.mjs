import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const FILE = 'assets/js/sign-core.js';
const { bdnixSign: S } = load(FILE);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const nearAll = (a, b) => { for (const k of Object.keys(b)) near(a[k], b[k], k); };

const A4 = { x: 0, y: 0, width: 595, height: 842 };

test('normAngle: any angle as -180 < a <= 180', () => {
  assert.equal(S.normAngle(0), 0);
  assert.equal(S.normAngle(180), 180);
  assert.equal(S.normAngle(-180), 180);
  assert.equal(S.normAngle(270), -90);
  assert.equal(S.normAngle(-270), 90);
  assert.equal(S.normAngle(725), 5);
  assert.equal(S.normAngle(-45), -45);
});

test('fix: keeps the centre on the page, the width sensible and the angle tidy', () => {
  assert.deepEqual(plain(S.fix({ x: -0.2, y: 1.5, w: 0.001, angle: 370.04 })), { x: 0, y: 1, w: S.MIN_W, angle: 10 });
  assert.deepEqual(plain(S.fix({ x: 0.4, y: 0.6, w: 3, angle: -12.345 })), { x: 0.4, y: 0.6, w: S.MAX_W, angle: -12.3 });
});

test('viewSize: a page turned a quarter is read the other way round', () => {
  assert.deepEqual(plain(S.viewSize(A4, 0)), { vw: 595, vh: 842 });
  assert.deepEqual(plain(S.viewSize(A4, 180)), { vw: 595, vh: 842 });
  assert.deepEqual(plain(S.viewSize(A4, 90)), { vw: 842, vh: 595 });
  assert.deepEqual(plain(S.viewSize(A4, 270)), { vw: 842, vh: 595 });
});

test('heightOf: the height follows the signature’s shape', () => {
  near(S.heightOf({ w: 0.5 }, 600, 800, 3), 0.125, 'h');   // 300 wide, 100 tall on 800
});

test('newPlacement: low on the page, a third wide, no taller than a seventh', () => {
  nearAll(S.newPlacement(595, 842, 2), { x: 0.5, y: 0.8, w: 1 / 3, angle: 0 });
  // A tall signature on a wide page is held to a seventh of the height.
  const p = S.newPlacement(842, 595, 1);
  near(S.heightOf(p, 842, 595, 1), 1 / 7, 'height');
  near(p.w, 595 / 7 / 842, 'w');
});

test('toPage: undoes each /Rotate and the crop box', () => {
  const box = { x: 10, y: 20, width: 100, height: 200 };
  assert.deepEqual(plain(S.toPage(5, 7, 0, box)), [15, 27]);
  assert.deepEqual(plain(S.toPage(5, 7, 90, box)), [10 + 93, 20 + 5]);
  assert.deepEqual(plain(S.toPage(5, 7, 180, box)), [10 + 95, 20 + 193]);
  assert.deepEqual(plain(S.toPage(5, 7, 270, box)), [10 + 7, 20 + 195]);
});

// Where pdf-lib's drawImage puts the centre of the image, from its params.
function centreOf(d){
  const a = d.rotate * Math.PI / 180;
  return [d.x + d.width / 2 * Math.cos(a) - d.height / 2 * Math.sin(a), d.y + d.width / 2 * Math.sin(a) + d.height / 2 * Math.cos(a)];
}

test('drawParams: an upright page, level and turned', () => {
  const d = S.drawParams({ x: 0.5, y: 0.8, w: 1 / 3, angle: 0 }, A4, 0, 2);
  nearAll(d, { x: 297.5 - 595 / 6 / 1, y: 842 * 0.2 - 595 / 12, width: 595 / 3, height: 595 / 6, rotate: 0 });
  // Turned 30° clockwise on screen is -30° (anticlockwise) for pdf-lib, about
  // the same centre.
  const t = S.drawParams({ x: 0.25, y: 0.5, w: 0.2, angle: 30 }, A4, 0, 4);
  near(t.rotate, -30, 'rotate');
  near(t.width, 119, 'width');
  near(t.height, 29.75, 'height');
  const c = centreOf(t);
  near(c[0], 595 * 0.25, 'cx');
  near(c[1], 421, 'cy');
});

test('drawParams: on a turned page with a crop box the centre still lands right', () => {
  const box = { x: 30, y: 40, width: 500, height: 700 };
  for (const rot of [0, 90, 180, 270]) {
    const v = S.viewSize(box, rot);
    const p = { x: 0.2, y: 0.3, w: 0.25, angle: 15 };
    const d = S.drawParams(p, box, rot, 2.5);
    near(d.width, 0.25 * v.vw, `width at ${rot}`);
    near(d.height, 0.25 * v.vw / 2.5, `height at ${rot}`);
    near(d.rotate, S.normAngle(rot - 15), `rotate at ${rot}`);
    const want = S.toPage(0.2 * v.vw, 0.7 * v.vh, rot, box);
    const got = centreOf(d);
    near(got[0], want[0], `cx at ${rot}`);
    near(got[1], want[1], `cy at ${rot}`);
  }
});

test('moveTo and nudge: move the centre, staying on the page', () => {
  const p = { x: 0.5, y: 0.5, w: 0.3, angle: 10 };
  nearAll(S.moveTo(p, 0.2, 0.9), { x: 0.2, y: 0.9, w: 0.3, angle: 10 });
  nearAll(S.moveTo(p, -1, 2), { x: 0, y: 1 });
  nearAll(S.nudge(p, 'ArrowLeft', false), { x: 0.49, y: 0.5 });
  nearAll(S.nudge(p, 'ArrowRight', true), { x: 0.55, y: 0.5 });
  nearAll(S.nudge(p, 'ArrowUp', false), { x: 0.5, y: 0.49 });
  nearAll(S.nudge(p, 'ArrowDown', true), { x: 0.5, y: 0.55 });
  nearAll(S.nudge({ x: 0.995, y: 0, w: 0.3, angle: 0 }, 'ArrowRight', true), { x: 1 });
  assert.equal(S.nudge(p, 'Enter', false), null);
});

test('resize: scales about the centre with the pointer’s distance', () => {
  nearAll(S.resize({ x: 0.3, y: 0.4, w: 0.2, angle: 5 }, 50, 75), { x: 0.3, y: 0.4, w: 0.3, angle: 5 });
  near(S.resize({ x: 0.3, y: 0.4, w: 0.2, angle: 0 }, 50, 0).w, S.MIN_W, 'smallest');
  near(S.resize({ x: 0.3, y: 0.4, w: 0.5, angle: 0 }, 10, 100).w, S.MAX_W, 'largest');
  near(S.resize({ x: 0.3, y: 0.4, w: 0.2, angle: 0 }, 0, 40).w, 0.2, 'no start distance');
});

test('angleFrom: clockwise from straight up, snapping near quarter turns', () => {
  assert.equal(S.angleFrom(0, 0, 0, -10), 0);
  assert.equal(S.angleFrom(0, 0, 10, 0), 90);
  assert.equal(S.angleFrom(0, 0, 0, 10), 180);
  assert.equal(S.angleFrom(0, 0, -10, 0), -90);
  assert.equal(S.angleFrom(0, 0, 10, -10), 45);
  assert.equal(S.angleFrom(0, 0, 100, 3), 90);    // 91.7°, close enough to snap
  assert.equal(S.angleFrom(0, 0, 100, -10), 84);  // 84.3°, too far to snap
  assert.equal(S.angleFrom(0, 0, -3, -100), 0);   // -1.7°
});

// An RGBA image w x h with the given pixels set to alpha a.
function rgba(w, h, set = [], a = 255){
  const d = new Uint8ClampedArray(w * h * 4);
  for (const [x, y] of set) d[(y * w + x) * 4 + 3] = a;
  return d;
}

test('inkBounds: what’s drawn, padded and kept inside the image', () => {
  assert.deepEqual(plain(S.inkBounds(rgba(10, 8, [[3, 2], [6, 5]]), 10, 8)), { x: 3, y: 2, w: 4, h: 4 });
  assert.deepEqual(plain(S.inkBounds(rgba(10, 8, [[3, 2], [6, 5]]), 10, 8, 2)), { x: 1, y: 0, w: 8, h: 8 });
  assert.deepEqual(plain(S.inkBounds(rgba(10, 8, [[0, 0]]), 10, 8, 5)), { x: 0, y: 0, w: 6, h: 6 });
  assert.equal(S.inkBounds(rgba(10, 8), 10, 8, 4), null);
  // Faint pixels at or below the threshold don't count.
  assert.equal(S.inkBounds(rgba(10, 8, [[2, 2]], 8), 10, 8, 0, 8), null);
  assert.deepEqual(plain(S.inkBounds(rgba(10, 8, [[2, 2]], 9), 10, 8, 0, 8)), { x: 2, y: 2, w: 1, h: 1 });
});

test('clearPaper: white goes clear, ink stays, and the edges fade', () => {
  const d = new Uint8ClampedArray([
    255, 255, 255, 255,   // paper
    230, 230, 230, 255,   // off-white paper
    20, 20, 40, 255,      // ink
    188, 188, 188, 255,   // halfway between dark and light
    150, 150, 150, 128    // dark, already half see-through
  ]);
  S.clearPaper(d);
  assert.deepEqual([d[3], d[7], d[11], d[15], d[19]], [0, 0, 255, 126, 128]);
  // The colours themselves are left alone.
  assert.deepEqual([...d.slice(8, 11)], [20, 20, 40]);
  // Custom thresholds.
  const e = new Uint8ClampedArray([200, 200, 200, 255]);
  S.clearPaper(e, 250, 210);
  assert.equal(e[3], 255);
});

test('smooth: curves through the midpoints, ending at the last point', () => {
  assert.deepEqual(plain(S.smooth([[0, 0]])), []);
  assert.deepEqual(plain(S.smooth([[0, 0], [10, 0]])), [{ cx: 0, cy: 0, x: 10, y: 0 }]);
  assert.deepEqual(plain(S.smooth([[0, 0], [10, 0], [10, 10]])), [
    { cx: 0, cy: 0, x: 5, y: 0 },
    { cx: 10, cy: 0, x: 10, y: 10 }
  ]);
});

test('cleanName and signedName', () => {
  assert.equal(S.cleanName('  Jane \n  Doe  '), 'Jane Doe');
  assert.equal(S.cleanName(null), '');
  assert.equal(S.cleanName('x'.repeat(80)).length, 60);
  assert.equal(S.signedName('report.pdf'), 'report-signed.pdf');
  assert.equal(S.signedName('Report.PDF'), 'Report-signed.pdf');
  assert.equal(S.signedName('notes'), 'notes-signed.pdf');
});

test('checkSaved: only signatures that make sense come back', () => {
  const isBytes = (b) => b === 'BYTES';
  assert.deepEqual(plain(S.checkSaved({ id: 'a', png: 'BYTES', w: 120.4, h: 40, extra: 1 }, isBytes)), { id: 'a', png: 'BYTES', w: 120, h: 40 });
  for (const bad of [null, 'junk', 7, {}, { id: '', png: 'BYTES', w: 1, h: 1 }, { id: 3, png: 'BYTES', w: 1, h: 1 },
    { id: 'a', png: 'other', w: 1, h: 1 }, { id: 'a', png: 'BYTES' }, { id: 'a', png: 'BYTES', w: 0, h: 5 },
    { id: 'a', png: 'BYTES', w: 5, h: 20000 }, { id: 'a', png: 'BYTES', w: NaN, h: 5 }]) {
    assert.equal(S.checkSaved(bad, isBytes), null, JSON.stringify(bad));
  }
});
