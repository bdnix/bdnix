import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, inkOn, tap, listen, heard, soundProblems } from './games.mjs';

// Pieces always come O, T, J, L, S, Z, I (see games.mjs). They spawn in the
// middle of the top row and, on an empty board, a hard drop moves the flat
// ones 18 rows (2 points a row).

const hud = (page) => page.evaluate(() => ({
  score: document.getElementById('score').textContent,
  lines: document.getElementById('lines').textContent,
  level: document.getElementById('level').textContent
}));

test.beforeEach(async ({ page }) => {
  await openGame(page, '/falling-blocks/');
  await expect(page.locator('#ovTitle')).toHaveText('Falling Blocks');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
});

test('a filled row clears and scores', async ({ page }) => {
  await press(page, 'ArrowLeft', 4); await press(page, 'Space');      // O into columns 1-2
  await press(page, 'ArrowLeft'); await press(page, 'Space');         // T into 3-5
  await press(page, 'ArrowRight', 2); await press(page, 'Space');     // J into 6-8
  await press(page, 'ArrowUp'); await press(page, 'ArrowRight', 4);   // L upright into 9-10
  await press(page, 'Space');
  await page.clock.runFor(300); // the cleared row flashes before it goes
  // Hard drops 36 + 36 + 36 + 34, plus 100 for one line at level 1.
  expect(await hud(page)).toEqual({ score: '242', lines: '1', level: '1' });
});

test('soft drop and gravity move the piece down', async ({ page }) => {
  await press(page, 'ArrowDown', 2);                // 1 point a row
  await expect(page.locator('#score')).toHaveText('2');
  await page.clock.runFor(3500);                    // level 1 falls a row each full second: 3 rows
  await press(page, 'Space');                       // 18 - 2 - 3 rows left
  await expect(page.locator('#score')).toHaveText(String(2 + 13 * 2));
});

test('rotating and holding pieces', async ({ page }) => {
  expect(await inkOn(page, '#hold')).toBe(0);
  await press(page, 'KeyC');                        // hold the O; the T comes in
  await page.clock.runFor(20);                      // one frame, to draw it
  expect(await inkOn(page, '#hold')).toBeGreaterThan(0);
  await press(page, 'KeyZ');                        // T stands up: three rows tall
  await press(page, 'Space');                       // so it drops 17 rows
  await expect(page.locator('#score')).toHaveText('34');
  await press(page, 'KeyC');                        // swap the J for the held O
  await press(page, 'KeyC');                        // only one hold per piece
  await press(page, 'KeyX'); await press(page, 'Space'); // O can't rotate; lands on the T
  await expect(page.locator('#score')).toHaveText(String(34 + 15 * 2));
});

test('pausing stops the game, and it resumes where it was', async ({ page }) => {
  const overlay = page.locator('#overlay');
  const pause = page.locator('#pauseBtn');

  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(pause).toHaveAttribute('aria-label', 'Resume');
  await page.clock.runFor(5000);                    // nothing falls while paused
  await press(page, 'KeyP');
  await expect(overlay).toBeHidden();
  await expect(pause).toHaveAttribute('aria-label', 'Pause');

  await press(page, 'Escape');
  await expect(overlay).toBeVisible();
  await pause.click();
  await expect(overlay).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.getByRole('button', { name: 'Resume' }).first().click();
  await expect(overlay).toBeHidden();

  await press(page, 'Space');                       // still at the top: a full 18-row drop
  await expect(page.locator('#score')).toHaveText('36');
});

test('the touch buttons play the game', async ({ page }) => {
  const button = (act) => page.locator(`.touch button[data-act="${act}"]`);
  await tap(button('down'));
  await tap(button('left'));
  await tap(button('right'));
  await tap(button('hold'));                        // O held, T in play
  await tap(button('rotate'));
  await page.locator('#board').dispatchEvent('pointerdown', { pointerType: 'touch' }); // tapping the board rotates too
  await tap(button('drop'));
  // 1 for the soft drop, then the T (upside down after two turns) drops 17 rows.
  await expect(page.locator('#score')).toHaveText(String(1 + 17 * 2));
});

test('stacking to the top ends the game and saves the best score', async ({ page }) => {
  const overlay = page.locator('#overlay');
  for (let i = 0; i < 40 && !(await overlay.isVisible()); i++) await press(page, 'Space');
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  const score = await page.locator('#score').textContent();
  expect(Number(score)).toBeGreaterThan(0);
  await expect(page.locator('#ovText')).toHaveText(`Score ${score} — new best!`);
  expect(await page.evaluate(() => localStorage.getItem('bdnix_tetris_best'))).toBe(score);
  expect(await page.evaluate(() => localStorage.getItem('bdnix_tetris_save'))).toBeNull(); // nothing left to resume
  await expect(page.locator('#newBtn')).toBeHidden();

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(overlay).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText(score);

  await page.goto('/profile/');
  await expect(page.locator('.score').first().locator('b')).toHaveText(Number(score).toLocaleString('en-US'));
});

