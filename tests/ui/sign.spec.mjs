import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectNoSideScroll, expectNewWindow } from './fixtures.mjs';
import { upload, secretPdf, download, imageCount, contentStreams } from './pdfs.mjs';
import { png } from './images.mjs';

// secret.pdf: three A4 pages, the second turned with /Rotate 90.
async function openSecret(page, { reload = true } = {}){
  const pdf = await secretPdf();
  if (reload) await page.goto('/sign-pdf/');
  await page.locator('#picker').setInputFiles(upload('secret.pdf', pdf.bytes));
  await expect(page.locator('#fileMeta')).toHaveText(/^3 pages · \d+ KB$/);
  await expect(page.locator('#pageCanvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#previewNote')).toBeHidden();
}

// A solid blue block twice as wide as it's tall, so where it lands and
// which way it turns can be read back from the signed page.
const block = () => png(200, 100, () => [30, 80, 255, 255]);
// Dark ink in the middle of white paper: 100 x 40 pixels at (50, 30).
const paper = () => png(200, 100, (x, y) => (x >= 50 && x < 150 && y >= 30 && y < 70 ? [20, 20, 30, 255] : [255, 255, 255, 255]));

// Opens the My signatures dialog, if it isn't open already.
async function openSigs(page){
  if (await page.locator('#sigDialog').evaluate((d) => d.open)) return;
  await page.getByRole('button', { name: 'My signatures' }).click();
  await expect(page.locator('#sigDialog')).toBeVisible();
}
// Signature n from the dialog: put on the page shown, or deleted.
const put = async (page, n) => { await openSigs(page); await page.getByRole('button', { name: `Put signature ${n} on this page` }).click(); };
const remove = async (page, n) => { await openSigs(page); await page.getByRole('button', { name: `Delete signature ${n}` }).click(); };
const remember = async (page) => { await openSigs(page); return page.locator('#remember'); };

async function addImage(page, bytes, { see = false, name = 'sig.png' } = {}){
  await openSigs(page);
  await page.locator('#modes label', { hasText: 'Image' }).click();
  await page.locator('#imagePicker').setInputFiles(upload(name, bytes, 'image/png'));
  await page.locator('#clearBg').setChecked(see);
  const before = await page.locator('#sigList .sig').count();
  await page.getByRole('button', { name: /^(Add to the page|Create signature)$/ }).click();
  // Done once it's in the list, or the reason it couldn't be is shown.
  await expect.poll(async () => (await page.locator('#sigList .sig').count()) > before || page.locator('#addHint').isVisible()).toBe(true);
}

const sign = (page) => download(page, async () => {
  // The page behind the signatures dialog can't be used while it's open.
  if (await page.locator('#sigDialog').evaluate((d) => d.open)) await page.keyboard.press('Escape');
  await expect(page.locator('#sigDialog')).toBeHidden();
  await page.getByRole('button', { name: 'Sign PDF' }).click();
  await expect(page.locator('#downloadBtn')).toBeVisible({ timeout: 20_000 });
  await expectNewWindow(page.locator('#downloadBtn'));
  await page.locator('#downloadBtn').click();
});

// Draws a wave on the pad.
async function scribble(page){
  await openSigs(page);
  await page.locator('#pad').scrollIntoViewIfNeeded();
  const box = await page.locator('#pad').boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * 15, box.y + box.height / 2 - Math.sin(i / 2) * 30);
  await page.mouse.up();
}

// Reads a PDF back with the site's own pdf.js: each page's text, and the
// colour at some points ([page number, x, y], as fractions from the top-left
// of the page as it's shown).
function readBack(page, bytes, points = []){
  return page.evaluate(async ({ b64, points }) => {
    const lib = await import('/assets/vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs/pdf.worker.min.mjs';
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const task = lib.getDocument({ data });
    const doc = await task.promise;
    const texts = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      texts.push(tc.items.map((it) => it.str).join(''));
    }
    const colours = [];
    for (const [n, fx, fy] of points) {
      const p = await doc.getPage(n);
      const vp = p.getViewport({ scale: 1 });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      colours.push([...c.getContext('2d').getImageData(Math.floor(fx * c.width), Math.floor(fy * c.height), 1, 1).data.slice(0, 3)]);
    }
    await task.destroy();
    return { texts, colours };
  }, { b64: Buffer.from(bytes).toString('base64'), points });
}

