import { test, expect } from './fixtures.mjs';
import { LIVE, GA, TAG, watchGoogle, serveLive } from './checks.mjs';

// Google Analytics (analytics.js) only runs on the live site, and only once
// the visitor accepts. checkPage (checks.mjs) checks every page links it,
// keeps it off locally and asks first on the live site; this checks what
// answering does, here and on the next page. The profile page's own switch is
// in profile.spec.mjs.
test('declining hides the banner for good and never loads Google\'s script', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await page.goto(LIVE + '/merge-pdf/');
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bdnix_analytics'))).toBe('denied');

  await page.goto(LIVE + '/snake/');
  await expect(page.locator('#ovTitle')).toBeVisible();
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
  expect(google).toEqual([]);
});

test('accepting loads Google Analytics straight away, and on every page after', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await page.goto(LIVE + '/merge-pdf/');
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect.poll(() => google).toEqual([TAG]);
  const config = await page.evaluate(() => Array.prototype.slice.call(window.dataLayer[1]));
  expect(config).toEqual(['config', GA]);

  await page.goto(LIVE + '/snake/');
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect.poll(() => google).toEqual([TAG, TAG]);
});
