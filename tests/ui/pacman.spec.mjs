import { test, expect } from './fixtures.mjs';
import { openGame, press, tap } from './games.mjs';

// Pac-Man starts at the bottom, heading left. Each dot is 10 points and a
// power pellet 50. The game waits 2.2 seconds on "Ready" before it moves.

test.beforeEach(async ({ page }) => {
  await openGame(page, '/pacman/');
  await expect(page.locator('#ovTitle')).toHaveText('Pac-Man');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(2300);
});

test('eats its way to a power pellet, then loses its lives', async ({ page }) => {
  const score = page.locator('#score');
  await page.clock.runFor(1500);                    // left to the wall: 7 dots
  await expect(score).toHaveText('70');
  await press(page, 'ArrowUp');
  await page.clock.runFor(150);
  await press(page, 'ArrowLeft');                   // turns left at the first gap
  await page.clock.runFor(1500);                    // 3 dots up, 5 along the top
  await expect(score).toHaveText('150');
  await press(page, 'ArrowDown');
  await page.clock.runFor(800);                     // 2 dots down, then the pellet
  await expect(score).toHaveText('220');

  // Stuck in the corner, the ghosts catch it three times.
  const overlay = page.locator('#overlay');
  for (let s = 0; s < 120 && !(await overlay.isVisible()); s++) await page.clock.runFor(1000);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovText')).toHaveText('Score 220 — new best!');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_pacman_best'))).toBe('220');

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(overlay).toBeHidden();
  await expect(score).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('220');
});

test('pausing stops the game, and it resumes where it was', async ({ page }) => {
  const score = page.locator('#score');
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  await page.clock.runFor(5000);
  await expect(score).toHaveText('0');              // didn't move while paused

  await press(page, 'KeyP');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(1500);
  await expect(score).toHaveText('70');

  await press(page, 'Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
});

test('the touch buttons and swipes steer', async ({ page }) => {
  const score = page.locator('#score');
  await page.clock.runFor(1500);                    // stopped at the wall, 70 points
  await expect(score).toHaveText('70');
  await tap(page.locator('.touch button[data-dir="up"]'));
  await page.clock.runFor(300);                     // up the side corridor
  await expect(score).not.toHaveText('70');

  // A swipe right steers right at the next junction.
  const game = page.locator('#game');
  await game.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 });
  await game.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 140, clientY: 102 });
  await game.dispatchEvent('pointerup', { pointerType: 'touch' });
  const before = Number(await score.textContent());
  await page.clock.runFor(1000);
  expect(Number(await score.textContent())).toBeGreaterThan(before);
});
