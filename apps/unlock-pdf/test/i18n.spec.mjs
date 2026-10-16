import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';
import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { upload, samplePdf, lockedPdf, download } from '../../../tests/ui/pdfs.mjs';
import { inLanguage, expectTranslated } from '../../../tests/ui/languages.mjs';

const sample = await samplePdf();
const locked = (options) => lockedPdf(sample, { user: 'open sesame', owner: 'boss', ...options });

// Using it in Bangla (each test opens it in Bangla, and finds nothing left
// in English at the end).
test.describe('in Bangla', () => {
  test.beforeEach(({ page }) => inLanguage(page, 'bn'));
  // Whatever a test does, nothing is left in English.
  test.afterEach(({ page }) => expectTranslated(page));

  // Unlock a PDF in Bangla.

  async function open(page, name, bytes){
    await page.locator('#picker').setInputFiles([upload(name, bytes)]);
    await expect(page.locator('#fileName')).toHaveText(name);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/unlock-pdf/');
  });

  test('unlocks a PDF, saying so in Bangla', async ({ page }) => {
    await expectTranslated(page);
    await open(page, 'report.pdf', await locked({ cipher: 'aes-256' }));
    await expect(page.locator('#fileMeta')).toHaveText(/^পাসওয়ার্ড দিয়ে সুরক্ষিত · AES ২৫৬-bit · [০-৯]+ KB$/);
    await expect(page.locator('#msg')).toHaveText('যে পাসওয়ার্ড দিয়ে এই PDF খোলেন, সেটি লিখুন।');
    const password = page.getByLabel('পাসওয়ার্ড', { exact: true });
    await expect(password).toBeFocused();
    const show = page.getByRole('button', { name: 'দেখান' });
    await show.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'লুকান' })).toBeVisible();
    await expectTranslated(page);

    await password.fill('wrong');
    await page.getByRole('button', { name: 'PDF আনলক করুন' }).click();
    await expect(page.locator('#msg')).toHaveText('এই পাসওয়ার্ড দিয়ে PDF-টি খোলে না। দেখে নিয়ে আবার চেষ্টা করুন।');
    await password.fill('open sesame');
    await password.press('Enter');
    await expect(page.locator('#msg')).toHaveText('হয়ে গেছে। নতুন কপিটি পাসওয়ার্ড ছাড়াই খোলে।');
    await expect(page.locator('#fileMeta')).toHaveText(/^আনলক হয়েছে · ৩ পৃষ্ঠা · [০-৯]+ KB$/);
    await expect(page.locator('#downloadLabel')).toHaveText(/^report-unlocked\.pdf ডাউনলোড করুন \([০-৯]+ KB\)$/);
    await expectTranslated(page);
    const out = await download(page, () => page.locator('#downloadBtn').click());
    expect(out.name).toBe('report-unlocked.pdf');
    expect(out.doc.context.trailerInfo.Encrypt).toBeUndefined();
    await expectNoSideScroll(page);
  });

  test('a PDF that only limits printing asks for its owner password', async ({ page }) => {
    await open(page, 'limited.pdf', await locked({ user: '', cipher: 'rc4-128' }));
    await expect(page.locator('#fileMeta')).toHaveText(/^পাসওয়ার্ড দিয়ে সুরক্ষিত · RC4 ১২৮-bit · /);
    await expect(page.locator('#msg')).toHaveText('এই PDF পাসওয়ার্ড ছাড়াই খোলে, কিন্তু প্রিন্ট, কপি বা এডিট করতে দেয় না। এই বাধাগুলো তুলতে এর ওনার পাসওয়ার্ড লিখুন।');
  });

  test('explains a PDF with no password, and a file that isn’t a PDF', async ({ page }) => {
    await open(page, 'plain.pdf', sample);
    await expect(page.locator('#msg')).toHaveText('plain.pdf পাসওয়ার্ড দিয়ে সুরক্ষিত নয়, তাই সরানোর মতো কোনো পাসওয়ার্ড নেই।');
    await page.locator('#picker').setInputFiles([upload('notes.txt', 'hello', 'text/plain')]);
    await expect(page.locator('#msg')).toHaveText('আনলক করতে একটি PDF ফাইল বেছে নিন।');
    await page.locator('#picker').setInputFiles([upload('broken.pdf', '%PDF-garbage')]);
    await expect(page.locator('#msg')).toHaveText('broken.pdf PDF হিসেবে পড়া যায়নি।');
  });
});

// Unlock a PDF's i18n target: the page in every other language the
// site has, from its own translations (lang/) and those of the shared modules
// it uses, and nothing else.
checkPageLanguages('/unlock-pdf/');
checkStrings('/unlock-pdf/', 'unlock-pdf');
