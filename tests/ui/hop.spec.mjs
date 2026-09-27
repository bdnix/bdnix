import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, tap } from './games.mjs';

// With Math.random fixed at 0 the lanes are the same every time: grass on
// rows 0 and 1, a road on row 2, grass on 3 and 4, a river on 5, grass on 6
// and 7, a road on 8, and so on, with no trees. The chicken starts on row 0
// in the middle column (4).
const MARGIN = 3;

// The round as saved: pausing saves it, and resuming carries on at the same
// moment, since time only moves when a test runs the clock.
async function peek(page){
  await press(page, 'KeyP');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_hop_save') || 'null'));
  await press(page, 'KeyP');
  return s && s.data;
}

// Whether a hop forward lands safely and leaves time to hop on again.
function safeAhead(s){
  const c = s.chicken, lane = s.lanes[c.row + 1 - s.base];
  if (lane.type === 'road') {
    return lane.items.every((it) => {
      const left = it.pos - MARGIN, reach = lane.speed * 0.5;
      return left + it.len + Math.max(0, reach) < c.x + 0.1 || left + Math.min(0, reach) > c.x + 0.9;
    });
  }
  if (lane.type === 'river') {
    const mid = c.x + 0.5;
    return lane.items.some((it) => mid >= it.pos - MARGIN + 0.4 && mid <= it.pos - MARGIN + it.len - 0.4);
  }
  return true;
}

// Hops forward whenever it's safe, until the chicken reaches row `to`.
async function hopTo(page, to){
  for (let i = 0; i < 400; i++) {
    const s = await peek(page);
    if (s.chicken.row >= to) return s;
    if (safeAhead(s)) await press(page, 'ArrowUp');
    else await page.clock.runFor(50);
  }
  throw new Error('never reached row ' + to);
}

// Waits (on the frozen clock) for the round to end.
async function waitForGameOver(page, ms = 20000){
  const overlay = page.locator('#overlay');
  for (let t = 0; t < ms && !(await overlay.isVisible()); t += 250) await page.clock.runFor(250);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
}

async function start(page){
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await press(page, 'ArrowUp');                        // row 1 is grass, so the first hop is always safe
  await expect(page.locator('#score')).toHaveText('1');
}

test.beforeEach(async ({ page }) => {
  await openGame(page, '/road-hop/');
  await expect(page.locator('#ovTitle')).toHaveText('Road Hop');
  await page.clock.runFor(100);
});

test('crosses a road and a river, then is hit by a car', async ({ page }) => {
  await start(page);
  await hopTo(page, 6);
  await expect(page.locator('#score')).toHaveText('6');
  await expect(page.locator('#best')).toHaveText('6');

  // Steps out onto the next road and stays there.
  await press(page, 'ArrowUp');
  await press(page, 'ArrowUp');
  await waitForGameOver(page);
  await expect(page.locator('#ovKicker')).toHaveText('Hit by a car.');
  await expect(page.locator('#ovText')).toHaveText('Score 8 — new best!');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_hop_best'))).toBe('8');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_hop_save'))).toBeNull(); // nothing left to resume
  await expect(page.locator('#newBtn')).toBeHidden();

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('8');

  // A worse round keeps the best score: waiting too long leaves the chicken behind.
  await press(page, 'ArrowRight');
  await waitForGameOver(page);
  await expect(page.locator('#ovKicker')).toHaveText('Too slow: the road moved on without you.');
  await expect(page.locator('#ovText')).toHaveText('Score 0 · Best 8');
  await press(page, 'Enter');
  await expect(page.locator('#overlay')).toBeHidden();
});

test('hopping into the river between logs is a splash', async ({ page }) => {
  await start(page);
  await hopTo(page, 4);
  // Waits until no log is anywhere near the chicken's column.
  const clear = (d) => d.lanes[5 - d.base].items.every((it) => d.chicken.x + 0.5 < it.pos - MARGIN - 0.2 || d.chicken.x + 0.5 > it.pos - MARGIN + it.len + 0.2);
  for (let i = 0; i < 400 && !clear(await peek(page)); i++) await page.clock.runFor(50);
  await press(page, 'ArrowUp');
  await waitForGameOver(page);
  await expect(page.locator('#ovKicker')).toHaveText('Splash! Chickens can’t swim.');
  await expect(page.locator('#ovText')).toHaveText('Score 5 — new best!');
});

