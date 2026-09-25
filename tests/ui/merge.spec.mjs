import { test, expect } from './fixtures.mjs';
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
