import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture } from '../../../tests/ui/fixture.mjs';
import { LIVE, GA, TAG, watchGoogle, serveLive } from '../../../tests/ui/checks.mjs';

// analytics.js only runs on the live site, and only once the visitor
// accepts. checkPage (checks.mjs) checks every page links it, keeps it off
// locally and asks first on the live site; this checks what answering does,
// here and on the next page, on a page of its own served as www.bdnix.com.
const open = (page) => openFixture(page, {
  origin: LIVE,
  css: ['/assets/css/base.css'],
  js: ['/assets/js/lang.js', '/assets/js/analytics.js'],
  body: '<main><h1>A page</h1></main>'
});

test('declining hides the banner for good and never loads Google\'s script', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await open(page);
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bdnix_analytics'))).toBe('denied');

  await open(page);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
  expect(google).toEqual([]);
});

test('accepting loads Google Analytics straight away, and on every page after', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await open(page);
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect.poll(() => google).toEqual([TAG]);
  const config = await page.evaluate(() => Array.prototype.slice.call(window.dataLayer[1]));
  expect(config).toEqual(['config', GA]);

  await open(page);
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect.poll(() => google).toEqual([TAG, TAG]);
});
