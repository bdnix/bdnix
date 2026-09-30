import { test, expect } from './fixtures.mjs';
import { openGame, press } from './games.mjs';

// Every game's pause button (gamebar.js) shows pause while it runs, and play
// with the label "Resume" while it's paused.
const games = ['/falling-blocks/', '/maze-chase/', '/flap/', '/road-hop/', '/snake/', '/brick-bounce/'];
const PAUSE = 'M4 2h3v12H4zM9 2h3v12H9z';
const icon = (page) => page.locator('#pauseBtn svg path').getAttribute('d');

for (const url of games) {
  test(`${url}: the pause button follows the game`, async ({ page }) => {
    await openGame(page, url);
    const btn = page.locator('#pauseBtn');
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(btn).toHaveAttribute('aria-label', 'Pause');
    expect(await icon(page)).toBe(PAUSE);

    await press(page, 'KeyP');
    await expect(page.locator('#ovTitle')).toHaveText('Paused');
    await expect(btn).toHaveAttribute('aria-label', 'Resume');
    expect(await icon(page)).not.toBe(PAUSE);

    await btn.click();
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(btn).toHaveAttribute('aria-label', 'Pause');
    expect(await icon(page)).toBe(PAUSE);
  });
}
