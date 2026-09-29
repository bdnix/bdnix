import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, tap, listen, heard, soundProblems } from './games.mjs';

// The snake starts three long with its head at (6, 8), heading right, and the
// first food is straight ahead at (12, 8). With Math.random fixed at 0 each
// food after that goes on the first free cell, (0, 0) at the top left. Each
// ending shows the first of its lines.
const COLS = 17, ROWS = 17;

// The round as saved: pausing saves it, and resuming carries on at the same
// moment, since time only moves when a test runs the clock.
async function peek(page){
  await press(page, 'KeyP');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_snake_save') || 'null'));
  await press(page, 'KeyP');
  return s && s.data;
}

// Waits (on the frozen clock) for the round to end.
async function waitForGameOver(page, ms = 20000){
  const overlay = page.locator('#overlay');
  for (let t = 0; t < ms && !(await overlay.isVisible()); t += 250) await page.clock.runFor(250);
  await expect(page.locator('#overlay')).toBeVisible();
}

// Loads the page with a round saved as `data`.
async function openSaved(page, data){
  await page.addInitScript((d) => localStorage.setItem('bdnix_snake_save', JSON.stringify({ v: 1, data: d })), data);
  await page.reload();
}
const saved = (body, extra = {}) => ({ carry: 0, body, dir: 'right', queue: [], food: { x: 0, y: 0 }, score: body.length - 3, ...extra });
const row = (x, y, n) => Array.from({ length: n }, (_, i) => ({ x: x - i, y }));

// Where the head is drawn, in cells: the middle of the pixels in its exact colour.
function headOnBoard(page){
  return page.locator('#board').evaluate((c, [cols, rows]) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === 34 && d[i + 1] === 211 && d[i + 2] === 238 && d[i + 3] === 255) {
        sx += (i / 4) % c.width; sy += Math.floor(i / 4 / c.width); n++;
      }
    }
    return n ? { x: sx / n / c.width * cols, y: sy / n / c.height * rows } : null;
  }, [COLS, ROWS]);
}
// How many pixels of the snake are drawn (bright cyan to purple, not the berry or the grid).
function snakeOnBoard(page){
  return page.locator('#board').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 80 && d[i] < 200 && d[i + 2] > 150) n++;
    return n;
  });
}

test.beforeEach(async ({ page }) => {
  await openGame(page, '/snake/');
  await expect(page.locator('#ovTitle')).toHaveText('Snake');
  await page.clock.runFor(100);
});

test('eats, grows and runs into the wall', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(2000);
  expect(await peek(page)).toBeNull();                 // waits on "Get ready" until told to go
  await press(page, 'ArrowRight');
  for (let i = 0; i < 40 && (await page.locator('#score').textContent()) !== '1'; i++) await page.clock.runFor(50);
  await expect(page.locator('#score')).toHaveText('1');
  await expect(page.locator('#best')).toHaveText('1');
  const s = await peek(page);
  expect(s.body).toEqual([{ x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 }]);
  expect(s.food).toEqual({ x: 0, y: 0 });

  await waitForGameOver(page);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovKicker')).toHaveText('Bonk! Straight into the wall.');
  await expect(page.locator('#ovText')).toHaveText('Score 1 — new best!');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_snake_best'))).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_snake_save'))).toBeNull(); // nothing left to resume
  await expect(page.locator('#newBtn')).toBeHidden();

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('1');

  // A worse round keeps the best score.
  await press(page, 'ArrowUp');
  await waitForGameOver(page);
  await expect(page.locator('#ovText')).toHaveText('Score 0 · Best 1');
  await press(page, 'Enter');
  await expect(page.locator('#overlay')).toBeHidden();
});