const isBlue = ([r, g, b]) => b > 200 && r < 90;
const isWhite = ([r, g, b]) => r > 215 && g > 215 && b > 215;
const colourAt = async (page, bytes, points) => (await readBack(page, bytes, points)).colours.map((c) => (isBlue(c) ? 'blue' : isWhite(c) ? 'white' : String(c)));

// The PNG a signature's "Save image" link gives: its size, and the colour
// of its top-left pixel and of its darkest one.
async function savedImage(page, n){
  await openSigs(page);
  const link = page.getByRole('link', { name: `Save signature ${n} as an image` });
  await expect(link).toHaveAttribute('download', `signature-${n}.png`);
  await expectNewWindow(link);
  const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(dl.suggestedFilename()).toBe(`signature-${n}.png`);
  return page.evaluate(async (href) => {
    const bmp = await createImageBitmap(await (await fetch(href)).blob());
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let dark = null;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 200 && (!dark || d[i] + d[i + 1] + d[i + 2] < dark[0] + dark[1] + dark[2])) dark = [...d.slice(i, i + 4)];
    }
    return { w: c.width, h: c.height, corner: [...d.slice(0, 4)], dark };
  }, await link.getAttribute('href'));
}

// Drags from one point to another, in page pixels.
async function dragFrom(page, [x0, y0], [x1, y1]){
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2);
  await page.mouse.move(x1, y1);
  await page.mouse.up();
}
const centre = (b) => [b.x + b.width / 2, b.y + b.height / 2];

test('an image signature goes where the preview shows it, over the page’s own text', async ({ page }) => {
  await openSecret(page);
  await expect(page.getByRole('button', { name: 'Sign PDF' })).toBeDisabled();
  await openSigs(page);
  await expect(page.getByRole('button', { name: 'Add to the page' })).toBeDisabled();
  await addImage(page, block());
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await expect(page.locator('#layer .placed')).toHaveCount(1);
  await expect(page.locator('#layer .placed.on')).toHaveCount(1);
  await expect(page.locator('#sizeOut')).toHaveText('33%');
  await expect(page.locator('#angleOut')).toHaveText('0°');
  await expectNoSideScroll(page);

  const out = await sign(page);
  expect(out.name).toBe('secret-signed.pdf');
  await expect(page.locator('#msg')).toHaveText('Done. Added 1 signature on 1 page.');
  expect(imageCount(out.doc)).toBe(1);
  const back = await readBack(page, out.bytes);
  // The pages and their text are kept: the signature is only added.
  expect(back.texts[0]).toContain('Account: 12345678');
  expect(back.texts[2]).toBe('Nothing to hide here.');
  // A third of the page wide (half-width 0.167), centred 80% down; half as
  // tall (half-height 0.059 of the page's height).
  expect(await colourAt(page, out.bytes, [[1, 0.5, 0.8], [1, 0.35, 0.8], [1, 0.65, 0.8], [1, 0.5, 0.75], [1, 0.5, 0.85], [1, 0.31, 0.8], [1, 0.69, 0.8], [1, 0.5, 0.73], [1, 0.5, 0.87]]))
    .toEqual(['blue', 'blue', 'blue', 'blue', 'blue', 'white', 'white', 'white', 'white']);
});

test('on a turned page the signature still sits upright as the reader sees it', async ({ page }) => {
  await openSecret(page);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('#pageLabel')).toHaveText('Page 2 of 3');
  await addImage(page, block());
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  const out = await sign(page);
  await expect(page.locator('#msg')).toHaveText('Done. Added 1 signature on 1 page.');
  // Page 2 reads 842 x 595. The block is a seventh of the page tall (85 pt,
  // half-height 0.071) and 170 pt wide (half-width 0.101), lying flat.
  expect(await colourAt(page, out.bytes, [[2, 0.5, 0.8], [2, 0.58, 0.8], [2, 0.42, 0.8], [2, 0.5, 0.86], [2, 0.62, 0.8], [2, 0.38, 0.8], [2, 0.5, 0.89], [2, 0.5, 0.71]]))
    .toEqual(['blue', 'blue', 'blue', 'blue', 'white', 'white', 'white', 'white']);
});

