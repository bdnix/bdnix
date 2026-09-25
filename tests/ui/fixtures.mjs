// Every UI test gets a page that fails the test on any uncaught JS error,
// and that doesn't fetch Google Fonts (not needed, and keeps tests offline).
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    await use(page);
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