test('riding a log off the edge of the board sweeps the chicken away', async ({ page }) => {
  await start(page);
  await hopTo(page, 5);
  const on = await peek(page);
  await page.clock.runFor(500);
  expect((await peek(page)).chicken.x).toBeGreaterThan(on.chicken.x);    // carried along with the log
  await waitForGameOver(page);
  await expect(page.locator('#ovKicker')).toHaveText('Swept away down the river.');
});

test('keys, taps, swipes and the buttons all hop', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  const game = page.locator('#game');
  await tap(game);                                      // a tap hops forward
  let s = await peek(page);
  expect([s.chicken.row, s.chicken.x, s.chicken.face]).toEqual([1, 4, 'up']);

  const swipe = async (dx, dy) => {
    await game.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 300 });
    await game.dispatchEvent('pointermove', { pointerType: 'touch', isPrimary: true, clientX: 200 + dx, clientY: 300 + dy });
    await game.dispatchEvent('pointermove', { pointerType: 'touch', isPrimary: true, clientX: 200 + dx * 2, clientY: 300 + dy * 2 });
    await game.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
  };
  // Row 2 is a road, so everything here stays on the grass of rows 0 and 1.
  await swipe(40, 0);
  await swipe(0, 40);
  s = await peek(page);
  expect([s.chicken.row, s.chicken.x, s.chicken.face]).toEqual([0, 5, 'down']);
  await swipe(0, 5);                                    // too short to count, so it's a tap: forward
  await swipe(-40, 0);
  s = await peek(page);
  expect([s.chicken.row, s.chicken.x, s.chicken.face]).toEqual([1, 4, 'left']);

  await tap(page.locator('.touch [data-dir=left]'));
  await tap(page.locator('.touch [data-dir=down]'));
  await tap(page.locator('.touch [data-dir=right]'));
  await tap(page.locator('.touch [data-dir=right]'));
  s = await peek(page);
  expect([s.chicken.row, s.chicken.x]).toEqual([0, 5]);
  await tap(page.locator('.touch [data-dir=up]'));
  await press(page, 'KeyA');
  await press(page, 'KeyD');
  await press(page, 'KeyD');
  await press(page, 'KeyS');
  await press(page, 'KeyW');
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowRight');
  s = await peek(page);
  expect([s.chicken.row, s.chicken.x]).toEqual([0, 6]);
  await press(page, 'ArrowDown');                       // the hedge below the start is in the way
  expect((await peek(page)).chicken.row).toBe(0);

  // A right click doesn't hop, and holding a key down hops once.
  await game.dispatchEvent('pointerdown', { pointerType: 'mouse', button: 2 });
  await game.dispatchEvent('pointerup', { pointerType: 'mouse', button: 2 });
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('ArrowLeft');                // a repeat
  await page.keyboard.up('ArrowLeft');
  s = await peek(page);
  expect([s.chicken.row, s.chicken.x]).toEqual([0, 5]);
});

test('pausing stops the traffic, and it resumes where it was', async ({ page }) => {
  await start(page);
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  const saved = () => page.evaluate(() => localStorage.getItem('bdnix_hop_save'));
  const before = await saved();
  await page.clock.runFor(3000);
  await press(page, 'KeyP');
  await press(page, 'KeyP');
  expect(await saved()).toBe(before);                   // nothing moved while paused
  await press(page, 'ArrowUp');                         // keys don't hop while paused
  await press(page, 'Space');                           // Space resumes...
  await expect(page.locator('#overlay')).toBeHidden();
  expect((await peek(page)).chicken.row).toBe(1);
  await page.clock.runFor(300);
  expect((await peek(page)).lanes).not.toEqual(JSON.parse(before).data.lanes); // ...and the traffic moves on

  await press(page, 'Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();              // the overlay's Resume button
  await expect(page.locator('#overlay')).toBeHidden();
  await press(page, 'ArrowDown');
  expect((await peek(page)).chicken.row).toBe(0);
  await press(page, 'Space');                           // Space hops forward while playing
  expect((await peek(page)).chicken.row).toBe(1);
});

test('pausing before the first hop, and a hidden tab pauses too', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.clock.runFor(2000);                        // waits on "Get ready", safe on the grass
  await expect(page.locator('#overlay')).toBeHidden();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
});