test('the snake glides a little every frame instead of jumping a cell at a time', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  const still = await headOnBoard(page);
  expect(still.x).toBeCloseTo(6.5, 1);                  // on "Get ready", in the middle of its cell
  await press(page, 'ArrowRight');
  let prev = await headOnBoard(page);
  expect(prev.x).toBeCloseTo(6.5, 1);                  // starting off doesn't jump it forward
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(40);
    const now = await headOnBoard(page);
    const moved = now.x - prev.x;
    expect(moved, `frame ${i}`).toBeGreaterThan(0.05);  // always moving...
    expect(moved, `frame ${i}`).toBeLessThan(0.4);      // ...a fraction of a cell at a time
    expect(now.y).toBeCloseTo(8.5, 1);
    prev = now;
  }
});

test('the snake stays on screen every frame, through the crash, with no blinking', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowUp');
  const overlay = page.locator('#overlay');
  let frames = 0;
  for (let t = 0; t < 5000 && !(await overlay.isVisible()); t += 50) {
    await page.clock.runFor(50);
    expect(await snakeOnBoard(page), `at ${t}ms`).toBeGreaterThan(200);
    frames++;
  }
  expect(frames).toBeGreaterThan(30);                   // it ran up to the wall, then crashed
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
});

test('running into its own body ends the round', async ({ page }) => {
  await openSaved(page, saved(row(6, 8, 5)));
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#score')).toHaveText('2');
  await page.locator('#startBtn').click();
  await press(page, 'ArrowUp');
  await press(page, 'ArrowLeft');                      // two quick turns make two steps
  let s = await peek(page);
  expect(s.queue).toEqual(['up', 'left']);
  for (let i = 0; i < 40 && s.dir !== 'left'; i++) {
    await page.clock.runFor(20);
    s = await peek(page);
  }
  expect(s.body[0]).toEqual({ x: 5, y: 7 });
  await press(page, 'ArrowDown');                      // back into the body
  await waitForGameOver(page);
  await expect(page.locator('#ovKicker')).toHaveText('Tied yourself in a knot.');
  await expect(page.locator('#ovText')).toHaveText('Score 2 — new best!');
});

test('filling the whole board wins', async ({ page }) => {
  // Every cell in one winding path, row by row; the food is on the last one.
  const path = [];
  for (let y = 0; y < ROWS; y++) for (let i = 0; i < COLS; i++) path.push({ x: y % 2 ? COLS - 1 - i : i, y });
  await openSaved(page, saved(path.slice(0, -1).reverse(), { food: path[path.length - 1] }));
  await expect(page.locator('#score')).toHaveText('285');
  await page.locator('#startBtn').click();
  await waitForGameOver(page);
  await expect(page.locator('#ovTitle')).toHaveText('You win!');
  await expect(page.locator('#ovKicker')).toHaveText('Not a single cell to spare.');
  await expect(page.locator('#ovText')).toHaveText('Score 286 — new best!');
});