test('a signature is moved, resized and turned by dragging it and its handles', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await page.locator('#layer').scrollIntoViewIfNeeded();
  const layer = await page.locator('#layer').boundingBox();
  const sig = page.locator('#layer .placed');

  // Move: from wherever it's grabbed, its centre goes to (0.3, 0.3).
  const grab = centre(await sig.boundingBox());
  await dragFrom(page, [grab[0] + 10, grab[1] + 5], [layer.x + layer.width * 0.3 + 10, layer.y + layer.height * 0.3 + 5]);
  await expect(page.locator('#sizeOut')).toHaveText('33%');

  // Resize: the corner handle dragged half as far again from the centre.
  const c = centre(await sig.boundingBox());
  const h = centre(await page.locator('#layer .placed .grow').boundingBox());
  await dragFrom(page, h, [c[0] + (h[0] - c[0]) * 1.5, c[1] + (h[1] - c[1]) * 1.5]);
  await expect(page.locator('#sizeOut')).toHaveText(/^(49|50|51)%$/);

  // Turn: the handle above dragged round to the right snaps to a quarter turn.
  const t = centre(await page.locator('#layer .placed .turn').boundingBox());
  await dragFrom(page, t, [c[0] + 100, c[1] + 3]);
  await expect(page.locator('#angleOut')).toHaveText('90°');
  await page.locator('#sizeRange').fill('50');

  const out = await sign(page);
  // Half the page wide (297 pt) and half that tall, turned upright: 0.125
  // of the page's width either side of x 0.3, 0.176 of its height above and
  // below y 0.3.
  expect(await colourAt(page, out.bytes, [[1, 0.3, 0.3], [1, 0.3, 0.45], [1, 0.3, 0.15], [1, 0.4, 0.3], [1, 0.45, 0.3], [1, 0.15, 0.3], [1, 0.3, 0.5], [1, 0.5, 0.8]]))
    .toEqual(['blue', 'blue', 'blue', 'blue', 'white', 'white', 'white', 'white']);
});

test('the sliders and keys size, turn, move and remove the selected signature', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  const sig = page.locator('#layer .placed');
  const style = () => sig.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top), width: el.style.width, transform: el.style.transform }));
  const start = await style();
  expect(start.left).toBeCloseTo(33.333, 2);

  await page.locator('#sizeRange').fill('50');
  await expect(page.locator('#sizeOut')).toHaveText('50%');
  await page.locator('#angleRange').fill('-30');
  await expect(page.locator('#angleOut')).toHaveText('-30°');
  let now = await style();
  expect(now.width).toBe('50%');
  expect(now.transform).toBe('rotate(-30deg)');

  await sig.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowUp');
  now = await style();
  expect(now.left).toBeCloseTo(27, 2);   // (0.52 - 0.25) of the width
  const height = await sig.evaluate((el) => parseFloat(el.style.height));
  expect(now.top).toBeCloseTo(75 - height / 2, 2);

  // Tapping the empty page lets go of it; tapping it picks it again.
  await page.locator('#layer').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#selected')).toBeHidden();
  await expect(sig).not.toHaveClass(/\bon\b/);
  await sig.click();
  await expect(page.locator('#selected')).toBeVisible();
  await expect(page.locator('#sizeOut')).toHaveText('50%');

  await sig.focus();
  await page.keyboard.press('Delete');
  await expect(sig).toHaveCount(0);
  await expect(page.locator('#summary')).toHaveText('Nothing placed yet');
  await expect(page.getByRole('button', { name: 'Sign PDF' })).toBeDisabled();

  await put(page, 1);
  await put(page, 1);
  await expect(page.locator('#summary')).toHaveText('2 signatures on 1 page');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('#summary')).toHaveText('Nothing placed yet');
});