test('a saved best score shows on load', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('bdnix_hop_best', '31'));
  await page.reload();
  await expect(page.locator('#best')).toHaveText('31');
});

test('a phone held sideways fits the whole board on screen, controls beside it', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  const board = await page.locator('#board').boundingBox();
  const stats = await page.locator('.stats').boundingBox();
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.y + board.height).toBeLessThanOrEqual(390);
  expect(board.height).toBeGreaterThan(300);                 // uses most of the height
  expect(board.width / board.height).toBeCloseTo(9 / 13, 1);
  expect(stats.x + stats.width).toBeLessThanOrEqual(board.x); // to the left, not above
  await expectNoSideScroll(page);

  await page.getByRole('button', { name: 'Start game' }).click();
  await tap(page.locator('#game'));
  await expect(page.locator('#score')).toHaveText('1');
});

test('a reload keeps the round, paused where it was', async ({ page }) => {
  await start(page);
  const s = await hopTo(page, 3);
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#score')).toHaveText('3');
  await page.clock.runFor(3000);
  await page.locator('#startBtn').click();              // Resume
  await expect(page.locator('#overlay')).toBeHidden();
  const now = await peek(page);
  expect(now.chicken).toEqual(s.chicken);               // on the same spot
  expect(now.lanes).toEqual(s.lanes);                   // with the traffic where it was
  await hopTo(page, 6);                                 // carries on over the river
  await expect(page.locator('#score')).toHaveText('6');
});

test('New game from the pause screen starts over, and before the first hop there is nothing to keep', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Road Hop');
  await start(page);
  await press(page, 'KeyP');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Road Hop');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_hop_save'))).toBeNull();
});

test('a save that does not make sense is thrown away', async ({ page }) => {
  // Written as the page loads, after the game in progress has saved itself.
  await page.addInitScript(() => localStorage.setItem('bdnix_hop_save', JSON.stringify({ v: 1, data: { chicken: { x: 4, row: 1 } } })));
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Road Hop');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_hop_save'))).toBeNull();
});

test('a save the chicken could not have survived is thrown away', async ({ page }) => {
  await start(page);
  const s = await hopTo(page, 3);
  s.camera = s.chicken.row + 2;                         // already off the bottom of the screen
  await page.addInitScript((data) => localStorage.setItem('bdnix_hop_save', JSON.stringify({ v: 1, data })), s);
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Road Hop');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_hop_save'))).toBeNull();
});

test('side-by-side roads, trees and trucks from a saved round are drawn', async ({ page }) => {
  await start(page);
  const s = await hopTo(page, 1);
  // Row 2 and 3 become roads with a truck, row 4 gets trees.
  const road = { type: 'road', trees: [], speed: 1.5, items: [{ pos: 5, len: 2, color: 1 }, { pos: 11, len: 1, color: 3 }] };
  s.lanes[2 - s.base] = road;
  s.lanes[3 - s.base] = { ...road, speed: -1.5 };
  s.lanes[4 - s.base] = { type: 'grass', trees: [0, 4, 8], speed: 0, items: [] };
  await page.addInitScript((data) => localStorage.setItem('bdnix_hop_save', JSON.stringify({ v: 1, data })), s);
  await page.reload();
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await page.locator('#startBtn').click();
  await page.clock.runFor(200);
  const lanes = (await peek(page)).lanes;
  expect(lanes[4 - s.base].trees).toEqual([0, 4, 8]);
  expect(lanes[2 - s.base].items[0].pos).toBeGreaterThan(5);  // the truck drove on
});
