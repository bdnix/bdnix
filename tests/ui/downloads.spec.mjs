import { test, expect } from './fixtures.mjs';
import { inNewWindow } from './downloads.mjs';
import { upload, samplePdf, lockedPdf, download } from './pdfs.mjs';

// What every tool's downloads share (bdnixFiles in files.js), tried on the
// unlock tool and directly: each file downloads in a new window.

// A small file to offer, made in the page.
const makeFile = (page) => page.evaluate(() => URL.createObjectURL(new Blob(['hello'], { type: 'text/plain' })));

test.beforeEach(async ({ page }) => {
  await page.goto('/unlock-pdf/');
});

test('a download link opens a new window, which names the file and downloads it', async ({ page }) => {
  await page.locator('#picker').setInputFiles([upload('report.pdf', await lockedPdf(await samplePdf(), { user: 'pw' }))]);
  await page.getByLabel('Password', { exact: true }).fill('pw');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  const link = page.locator('#downloadBtn');
  await expect(link).toHaveAttribute('download', 'report-unlocked.pdf');
  await expect(link).toHaveAttribute('target', '_blank');

  const { download: dl, popup } = await inNewWindow(page, () => link.click());
  expect(dl.suggestedFilename()).toBe('report-unlocked.pdf');
  await expect(popup).toHaveTitle('report-unlocked.pdf · bdnix');
  await expect(popup.locator('.lede')).toHaveText('Your download has started. If it didn’t, use the button below. You can close this tab once the file is saved.');
  // The page there links the site's styles (checked in use below), and its
  // button downloads the file again.
  const sheets = (p) => p.locator('link[rel="stylesheet"]').evaluateAll((ls) => ls.map((l) => l.href));
  expect(await sheets(popup)).toEqual(await sheets(page));
  const [again] = await Promise.all([popup.waitForEvent('download'), popup.getByRole('link', { name: 'Download report-unlocked.pdf' }).click()]);
  expect(again.suggestedFilename()).toBe('report-unlocked.pdf');
  // The tool is still there, with its result.
  await expect(page.locator('#msg')).toHaveText('Done. The new copy opens without a password.');

  // A second click opens another window.
  const second = await download(page, () => link.click());
  expect(second.name).toBe('report-unlocked.pdf');
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