test('keys, swipes and the buttons all turn', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowLeft');                      // straight back doesn't start it
  expect(await peek(page)).toBeNull();
  await press(page, 'KeyW');                           // the first press turns and starts it at once
  let s = await peek(page);
  expect([s.dir, s.queue, s.body[0]]).toEqual(['up', [], { x: 6, y: 7 }]);
  await press(page, 'KeyA');
  await press(page, 'KeyS');
  expect((await peek(page)).queue).toEqual(['left', 'down']);
  await press(page, 'KeyD');                           // only two turns wait at once
  expect((await peek(page)).queue).toEqual(['left', 'down']);
  await page.clock.runFor(500);
  s = await peek(page);
  expect([s.dir, s.queue]).toEqual(['down', []]);

  const game = page.locator('#game');
  const swipe = async (...moves) => {
    await game.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 300 });
    let x = 200, y = 300;
    for (const [dx, dy] of moves) {
      x += dx; y += dy;
      await game.dispatchEvent('pointermove', { pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
    }
    await game.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
  };
  await swipe([0, 5]);                                  // too short to count
  expect((await peek(page)).queue).toEqual([]);
  await swipe([30, 0], [0, -30]);                       // one stroke, two turns
  expect((await peek(page)).queue).toEqual(['right', 'up']);
  await page.clock.runFor(500);
  await swipe([-30, 0]);
  await swipe([0, 30]);
  expect((await peek(page)).queue).toEqual(['left', 'down']);
  await page.clock.runFor(500);

  await tap(page.locator('.touch [data-dir=right]'));
  await tap(page.locator('.touch [data-dir=up]'));
  expect((await peek(page)).queue).toEqual(['right', 'up']);
  await page.clock.runFor(500);
  await tap(page.locator('.touch [data-dir=left]'));
  await tap(page.locator('.touch [data-dir=down]'));
  expect((await peek(page)).queue).toEqual(['left', 'down']);
  await page.clock.runFor(500);
  await press(page, 'ArrowRight');
  await press(page, 'KeyW');
  expect((await peek(page)).queue).toEqual(['right', 'up']);
  await page.clock.runFor(500);
  await press(page, 'ArrowLeft');
  expect((await peek(page)).queue).toEqual(['left']);

  // A right click doesn't start a swipe.
  await game.dispatchEvent('pointerdown', { pointerType: 'mouse', button: 2, clientX: 200, clientY: 300 });
  await game.dispatchEvent('pointermove', { pointerType: 'mouse', button: 2, clientX: 260, clientY: 300 });
  await game.dispatchEvent('pointercancel', { pointerType: 'mouse' });
  expect((await peek(page)).queue).toEqual(['left']);
});

test('pausing stops the snake, and it resumes where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowDown');
  await page.clock.runFor(200);
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  const stored = () => page.evaluate(() => localStorage.getItem('bdnix_snake_save'));
  const before = await stored();
  await page.clock.runFor(3000);
  await press(page, 'ArrowLeft');                       // keys don't turn while paused
  await press(page, 'KeyP');
  await press(page, 'KeyP');
  expect(await stored()).toBe(before);                  // nothing moved while paused
  await press(page, 'Space');                           // Space resumes...
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(300);
  const now = await peek(page);
  expect(now.body[0].y).toBeGreaterThan(JSON.parse(before).data.body[0].y); // ...and the snake moves on
  expect(now.dir).toBe('down');

  await press(page, 'Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();              // the overlay's Resume button
  await expect(page.locator('#overlay')).toBeHidden();
});

test('pausing before the snake moves, and a hidden tab pauses too', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
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
  await page.evaluate(() => localStorage.setItem('bdnix_snake_best', '31'));
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
  expect(board.width / board.height).toBeCloseTo(1, 1);
  expect(stats.x + stats.width).toBeLessThanOrEqual(board.x); // to the left, not above
  await expectNoSideScroll(page);

  await page.getByRole('button', { name: 'Start game' }).click();
  await tap(page.locator('.touch [data-dir=up]'));
  expect((await peek(page)).dir).toBe('up');
});

test('a reload keeps the round, paused where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowRight');
  for (let i = 0; i < 40 && (await page.locator('#score').textContent()) !== '1'; i++) await page.clock.runFor(50);
  await press(page, 'ArrowUp');
  const s = await peek(page);
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#score')).toHaveText('1');
  await page.clock.runFor(3000);
  await page.locator('#startBtn').click();              // Resume
  await expect(page.locator('#overlay')).toBeHidden();
  const now = await peek(page);
  expect(now).toEqual(s);                               // on the same spot, with the same turn coming
  // Carries on up to the top, then left to the food in the corner.
  for (let i = 0; i < 200 && (await page.locator('#score').textContent()) !== '2'; i++) {
    await page.clock.runFor(50);
    const d = await peek(page);
    if (d.body[0].y === 0 && d.dir === 'up') await press(page, 'ArrowLeft');
  }
  await expect(page.locator('#score')).toHaveText('2');
});

