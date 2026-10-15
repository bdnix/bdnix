import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { upload, secretPdf, download, imageCount } from './pdfs.mjs';
import { png } from './images.mjs';
import { expectNoEnglish } from './bangla.mjs';

// Sign a PDF in Bangla (bn/sign-pdf/). secret.pdf has three pages.
async function openSecret(page){
  await page.goto('/bn/sign-pdf/');
  await page.locator('#picker').setInputFiles(upload('secret.pdf', (await secretPdf()).bytes));
  await expect(page.locator('#fileMeta')).toHaveText(/^৩ পৃষ্ঠা · [০-৯]+ KB$/);
  await expect(page.locator('#pageCanvas')).toBeVisible({ timeout: 20_000 });
}

async function openSigs(page){
  if (await page.locator('#sigDialog').evaluate((d) => d.open)) return;
  await page.getByRole('button', { name: 'আমার সই' }).click();
  await expect(page.locator('#sigDialog')).toBeVisible();
}

// Dark ink on white paper.
const paper = () => png(200, 100, (x, y) => (x >= 50 && x < 150 && y >= 30 && y < 70 ? [20, 20, 30, 255] : [255, 255, 255, 255]));

test('signs every page, saying so in Bangla', async ({ page }) => {
  await openSecret(page);
  await expect(page.locator('#summary')).toHaveText('এখনো কিছু বসানো হয়নি');
  await expectNoEnglish(page, ['secret.pdf']);
  await openSigs(page);
  await page.locator('#modes label', { hasText: 'ছবি' }).click();
  await page.locator('#imagePicker').setInputFiles(upload('sig.png', paper(), 'image/png'));
  await expectNoEnglish(page, ['secret.pdf', 'sig.png']);
  await page.getByRole('button', { name: 'পৃষ্ঠায় বসান' }).click();
  await expect(page.locator('#sigDialog')).toBeHidden();
  await expect(page.locator('#summary')).toHaveText('১ পৃষ্ঠায় ১টি সই');
  await expect(page.locator('#sizeOut')).toHaveText(/^[০-৯]+%$/);
  await expect(page.locator('#angleOut')).toHaveText('০°');
  await expect(page.getByRole('button', { name: /^সই ১। সরাতে টেনে নিন/ })).toBeVisible();

  await page.getByRole('button', { name: 'প্রতিটি পৃষ্ঠায় কপি করুন' }).click();
  await expect(page.locator('#msg')).toHaveText('আরও ২ পৃষ্ঠায় কপি করা হয়েছে।');
  await page.getByRole('button', { name: 'প্রতিটি পৃষ্ঠায় কপি করুন' }).click();
  await expect(page.locator('#msg')).toHaveText('এটি আগেই প্রতিটি পৃষ্ঠায় আছে।');
  await expect(page.locator('#summary')).toHaveText('৩ পৃষ্ঠায় ৩টি সই');
  await expectNoEnglish(page, ['secret.pdf']);

  const out = await download(page, async () => {
    await page.getByRole('button', { name: 'PDF-এ সই করুন' }).click();
    await expect(page.locator('#downloadBtn')).toBeVisible({ timeout: 20_000 });
    await page.locator('#downloadBtn').click();
  });
  expect(out.name).toBe('secret-signed.pdf');
  expect(imageCount(out.doc)).toBeGreaterThan(0);
  await expect(page.locator('#msg')).toHaveText('হয়ে গেছে। ৩ পৃষ্ঠায় ৩টি সই বসানো হয়েছে।');
  await expectNoSideScroll(page);
});

test('deleting a signature that’s on the pages asks first, in Bangla', async ({ page }) => {
  await openSecret(page);
  await openSigs(page);
  await page.locator('#modes label', { hasText: 'ছবি' }).click();
  await page.locator('#imagePicker').setInputFiles(upload('sig.png', paper(), 'image/png'));
  await page.getByRole('button', { name: 'পৃষ্ঠায় বসান' }).click();
  await expect(page.locator('#sigDialog')).toBeHidden();
  // The count of saved signatures is in Bangla digits too.
  await expect(page.locator('#sigCount')).toHaveText('১');
  await openSigs(page);
  await page.getByRole('button', { name: 'সই ১ মুছুন' }).click();
  await expect(page.locator('.sig-confirm .tip')).toHaveText('সই ১ secret.pdf-এর ১ পৃষ্ঠায় আছে। মুছলে সেই পৃষ্ঠা থেকেও উঠে যাবে, তাই সেখানে রাখতে চাইলে আগে PDF-এ সই করে ডাউনলোড করুন।');
  await page.getByRole('button', { name: 'রেখে দিন' }).click();
  await expect(page.locator('#sigMsg')).toHaveText('সই ১ রাখা হয়েছে। এটি এখনো পৃষ্ঠাগুলোতে আছে।');
  await page.getByRole('button', { name: 'সই ১ মুছুন' }).click();
  await page.getByRole('button', { name: 'তবুও মুছুন' }).click();
  await expect(page.locator('#sigMsg')).toHaveText('সই ১ মুছে পৃষ্ঠাগুলো থেকে সরানো হয়েছে।');
  await expect(page.locator('#sigNone')).toHaveText('এখনো কোনোটি নেই। ওপরে একটি তৈরি করুন।');
});

test('makes a signature without a PDF, and explains pictures that won’t do', async ({ page }) => {
  await page.goto('/bn/sign-pdf/');
  await openSigs(page);
  await page.locator('#modes label', { hasText: 'টাইপ করুন' }).click();
  // The handwriting fonts only have Latin letters, so their samples are in English.
  await expect(page.locator('#fonts span').first()).toHaveText('Your name');
  await page.getByRole('textbox', { name: 'আপনার নাম' }).fill('Musa');
  await expect(page.locator('#fonts span').first()).toHaveText('Musa');
  await page.getByRole('button', { name: 'সই তৈরি করুন' }).click();
  await expect(page.locator('#sigMsg')).toHaveText('সই ১ তৈরি হয়েছে। ছবি হিসেবে সেভ করুন, অথবা পৃষ্ঠায় বসাতে একটি PDF খুলুন।');
  await expect(page.getByRole('link', { name: 'সই ১ ছবি হিসেবে সেভ করুন' })).toHaveText('ছবি সেভ করুন');
  await expectNoEnglish(page, ['Musa']);

  await page.locator('#modes label', { hasText: 'ছবি' }).click();
  await page.locator('#imagePicker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#addHint')).toHaveText('এটি ছবি নয়। আপনার সইয়ের একটি PNG বা JPG বেছে নিন।');
  await page.locator('#imagePicker').setInputFiles(upload('blank.png', png(40, 20, () => [255, 255, 255, 255]), 'image/png'));
  await page.getByRole('button', { name: 'সই তৈরি করুন' }).click();
  await expect(page.locator('#addHint')).toHaveText('ছবিটি ফাঁকা মনে হচ্ছে। আরও গাঢ় কালির ছবি দিয়ে চেষ্টা করুন, অথবা “সাদা কাগজ স্বচ্ছ করুন” থেকে টিক তুলে দিন।');

  await page.locator('#remember').check();
  await expect(page.locator('#sigMsg')).toHaveText('আপনার সইগুলো পরের বার এখানে থাকবে, শুধু এই ব্রাউজারে।');
  await page.keyboard.press('Escape');
  await page.locator('#picker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#msg')).toHaveText('এটি PDF ফাইল নয়। সই করতে একটি .pdf বেছে নিন।');
});
