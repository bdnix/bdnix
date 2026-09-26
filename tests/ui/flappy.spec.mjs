import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, tap } from './games.mjs';

// With Math.random fixed at 0 every gap is at the same height: 64 to 188 on
// the 288 x 512 board. The bird hovers at 220 until the first flap.

// The bird's height on the board, found from its yellow pixels.
function birdY(page){
  return page.locator('#board').evaluate((c) => {
    const s = c.width / 288;
    const x0 = Math.floor(68 * s), w = Math.ceil(24 * s);
    const d = c.getContext('2d').getImageData(x0, 0, w, c.height).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 200 && Math.abs(d[i] - 250) < 12 && Math.abs(d[i + 1] - 204) < 12 && Math.abs(d[i + 2] - 21) < 12) {
        sum += Math.floor(i / 4 / w); n++;
      }
    }
    return n ? sum / n / s : null;
  });
}

// Flaps whenever the bird sinks below the middle of the gaps, until it has
// passed `pipes` pipes.
async function flyThrough(page, pipes, flap){
  const score = page.locator('#score');
  let prev = await birdY(page);
  for (let i = 0; i < 1000 && Number(await score.textContent()) < pipes; i++) {
    const y = await birdY(page);
    if (y > 150 && y >= prev) await flap();
    prev = y;
    await page.clock.runFor(32);
  }
  await expect(score).toHaveText(String(pipes));
}

test.beforeEach(async ({ page }) => {
  await openGame(page, '/flappy-bird/');
  await expect(page.locator('#ovTitle')).toHaveText('Flappy Bird');
  await page.clock.runFor(100);
});

test('flies through three pipes, then crashes', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  const overlay = page.locator('#overlay');
  await expect(overlay).toBeHidden();

  // Waits in the air until the first flap.
  await page.clock.runFor(3000);
  expect(Math.abs(await birdY(page) - 220)).toBeLessThan(8);

  await flyThrough(page, 3, () => press(page, 'Space'));

  // Stops flapping: falls into the next pipe, or the ground.
  for (let s = 0; s < 20 && !(await overlay.isVisible()); s++) await page.clock.runFor(250);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovText')).toHaveText('Score 3 — new best!');
  await expect(page.locator('#ovKicker')).toHaveText('bdnix arcade');   // no medal under 10
  expect(await page.evaluate(() => localStorage.getItem('bdnix_flappy_best'))).toBe('3');

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(overlay).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('3');

  // A worse round keeps the best score.
  await press(page, 'ArrowUp');
  for (let s = 0; s < 20 && !(await overlay.isVisible()); s++) await page.clock.runFor(250);
  await expect(page.locator('#ovText')).toHaveText('Score 0 · Best 3');
  await press(page, 'Enter');
  await expect(overlay).toBeHidden();
});

test('clicks and taps on the game flap', async ({ page }) => {
  await press(page, 'Enter');
  await expect(page.locator('#overlay')).toBeHidden();
  const game = page.locator('#game');
  const flap = () => tap(game);
  await flap();
  await page.clock.runFor(150);
  expect(await birdY(page)).toBeLessThan(200);          // rose from 220

  await flyThrough(page, 1, flap);

  // A right click doesn't flap.
  await page.clock.runFor(400);
  const before = await birdY(page);
  await game.dispatchEvent('pointerdown', { pointerType: 'mouse', button: 2 });
  await page.clock.runFor(50);
  expect(await birdY(page)).toBeGreaterThan(before);
});

test('pausing stops the game, and it resumes where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');
  await page.clock.runFor(200);
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  const y = await birdY(page);
  await page.clock.runFor(3000);
  expect(await birdY(page)).toBe(y);                    // hung in the air while paused
  await press(page, 'Space');                           // Space doesn't flap while paused...
  await expect(page.locator('#overlay')).toBeHidden();  // ...it resumes
  await page.clock.runFor(300);
  expect(await birdY(page)).not.toBe(y);

  await press(page, 'Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();                // the overlay's Resume button
  await expect(page.locator('#overlay')).toBeHidden();
});

test('pausing before the first flap, and a hidden tab pauses too', async ({ page }) => {
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
  await page.evaluate(() => localStorage.setItem('bdnix_flappy_best', '12'));
  await page.reload();
  await expect(page.locator('#best')).toHaveText('12');
});

test('a phone held sideways fits the whole board on screen, scores beside it', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  const board = await page.locator('#board').boundingBox();
  const stats = await page.locator('.stats').boundingBox();
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.y + board.height).toBeLessThanOrEqual(390);
  expect(board.height).toBeGreaterThan(300);                 // uses most of the height
  expect(board.width / board.height).toBeCloseTo(288 / 512, 1);
  expect(stats.x + stats.width).toBeLessThanOrEqual(board.x); // to the left, not above
  await expectNoSideScroll(page);

  // Still plays: a tap flaps.
  await page.getByRole('button', { name: 'Start game' }).click();
  await tap(page.locator('#game'));
  await page.clock.runFor(150);
  expect(await birdY(page)).toBeLessThan(200);
});
