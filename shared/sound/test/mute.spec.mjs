import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture } from '../../../tests/ui/fixture.mjs';
import { listen, heard, press } from '../../../tests/ui/games.mjs';

// sound.js's mute button (#soundBtn) and the M key, on a page of their own:
// the choice is kept, so muting one page mutes every page after it, and
// with no storage the button still mutes for the visit.
const open = (page) => openFixture(page, {
  js: ['/assets/js/sound.js'],
  body: '<button type="button" id="soundBtn" aria-label="Mute sound"></button><button type="button" id="play">Play</button>'
});
const btn = (page) => page.locator('#soundBtn');
// A press that plays the start sound, as a game's Start button does.
const start = (page) => page.locator('#play').click().then(() => page.evaluate(() => window.bdnixSound.play('start')));

test('muting is kept, so the next page is muted too, and M turns it back on', async ({ page }) => {
  await listen(page);
  await open(page);
  await expect(btn(page)).toHaveAttribute('aria-label', 'Mute sound');
  await btn(page).click();
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_sound'))).toBe('off');
  await expect(btn(page)).not.toBeFocused();         // so Space and Enter go to the game, not the button

  // Another page: still muted, and nothing plays.
  await open(page);
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
  await start(page);
  expect(await heard(page)).toEqual([]);

  // M turns it back on (and off again).
  await press(page, 'KeyM');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Mute sound');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_sound'))).toBe('on');
  await start(page);
  expect(await heard(page)).toEqual(['start']);
  await press(page, 'KeyM');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
});

test('without storage, sound is on and the button still mutes it for the visit', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get(){ throw new Error('blocked'); } });
  });
  await listen(page);
  await open(page);
  await expect(btn(page)).toHaveAttribute('aria-label', 'Mute sound');
  await start(page);
  expect(await heard(page)).toEqual(['start']);
  await btn(page).click();
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
  await start(page);
  expect(await heard(page)).toEqual([]);
});
