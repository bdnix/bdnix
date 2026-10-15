import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { upload, secretPdf, picturePdf, download, imageCount } from './pdfs.mjs';
import { expectNoEnglish } from './bangla.mjs';

// Redact a PDF in Bangla (bn/redact-pdf/).
async function openSecret(page){
  await page.goto('/bn/redact-pdf/');
  await page.locator('#picker').setInputFiles(upload('secret.pdf', (await secretPdf()).bytes));
  await expect(page.locator('#fileMeta')).toHaveText(/^৩ পৃষ্ঠা · [০-৯]+ KB$/);
  await expect(page.locator('#pageCanvas')).toBeVisible({ timeout: 20_000 });
}

const find = async (page, text) => {
  await page.getByLabel('লেখা খুঁজুন').fill(text);
  await page.getByRole('button', { name: 'সব চিহ্নিত করুন' }).click();
};

test('finds and blacks out text, saying so in Bangla', async ({ page }) => {
  await openSecret(page);
  await expect(page.locator('#summary')).toHaveText('এখনো কিছু চিহ্নিত করা হয়নি');
  await find(page, 'jane doe');
  await expect(page.locator('#findHint')).toHaveText('২ পৃষ্ঠায় ২টি মিল চিহ্নিত করা হয়েছে। লেখা ঢাকার আগে দেখে নিন।');
  await expect(page.locator('#summary')).toHaveText('২ পৃষ্ঠায় ২টি জায়গা');
  await expect(page.getByRole('button', { name: 'এই বাক্সটি সরান' })).toHaveCount(1);
  await page.getByRole('button', { name: 'পরের পৃষ্ঠা' }).click();
  await expect(page.locator('#pageLabel')).toHaveText('পৃষ্ঠা ২ / ৩');
  await expectNoEnglish(page, ['secret.pdf', 'jane doe']);

  await find(page, 'jane doe');
  await expect(page.locator('#findHint')).toHaveText('সব “jane doe” আগেই চিহ্নিত করা আছে।');
  await find(page, 'nobody');
  await expect(page.locator('#findHint')).toHaveText('“nobody” এই ফাইলের লেখায় নেই। স্ক্যান করা পৃষ্ঠা আসলে ছবি, তাতে খোঁজার মতো লেখা নেই, তাই সেগুলোর ওপর বাক্স আঁকুন।');

  const out = await download(page, async () => {
    await page.getByRole('button', { name: 'লেখা ঢেকে দিন' }).click();
    await expect(page.locator('#downloadBtn')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#downloadLabel')).toHaveText(/^ডাউনলোড \([০-৯]+ KB\)$/);
    await page.locator('#downloadBtn').click();
  });
  expect(out.name).toBe('secret-redacted.pdf');
  expect(imageCount(out.doc)).toBe(2);
  await expect(page.locator('#msg')).toHaveText('হয়ে গেছে। ২ পৃষ্ঠায় ২টি জায়গা কালো করে ঢাকা হয়েছে।');
  await expectNoSideScroll(page);
});

test('says in Bangla which pages have pictures search can’t read', async ({ page }) => {
  await page.goto('/bn/redact-pdf/');
  await page.locator('#picker').setInputFiles(upload('ticket.pdf', await picturePdf()));
  await expect(page.locator('#pageCanvas')).toBeVisible({ timeout: 20_000 });
  await find(page, 'tickets');
  await expect(page.locator('#findHint')).toHaveText('১ পৃষ্ঠায় ১টি মিল চিহ্নিত করা হয়েছে। লেখা ঢাকার আগে দেখে নিন। ছবির ভেতরের লেখা খোঁজা যায় না, তাই পৃষ্ঠা ২-র ছবিগুলোর ওপর টেনে বাক্স আঁকুন।');
});

test('explains an empty search and a file that isn’t a PDF', async ({ page }) => {
  await openSecret(page);
  await page.getByRole('button', { name: 'সব চিহ্নিত করুন' }).click();
  await expect(page.locator('#findHint')).toHaveText('যে লেখা কালো করে ঢাকতে চান, সেটি লিখুন।');
  await page.locator('#picker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#msg')).toHaveText('এটি PDF ফাইল নয়। লেখা ঢাকতে একটি .pdf বেছে নিন।');
});