test('a signature drawn on the pad, in blue ink, can be saved as an image', async ({ page }) => {
  await openSecret(page);
  await openSigs(page);
  const add = page.getByRole('button', { name: 'Add to the page' });
  await expect(add).toBeDisabled();
  await scribble(page);
  await expect(add).toBeEnabled();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(add).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();

  await page.locator('#inks label', { hasText: 'Blue' }).click();
  await scribble(page);
  await add.click();
  // Made with a PDF open, it goes straight onto the page.
  await expect(page.locator('#sigDialog')).toBeHidden();
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  await expect(page.locator('#sigNone')).toBeHidden();
  // The pad is cleared for the next one.
  await openSigs(page);
  await expect(add).toBeDisabled();

  const img = await savedImage(page, 1);
  // Cropped to the ink, on a see-through background.
  expect(img.w).toBeGreaterThan(img.h);
  expect(img.corner[3]).toBe(0);
  const [r, , b] = img.dark;
  expect(b - r, `blue ink: ${img.dark}`).toBeGreaterThan(60);

  const out = await sign(page);
  // The ink, and the mask that makes the rest of it see-through.
  expect(imageCount(out.doc)).toBe(2);
  await expectNoSideScroll(page);
});

test('a typed signature uses the name from the profile and a handwriting font', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('bdnix_name', 'Ada Lovelace'); } catch (e) {} });
  await openSecret(page);
  await openSigs(page);
  await page.locator('#modes label', { hasText: 'Type' }).click();
  await expect(page.locator('#typed')).toHaveValue('Ada Lovelace');
  await expect(page.locator('#fonts span')).toHaveText(Array(4).fill('Ada Lovelace'));
  await page.locator('#typed').fill('   ');
  await expect(page.locator('#fonts span').first()).toHaveText('Your name');
  await expect(page.getByRole('button', { name: 'Add to the page' })).toBeDisabled();
  await page.locator('#typed').fill('Jane   Doe');
  await expect(page.locator('#fonts span').first()).toHaveText('Jane Doe');

  const sizes = [];
  for (const [n, family] of [[1, 'Herr Von Muellerhoff'], [2, 'Mr Dafoe']]) {
    await openSigs(page);
    await page.locator('#fonts label', { has: page.locator(`input[value="${family}"]`) }).click();
    await page.getByRole('button', { name: 'Add to the page' }).click();
    await expect(page.locator('#sigList .sig')).toHaveCount(n);
    const loaded = await page.evaluate((f) => [...document.fonts].some((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded'), family);
    expect(loaded, `${family} loaded from assets/fonts`).toBe(true);
    const img = await savedImage(page, n);
    expect(img.corner[3]).toBe(0);
    expect(img.w).toBeGreaterThan(img.h * 2);
    sizes.push(img.w);
  }
  // Two fonts, two different signatures.
  expect(sizes[0]).not.toBe(sizes[1]);
  await expect(page.locator('#summary')).toHaveText('2 signatures on 1 page');
});

test('an uploaded picture can have its white paper made see-through', async ({ page }) => {
  await openSecret(page);
  await addImage(page, paper(), { see: true, name: 'scan.png' });
  await expect(page.locator('#imageName')).toHaveText('scan.png');
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  // Cropped to the ink, with a little room around it.
  const clear = await savedImage(page, 1);
  expect([clear.w, clear.h]).toEqual([112, 52]);
  expect(clear.corner[3]).toBe(0);

  await addImage(page, paper());
  const kept = await savedImage(page, 2);
  expect([kept.w, kept.h]).toEqual([200, 100]);
  expect(kept.corner).toEqual([255, 255, 255, 255]);
});

test('explains pictures that are blank, broken or not pictures at all', async ({ page }) => {
  await openSecret(page);
  await addImage(page, png(40, 20, () => [255, 255, 255, 255]), { see: true });
  await expect(page.locator('#addHint')).toHaveText('That image looks blank. Try one with darker ink, or untick “Make white paper see-through”.');
  await expect(page.locator('#sigList .sig')).toHaveCount(0);
  await page.locator('#imagePicker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#addHint')).toHaveText('That isn’t an image. Choose a PNG or JPG of your signature.');
  await page.locator('#imagePicker').setInputFiles(upload('broken.png', 'not really a png', 'image/png'));
  await page.getByRole('button', { name: 'Add to the page' }).click();
  await expect(page.locator('#addHint')).toHaveText('broken.png couldn’t be read as an image.');
  await expect(page.locator('#addHint')).toHaveClass(/error/);
  await expect(page.locator('#summary')).toHaveText('Nothing placed yet');
});

