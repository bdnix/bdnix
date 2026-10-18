import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openGame, press, listen, heard, soundProblems } from '../../../tests/ui/games.mjs';

// The snake starts three long with its head at (6, 8), heading right, and the
// first food is straight ahead at (12, 8), on the square board. A phone held
// upright gets a taller board, with the snake half way down it. With
// Math.random fixed at 0 each food after that goes on the first free cell,
// (0, 0) at the top left. Each ending shows the first of its lines.
const COLS = 17, ROWS = 17;

// How many rows the board has, from its shape.
function rowsOnBoard(page){
  return page.locator('#board').evaluate((c, cols) => Math.round(c.height / c.width * cols), COLS);
}
// The row the snake starts on.
async function middle(page){
  return Math.floor(await rowsOnBoard(page) / 2);
}

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
function headOnBoard(page, rows = ROWS){
  return page.locator('#board').evaluate((c, [cols, rows]) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === 34 && d[i + 1] === 211 && d[i + 2] === 238 && d[i + 3] === 255) {
        sx += (i / 4) % c.width; sy += Math.floor(i / 4 / c.width); n++;
      }
    }
    return n ? { x: sx / n / c.width * cols, y: sy / n / c.height * rows } : null;
  }, [COLS, rows]);
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
  const mid = await middle(page);
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(2000);
  expect(await peek(page)).toBeNull();                 // waits on "Get ready" until told to go
  await press(page, 'ArrowRight');
  for (let i = 0; i < 40 && (await page.locator('#score').textContent()) !== '1'; i++) await page.clock.runFor(50);
  await expect(page.locator('#score')).toHaveText('1');
  await expect(page.locator('#best')).toHaveText('1');
  const s = await peek(page);
  expect(s.body).toEqual([{ x: 12, y: mid }, { x: 11, y: mid }, { x: 10, y: mid }, { x: 9, y: mid }]);
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
  const rows = await rowsOnBoard(page), mid = Math.floor(rows / 2);
  await page.getByRole('button', { name: 'Start game' }).click();
  const still = await headOnBoard(page, rows);
  expect(still.x).toBeCloseTo(6.5, 1);                  // on "Get ready", in the middle of its cell
  await press(page, 'ArrowRight');
  let prev = await headOnBoard(page, rows);
  expect(prev.x).toBeCloseTo(6.5, 1);                  // starting off doesn't jump it forward
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(40);
    const now = await headOnBoard(page, rows);
    const moved = now.x - prev.x;
    expect(moved, `frame ${i}`).toBeGreaterThan(0.05);  // always moving...
    expect(moved, `frame ${i}`).toBeLessThan(0.4);      // ...a fraction of a cell at a time
    expect(now.y).toBeCloseTo(mid + 0.5, 1);
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

test('keys and swipes turn', async ({ page }) => {
  const mid = await middle(page);
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowLeft');                      // straight back doesn't start it
  expect(await peek(page)).toBeNull();
  await press(page, 'KeyW');                           // the first press turns and starts it at once
  let s = await peek(page);
  expect([s.dir, s.queue, s.body[0]]).toEqual(['up', [], { x: 6, y: mid - 1 }]);
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

test('a swipe that curves at the end turns once, and only the first finger steers', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  const game = page.locator('#game');
  const touch = (type, id, x, y) => game.dispatchEvent(type, { pointerType: 'touch', pointerId: id, isPrimary: id === 1, clientX: x, clientY: y });
  // A thumb swipes up, curving to the left as it goes: that's one turn.
  await touch('pointerdown', 1, 200, 400);
  for (const [x, y] of [[200, 380], [197, 368], [192, 358], [185, 350], [177, 344], [170, 341]]) await touch('pointermove', 1, x, y);
  let s = await peek(page);
  expect([s.dir, s.queue]).toEqual(['up', []]);
  // Carrying on to the left, it turns.
  await touch('pointermove', 1, 150, 341);
  expect((await peek(page)).queue).toEqual(['left']);

  // A second finger on the screen doesn't steer, and lifting it doesn't
  // stop the first one.
  await touch('pointerdown', 2, 300, 600);
  await touch('pointermove', 2, 300, 660);
  await touch('pointermove', 2, 360, 660);
  expect((await peek(page)).queue).toEqual(['left']);
  await touch('pointerup', 2, 360, 660);
  await touch('pointermove', 1, 150, 371);
  expect((await peek(page)).queue).toEqual(['left', 'down']);
  await touch('pointerup', 1, 150, 371);
  await page.clock.runFor(500);

  // Once it's lifted, a new finger steers.
  await touch('pointerdown', 3, 200, 300);
  await touch('pointermove', 3, 230, 300);
  expect((await peek(page)).queue).toEqual(['right']);
  await touch('pointercancel', 3, 230, 300);
  await page.clock.runFor(500);

  // A finger lifted over the top bar is lifted too: the next one steers.
  await touch('pointerdown', 4, 200, 300);
  await page.locator('.bar').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 4 });
  await touch('pointerdown', 5, 200, 300);
  await touch('pointermove', 5, 200, 270);
  expect((await peek(page)).queue).toEqual(['up']);
  // And a new first touch steers even if the last one's lift was missed.
  await touch('pointerdown', 1, 200, 300);
  await touch('pointermove', 1, 170, 300);
  expect((await peek(page)).queue).toEqual(['up', 'left']);
});

test('on a phone held upright the board takes more rows, to fill the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const rows = await rowsOnBoard(page);
  expect(rows).toBeGreaterThan(ROWS);
  const box = await page.locator('#board').boundingBox();
  expect(box.width).toBeGreaterThan(340);
  expect(box.height).toBeGreaterThan(600);

  // A round keeps its rows, even if the screen changes shape.
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowRight');
  let s = await peek(page);
  expect(s.rows).toBe(rows);
  expect(s.body[0]).toEqual({ x: 7, y: Math.floor(rows / 2) });
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await rowsOnBoard(page)).toBe(rows);
  // Runs off the bottom of the tall board.
  await press(page, 'ArrowDown');
  await waitForGameOver(page);
  expect(await rowsOnBoard(page)).toBe(rows);
  // The next round fits the screen as it is now: square.
  await page.getByRole('button', { name: 'Play again' }).click();
  expect(await rowsOnBoard(page)).toBe(ROWS);
  await press(page, 'ArrowUp');
  expect((await peek(page)).rows).toBe(ROWS);

  // A tall round carries on as it was on a wide screen.
  await openSaved(page, saved(row(6, 20, 4), { rows: 25 }));
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  expect(await rowsOnBoard(page)).toBe(25);
  // And a round saved before boards could be taller is square on a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  await openSaved(page, saved(row(6, 8, 4)));
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  expect(await rowsOnBoard(page)).toBe(ROWS);
});

test('pausing stops the snake, and it resumes where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'ArrowDown');
  await page.clock.runFor(200);
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#startBtn')).toHaveText('Resume');
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
  await page.locator('#startBtn').click();              // the overlay's Resume button
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();              // the overlay's Resume button
  await expect(page.locator('#overlay')).toBeHidden();
});

test('pausing before the snake moves, and a hidden tab pauses too', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();
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
    { ...good, queue: ['up', 'left', 'down'] },                                  // too many turns waiting
    { ...good, rows: 16 },                                                       // fewer rows than the square board
    { ...good, rows: 40 },                                                       // more than ever fit
    { ...good, rows: '20' },
    { ...saved(row(6, 20, 4)), rows: 20 }                                        // the snake below the bottom
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
