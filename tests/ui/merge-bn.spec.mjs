import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { inNewWindow } from './downloads.mjs';
import { upload, numberedPdf, download, widths } from './pdfs.mjs';
import { expectNoEnglish } from './bangla.mjs';

// Merge PDFs in Bangla (bn/merge-pdf/): the same tool, in Bangla words and
// digits. Page widths encode file and page: A = 101..110, B = 201..203.

test('the top bar switches between the English and Bangla tool', async ({ page }) => {
  await page.goto('/merge-pdf/');
  await page.getByRole('navigation', { name: 'Language' }).getByRole('link', { name: 'বাংলা' }).click();
  await expect(page).toHaveURL(/\/bn\/merge-pdf\/$/);
  await expect(page.locator('h1')).toHaveText('PDF জোড়া লাগান');
  await expect(page.getByRole('link', { name: 'bdnix-এ ফিরে যান' })).toHaveAttribute('href', '/bn/');
  await expect(page.locator('.profile-chip')).toHaveAttribute('href', '/bn/profile/');
  await expectNoEnglish(page);
  await page.getByRole('navigation', { name: 'ভাষা' }).getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/merge-pdf\/$/);
  await expect(page.locator('h1')).toHaveText('Merge PDFs');
});

test('merges in Bangla, with page ranges typed in Bangla digits', async ({ page }) => {
  await page.goto('/bn/merge-pdf/');
  await page.locator('#picker').setInputFiles([
    upload('A.pdf', await numberedPdf(100, 10)),
    upload('B.pdf', await numberedPdf(200, 3)),
    upload('notes.txt', 'hello', 'text/plain'),
    upload('broken.pdf', '%PDF-garbage')
  ]);
  await expect(page.locator('.file')).toHaveCount(2);
  await expect(page.locator('#msg')).toHaveText('বাদ পড়েছে: notes.txt PDF নয়; broken.pdf পড়া যায়নি।');
  await expect(page.locator('#summary')).toHaveText('২টি ফাইল · ১৩ পৃষ্ঠা বাছাই করা হয়েছে');
  await expect(page.locator('.file-meta').first()).toHaveText(/^১০ পৃষ্ঠা · [০-৯.]+ (B|KB)$/);

  const range = (i) => page.locator('.file').nth(i).getByRole('textbox', { name: /থেকে যে পৃষ্ঠাগুলো নেবেন$/ });
  await expect(range(0)).toHaveAttribute('placeholder', 'সব, বা যেমন ১-৩, ১০');
  await range(0).fill('১-৩, ৯-');
  await expect(page.locator('.file-meta').first()).toHaveText(/^৫ \/ ১০ পৃষ্ঠা · /);
  await expect(page.locator('#summary')).toHaveText('২টি ফাইল · ৮ পৃষ্ঠা বাছাই করা হয়েছে');
  await page.getByRole('button', { name: 'B.pdf ওপরে সরান' }).click();
  await expect(page.locator('.file-name')).toHaveText(['B.pdf', 'A.pdf']);
  await expect(page.locator('#pageLabel')).toHaveText('পৃষ্ঠা ১ / ৮', { timeout: 20_000 });
  await expect(page.locator('#pageCanvas')).toHaveAttribute('aria-label', 'জোড়া লাগানো PDF-এর পৃষ্ঠা ১ / ৮');
  await expectNoEnglish(page, ['A.pdf', 'B.pdf', 'notes.txt', 'broken.pdf', 'merged.pdf']);

  const out = await download(page, () => page.getByRole('button', { name: 'PDF জোড়া লাগান' }).click());
  expect(out.name).toBe('merged.pdf');
  expect(widths(out.doc)).toEqual([201, 202, 203, 101, 102, 103, 109, 110]);
  await expect(page.locator('#msg')).toHaveText(/^merged\.pdf সেভ হয়েছে: ২টি ফাইল থেকে ৮ পৃষ্ঠা, [০-৯.]+ (B|KB)।$/);
  await expectNoSideScroll(page);
});

test('the download window speaks Bangla too', async ({ page }) => {
  await page.goto('/bn/merge-pdf/');
  await page.locator('#picker').setInputFiles([upload('A.pdf', await numberedPdf(100, 2))]);
  await expect(page.locator('.file')).toHaveCount(1);
  const { popup } = await inNewWindow(page, () => page.getByRole('button', { name: 'PDF জোড়া লাগান' }).click());
  await expect(popup.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(popup.locator('.lede')).toHaveText('আপনার ডাউনলোড শুরু হয়েছে। না হলে নিচের বোতামটি ব্যবহার করুন। ফাইলটি সেভ হয়ে গেলে এই ট্যাবটি বন্ধ করতে পারেন।');
  await expect(popup.locator('a[download]')).toHaveText('merged.pdf ডাউনলোড করুন');
});

test('a page range that doesn’t work is explained in Bangla', async ({ page }) => {
  await page.goto('/bn/merge-pdf/');
  await page.locator('#picker').setInputFiles([upload('A.pdf', await numberedPdf(100, 10))]);
  const input = page.locator('.file-range input');
  const meta = page.locator('.file-meta');
  await input.fill('১-৩, ১২');
  await expect(meta).toHaveText('১২ নম্বর পৃষ্ঠা নেই (এই ফাইলে ১০ পৃষ্ঠা আছে)');
  await input.fill('abc');
  await expect(meta).toHaveText('“abc” কোনো পৃষ্ঠা বা পৃষ্ঠার পরিসর নয়');
  const merge = page.getByRole('button', { name: 'PDF জোড়া লাগান' });
  await expect(merge).toBeDisabled();
  await expect(merge).toHaveAttribute('title', 'আগে লাল দাগ দেওয়া পৃষ্ঠার পরিসরগুলো ঠিক করুন');
  await expect(page.locator('#previewNote')).toHaveText('প্রিভিউ দেখতে লাল দাগ দেওয়া পৃষ্ঠার পরিসরগুলো ঠিক করুন।');
  await page.locator('#picker').setInputFiles([upload('notes.txt', 'hello', 'text/plain')]);
  await expect(page.locator('#msg')).toHaveText('শুধু PDF ফাইল জোড়া লাগানো যায়।');
});
