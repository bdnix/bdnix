import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, tap, inkOn, listen, heard } from './games.mjs';

// The board is 360 × 480 units. A new ball waits on the middle of the paddle
// at (180, 435); with Math.random fixed at 0 it's launched up and to the
// left, and game over shows the first of its lines.
const W = 360, COLS = 10, ROWS = 8;
const PADDLE_Y = 440, R = 5;

// The game as saved: pausing saves it, and resuming carries on at the same
// moment, since time only moves when a test runs the clock.
async function peek(page){
  await press(page, 'KeyP');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_bricks_save') || 'null'));
  await press(page, 'KeyP');
  return s && s.data;
}

// Runs the frozen clock a little at a time until `done()` says so.
async function runUntil(page, done, ms = 20000){
  for (let t = 0; t < ms; t += 50) {
    if (await done()) return;
    await page.clock.runFor(50);
  }
  expect(await done()).toBe(true);
}
const overlayShown = (page) => () => page.locator('#overlay').isVisible();
const scoreIs = (page, n) => async () => (await page.locator('#score').textContent()) === String(n);

// Loads the page with a game saved as `data`.
async function openSaved(page, data){
  await page.addInitScript((d) => localStorage.setItem('bdnix_bricks_save', JSON.stringify({ v: 1, data: d })), data);
  await page.reload();
}
const full = () => Array(ROWS * COLS).fill(1);
// Every brick gone but the ones listed.
const only = (...keep) => full().map((_, i) => (keep.includes(i) ? 1 : 0));
const onPaddle = (x = 180) => ({ x, y: PADDLE_Y - R, dx: 0, dy: -1 });
const saved = (extra = {}) => ({ level: 1, bricks: full(), paddle: 180, small: false, ball: onPaddle(), stuck: true, lives: 2, score: 0, ...extra });
// Points for every brick broken in `bricks`.
const points = (bricks) => bricks.reduce((n, b, i) => n + (b ? 0 : [7, 7, 5, 5, 3, 3, 1, 1][Math.floor(i / COLS)]), 0);
// A ball falling past the far left of the paddle, which is at the far right.
const falling = { paddle: 300, ball: { x: 20, y: 400, dx: 0, dy: 1 }, stuck: false };

test.beforeEach(async ({ page }) => {
  await openGame(page, '/brick-bounce/');
  await expect(page.locator('#ovTitle')).toHaveText('Brick Bounce');
  await page.clock.runFor(100);
});

test('launches, breaks a brick, and ends when the last ball is lost', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#lives')).toHaveText('3');
  await expect(page.locator('#level')).toHaveText('1');
  await page.clock.runFor(2000);
  expect(await peek(page)).toBeNull();                 // waits on the paddle until launched
  await press(page, 'Space');
  await runUntil(page, scoreIs(page, 1));              // the bottom row is worth 1
  const s = await peek(page);
  expect(s.bricks.indexOf(0)).toBeGreaterThanOrEqual((ROWS - 1) * COLS);
  expect(s.ball.dy).toBeGreaterThan(0);                // on its way back down

  // Nobody moves the paddle: sooner or later every ball is lost. Each new
  // ball waits on the paddle until it's launched.
  await runUntil(page, async () => {
    if (await page.locator('#overlay').isVisible()) return true;
    await press(page, 'ArrowUp');
    return false;
  });
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovKicker')).toHaveText('The last ball slipped by.');
  await expect(page.locator('#lives')).toHaveText('0');
  const score = Number(await page.locator('#score').textContent());
  expect(score).toBeGreaterThan(0);
  await expect(page.locator('#ovText')).toHaveText(`Score ${score} — new best!`);
  expect(await page.evaluate(() => localStorage.getItem('bdnix_bricks_best'))).toBe(String(score));
  expect(await page.evaluate(() => localStorage.getItem('bdnix_bricks_save'))).toBeNull(); // nothing left to resume
  await expect(page.locator('#newBtn')).toBeHidden();

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#lives')).toHaveText('3');
  await expect(page.locator('#best')).toHaveText(String(score));
});

