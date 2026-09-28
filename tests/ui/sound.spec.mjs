import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, listen, heard } from './games.mjs';

// What each game's own sound tests don't cover: the mute button every game
// has in its top bar, and the choice carrying over between games.
const btn = (page) => page.locator('#soundBtn');
const games = ['/falling-blocks/', '/maze-chase/', '/flap/', '/road-hop/', '/snake/'];

test('every game has a mute button, and muting one mutes them all', async ({ page }) => {
  await listen(page);
  await openGame(page, games[0]);
  for (const url of games) {
    await page.goto(url);
    const btn = page.locator('#soundBtn');
    await expect(btn, url).toHaveAttribute('aria-label', 'Mute sound');
    await expect(btn.locator('svg'), url).toBeVisible();
    await expectNoSideScroll(page);
  }

  await btn(page).click();
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_sound'))).toBe('off');
  await expect(btn(page)).not.toBeFocused();         // so Space and Enter go to the game, not the button

  // Still muted after a reload and on every other game, and nothing plays.
  for (const url of games) {
    await page.goto(url);
    await expect(btn(page), url).toHaveAttribute('aria-label', 'Unmute sound');
    await page.getByRole('button', { name: 'Start game' }).click();
    expect(await heard(page), url).toEqual([]);
  }

  // M turns it back on (and off again).
  await press(page, 'KeyM');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Mute sound');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_sound'))).toBe('on');
  await press(page, 'KeyP');                           // Snake is on "Get ready": pause it
  await page.getByRole('button', { name: 'New game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await press(page, 'KeyM');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
});

test('the games play without storage, with sound on', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get(){ throw new Error('blocked'); } });
  });
  await listen(page);
  await openGame(page, '/snake/');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Mute sound');
  await page.getByRole('button', { name: 'Start game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await btn(page).click();                             // mutes for this visit, just can't remember it
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
});

test('on a phone held sideways the top bar still fits beside the board', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  for (const url of games) {
    await page.goto(url);
    const fits = await page.evaluate(() => {
      const word = document.querySelector('.wordmark').getBoundingClientRect();
      const sound = document.getElementById('soundBtn').getBoundingClientRect();
      return word.height < 30 && word.right <= sound.left;
    });
    expect(fits, url).toBe(true);
    await expectNoSideScroll(page);
  }
});
