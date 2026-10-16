// Every UI test gets a page that fails the test on any uncaught JS error or
// anything the content security policy blocks, and that doesn't fetch Google
// Analytics (not needed, and keeps tests offline).
// With UI_COVERAGE set to a folder, it also writes which parts of the site's
// scripts ran there, raw as Chromium reports them: one file per test, in a
// folder per spec (tests/coverage/ui.mjs merges them).
// Every request to the test server says which spec made it, so the UI result
// cache (scripts/ui-cache.mjs) knows what each spec was served.
// Every spec runs on this file, so a change to it reruns every spec: it
// imports nothing of the repository's, and is kept small.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const COVERAGE = process.env.UI_COVERAGE;
// The site's own scripts, as pages load them (not vendored libraries).
const OWN = /\/assets\/js\/[\w-]+\.js(?:\?|$)/;

// The folder a spec's raw coverage goes in: apps/snake/test/page.spec.mjs → apps~snake~test~page.spec.mjs
export const coverageFolder = (spec) => spec.replace(/\//g, '~');

// The spec file a test belongs to: the one Playwright ran, even for a test
// declared in a helper it calls (such as checkPage in checks.mjs), whose
// testInfo.file is the helper. Its title path starts with the spec's path.
export function specFile(testInfo){
  return path.join(testInfo.project.testDir, testInfo.titlePath[0]);
}

export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    const spec = path.relative(root, specFile(testInfo)).split(path.sep).join('/');
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
    if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    if (COVERAGE) {
      const own = (await page.coverage.stopJSCoverage()).filter((e) => OWN.test(e.url));
      if (own.length) {
        const dir = path.join(COVERAGE, coverageFolder(path.relative(root, specFile(testInfo)).split(path.sep).join('/')));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${testInfo.testId}-${testInfo.retry}.json`), JSON.stringify(own));
      }
    }
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

// Fails if the page scrolls sideways (the layout is wider than the screen).
export async function expectNoSideScroll(page){
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(scroll, 'page is wider than the screen').toBeLessThanOrEqual(client);
}
