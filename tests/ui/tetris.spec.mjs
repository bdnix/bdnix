import { test, expect } from './fixtures.mjs';
import { openGame, press, inkOn, tap } from './games.mjs';

// Pieces always come O, T, J, L, S, Z, I (see games.mjs). They spawn in the
// middle of the top row and, on an empty board, a hard drop moves the flat
// ones 18 rows (2 points a row).

const hud = (page) => page.evaluate(() => ({
  score: document.getElementById('score').textContent,
  lines: document.getElementById('lines').textContent,
  level: document.getElementById('level').textContent
}));

test.beforeEach(async ({ page }) => {
  await openGame(page, '/play/');
  await expect(page.locator('#ovTitle')).toHaveText('Tetris');
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

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(overlay).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText(score);

  await page.goto('/profile/');
  await expect(page.locator('.score').first().locator('b')).toHaveText(Number(score).toLocaleString('en-US'));
});
