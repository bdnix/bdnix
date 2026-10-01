import { test, expect } from './fixtures.mjs';
import { upload, numberedPdf, logoPng } from './pdfs.mjs';
import { flacMp4, tone } from './media.mjs';

// The big libraries (pdf-lib, lamejs) aren't part of the page: each is
// fetched the first time a tool needs it, and a failed fetch says so and is
// tried again next time.
const PDF_LIB = /\/assets\/vendor\/pdf-lib\.min\.js/;
const LAME = /\/assets\/vendor\/lame\.min\.js/;
const OFFLINE_PDF = 'Couldn’t load the PDF tools. Check your connection and try again.';

function watch(page, pattern){
  const seen = [];
  page.on('request', (r) => { if (pattern.test(r.url())) seen.push(r.url()); });
  return seen;
}
const pdf = async () => upload('A.pdf', await numberedPdf(100, 2));

// What shows once a PDF is open in each tool.
const opened = {
  '/merge-pdf/': (page) => expect(page.locator('.file-name')).toHaveText(['A.pdf']),
  '/redact-pdf/': (page) => expect(page.locator('#fileName')).toHaveText('A.pdf'),
  '/watermark-pdf/': (page) => expect(page.locator('#fileName')).toHaveText('A.pdf')
};

for (const [url, isOpen] of Object.entries(opened)) {
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

const clip = () => ({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: flacMp4(tone(1, 2)) });

test('/mp4-to-mp3/: lamejs is only fetched to make an MP3', async ({ page }) => {
  const seen = watch(page, LAME);
  await page.goto('/mp4-to-mp3/');
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByText('WAV', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
  expect(seen).toEqual([]);

  await page.getByText('MP3', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
  expect(seen).toEqual([expect.stringContaining('/assets/vendor/lame.min.js?v=1.2.1')]);
});

test('/mp4-to-mp3/: says so when lamejs can\'t be fetched, and tries again', async ({ page }) => {
  await page.route(LAME, (route) => route.abort());
  await page.goto('/mp4-to-mp3/');
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: the MP3 encoder didn’t load. Check your connection and try again');
  await page.unroute(LAME);
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: /Convert/ }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
});