test('losing a ball brings the next one to the paddle, and a worse game keeps the best', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('bdnix_bricks_best', '500'));
  await openSaved(page, saved({ ...falling, lives: 2, bricks: only(...Array.from({ length: 79 }, (_, i) => i)), score: 1 }));
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#best')).toHaveText('500');
  await page.locator('#startBtn').click();
  await runUntil(page, async () => (await page.locator('#lives').textContent()) === '1');
  let s = await peek(page);
  expect([s.stuck, s.lives, s.ball]).toEqual([true, 1, onPaddle(300)]);
  await page.clock.runFor(1000);
  expect((await peek(page)).ball).toEqual(onPaddle(300)); // waits there to be launched

  await openSaved(page, saved({ ...falling, lives: 1, score: 1, bricks: only(...Array.from({ length: 79 }, (_, i) => i)) }));
  await page.locator('#startBtn').click();
  await runUntil(page, overlayShown(page));
  await expect(page.locator('#ovText')).toHaveText('Score 1 · Best 500');
  await press(page, 'Enter');
  await expect(page.locator('#overlay')).toBeHidden();
});

test('the paddle sends the ball back up, and the ball is drawn every frame', async ({ page }) => {
  await openSaved(page, saved({ ball: { x: 180, y: 380, dx: 0, dy: 1 }, stuck: false }));
  await page.locator('#startBtn').click();
  let s = await peek(page);
  for (let i = 0; i < 40 && s.ball.dy > 0; i++) {
    await page.clock.runFor(20);
    expect(await inkOn(page, '#board')).toBeGreaterThan(1000);
    s = await peek(page);
  }
  expect(s.ball.dy).toBe(-1);                          // off the middle: straight up
  expect(s.lives).toBe(2);
});

test('keys, the mouse, dragging and the buttons all move the paddle', async ({ page }) => {
  await openSaved(page, saved());                      // a ball waiting on the paddle
  await page.locator('#startBtn').click();
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(100);
  await page.keyboard.up('ArrowRight');
  let s = await peek(page);
  expect(s.paddle).toBeGreaterThan(200);
  expect(s.ball.x).toBe(s.paddle);                    // the ball comes along
  const right = s.paddle;
  await page.clock.runFor(200);
  expect((await peek(page)).paddle).toBe(right);      // and stops when the key comes up
  await page.keyboard.down('KeyA');
  await page.clock.runFor(2000);
  await page.keyboard.up('KeyA');
  expect((await peek(page)).paddle).toBe(32);         // as far left as it goes

  const box = await page.locator('#board').boundingBox();
  const scale = box.width / W;
  const game = page.locator('#game');
  if (!(await page.locator('.touch').isVisible())) {
    await page.mouse.move(box.x + 250 * scale, box.y + 300 * scale);
    expect((await peek(page)).paddle).toBeCloseTo(250, 0);
  }
  await game.dispatchEvent('pointermove', { pointerType: 'mouse', clientX: box.x + 100 * scale, clientY: box.y + 100 });
  expect((await peek(page)).paddle).toBeCloseTo(100, 0);

  // A finger drags it along from wherever it touches.
  await game.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: 20, clientY: 300 });
  await game.dispatchEvent('pointermove', { pointerType: 'touch', isPrimary: true, clientX: 20 + 60 * scale, clientY: 300 });
  await game.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
  s = await peek(page);
  expect(s.paddle).toBeCloseTo(160, 0);
  expect(s.stuck).toBe(true);                         // a drag isn't a tap

  const hold = async (dir, ms) => {
    const b = page.locator(`.touch [data-dir=${dir}]`);
    await b.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
    await page.clock.runFor(ms);
    await b.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
  };
  await hold('right', 2000);
  expect((await peek(page)).paddle).toBe(W - 32);
  await hold('left', 100);
  expect((await peek(page)).paddle).toBeLessThan(W - 50);

  // A right click does nothing.
  await game.dispatchEvent('pointerdown', { pointerType: 'mouse', button: 2, clientX: box.x + 50, clientY: 300 });
  expect((await peek(page)).stuck).toBe(true);
});

