import { test, expect } from './fixtures.mjs';
import { checkPage } from './checks.mjs';
import { checkPdfLib, PDF_LIB, OFFLINE_PDF } from './checks-pdf.mjs';
import { upload, logoPng } from './pdfs.mjs';

// The checks every page and every PDF tool gets (see checks.mjs and checks-pdf.mjs).
checkPage('/watermark-pdf/', { schema: 'WebApplication', category: 'UtilitiesApplication', footer: true });
// pdf-lib is fetched with the first PDF: what shows once A.pdf is open.
checkPdfLib('/watermark-pdf/', (page) => expect(page.locator('#fileName')).toHaveText('A.pdf'));

test('/watermark-pdf/: an image chosen first fetches pdf-lib, and says so when it can\'t', async ({ page }) => {
  await page.route(PDF_LIB, (route) => route.abort());
  await page.goto('/watermark-pdf/');
  await page.locator('#imagePicker').setInputFiles(upload('logo.png', logoPng(), 'image/png'));
  await expect(page.locator('#msg')).toHaveText(OFFLINE_PDF);
  await page.unroute(PDF_LIB);
  await page.locator('#imagePicker').setInputFiles(upload('logo.png', logoPng(), 'image/png'));
  await expect(page.locator('#imageName')).toHaveText('logo.png');
  expect(await page.evaluate(() => typeof window.PDFLib)).toBe('object');
});