test('a signature copied to every page is stored once, and deleting it takes it off', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await page.getByRole('button', { name: 'Copy to every page' }).click();
  await expect(page.locator('#msg')).toHaveText('Copied to 2 more pages.');
  await expect(page.locator('#summary')).toHaveText('3 signatures on 3 pages');
  await page.locator('#layer .placed').click();
  await page.getByRole('button', { name: 'Copy to every page' }).click();
  await expect(page.locator('#msg')).toHaveText('It’s already on every page.');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('#layer .placed')).toHaveCount(1);

  const out = await sign(page);
  await expect(page.locator('#msg')).toHaveText('Done. Added 3 signatures on 3 pages.');
  expect(imageCount(out.doc)).toBe(1);
  for (const i of [0, 1, 2]) expect(contentStreams(out.doc, i).join(''), `page ${i + 1}`).toMatch(/\/Image-\d+ Do/);

  // It's on the open PDF, so deleting it asks first.
  await remove(page, 1);
  const ask = page.locator('.sig-confirm');
  await expect(ask).toHaveText(/^Signature 1 is on 3 pages of secret\.pdf\. Deleting it takes it off them too, so sign and download the PDF first if you want it there\./);
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  await expectNoSideScroll(page);

  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.locator('#sigMsg')).toHaveText('Kept signature 1. It’s still on the pages.');
  await expect(page.getByRole('button', { name: 'Delete signature 1' })).toBeFocused();
  await expect(page.locator('#summary')).toHaveText('3 signatures on 3 pages');
  await expect(page.locator('#downloadBtn')).toBeVisible();

  await remove(page, 1);
  await page.getByRole('button', { name: 'Delete anyway' }).click();
  await expect(page.locator('#sigMsg')).toHaveText('Deleted signature 1 and took it off the pages.');
  await expect(page.locator('#summary')).toHaveText('Nothing placed yet');
  await expect(page.locator('#sigList .sig')).toHaveCount(0);
  await expect(page.locator('#downloadBtn')).toBeHidden();
});

test('a signature that isn’t on the open PDF is deleted straight away', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await addImage(page, paper(), { see: true });
  await expect(page.locator('#summary')).toHaveText('2 signatures on 1 page');
  await page.locator('#layer .placed').nth(1).focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await remove(page, 1);
  await expect(page.locator('.sig-confirm')).toHaveText(/^Signature 1 is on 1 page of secret\.pdf\. Deleting it takes it off that page too,/);
  await page.getByRole('button', { name: 'Keep it' }).click();
  await remove(page, 2);
  await expect(page.locator('.sig-confirm')).toHaveCount(0);
  await expect(page.locator('#sigMsg')).toHaveText('Deleted signature 2.');
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
});

test('the cross on the page closes the PDF and keeps the signatures', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await expect(page.locator('#fileBar .link-btn')).toHaveCount(0);
  await expectNoSideScroll(page);
  await page.getByRole('button', { name: 'Close the PDF' }).click();
  await expect(page.locator('#msg')).toHaveText('Closed secret.pdf. Your signatures are still here for the next one.');
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#fileBar')).toBeHidden();
  await expect(page.locator('#drop')).toBeVisible();
  await expect(page.locator('#sigCount')).toHaveText('1');
  await openSigs(page);
  await expect(page.getByRole('button', { name: 'Put signature 1 on this page' })).toBeDisabled();
  await expect(page.locator('#addLabel')).toHaveText('Create signature');
  // Nothing is in use any more, so it could be deleted without asking.
  await page.keyboard.press('Escape');

  // The next file starts clean, with the signature ready.
  await openSecret(page, { reload: false });
  await expect(page.locator('#summary')).toHaveText('Nothing placed yet');
  await put(page, 1);
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
});

