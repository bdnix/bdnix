import { test, expect, expectNewWindow, expectNoSideScroll } from './fixtures.mjs';
import { L, upload, samplePdf, lockedPdf, download, contentStreams } from './pdfs.mjs';

const sample = await samplePdf();
const original = await L.PDFDocument.load(sample);
const locked = (options) => lockedPdf(sample, { user: 'open sesame', owner: 'boss', ...options });

async function open(page, name, bytes){
  await page.locator('#picker').setInputFiles([upload(name, bytes)]);
  await expect(page.locator('#fileName')).toHaveText(name);
}

// The download is the same document, and opens without a password.
async function expectUnlocked(page, name){
  await expectNewWindow(page.locator('#downloadBtn'));
  const out = await download(page, () => page.locator('#downloadBtn').click());
  expect(out.name).toBe(name);
  expect(out.doc.context.trailerInfo.Encrypt).toBeUndefined();
  expect(out.doc.getPageCount()).toBe(3);
  for (let i = 0; i < 3; i++) expect(contentStreams(out.doc, i)).toEqual(contentStreams(original, i));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/unlock-pdf/');
});

test('unlocks a PDF with the password that opens it', async ({ page }) => {
  await expect(page.locator('#unlockForm')).toBeHidden();
  await open(page, 'report.pdf', await locked({ cipher: 'aes-256' }));
  await expect(page.locator('#drop')).toBeHidden();
  await expect(page.locator('#fileMeta')).toHaveText(/^Password-protected · AES 256-bit · \d+ KB$/);
  await expect(page.locator('#msg')).toHaveText('Type the password you open this PDF with.');
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute('type', 'password');
  const unlock = page.getByRole('button', { name: 'Unlock PDF' });
  await expect(unlock).toBeDisabled();

  await password.fill('open sesame');
  await password.press('Enter');
  await expect(page.locator('#msg')).toHaveText('Done. The new copy opens without a password.');
  await expect(page.locator('#unlockForm')).toBeHidden();
  await expect(page.locator('#fileMeta')).toHaveText(/^Unlocked · 3 pages · \d+ KB$/);
  await expect(page.locator('#downloadLabel')).toHaveText(/^Download report-unlocked\.pdf \(\d+ KB\)$/);
  await expect(page.locator('#downloadBtn')).toBeFocused();
  await expectUnlocked(page, 'report-unlocked.pdf');
  await expectNoSideScroll(page);
});

test('a wrong password is explained, and the right one still works', async ({ page }) => {
  await open(page, 'old.pdf', await locked({ cipher: 'rc4-128', objectStreams: true }));
  await expect(page.locator('#fileMeta')).toHaveText(/^Password-protected · RC4 128-bit · /);
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('Open Sesame');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expect(page.locator('#msg')).toHaveText('That password doesn’t open this PDF. Check it and try again.');
  await expect(page.locator('#msg')).toHaveClass(/error/);
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expect(password).toHaveClass(/invalid/);
  await expect(page.locator('#done')).toBeHidden();

  // Typing clears the mark; the owner password works as well as the user's.
  await password.fill('boss');
  await expect(password).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expect(page.locator('#msg')).toHaveText('Done. The new copy opens without a password.');
  await expectUnlocked(page, 'old-unlocked.pdf');
});

test('the password can be shown while typing it', async ({ page }) => {
  await open(page, 'a.pdf', await locked({ cipher: 'aes-128' }));
  const password = page.getByLabel('Password', { exact: true });
  const show = page.getByRole('button', { name: 'Show' });
  await expect(show).toHaveAttribute('aria-pressed', 'false');
  await show.click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Hide' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(show).toHaveAttribute('aria-pressed', 'false');
});

test('a PDF that opens without a password asks for its owner password', async ({ page }) => {
  await open(page, 'limited.pdf', await locked({ user: '', cipher: 'rc4-40' }));
  await expect(page.locator('#fileMeta')).toHaveText(/^Password-protected · RC4 40-bit · /);
  await expect(page.locator('#msg')).toHaveText('This PDF opens without a password but limits printing, copying or editing. Type its owner password to lift the limits.');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expect(page.locator('#msg')).toHaveText('That password doesn’t open this PDF. Check it and try again.');
  await page.getByLabel('Password', { exact: true }).fill('boss');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expectUnlocked(page, 'limited-unlocked.pdf');
});

test('a PDF without a password, a broken one and other files', async ({ page }) => {
  await open(page, 'plain.pdf', sample);
  await expect(page.locator('#msg')).toHaveText('plain.pdf isn’t password-protected, so there’s no password to remove.');
  await expect(page.locator('#unlockForm')).toBeHidden();
  await expect(page.locator('#fileMeta')).toHaveText(/^\d+ KB$/);

  await page.locator('#picker').setInputFiles([upload('notes.txt', 'hello', 'text/plain')]);
  await expect(page.locator('#msg')).toHaveText('Choose a PDF file to unlock.');

  await page.locator('#picker').setInputFiles([upload('broken.pdf', '%PDF-garbage')]);
  await expect(page.locator('#msg')).toHaveText('broken.pdf could not be read as a PDF.');
});

test('says so when the encryption is a kind it can\'t remove', async ({ page }) => {
  // Same length, so the cross-reference offsets still hold.
  const bytes = Buffer.from(await locked({ cipher: 'aes-128' }));
  const at = bytes.indexOf('/Standard');
  bytes.write('/Unknown1', at, 'latin1');
  await page.locator('#picker').setInputFiles([upload('cert.pdf', bytes)]);
  await expect(page.locator('#msg')).toHaveText('cert.pdf: This PDF uses a kind of encryption this tool can’t remove.');
  await expect(page.locator('#unlockForm')).toBeHidden();
});

test('choosing another file starts again', async ({ page }) => {
  await open(page, 'first.pdf', await locked({ cipher: 'aes-256' }));
  await page.getByLabel('Password', { exact: true }).fill('open sesame');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expect(page.locator('#done')).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Change file' }).click();
  await (await chooser).setFiles([upload('second.pdf', await locked({ cipher: 'aes-128' }))]);
  await expect(page.locator('#fileName')).toHaveText('second.pdf');
  await expect(page.locator('#done')).toBeHidden();
  await expect(page.locator('#unlockForm')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.locator('#fileMeta')).toHaveText(/^Password-protected · AES 128-bit · /);
});

test('an error while unlocking is shown, and the form stays', async ({ page }) => {
  await open(page, 'odd.pdf', await locked({ cipher: 'aes-128' }));
  await page.evaluate(() => { window.bdnixUnlock.unlock = () => Promise.reject(new Error('the file ends early')); });
  await page.getByLabel('Password', { exact: true }).fill('open sesame');
  await page.getByRole('button', { name: 'Unlock PDF' }).click();
  await expect(page.locator('#msg')).toHaveText('Something went wrong while unlocking: the file ends early');
  await expect(page.locator('#unlockForm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock PDF' })).toBeEnabled();
  await expect(page.locator('#done')).toBeHidden();
});
