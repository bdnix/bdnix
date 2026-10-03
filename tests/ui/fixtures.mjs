// Every UI test gets a page that fails the test on any uncaught JS error or
// anything the content security policy blocks, and that doesn't fetch Google
// Analytics (not needed, and keeps tests offline).
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
    // Anything the page's content security policy blocks fails the test too,
    // unless the test takes it with takeCspViolations().
    const blocked = [];
    violations.set(page, blocked);
    page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/.test(m.text())) blocked.push(m.text()); });
    await page.route(/^https:\/\/([\w-]+\.)*(googletagmanager|google-analytics)\.com\//, (route) => route.abort());
    if (coverage.enabled) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    if (coverage.enabled) await coverage.save(testInfo.file, await page.coverage.stopJSCoverage());
    expect(errors, 'uncaught errors on the page').toEqual([]);
    expect(blocked, 'blocked by the content security policy').toEqual([]);
  }
});

const violations = new WeakMap();
// What the content security policy has blocked on the page so far, for a
// test that expects it to block something. Clears the list.
export function takeCspViolations(page){
  return violations.get(page).splice(0);
}

export { expect };

// Every download link opens in a new window (bdnixFiles.offer in files.js),
// so a browser that shows a PDF or image rather than saving it leaves the
// tool, and the work in it, where it was.
export async function expectNewWindow(link){
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
}

// Fails if the page scrolls sideways (the layout is wider than the screen).
export async function expectNoSideScroll(page){
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(scroll, 'page is wider than the screen').toBeLessThanOrEqual(client);
}