// What the page keeps in IndexedDB, once any write in progress is done.
const stored = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('bdnix-sign', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('files');
  req.onsuccess = () => {
    const get = req.result.transaction('files').objectStore('files').get('signatures');
    get.onsuccess = () => { req.result.close(); resolve(get.result === undefined ? null : get.result.length); };
  };
}));

test('signatures are remembered in this browser only when asked', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await expect(await remember(page)).not.toBeChecked();
  await page.reload();
  await expect(page.locator('#sigList .sig')).toHaveCount(0);

  await openSecret(page);
  await addImage(page, block());
  // Making it is done once it's in the list (and its message is cleared).
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  await (await remember(page)).check();
  await expect(page.locator('#sigMsg')).toHaveText('Your signatures will be here next time, in this browser only.');
  await addImage(page, paper(), { see: true });
  await expect.poll(() => stored(page)).toBe(2);

  await openSecret(page);
  await expect(await remember(page)).toBeChecked();
  await expect(page.locator('#sigList .sig')).toHaveCount(2);
  await put(page, 2);
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await remove(page, 1);
  await expect.poll(() => stored(page)).toBe(1);

  await (await remember(page)).uncheck();
  await expect(page.locator('#sigMsg')).toHaveText('Your signatures are no longer kept in this browser.');
  await expect.poll(() => stored(page)).toBe(null);
  await openSecret(page);
  await expect(await remember(page)).not.toBeChecked();
  await expect(page.locator('#sigList .sig')).toHaveCount(0);

  await (await remember(page)).check();
  await expect(page.locator('#sigMsg')).toHaveText('Signatures you make will be kept in this browser for next time.');
  await expect.poll(() => stored(page)).toBe(0);
});

test('a saved signature that doesn’t make sense is left out', async ({ page }) => {
  await page.goto('/sign-pdf/');
  const good = [...block()];
  await page.evaluate((good) => new Promise((resolve) => {
    const req = indexedDB.open('bdnix-sign', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => {
      const tx = req.result.transaction('files', 'readwrite');
      tx.objectStore('files').put([
        { id: 'ok', png: new Uint8Array(good).buffer, w: 200, h: 100 },
        { id: 'no-size', png: new Uint8Array(good).buffer },
        { id: 'not-bytes', png: 'hello', w: 10, h: 10 },
        null, 'junk', { png: new Uint8Array(good).buffer, w: 1, h: 1 }
      ], 'signatures');
      tx.oncomplete = () => { req.result.close(); resolve(); };
    };
  }), good);
  await openSecret(page);
  await expect(await remember(page)).toBeChecked();
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  await put(page, 1);
  const out = await sign(page);
  expect(imageCount(out.doc)).toBe(1);
});

test('the editor with a signature on the page passes axe', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await expect(page.locator('#layer .placed.on')).toHaveCount(1);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('the file’s name opens a different PDF', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  const name = page.getByRole('button', { name: 'secret.pdf' });
  await expect(name).toHaveAttribute('title', 'Open a different PDF');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), name.click()]);
  await chooser.setFiles(upload('next.pdf', (await secretPdf()).bytes));
  await expect(page.getByRole('button', { name: 'next.pdf' })).toBeVisible();
  await expect(page.locator('#summary')).toHaveText('Nothing placed yet');
});

test('opening another file starts over but keeps your signatures', async ({ page }) => {
  await openSecret(page);
  await addImage(page, block());
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await page.getByRole('button', { name: 'Next page' }).click();
  const pdf = await secretPdf();
  await page.locator('#picker').setInputFiles(upload('other.pdf', pdf.bytes));
  await expect(page.locator('#fileName')).toHaveText('other.pdf');
  await expect(page.locator('#summary')).toHaveText('Nothing placed yet');
  await expect(page.locator('#pageLabel')).toHaveText('Page 1 of 3');
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
});

