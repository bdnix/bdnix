import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// profile-chip.css: the visitor's name in a pill in the top bar, on a page
// of its own.
const chip = (name) => '<header class="bar"><a class="profile-chip" href="/profile/" aria-label="Your profile"><span class="avatar">U</span><span>' + name + '</span></a></header>';

test('the chip is a pill, and a long name is cut short to fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/avatar.css', '/assets/css/profile-chip.css'], body: chip('A name much too long to fit in the top bar of a phone') });
  expect(await style(page, '.profile-chip', 'border-radius')).toBe('999px');
  expect(await style(page, '.profile-chip span:last-child', 'text-overflow')).toBe('ellipsis');
  const box = await page.locator('.profile-chip').boundingBox();
  expect(box.width).toBeLessThanOrEqual(390 * 0.5 + 1);
  await fitsScreen(page);
});
