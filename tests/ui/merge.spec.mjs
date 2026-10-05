import { test, expect, expectNewWindow, expectNoSideScroll } from './fixtures.mjs';
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

test('the download button stays hidden until something is merged', async ({ page }) => {
  await expect(page.locator('#downloadBtn')).toBeHidden();
});

test('merges in the chosen order, with page ranges', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  await expect(page.locator('#msg')).toHaveText('Done. 10 pages from 3 files.');
  await expectNewWindow(page.locator('#downloadBtn'));
  await expect(page.locator('#downloadBtn')).toHaveAttribute('download', 'merged.pdf');
  const out = await download(page, () => page.locator('#downloadBtn').click());
  expect(out.name).toBe('merged.pdf');
  expect(widths(out.doc)).toEqual([203, 202, 201, 101, 102, 103, 109, 110, 105, 301]);
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

test('changing the list after merging hides the old download', async ({ page }) => {
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  await expect(page.locator('#downloadBtn')).toBeVisible();
  await page.locator('.file').first().locator('.file-range input').fill('1');
  await expect(page.locator('#downloadBtn')).toBeHidden();
});

// Each preview page's canvas, as its label and its width over its height.
const previewPages = (page) => page.locator('#previewGrid canvas').evaluateAll((cs) => cs.map((c) => ({
  label: c.getAttribute('aria-label'),
  ratio: c.width / c.height,
  drawn: c.closest('.preview-page').classList.contains('drawn')
})));

test('merging shows a preview of every page, in order', async ({ page }) => {
  await expect(page.locator('#preview')).toBeHidden();
  await page.locator('.file').first().locator('.file-range input').fill('2, 10');
  await page.locator('.file').nth(1).locator('.file-range input').fill('3');
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  await expect(page.locator('#msg')).toHaveText('Done. 4 pages from 3 files.');
  await expect(page.getByRole('heading', { name: 'Preview of merged.pdf' })).toBeVisible();
  await expect(page.locator('#previewGrid .drawn')).toHaveCount(4);
  await expect(page.locator('#previewNote')).toHaveText('');
  // Pages are (width) x 300: A2 = 102, A10 = 110, B3 = 203, C1 = 301.
  // Canvases are whole pixels, so the shapes match to within rounding.
  const shown = await previewPages(page);
  expect(shown.map((p) => p.label)).toEqual([1, 2, 3, 4].map((n) => `Page ${n} of merged.pdf`));
  expect(shown.every((p) => p.drawn)).toBe(true);
  [102, 110, 203, 301].forEach((w, i) => expect(shown[i].ratio).toBeCloseTo(w / 300, 2));
  // Drawn as the page, not left blank.
  const ink = await page.locator('#previewGrid canvas').first().evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    return d[3];
  });
  expect(ink).toBe(255);
  await expectNoSideScroll(page);
});

test('changing the list after merging removes the preview', async ({ page }) => {
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  await expect(page.locator('#previewGrid .drawn')).toHaveCount(14);
  await page.getByRole('button', { name: 'Remove C.pdf' }).click();
  await expect(page.locator('#preview')).toBeHidden();
  await expect(page.locator('#previewGrid canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  await expect(page.locator('#previewGrid .drawn')).toHaveCount(13);
});

test('without pdf.js, the preview says so and the download still works', async ({ page }) => {
  await page.route(/\/assets\/vendor\/pdfjs\//, (route) => route.abort());
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  await expect(page.locator('#previewNote')).toHaveText('The pages can’t be shown in this browser, but the merged file is ready to download.');
  await expect(page.locator('#previewGrid canvas')).toHaveCount(0);
  const out = await download(page, () => page.locator('#downloadBtn').click());
  expect(widths(out.doc)).toHaveLength(14);
});