test('Space, ↑, a click, a tap and the launch button each launch the ball', async ({ page }) => {
  const launched = async (how) => {
    await openSaved(page, saved());
    await page.locator('#startBtn').click();
    expect((await peek(page)).stuck).toBe(true);
    await how();
    const s = await peek(page);
    expect(s.stuck).toBe(false);
    expect(s.ball.dx).toBeCloseTo(-0.5, 5);
  };
  await launched(() => press(page, 'Space'));
  await launched(() => press(page, 'ArrowUp'));
  await launched(() => press(page, 'KeyW'));
  await launched(() => tap(page.locator('.touch [data-dir=launch]')));
  await launched(() => tap(page.locator('#game')));
  await launched(async () => {
    const box = await page.locator('#board').boundingBox();
    await page.locator('#game').dispatchEvent('pointerdown', { pointerType: 'mouse', button: 0, clientX: box.x + box.width / 2, clientY: box.y + 100 });
  });
});

test('breaking the last brick puts up the next wall', async ({ page }) => {
  const last = (ROWS - 1) * COLS + 4;
  const bricks = only(last);
  const x = 12 + 4 * 33.6 + 16.8;                      // under the middle of that brick
  await openSaved(page, saved({ bricks, score: points(bricks), small: true, paddle: 100, ball: { x, y: 300, dx: 0, dy: -1 }, stuck: false }));
  await expect(page.locator('#score')).toHaveText('319');
  await page.locator('#startBtn').click();
  await runUntil(page, async () => (await page.locator('#level').textContent()) === '2');
  await expect(page.locator('#score')).toHaveText('320');
  const s = await peek(page);
  expect([s.level, s.stuck, s.small, s.lives, s.bricks.every((b) => b === 1)]).toEqual([2, true, false, 2, true]);
  await page.clock.runFor(1000);
  expect((await peek(page)).stuck).toBe(true);        // the new wall waits for a launch
});

test('pausing stops the ball, and it resumes where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');
  await page.clock.runFor(200);
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  const stored = () => page.evaluate(() => localStorage.getItem('bdnix_bricks_save'));
  const before = await stored();
  await page.clock.runFor(3000);
  await page.keyboard.down('ArrowLeft');               // keys don't move it while paused
  await page.clock.runFor(200);
  await page.keyboard.up('ArrowLeft');
  await press(page, 'KeyP');
  await press(page, 'KeyP');
  expect(await stored()).toBe(before);                  // nothing moved while paused
  await press(page, 'Space');                           // Space resumes...
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(100);
  const now = await peek(page);
  expect(now.ball.y).toBeLessThan(JSON.parse(before).data.ball.y); // ...and the ball flies on

  await press(page, 'Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();              // the overlay's Resume button
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#ovTitle')).toHaveText('Paused'); // and so does a hidden tab
});

test('a saved best score shows on load', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('bdnix_bricks_best', '640'));
  await page.reload();
  await expect(page.locator('#best')).toHaveText('640');
});

test('a phone held sideways fits the whole board on screen, controls beside it', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  const board = await page.locator('#board').boundingBox();
  const stats = await page.locator('.stats').boundingBox();
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.y + board.height).toBeLessThanOrEqual(390);
  expect(board.height).toBeGreaterThan(300);                 // uses most of the height
  expect(board.width / board.height).toBeCloseTo(0.75, 1);
  expect(stats.x + stats.width).toBeLessThanOrEqual(board.x); // to the left, not above
  await expectNoSideScroll(page);

  await openSaved(page, saved());
  await page.locator('#startBtn').click();
  await tap(page.locator('.touch [data-dir=launch]'));
  expect((await peek(page)).stuck).toBe(false);
});

test('a reload keeps the game, paused where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');
  await runUntil(page, scoreIs(page, 1));
  const s = await peek(page);
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#score')).toHaveText('1');
  await page.clock.runFor(3000);
  await page.locator('#startBtn').click();              // Resume
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await peek(page)).toEqual(s);                  // the ball in the same spot, going the same way
  await page.clock.runFor(200);
  expect((await peek(page)).ball).not.toEqual(s.ball);  // and it carries on

  // A ball waiting on the paddle comes back waiting.
  await openSaved(page, saved({ lives: 1, paddle: 90, ball: onPaddle(90) }));
  await expect(page.locator('#lives')).toHaveText('1');
  await page.locator('#startBtn').click();
  await page.clock.runFor(1000);
  expect((await peek(page)).ball).toEqual(onPaddle(90));
});

