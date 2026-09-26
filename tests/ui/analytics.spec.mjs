import { test, expect, expectNoSideScroll } from './fixtures.mjs';

const pages = ['/', '/tetris/', '/pacman/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/mp4-to-mp3/', '/compress-image/', '/profile/'];
const LIVE = 'https://www.bdnix.com';
const TAG = 'https://www.googletagmanager.com/gtag/js?id=G-67D1H8GX6X';

// Records every request to Google (the fixture aborts them, so nothing is sent).
function watchGoogle(page){
  const urls = [];
  page.on('request', (r) => { if (/googletagmanager|google-analytics/.test(r.url())) urls.push(r.url()); });
  return urls;
}

// Serves the local site as www.bdnix.com, so analytics.js treats it as live.
async function serveLive(page){
  const local = test.info().project.use.baseURL;
  await page.route(/^https:\/\/www\.bdnix\.com\//, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(LIVE, local) });
    await route.fulfill({ response });
  });
}

test('every page includes Google Analytics, which stays off away from the live site', async ({ page }) => {
  const google = watchGoogle(page);
  for (const url of pages) {
    await page.goto(url);
    await expect(page.locator('head script[src^="/assets/js/analytics.js"]'), url).toHaveCount(1);
    expect(await page.evaluate(() => [window.bdnixAnalytics.id, window.bdnixAnalytics.live]), url).toEqual(['G-67D1H8GX6X', false]);
    expect(await page.evaluate(() => [typeof window.gtag, typeof window.dataLayer]), url).toEqual(['undefined', 'undefined']);
    await expect(page.locator('.consent'), url).toHaveCount(0);
  }
  expect(google).toEqual([]);
});

test('on the live site every page asks first, and loads nothing until asked', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  for (const url of pages) {
    await page.goto(LIVE + url);
    const banner = page.getByRole('region', { name: 'Cookie consent' });
    await expect(banner, url).toBeVisible();
    await expect(banner).toContainText('Google Analytics cookies');
    await expect(banner.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Decline' })).toBeVisible();
    await expect(banner.getByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/profile/');
    await expectNoSideScroll(page);
    expect(await page.evaluate(() => typeof window.gtag), url).toBe('undefined');
  }
  expect(google).toEqual([]);
});

test('declining hides the banner for good and never loads Google\'s script', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await page.goto(LIVE + '/merge-pdf/');
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bdnix_analytics'))).toBe('denied');

  await page.goto(LIVE + '/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
  expect(google).toEqual([]);
});

test('accepting loads Google Analytics straight away, and on every page after', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await page.goto(LIVE + '/');
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect.poll(() => google).toEqual([TAG]);
  const config = await page.evaluate(() => Array.prototype.slice.call(window.dataLayer[1]));
  expect(config).toEqual(['config', 'G-67D1H8GX6X']);

  await page.goto(LIVE + '/tetris/');
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect.poll(() => google).toEqual([TAG, TAG]);
});

test('the profile page turns analytics on and off', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await page.goto(LIVE + '/profile/');
  const state = page.locator('#analyticsState');
  const toggle = page.locator('#analyticsBtn');
  await expect(state).toHaveText(/^Off\./);
  await expect(toggle).toHaveText('Turn on');
  await expectNoSideScroll(page);

  // Choosing here answers the banner too.
  await toggle.click();
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect(state).toHaveText(/^On\./);
  await expect(toggle).toHaveText('Turn off');
  await expect(page.locator('#msg')).toHaveText('Analytics cookies turned on. Thanks!');
  await expect.poll(() => google).toEqual([TAG]);

  await toggle.click();
  await expect(state).toHaveText(/^Off\./);
  await expect(page.locator('#msg')).toHaveText('Analytics cookies turned off.');
  const last = await page.evaluate(() => Array.prototype.slice.call(window.dataLayer[window.dataLayer.length - 1]));
  expect(last).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);

  await page.reload();
  await expect(state).toHaveText(/^Off\./);
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(google).toEqual([TAG]);
});

test('answering the banner on the profile page updates the setting there', async ({ page }) => {
  await serveLive(page);
  await page.goto(LIVE + '/profile/');
  await expect(page.locator('#analyticsBtn')).toHaveText('Turn on');
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('#analyticsState')).toHaveText(/^On\./);
  await expect(page.locator('#analyticsBtn')).toHaveText('Turn off');
});
