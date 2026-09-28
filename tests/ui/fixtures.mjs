// Every UI test gets a page that fails the test on any uncaught JS error,
// and that doesn't fetch Google Fonts or Google Analytics (not needed, and
// keeps tests offline).
// With COVERAGE set, it also records which parts of the site's scripts ran
// (see tests/coverage/ui.mjs).
// Every request to the test server says which spec made it, so the UI result
// cache (scripts/ui-cache.mjs) knows which files each spec depends on.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import * as coverage from '../coverage/ui.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    const spec = path.relative(root, testInfo.file).split(path.sep).join('/');
    await use({ ...extraHTTPHeaders, 'x-bdnix-spec': spec });
  },
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    await page.route(/^https:\/\/([\w-]+\.)*(googletagmanager|google-analytics)\.com\//, (route) => route.abort());
    if (coverage.enabled) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    if (coverage.enabled) await coverage.save(testInfo.file, await page.coverage.stopJSCoverage());
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