test('New game from the pause screen starts over, and before the first launch there is nothing to keep', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Brick Bounce');
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');
  await runUntil(page, scoreIs(page, 1));
  await press(page, 'KeyP');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Brick Bounce');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_bricks_save'))).toBeNull();
});

test('saves that do not make sense are thrown away', async ({ page }) => {
  const good = saved({ bricks: only(...Array.from({ length: 70 }, (_, i) => i)), score: 10 });
  for (const bad of [
    { bricks: [1] },                                                         // missing most fields
    { ...good, score: 11 },                                                  // score doesn't match the bricks broken
    { ...good, level: 2, score: 9 },                                         // less than this wall's bricks are worth
    { ...good, level: 0 },                                                   // no such wall
    { ...good, bricks: full().slice(1) },                                    // too few bricks
    { ...good, bricks: full().map(() => 0), score: 320 },                    // an empty wall
    { ...good, bricks: full().map(() => 2) },                                // not a brick
    { ...good, lives: 4 },                                                   // too many balls
    { ...good, lives: 0 },                                                   // no ball to play
    { ...good, small: 'yes' },
    { ...good, paddle: 10 },                                                 // the paddle off the end
    { ...good, ball: { x: 180, y: 300, dx: 1, dy: 1 }, stuck: false },       // not a direction
    { ...good, ball: { x: -5, y: 300, dx: 0, dy: 1 }, stuck: false },        // off the board
    { ...good, ball: { x: 180, y: 70, dx: 0, dy: 1 }, stuck: false }         // inside a brick
  ]) {
    await openSaved(page, bad);
    await expect(page.locator('#ovTitle'), JSON.stringify(bad)).toHaveText('Brick Bounce');
    expect(await page.evaluate(() => localStorage.getItem('bdnix_bricks_save'))).toBeNull();
  }
  await openSaved(page, { ...good, level: 3, score: 700, ball: { x: 180, y: 300, dx: 0, dy: 1 }, stuck: false }); // and a good one is kept
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#level')).toHaveText('3');
});

test('launching, bricks, the paddle, the walls, lost balls and a new wall each have a sound', async ({ page }) => {
  await listen(page);
  await page.reload();
  await page.getByRole('button', { name: 'Start game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await press(page, 'Space');
  await runUntil(page, scoreIs(page, 1));
  expect(await heard(page)).toEqual(['brick']);

  await openSaved(page, saved({ ball: { x: 180, y: 380, dx: 0, dy: 1 }, stuck: false }));
  await page.locator('#startBtn').click();
  await runUntil(page, async () => (await page.evaluate(() => window.heard.length)) > 0);
  expect(await heard(page)).toEqual(['paddle']);

  await openSaved(page, saved({ ball: { x: 30, y: 300, dx: -1, dy: 0.0001 }, stuck: false }));
  await page.locator('#startBtn').click();
  await runUntil(page, async () => (await page.evaluate(() => window.heard.length)) > 0);
  expect(await heard(page)).toEqual(['wall']);

  await openSaved(page, saved({ ...falling, lives: 2 }));
  await page.locator('#startBtn').click();
  await runUntil(page, async () => (await page.locator('#lives').textContent()) === '1');
  expect(await heard(page)).toEqual(['fall']);

  await openSaved(page, saved({ ...falling, lives: 1, bricks: only(...Array.from({ length: 79 }, (_, i) => i)), score: 1 }));
  await page.locator('#startBtn').click();
  await runUntil(page, overlayShown(page));
  expect(await heard(page)).toEqual(['fall', 'best']);
  await page.getByRole('button', { name: 'Play again' }).click();
  await openSaved(page, saved({ ...falling, lives: 1 }));
  await page.locator('#startBtn').click();
  await runUntil(page, overlayShown(page));
  expect(await heard(page)).toEqual(['fall', 'over']);

  const bricks = only(74);
  await openSaved(page, saved({ bricks, score: points(bricks), ball: { x: 12 + 4 * 33.6 + 16.8, y: 300, dx: 0, dy: -1 }, stuck: false }));
  await page.locator('#startBtn').click();
  await runUntil(page, async () => (await page.locator('#level').textContent()) === '2');
  expect(await heard(page)).toEqual(['brick', 'level']);
});