test('signatures are made, saved and kept in their dialog without a PDF, then placed once one is open', async ({ page }) => {
  await page.goto('/sign-pdf/');
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#sigDialog')).toBeHidden();
  await expect(page.locator('#sigCount')).toBeHidden();
  await page.getByRole('button', { name: 'My signatures' }).click();
  const dialog = page.getByRole('dialog', { name: 'My signatures' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#sigNone')).toBeVisible();
  const create = dialog.getByRole('button', { name: 'Create signature' });
  await expect(create).toBeDisabled();

  await scribble(page);
  await create.click();
  await expect(page.locator('#sigMsg')).toHaveText('Made signature 1. Save it as an image, or open a PDF to put it on a page.');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  // Nothing to put it on yet.
  await expect(page.getByRole('button', { name: 'Put signature 1 on this page' })).toBeDisabled();
  await expect(page.locator('#sigTip')).toBeHidden();
  const img = await savedImage(page, 1);
  expect(img.corner[3]).toBe(0);

  await page.locator('#modes label', { hasText: 'Type' }).click();
  await page.locator('#typed').fill('Jane Doe');
  await create.click();
  await expect(page.locator('#sigList .sig')).toHaveCount(2);
  await (await remember(page)).check();
  await expect.poll(() => stored(page)).toBe(2);
  await expectNoSideScroll(page);

  // Esc, the close button and a click outside all close it.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#sigCount')).toHaveText('2');
  await openSigs(page);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await openSigs(page);
  await page.mouse.click(3, 3);
  await expect(dialog).toBeHidden();

  // Still there next time, and ready for a PDF.
  await page.reload();
  await expect(page.locator('#sigCount')).toHaveText('2');
  const pdf = await secretPdf();
  await page.locator('#picker').setInputFiles(upload('secret.pdf', pdf.bytes));
  await expect(page.locator('#pageCanvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#placeTip')).toBeVisible();
  await page.getByRole('button', { name: 'Add a signature' }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#sigTip')).toHaveText('Tap a signature to put it on the page.');
  await expect(page.locator('#addLabel')).toHaveText('Add to the page');
  await page.getByRole('button', { name: 'Put signature 2 on this page' }).click();
  // Picking one closes the dialog and puts it on the page.
  await expect(dialog).toBeHidden();
  await expect(page.locator('#summary')).toHaveText('1 signature on 1 page');
  await expect(page.locator('#placeTip')).toBeHidden();
  await expect(page.locator('#layer .placed')).toBeFocused();
  const out = await sign(page);
  expect(out.name).toBe('secret-signed.pdf');
});

test('the signatures dialog passes axe', async ({ page }) => {
  await page.goto('/sign-pdf/');
  await page.getByRole('button', { name: 'My signatures' }).click();
  await scribble(page);
  await page.getByRole('button', { name: 'Create signature' }).click();
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('a drawn line leaves more ink where the pen moves slowly, as real ink does', async ({ page }) => {
  // A frozen clock, so how fast the pen moves is exact.
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto('/sign-pdf/');
  await openSigs(page);
  const box = await page.locator('#pad').boundingBox();
  // The same wave, with ms between each 12 px step.
  async function wave(ms){
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      await page.clock.runFor(ms);
      await page.mouse.move(box.x + 20 + i * 12, box.y + box.height / 2 - Math.sin(i / 3) * 40);
    }
    await page.mouse.up();
    await page.getByRole('button', { name: 'Create signature' }).click();
  }
  await wave(200);
  await expect(page.locator('#sigList .sig')).toHaveCount(1);
  await wave(4);
  await expect(page.locator('#sigList .sig')).toHaveCount(2);

  // How many pixels of ink each signature has.
  const ink = async (n) => page.evaluate(async (href) => {
    const bmp = await createImageBitmap(await (await fetch(href)).blob());
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
    return n;
  }, await page.getByRole('link', { name: `Save signature ${n} as an image` }).getAttribute('href'));
  const slow = await ink(1), fast = await ink(2);
  expect(slow / fast, `slow ${slow} px of ink, fast ${fast}`).toBeGreaterThan(2);
});

test('rejects files that are not PDFs', async ({ page }) => {
  await page.goto('/sign-pdf/');
  await page.locator('#picker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#msg')).toHaveText('That isn’t a PDF file. Choose a .pdf to sign.');
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#drop')).toBeVisible();
  await page.locator('#picker').setInputFiles(upload('broken.pdf', 'not really a pdf'));
  await expect(page.locator('#msg')).toHaveText('broken.pdf could not be read as a PDF.');
});
