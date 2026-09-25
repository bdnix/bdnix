import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, variants } from './load.mjs';

for (const [kind, file] of variants('assets/js/watermark-layout.js')) describe(kind, () => {
  const { bdnixWatermarkLayout: W } = load(file);
  const A4 = { x: 0, y: 0, width: 595, height: 842 };
  const OFFSET = { x: 60, y: 40, width: 700, height: 480 };
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
  const key = ([x, y]) => `${Math.round(x)},${Math.round(y)}`;

  test('viewSize swaps width and height for sideways pages', () => {
    assert.deepEqual(plain(W.viewSize(A4, 0)), { vw: 595, vh: 842, short: 595 });
    assert.deepEqual(plain(W.viewSize(A4, 90)), { vw: 842, vh: 595, short: 595 });
    assert.deepEqual(plain(W.viewSize(A4, 180)), { vw: 595, vh: 842, short: 595 });
    assert.deepEqual(plain(W.viewSize(A4, 270)), { vw: 842, vh: 595, short: 595 });
  });

  test('toPage: the reader’s corners land on the crop box corners, for every rotation', () => {
    const boxCorners = new Set([[0, 0], [700, 0], [0, 480], [700, 480]].map(([x, y]) => key([x + 60, y + 40])));
    for (const rot of [0, 90, 180, 270]) {
      const { vw, vh } = W.viewSize(OFFSET, rot);
      const mapped = new Set([[0, 0], [vw, 0], [0, vh], [vw, vh]].map(([x, y]) => key(W.toPage(x, y, rot, OFFSET))));
      assert.deepEqual([...mapped].sort(), [...boxCorners].sort(), `rot ${rot}`);
    }
  });

  test('toPage: known points for a page turned 90° clockwise', () => {
    // Turning clockwise puts the page's bottom-right corner at the reader's bottom-left.
    assert.deepEqual(plain(W.toPage(0, 0, 90, A4)), [595, 0]);
    // ...and its bottom-left corner at the reader's top-left.
    assert.deepEqual(plain(W.toPage(0, 595, 90, A4)), [0, 0]);
  });

  test('placeCenter: nine positions, kept inside the margin', () => {
    const [vw, vh, bw, bh, m] = [600, 800, 200, 100, 30];
    const at = (pos) => plain(W.placeCenter(pos, vw, vh, bw, bh, m));
    assert.deepEqual(at('mc'), [300, 400]);
    assert.deepEqual(at('tl'), [130, 720]);
    assert.deepEqual(at('tr'), [470, 720]);
    assert.deepEqual(at('bl'), [130, 80]);
    assert.deepEqual(at('br'), [470, 80]);
    assert.deepEqual(at('tc'), [300, 720]);
    assert.deepEqual(at('ml'), [130, 400]);
    assert.deepEqual(at('mr'), [470, 400]);
    assert.deepEqual(at('bc'), [300, 80]);
  });

  test('tileCenters: every copy touches the page, and the corners are covered', () => {
    const [vw, vh, bw, bh] = [595, 842, 150, 40];
    const tiles = plain(W.tileCenters(vw, vh, bw, bh, 48));
    assert.ok(tiles.length > 10, `got ${tiles.length} tiles`);
    for (const [x, y] of tiles) {
      assert.ok(x + bw / 2 > 0 && x - bw / 2 < vw && y + bh / 2 > 0 && y - bh / 2 < vh, `tile at ${x},${y} is off the page`);
    }
    const covers = (px, py) => tiles.some(([x, y]) => Math.abs(x - px) <= bw / 2 + 48 && Math.abs(y - py) <= bh / 2 + 48);
    for (const [px, py] of [[0, 0], [vw, 0], [0, vh], [vw, vh]]) assert.ok(covers(px, py), `corner ${px},${py} not covered`);
  });

  // The core promise of place(): after pdf-lib rotates the watermark about its
  // drawing origin, its centre sits exactly where the reader expects it.
  test('place: the drawn watermark is centred on the page for any page and watermark rotation', () => {
    const [w, h] = [300, 60];
    for (const box of [A4, OFFSET]) {
      for (const rot of [0, 90, 180, 270]) {
        for (const rotation of [-90, -45, 0, 30, 45, 90]) {
          const { vw, vh } = W.viewSize(box, rot);
          const placed = plain(W.place(box, rot, w, h, { rotation, pos: 'mc', tile: false }));
          assert.equal(placed.angle, rotation + rot);
          assert.equal(placed.origins.length, 1);
          const a = placed.angle * Math.PI / 180;
          const [ox, oy] = placed.origins[0];
          const cx = ox + (w / 2) * Math.cos(a) - (h / 2) * Math.sin(a);
          const cy = oy + (w / 2) * Math.sin(a) + (h / 2) * Math.cos(a);
          const [ex, ey] = W.toPage(vw / 2, vh / 2, rot, box);
          const label = `box ${box.width}x${box.height} rot ${rot} rotation ${rotation}`;
          near(cx, ex, label + ' x');
          near(cy, ey, label + ' y');
        }
      }
    }
  });

  test('place: a corner position lands in that corner of the page', () => {
    const placed = plain(W.place(A4, 0, 100, 20, { rotation: 0, pos: 'br', tile: false }));
    const [x, y] = placed.origins[0];
    assert.ok(x > 595 / 2 && y < 842 / 2, `bottom-right origin at ${x},${y}`);
  });

  test('place: tiling gives many copies with the same angle', () => {
    const placed = plain(W.place(A4, 90, 100, 20, { rotation: 45, pos: 'mc', tile: true }));
    assert.equal(placed.angle, 135);
    assert.ok(placed.origins.length > 10);
  });
});
