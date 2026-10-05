// The checks every PDF tool gets: pdf-lib fetched on demand. Each PDF tool
// calls checkPdfLib() from its own tests/ui/<app>.site.spec.mjs, beside
// checkPage() from checks.mjs.
import { test, expect } from './fixtures.mjs';
import { upload, numberedPdf } from './pdfs.mjs';
import { watch } from './checks.mjs';

export const PDF_LIB = /\/assets\/vendor\/pdf-lib\.min\.js/;
export const OFFLINE_PDF = 'Couldn’t load the PDF tools. Check your connection and try again.';

// The checks every PDF tool gets: pdf-lib isn't part of the page, but is
// fetched with the first PDF opened, and a failed fetch says so and is tried
// again next time. isOpen(page) waits for what shows once A.pdf is open.
export function checkPdfLib(url, isOpen){
  const pdf = async () => upload('A.pdf', await numberedPdf(100, 2));
  test(`${url}: pdf-lib is fetched with the first PDF`, async ({ page }) => {
    const seen = watch(page, PDF_LIB);
    await page.goto(url);
    expect(await page.evaluate(() => typeof window.PDFLib)).toBe('undefined');
    expect(seen).toEqual([]);
    await page.locator('#picker').setInputFiles([await pdf()]);
    await isOpen(page);
    expect(seen).toEqual([expect.stringContaining('/assets/vendor/pdf-lib.min.js?v=1.17.1')]);
  });

  test(`${url}: says so when pdf-lib can't be fetched, and tries again`, async ({ page }) => {
    await page.route(PDF_LIB, (route) => route.abort());
    await page.goto(url);
    await page.locator('#picker').setInputFiles([await pdf()]);
    await expect(page.locator('#msg')).toHaveText(OFFLINE_PDF);
    await expect(page.locator('script[src*="pdf-lib"]')).toHaveCount(0);   // the failed tag is gone
    await page.unroute(PDF_LIB);
    await page.locator('#picker').setInputFiles([await pdf()]);
    await isOpen(page);
  });
}
