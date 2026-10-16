import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture } from '../../../tests/ui/fixture.mjs';
import { inNewWindow } from '../../../tests/ui/downloads.mjs';

// files.js's downloads, on a page of their own: each file downloads in a new
// window, which says what's happening, and falls back to saving from the page
// when there's no window. (Each tool tries its own download links.)

// A small file to offer, made in the page.
const makeFile = (page) => page.evaluate(() => URL.createObjectURL(new Blob(['hello'], { type: 'text/plain' })));

test.beforeEach(async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css'], js: ['/assets/js/lang.js', '/assets/js/files.js'], body: '<main><h1>A tool</h1></main>' });
});

test('a download link opens a new window, which names the file and downloads it', async ({ page }) => {
  const url = await makeFile(page);
  await page.evaluate((url) => {
    const a = window.bdnixFiles.offer(document.createElement('a'), url, 'notes.txt');
    a.id = 'link';
    a.textContent = 'Download';
    document.body.appendChild(a);
  }, url);
  const link = page.locator('#link');
  await expect(link).toHaveAttribute('download', 'notes.txt');
  await expect(link).toHaveAttribute('target', '_blank');
  const { download: dl, popup } = await inNewWindow(page, () => link.click());
  expect(dl.suggestedFilename()).toBe('notes.txt');
  await expect(popup).toHaveTitle('notes.txt · bdnix');
  await expect(popup.locator('.lede')).toHaveText('Your download has started. If it didn’t, use the button below. You can close this tab once the file is saved.');
  // The page there links the same styles, and its button downloads the file again.
  const sheets = (p) => p.locator('link[rel="stylesheet"]').evaluateAll((ls) => ls.map((l) => l.href));
  expect(await sheets(popup)).toEqual(await sheets(page));
  const [again] = await Promise.all([popup.waitForEvent('download'), popup.getByRole('link', { name: 'Download notes.txt' }).click()]);
  expect(again.suggestedFilename()).toBe('notes.txt');
  await expect(page.locator('h1')).toHaveText('A tool');
});

test('the new window is styled like the site', async ({ page }) => {
  // Playwright holds back a new window's requests while the page has routes
  // (the fixture's, which keep Google Analytics out), so drop them: on this
  // test server the site doesn't load Analytics anyway.
  await page.unrouteAll();
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => { window.bdnixFiles.fileWindow(); })]);
  await expect.poll(() => popup.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^Inter/);
  expect(await popup.evaluate(() => document.compatMode)).toBe('CSS1Compat');
  await expect(popup.locator('html')).toHaveAttribute('lang', 'en');
});

test('a link whose file has gone does nothing', async ({ page }) => {
  await page.evaluate(() => {
    const a = window.bdnixFiles.offer(document.createElement('a'), 'blob:x', 'x.txt');
    a.id = 'gone';
    a.textContent = 'x';
    a.removeAttribute('href');
    document.body.appendChild(a);
  });
  let opened = false;
  page.on('popup', () => { opened = true; });
  await page.locator('#gone').click();
  await expect(page.locator('#gone')).toBeVisible();
  expect(opened).toBe(false);
});

test('when the browser blocks new windows, the link saves the file from the page', async ({ page }) => {
  const url = await makeFile(page);
  await page.evaluate((url) => {
    window.open = () => null;
    const a = window.bdnixFiles.offer(document.createElement('a'), url, 'notes.txt');
    a.id = 'link';
    a.textContent = 'Download';
    document.body.appendChild(a);
  }, url);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#link').click()]);
  expect(dl.suggestedFilename()).toBe('notes.txt');
});

test('a file still being made: the window says so, then downloads it', async ({ page }) => {
  const url = await makeFile(page);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => { window.pending = window.bdnixFiles.fileWindow(); })
  ]);
  await expect(popup.locator('h1')).toHaveText('Preparing your file…');
  await expect(popup.locator('.lede')).toHaveText('It downloads here as soon as it’s ready. Keep the other tab open until then.');
  await expect(popup).toHaveTitle('Preparing your file · bdnix');
  await expect(popup.locator('a')).toHaveCount(0);

  const [dl] = await Promise.all([popup.waitForEvent('download'), page.evaluate((url) => window.pending.save(url, 'notes.txt'), url)]);
  expect(dl.suggestedFilename()).toBe('notes.txt');
  await expect(popup.locator('h1')).toHaveText('notes.txt');
  // Its stylesheets are only added once.
  expect(await popup.locator('link[rel="stylesheet"]').count()).toBe(await page.locator('link[rel="stylesheet"]').count());
});

test('a file that can\'t be made closes its window', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => { window.pending = window.bdnixFiles.fileWindow(); })
  ]);
  await page.evaluate(() => window.pending.close());
  await expect.poll(() => popup.isClosed()).toBe(true);
  // Closing again is harmless.
  await page.evaluate(() => window.pending.close());
});

test('with no window, or one the visitor closed, the file saves from the page', async ({ page }) => {
  const url = await makeFile(page);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => { window.pending = window.bdnixFiles.fileWindow(); })
  ]);
  await popup.close();
  let [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate((url) => window.pending.save(url, 'one.txt'), url)]);
  expect(dl.suggestedFilename()).toBe('one.txt');

  await page.evaluate(() => {
    window.open = () => { throw new Error('blocked'); };
    window.pending = window.bdnixFiles.fileWindow();
    window.pending.close();
  });
  [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate((url) => window.pending.save(url, 'two.txt'), url)]);
  expect(dl.suggestedFilename()).toBe('two.txt');
});
