import { test, expect } from './fixtures.mjs';
import { openGame } from './games.mjs';

// Every game is played with the phone upright (upright.js); checkGame
// (checks.mjs) checks each game turned sideways, and checkPage that the other
// pages never ask. This checks a game opened already turned.
const note = (page) => page.locator('.upright');
const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);

test('a game opened on a phone already held sideways shows the note, and a saved game still comes back paused', async ({ page }) => {
  await openGame(page, '/falling-blocks/');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.keyboard.press('KeyP');                  // pausing saves the game
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  const upright = page.viewportSize();

  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  if (await touch(page)) {
    await expect(note(page)).toBeVisible();
    await page.setViewportSize(upright);
    await expect(note(page)).toBeHidden();
  } else {
    await expect(note(page)).toBeHidden();
  }
  await page.locator('#startBtn').click();   // Resume
  await expect(page.locator('#overlay')).toBeHidden();
});
