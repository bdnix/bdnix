import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { upload, samplePdf, download, imageCount } from './pdfs.mjs';
import { expectNoEnglish } from './bangla.mjs';

// Watermark a PDF in Bangla (bn/watermark-pdf/). Its default text is Bangla,
// which the built-in PDF fonts can't show, so it goes in as an image.
async function openSample(page){
  await page.goto('/bn/watermark-pdf/');
  await page.locator('#picker').setInputFiles(upload('report.pdf', await samplePdf()));
  await expect(page.locator('#fileMeta')).toHaveText(/^৩ পৃষ্ঠা · [০-৯]+ KB$/);
  await expect(page.locator('#previewCanvas')).toBeVisible({ timeout: 20_000 });
}

test('watermarks the pages listed in Bangla digits, with Bangla text', async ({ page }) => {
  await openSample(page);
  await expect(page.locator('input[name=text]')).toHaveValue('গোপনীয়');
  await expect(page.locator('#pagesHint')).toHaveText('সব ৩ পৃষ্ঠায় ওয়াটারমার্ক বসবে');
  await expect(page.locator('#sizeOut')).toHaveText('৮০%');
  await expect(page.locator('#opacityOut')).toHaveText('২৫%');
  await expect(page.locator('#rotationOut')).toHaveText('৪৫°');
  await expect(page.locator('#pageLabel')).toHaveText('পৃষ্ঠা ১ / ৩');
  await expectNoEnglish(page, ['report.pdf']);

  const pages = page.getByRole('textbox', { name: 'পৃষ্ঠা' });
  await pages.fill('৯');
  await expect(page.locator('#pagesHint')).toHaveText('৯ নম্বর পৃষ্ঠা নেই (এই ফাইলে ৩ পৃষ্ঠা আছে)');
  await expect(page.locator('#previewNote')).toHaveText('ওয়াটারমার্ক দেখতে পৃষ্ঠার তালিকা ঠিক করুন।');
  await pages.fill('২-৩');
  await expect(page.locator('#pagesHint')).toHaveText('৩ পৃষ্ঠার মধ্যে ২ পৃষ্ঠায় ওয়াটারমার্ক বসবে');
  await expect(page.locator('#previewNote')).toHaveText('১ নম্বর পৃষ্ঠা আপনার তালিকায় নেই, তাই এটি যেমন আছে তেমনই থাকবে।');

  const out = await download(page, async () => {
    await page.getByRole('button', { name: 'ওয়াটারমার্ক দিন' }).click();
    await expect(page.locator('#downloadBtn')).toBeVisible();
    await page.locator('#downloadBtn').click();
  });
  expect(out.name).toBe('report-watermarked.pdf');
  expect(imageCount(out.doc)).toBeGreaterThan(0);
  await expect(page.locator('#msg')).toHaveText('হয়ে গেছে। ২ পৃষ্ঠায় ওয়াটারমার্ক বসানো হয়েছে।');
  await expectNoSideScroll(page);
});

test('settings reset in Bangla, and a file that isn’t a PDF is explained', async ({ page }) => {
  await openSample(page);
  await page.locator('input[name=text]').fill('');
  await expect(page.locator('#previewNote')).toHaveText('এখানে দেখতে কিছু লেখা লিখুন।');
  await page.getByRole('button', { name: 'আগের অবস্থায় ফেরান' }).click();
  await expect(page.locator('#msg')).toHaveText('সেটিংস আগের অবস্থায় ফেরানো হয়েছে।');
  await expect(page.locator('input[name=text]')).toHaveValue('গোপনীয়');
  await page.locator('input[name=kind][value=image]').check({ force: true });
  await expect(page.locator('#imageName')).toHaveText('PNG বা JPG, যেমন একটি লোগো');
  await expect(page.locator('#previewNote')).toHaveText('এখানে দেখতে একটি ছবি বেছে নিন।');
  await page.locator('#picker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#msg')).toHaveText('এটি PDF ফাইল নয়। ওয়াটারমার্ক দিতে একটি .pdf বেছে নিন।');
});