test('a reload keeps the game, paused where it was', async ({ page }) => {
  await press(page, 'ArrowLeft', 4); await press(page, 'Space');     // O into columns 1-2
  await press(page, 'KeyC');                                         // hold the T; the J comes in
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  await expect(page.locator('#score')).toHaveText('36');
  expect(await inkOn(page, '#hold')).toBeGreaterThan(0);             // the T is still held
  await page.clock.runFor(5000);                                     // nothing falls while paused

  await page.locator('#startBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await press(page, 'Space');                                        // the J, still at the top: 18 rows
  await expect(page.locator('#score')).toHaveText('72');
});

test('New game on the pause screen starts over', async ({ page }) => {
  await press(page, 'Space');
  await page.reload();
  await expect(page.locator('#score')).toHaveText('36');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#newBtn')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  expect(await inkOn(page, '#hold')).toBe(0);
});

test('a save that does not make sense is thrown away', async ({ page }) => {
  // Written as the page loads, after the game in progress has saved itself.
  await page.addInitScript(() => localStorage.setItem('bdnix_tetris_save', JSON.stringify({ v: 1, data: { grid: [], score: 5 } })));
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Falling Blocks');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_tetris_save'))).toBeNull();
});

test('a reload while a row is clearing finishes the clear on resume', async ({ page }) => {
  await press(page, 'ArrowLeft', 4); await press(page, 'Space');
  await press(page, 'ArrowLeft'); await press(page, 'Space');
  await press(page, 'ArrowRight', 2); await press(page, 'Space');
  await press(page, 'ArrowUp'); await press(page, 'ArrowRight', 4);
  await press(page, 'Space');                                        // fills the row: it starts to flash
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  expect(await hud(page)).toEqual({ score: '142', lines: '0', level: '1' });
  await page.locator('#startBtn').click();
  await page.clock.runFor(300);
  expect(await hud(page)).toEqual({ score: '242', lines: '1', level: '1' });
});

test('moves, drops, clears and the end of the game each have a sound', async ({ page }) => {
  await listen(page);
  await page.reload();                              // paused, from the save
  await page.getByRole('button', { name: 'New game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowUp');                     // the O doesn't turn, so no sound
  expect(await heard(page)).toEqual(['move']);
  await press(page, 'KeyC');                        // hold the O
  await press(page, 'ArrowUp');                     // the T turns
  await press(page, 'Space');
  expect(await heard(page)).toEqual(['hold', 'rotate', 'drop', 'lock']);

  // The route from the first test fills the bottom row.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await press(page, 'ArrowLeft', 4); await press(page, 'Space');
  await press(page, 'ArrowLeft'); await press(page, 'Space');
  await press(page, 'ArrowRight', 2); await press(page, 'Space');
  await press(page, 'ArrowUp'); await press(page, 'ArrowRight', 4);
  await heard(page);
  await press(page, 'Space');
  expect(await heard(page)).toEqual(['drop', 'clear']);
  await page.clock.runFor(300);                     // the cleared row flashes before it goes

  const overlay = page.locator('#overlay');
  for (let i = 0; i < 40 && !(await overlay.isVisible()); i++) await press(page, 'Space');
  expect((await heard(page)).pop()).toBe('best');   // a new best score
  await page.getByRole('button', { name: 'Play again' }).click();
  for (let i = 0; i < 40 && !(await overlay.isVisible()); i++) await press(page, 'Space');
  expect((await heard(page)).pop()).toBe('over');   // the same score isn't a new best
});

test('clearing four rows at once and reaching the next level have their own sounds', async ({ page }) => {
  // A real save, changed to four rows filled all but the right-hand column,
  // an upright I above the gap and one line short of level 2.
  await press(page, 'KeyP');
  const save = JSON.parse(await page.evaluate(() => localStorage.getItem('bdnix_tetris_save')));
  const d = save.data;
  d.grid = d.grid.map((row, y) => row.map((c, x) => (y >= 16 && x < 9 ? 'O' : null)));
  d.piece = { type: 'I', m: [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], x: 7, y: 0 };
  d.lines = 9;
  await page.addInitScript(s => localStorage.setItem('bdnix_tetris_save', s), JSON.stringify(save));
  await listen(page);
  await page.reload();
  await press(page, 'Enter');
  await press(page, 'Space');
  expect(await heard(page)).toEqual(['drop', 'bigclear']);
  await page.clock.runFor(300);                     // the rows flash, then go
  expect(await heard(page)).toEqual(['level']);
  await expect(page.locator('#level')).toHaveText('2');
});

test('its sounds are well formed and loud enough', async ({ page }) => {
  expect(await soundProblems(page)).toEqual([]);
});

test('turning a phone sideways mid-game fits the board to the height, controls beside it, and play goes on', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await page.locator('#board').boundingBox()).width).toBeLessThan(390);
  await tap(page.locator('.touch [data-act=down]'));
  await tap(page.locator('.touch [data-act=down]'));   // 1 point a row
  await expect(page.locator('#score')).toHaveText('2');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await page.locator('#board').boundingBox()).height).toBeGreaterThan(330);
  const board = await page.locator('#board').boundingBox();
  const stats = await page.locator('.stats').boundingBox();
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.y + board.height).toBeLessThanOrEqual(390);   // the whole well, top to bottom
  expect(stats.x + stats.width).toBeLessThanOrEqual(board.x); // beside it, not above
  for (const b of await page.locator('.touch button').all()) {
    const box = await b.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(390);
    expect(box.x + box.width <= board.x || box.x >= board.x + board.width).toBe(true); // not over the board
  }
  await expectNoSideScroll(page);

  await tap(page.locator('.touch [data-act=drop]'));   // the O falls the 16 rows left: 2 points a row
  await expect(page.locator('#score')).toHaveText('34');
});
