import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame } from './games.mjs';

// Every game is played with the phone upright (upright.js). Turned sideways,
// a phone gets a note asking for it to be turned back, and the game pauses.
// A mouse and keyboard screen is never covered, however short the window:
// the game carries on, laid out beside its board.
const games = ['/falling-blocks/', '/maze-chase/', '/flap/', '/road-hop/', '/snake/', '/brick-bounce/'];
const note = (page) => page.locator('.upright');
const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);

for (const url of games) {
  test(`${url}: turning a phone sideways pauses the game and asks for it upright`, async ({ page }) => {
    await openGame(page, url);
    const upright = page.viewportSize();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.locator('#overlay')).toBeHidden();
    await page.clock.runFor(300);
    await expect(note(page)).toBeHidden();

    await page.setViewportSize({ width: 844, height: 390 });
    if (await touch(page)) {
      await expect(note(page)).toBeVisible();
      await expect(note(page)).toContainText('Turn your phone upright');
      await expect(note(page)).toContainText('only work in portrait mode');
      await expect(page.locator('#ovTitle')).toHaveText('Paused');
      await expectNoSideScroll(page);

      // Turned back, the game waits paused until the player resumes it.
      await page.setViewportSize(upright);
      await expect(note(page)).toBeHidden();
      await page.clock.runFor(1000);
      await expect(page.locator('#ovTitle')).toHaveText('Paused');
      await page.locator('#startBtn').click();   // Resume
      await expect(page.locator('#overlay')).toBeHidden();
    } else {
      // A short window on a computer: no note, and the game goes on.
      await page.clock.runFor(300);
      await expect(note(page)).toBeHidden();
      await expect(page.locator('#overlay')).toBeHidden();
      const board = await page.locator('#board').boundingBox();
      expect(board.y).toBeGreaterThanOrEqual(0);
      expect(board.y + board.height).toBeLessThanOrEqual(390);
      await expectNoSideScroll(page);
    }
  });
}

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

test('only the games ask for the phone upright', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  for (const url of ['/', '/merge-pdf/', '/profile/']) {
    await page.goto(url);
    await expect(note(page), url).toHaveCount(0);
  }
});
