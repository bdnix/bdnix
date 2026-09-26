import { test, expect } from './fixtures.mjs';

const pages = ['/', '/tetris/', '/pacman/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/mp4-to-mp3/', '/compress-image/', '/profile/'];

test('every page includes Google Analytics, which stays off away from the live site', async ({ page }) => {
  const google = [];
  page.on('request', (r) => { if (/googletagmanager|google-analytics/.test(r.url())) google.push(r.url()); });
  for (const url of pages) {
    await page.goto(url);
    await expect(page.locator('head script[src^="/assets/js/analytics.js"]'), url).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.bdnixAnalytics && window.bdnixAnalytics.id), url).toBe('G-67D1H8GX6X');
    expect(await page.evaluate(() => [typeof window.gtag, typeof window.dataLayer]), url).toEqual(['undefined', 'undefined']);
  }
  expect(google).toEqual([]);
});
