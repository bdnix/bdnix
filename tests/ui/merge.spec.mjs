import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { upload, numberedPdf, download, widths } from './pdfs.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/merge-pdf/');
  // Page widths encode file and page: A = 101..110, B = 201..203, C = 301.
  await page.locator('#picker').setInputFiles([
    upload('A.pdf', await numberedPdf(100, 10)),
    upload('B.pdf', await numberedPdf(200, 3)),
    upload('notes.txt', 'hello', 'text/plain'),
    upload('broken.pdf', '%PDF-garbage')
  ]);
  // Files added while others are still being read are ignored, so wait.
  await expect(page.locator('.file')).toHaveCount(2);
  await page.locator('#picker').setInputFiles([upload('C.pdf', await numberedPdf(300, 1))]);
  await expect(page.locator('.file')).toHaveCount(3);
});

test('skips files that are not readable PDFs', async ({ page }) => {
  // The second upload clears the first message, so check the list instead.
  await expect(page.locator('.file-name')).toHaveText(['A.pdf', 'B.pdf', 'C.pdf']);
  await expect(page.locator('#summary')).toHaveText('3 files · 14 pages selected');
});

test('there is one button, and no download link waiting to be clicked', async ({ page }) => {
  await expect(page.locator('.actions').getByRole('button')).toHaveText(['Merge PDFs']);
  await expect(page.locator('.actions a')).toHaveCount(0);
});

// Merging opens a new window straight away, and merged.pdf downloads there
// once it's made.
async function merge(page){
  const out = await download(page, () => page.getByRole('button', { name: 'Merge PDFs' }).click());
  expect(out.name).toBe('merged.pdf');
  return out;
}

test('merges in the chosen order, with page ranges, and saves the file', async ({ page }) => {
  const range = (i) => page.locator('.file').nth(i).locator('.file-range input');
  await range(0).fill('1-3, 9-, 5');
  await range(1).fill('3-1');
  await expect(page.locator('#summary')).toHaveText('3 files · 10 pages selected');
  // The size varies by a byte or two, since pdf-lib dates each file it makes.
  await expect(page.locator('.file-meta').first()).toHaveText(/^6 of 10 pages · \d+ B$/);

  // Move B to the top; its range goes with it.
  await page.locator('.file').nth(1).getByRole('button', { name: 'Move B.pdf up' }).click();
  await expect(page.locator('.file-name')).toHaveText(['B.pdf', 'A.pdf', 'C.pdf']);
  await expect(range(0)).toHaveValue('3-1');

  const out = await merge(page);
  expect(out.name).toBe('merged.pdf');
  expect(widths(out.doc)).toEqual([203, 202, 201, 101, 102, 103, 109, 110, 105, 301]);
  await expect(page.locator('#msg')).toHaveText(/^Saved merged\.pdf: 10 pages from 3 files, \d+ B\.$/);
  await expect(page.getByRole('button', { name: 'Merge PDFs' })).toBeEnabled();
});

test('an invalid range is explained and blocks merging', async ({ page }) => {
  const input = page.locator('.file').first().locator('.file-range input');
  await input.fill('1-3, 12');
  await expect(page.locator('.file-meta').first()).toHaveText('No page 12 (this file has 10 pages)');
  await expect(page.getByRole('button', { name: 'Merge PDFs' })).toBeDisabled();
  await input.fill('abc');
  await expect(page.locator('.file-meta').first()).toHaveText('“abc” isn’t a page or range');
  await input.fill('');
  await expect(page.getByRole('button', { name: 'Merge PDFs' })).toBeEnabled();
});

test('removing a file and clearing the list', async ({ page }) => {
  await page.getByRole('button', { name: 'Remove B.pdf' }).click();
  await expect(page.locator('.file-name')).toHaveText(['A.pdf', 'C.pdf']);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('.file')).toHaveCount(0);
  await expect(page.locator('#filesWrap')).toBeHidden();
});