test('New game from the pause screen starts over, and before the snake moves there is nothing to keep', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Snake');
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowUp');
  await page.clock.runFor(500);
  await press(page, 'KeyP');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Snake');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_snake_save'))).toBeNull();
});

test('saves that do not make sense are thrown away', async ({ page }) => {
  const good = saved(row(6, 8, 4));
  for (const bad of [
    { body: [{ x: 4, y: 1 }] },                                                  // missing most fields
    { ...good, score: 5 },                                                       // score doesn't match the length
    { ...good, dir: 'left' },                                                    // head facing into its neck
    { ...good, body: [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }] }, // a gap in the body
    { ...good, body: [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 9 }, { x: 5, y: 8 }] }, // folded back on itself
    { ...good, food: { x: 4, y: 8 } },                                           // food under the snake
    { ...good, food: { x: COLS, y: 0 } },                                        // food off the board
    { ...good, queue: ['up', 'left', 'down'] }                                   // too many turns waiting
  ]) {
    await openSaved(page, bad);
    await expect(page.locator('#ovTitle'), JSON.stringify(bad)).toHaveText('Snake');
    expect(await page.evaluate(() => localStorage.getItem('bdnix_snake_save'))).toBeNull();
  }
  await openSaved(page, { ...good, queue: ['up'] });                             // and a good one is kept
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
});

test('eating, crashing and filling the board each have a sound', async ({ page }) => {
  await listen(page);
  await page.reload();
  await page.getByRole('button', { name: 'Start game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await press(page, 'ArrowRight');
  for (let i = 0; i < 40 && (await page.locator('#score').textContent()) !== '1'; i++) await page.clock.runFor(50);
  expect(await heard(page)).toEqual(['eat']);
  await waitForGameOver(page);
  expect(await heard(page)).toEqual(['hit', 'best']);

  await page.getByRole('button', { name: 'Play again' }).click();
  await press(page, 'ArrowUp');
  await waitForGameOver(page);
  expect(await heard(page)).toEqual(['start', 'hit', 'over']);

  // The last berry fills the board, as in the test above.
  const path = [];
  for (let y = 0; y < ROWS; y++) for (let i = 0; i < COLS; i++) path.push({ x: y % 2 ? COLS - 1 - i : i, y });
  await openSaved(page, saved(path.slice(0, -1).reverse(), { food: path[path.length - 1] }));
  await page.locator('#startBtn').click();
  await waitForGameOver(page);
  expect(await heard(page)).toEqual(['eat', 'win', 'best']);
});

test('its sounds are well formed and loud enough', async ({ page }) => {
  expect(await soundProblems(page)).toEqual([]);
});

test('turning a phone sideways mid-round fits the board to the height, controls beside it, and play goes on', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('button', { name: 'Start game' }).click();
  await tap(page.locator('.touch [data-dir=right]'));
  for (let i = 0; i < 40 && (await page.locator('#score').textContent()) !== '1'; i++) await page.clock.runFor(50);
  await expect(page.locator('#score')).toHaveText('1');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await page.locator('#board').boundingBox()).height).toBeGreaterThan(330);
  const board = await page.locator('#board').boundingBox();
  expect(board.y + board.height).toBeLessThanOrEqual(390);
  for (const b of await page.locator('.touch button').all()) {
    const box = await b.boundingBox();
    expect(box.x + box.width <= board.x || box.x >= board.x + board.width).toBe(true); // not over the board
  }
  await expectNoSideScroll(page);

  // Steers round and keeps going: up, then left, well clear of the walls.
  await tap(page.locator('.touch [data-dir=up]'));
  await page.clock.runFor(500);
  await tap(page.locator('.touch [data-dir=left]'));
  await page.clock.runFor(500);
  await expect(page.locator('#overlay')).toBeHidden();
  const s = await peek(page);
  expect(s.dir).toBe('left');
  expect(s.body[0].y).toBeLessThan(8);
});
