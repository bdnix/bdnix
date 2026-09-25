// Every UI test gets a page that fails the test on any uncaught JS error,
// and that doesn't fetch Google Fonts (not needed, and keeps tests offline).
// With COVERAGE set, it also records which parts of the site's scripts ran
// (see tests/coverage/ui.mjs).
import { test as base, expect } from '@playwright/test';
import * as coverage from '../coverage/ui.mjs';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    if (coverage.enabled) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    if (coverage.enabled) await coverage.save(await page.coverage.stopJSCoverage());
    expect(errors, 'uncaught errors on the page').toEqual([]);
  }
});

export { expect };

// Fails if the page scrolls sideways (the layout is wider than the screen).
export async function expectNoSideScroll(page){
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(scroll, 'page is wider than the screen').toBeLessThanOrEqual(client);
}