// ---- Preview ----
// The merged file shows one page at a time; page widths say which page it is.
const canvas = (page) => page.locator('#pageCanvas');
const shownRatio = (page) => canvas(page).evaluate((c) => c.width / c.height);
async function expectShowing(page, n, of, width){
  await expect(page.locator('#pageLabel')).toHaveText(`Page ${n} of ${of}`);
  await expect(canvas(page)).toHaveAttribute('aria-label', `Page ${n} of ${of} of the merged PDF`);
  await expect(canvas(page)).toBeVisible();
  await expect(page.locator('#previewNote')).toBeHidden();
  // Canvases are whole pixels, so the shape matches to within rounding.
  await expect.poll(() => shownRatio(page)).toBeCloseTo(width / 300, 2);
}

test('the preview shows the merged file a page at a time, before anything is saved', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Preview of merged.pdf' })).toBeVisible();
  await expectShowing(page, 1, 14, 101);
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expectShowing(page, 2, 14, 102);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expectShowing(page, 1, 14, 101);
  // Drawn as the page, not left blank: the page is opaque white.
  const px = await canvas(page).evaluate((c) => Array.from(c.getContext('2d').getImageData(1, 1, 1, 1).data));
  expect(px).toEqual([255, 255, 255, 255]);
  // Only one page is shown, never a strip of thumbnails.
  await expect(page.locator('#preview canvas')).toHaveCount(1);
  await expectNoSideScroll(page);
});

test('the preview follows the order and the page ranges', async ({ page }) => {
  await expectShowing(page, 1, 14, 101);
  await page.locator('.file').nth(1).locator('.file-range input').fill('3');
  await page.getByRole('button', { name: 'Move B.pdf up' }).click();
  await expectShowing(page, 1, 12, 203);

  // Go to the last page, then shorten the file: it stays on what's now the last page.
  for (let i = 1; i < 12; i++) await page.getByRole('button', { name: 'Next page' }).click();
  await expectShowing(page, 12, 12, 301);
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.locator('.file').nth(1).locator('.file-range input').fill('10');
  await expectShowing(page, 3, 3, 301);

  await page.getByRole('button', { name: 'Remove C.pdf' }).click();
  await expectShowing(page, 2, 2, 110);
});

test('an invalid range pauses the preview until it is fixed', async ({ page }) => {
  await expectShowing(page, 1, 14, 101);
  const input = page.locator('.file').first().locator('.file-range input');
  await input.fill('12');
  await expect(page.locator('#previewNote')).toHaveText('Fix the page ranges marked in red to see the preview.');
  await expect(canvas(page)).toBeHidden();
  await expect(page.locator('#pageLabel')).toHaveText('');
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await input.fill('4');
  await expectShowing(page, 1, 5, 104);
});

test('clearing the list hides the preview, and adding files brings it back', async ({ page }) => {
  await expectShowing(page, 1, 14, 101);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('#preview')).toBeHidden();
  await page.locator('#picker').setInputFiles([upload('D.pdf', await numberedPdf(400, 2))]);
  await expectShowing(page, 1, 2, 401);
});

test('without pdf.js, the preview says so and merging still works', async ({ page }) => {
  // The page in beforeEach already fetched pdf.js, so start again offline.
  await page.route(/\/assets\/vendor\/pdfjs\//, (route) => route.abort());
  await page.goto('/merge-pdf/');
  await page.locator('#picker').setInputFiles([upload('A.pdf', await numberedPdf(100, 3))]);
  await expect(page.locator('#previewNote')).toHaveText('The preview can’t be shown in this browser, but you can still merge your files.');
  await expect(canvas(page)).toBeHidden();
  const out = await merge(page);
  expect(widths(out.doc)).toEqual([101, 102, 103]);
});

test('a merge that fails closes the window it opened, and says why', async ({ page }) => {
  await page.evaluate(() => { window.PDFLib.PDFDocument.prototype.save = () => Promise.reject(new Error('out of memory')); });
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Merge PDFs' }).click()]);
  await expect(page.locator('#msg')).toHaveText('Something went wrong while merging: out of memory');
  await expect.poll(() => popup.isClosed()).toBe(true);
});
