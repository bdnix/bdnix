import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style } from '../../../tests/ui/fixture.mjs';

// icon-btn.css: a square button with an icon, on a page of its own.
test('an icon button is a 40px square with a 16px icon in its middle', async ({ page }) => {
  await openFixture(page, {
    css: ['/assets/css/base.css', '/assets/css/icon-btn.css'],
    body: '<button class="icon-btn" type="button" aria-label="Mute"><svg viewBox="0 0 16 16"><rect width="16" height="16"/></svg></button>'
  });
  const btn = await page.locator('.icon-btn').boundingBox();
  const icon = await page.locator('.icon-btn svg').boundingBox();
  expect([btn.width, btn.height]).toEqual([40, 40]);
  expect([icon.width, icon.height]).toEqual([16, 16]);
  expect(icon.x - btn.x).toBeCloseTo(12, 0);
  expect(icon.y - btn.y).toBeCloseTo(12, 0);
  expect(await style(page, '.icon-btn', 'border-radius')).toBe('10px');
});
