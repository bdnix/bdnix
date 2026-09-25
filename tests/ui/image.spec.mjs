import fs from 'node:fs';
import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { png, photo, gif, kind, inspect, near } from './images.mjs';

const file = (name, buffer, mimeType) => ({ name, mimeType, buffer: Buffer.from(buffer) });
const holiday = () => file('holiday photo.png', photo(600, 400), 'image/png');
// The photo's colours, left half and right half, give or take its grain.
const RED = [212, 130, 52, 255], BLUE = [52, 130, 212, 255];
const SIDES = [[0.25, 0.5], [0.75, 0.5]];

// Whether each half of a row's thumbnail is mostly red or blue.
function tileColours(page, row){
  return page.locator('.track .thumb').nth(row).evaluate((tile) => {
    const ctx = tile.getContext('2d');
    return [0.25, 0.75].map((fx) => {
      const [r, , b, a] = ctx.getImageData(Math.floor(fx * tile.width), tile.height / 2, 1, 1).data;
      return !a ? 'blank' : r > b ? 'red' : 'blue';
    });
  });
}

async function fetchDownload(page, row){
  const [dl] = await Promise.all([page.waitForEvent('download'), row.locator('.dl').click()]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
}

// Compresses the one image on the list and downloads the result.
async function compressOne(page){
  await page.getByRole('button', { name: 'Compress 1 image' }).click();
  await expect(page.locator('#msg')).toHaveText(/^Done\. /);
  return fetchDownload(page, page.locator('.track'));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/compress-image/');
});

test('describes what it does', async ({ page }) => {
  await expect(page).toHaveTitle('bdnix — Compress Images');
  await expect(page.locator('h1')).toHaveText('Compress Images');
  await expect(page.locator('.features li')).toHaveCount(5);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /never uploaded/);
  await expectNoSideScroll(page);
});

test('compresses a PNG to a much smaller JPEG of the same picture', async ({ page }) => {
  const original = holiday();
  await expect(page.locator('#filesWrap')).toBeHidden();
  await page.locator('#picker').setInputFiles([original]);
  await expect(page.locator('#summary')).toHaveText('1 image');
  await expect(page.locator('.track .file-meta')).toHaveText(/^\d+ KB$/);
  // The thumbnail shows the photo's middle: red on the left, blue on the right.
  await expect.poll(() => tileColours(page, 0)).toEqual(['red', 'blue']);

  await page.locator('#format').selectOption('jpeg');
  await expect(page.locator('#qualityField')).toBeVisible();
  await expect(page.locator('#hint')).toHaveText('');
  await page.getByRole('button', { name: 'Compress 1 image' }).click();
  await expect(page.locator('#msg')).toHaveText(/^Done\. Compressed 1 image: \d+ KB → \d+ KB, \d+% smaller\.$/);
  await expect(page.locator('.track .file-meta')).toHaveText(/^600×400 · \d+ KB → \d+ KB · \d+% smaller$/);
  await expect(page.getByRole('link', { name: 'Download holiday photo-compressed.jpg' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Compress' })).toBeDisabled();

  const out = await fetchDownload(page, page.locator('.track'));
  expect(out.name).toBe('holiday photo-compressed.jpg');
  expect(kind(out.bytes)).toBe('jpeg');
  expect(out.bytes.length).toBeLessThan(original.buffer.length / 4);
  const img = await inspect(page, out.bytes, SIDES);
  expect([img.width, img.height]).toEqual([600, 400]);
  expect(near(img.colours[0], RED)).toBe(true);
  expect(near(img.colours[1], BLUE)).toBe(true);
  await expectNoSideScroll(page);
});

test('lower quality makes a smaller file; changing a setting clears the result', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday()]);
  await page.locator('#format').selectOption('webp');
  await page.locator('#quality').fill('90');
  await expect(page.locator('#qualityOut')).toHaveText('90%');
  await page.getByRole('button', { name: 'Compress 1 image' }).click();
  await expect(page.locator('#msg')).toHaveText(/^Done\. /);
  const fine = await fetchDownload(page, page.locator('.track'));

  await page.locator('#quality').fill('30');
  await expect(page.locator('.track .dl')).toHaveCount(0);
  await expect(page.locator('#msg')).toHaveText('');
  await page.getByRole('button', { name: 'Compress 1 image' }).click();
  await expect(page.locator('#msg')).toHaveText(/^Done\. /);
  const small = await fetchDownload(page, page.locator('.track'));

  expect(fine.name).toBe('holiday photo-compressed.webp');
  expect(kind(fine.bytes)).toBe('webp');
  expect(kind(small.bytes)).toBe('webp');
  expect(small.bytes.length).toBeLessThan(fine.bytes.length);
  const img = await inspect(page, small.bytes, SIDES);
  expect(near(img.colours[0], RED)).toBe(true);
  expect(near(img.colours[1], BLUE)).toBe(true);
});

test('shrinks a big image so its longest side fits', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('tall.png', photo(300, 1000), 'image/png')]);
  await page.locator('#format').selectOption('jpeg');
  await page.locator('#longest').selectOption('800');
  await page.getByRole('button', { name: 'Compress 1 image' }).click();
  await expect(page.locator('.track .file-meta')).toHaveText(/^240×800 · /);
  const out = await fetchDownload(page, page.locator('.track'));
  const img = await inspect(page, out.bytes, SIDES);
  expect([img.width, img.height]).toEqual([240, 800]);
  expect(near(img.colours[0], RED)).toBe(true);
  expect(near(img.colours[1], BLUE)).toBe(true);
});

test('a small image is never enlarged', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('icon.png', photo(200, 100), 'image/png')]);
  await page.locator('#format').selectOption('webp');
  await page.locator('#longest').selectOption('1920');
  await page.getByRole('button', { name: 'Compress 1 image' }).click();
  await expect(page.locator('.track .file-meta')).toHaveText(/^200×100 · /);
  const img = await inspect(page, (await fetchDownload(page, page.locator('.track'))).bytes);
  expect([img.width, img.height]).toEqual([200, 100]);
});

test('an image that can’t get smaller comes back unchanged', async ({ page }) => {
  // A JPEG saved at low quality only grows when saved again at the best.
  await page.locator('#picker').setInputFiles([holiday()]);
  await page.locator('#format').selectOption('jpeg');
  await page.locator('#quality').fill('10');
  const rough = await compressOne(page);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('#filesWrap')).toBeHidden();

  await page.locator('#picker').setInputFiles([file('rough.jpg', rough.bytes, 'image/jpeg')]);
  await page.locator('#format').selectOption('same');
  await page.locator('#quality').fill('100');
  const out = await compressOne(page);
  await expect(page.locator('.track .file-meta')).toHaveText(`600×400 · ${Math.round(rough.bytes.length / 1024)} KB · already as small as these settings allow, so it’s unchanged`);
  await expect(page.locator('#msg')).toHaveText(/^Done\. Compressed 1 image: (\d+ KB) → \1, no smaller\.$/);
  expect(out.name).toBe('rough-compressed.jpg');
  expect(out.bytes.equals(rough.bytes)).toBe(true);

  // Made smaller, it's a new file even if that file is bigger.
  await page.locator('#longest').selectOption('480');
  await compressOne(page);
  await expect(page.locator('.track .file-meta')).toHaveText(/^480×320 · /);
});

test('clear areas turn white in a JPEG, and stay clear in a PNG', async ({ page }) => {
  // Left half see-through, right half solid blue.
  const logo = file('logo.png', png(100, 60, (x) => (x < 50 ? [0, 0, 0, 0] : [30, 60, 220, 255])), 'image/png');
  await page.locator('#picker').setInputFiles([logo]);
  await page.locator('#format').selectOption('jpeg');
  let img = await inspect(page, (await compressOne(page)).bytes, SIDES);
  expect(near(img.colours[0], [255, 255, 255, 255], 8)).toBe(true);
  expect(near(img.colours[1], [30, 60, 220, 255], 16)).toBe(true);

  await page.locator('#format').selectOption('png');
  const out = await compressOne(page);
  expect(out.name).toBe('logo-compressed.png');
  expect(kind(out.bytes)).toBe('png');
  img = await inspect(page, out.bytes, SIDES);
  expect(img.colours).toEqual([[0, 0, 0, 0], [30, 60, 220, 255]]);
});

test('quality is hidden for PNG, which gets a hint instead', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday()]);
  // "Same as original" for a PNG is a PNG.
  await expect(page.locator('#qualityField')).toBeHidden();
  await expect(page.locator('#hint')).toHaveText(/quality doesn’t apply/);
  await page.locator('#format').selectOption('webp');
  await expect(page.locator('#qualityField')).toBeVisible();
  await expect(page.locator('#hint')).toBeHidden();

  // With a JPEG on the list too, quality applies to that one.
  await page.locator('#format').selectOption('jpeg');
  const jpeg = await compressOne(page);
  await page.locator('#format').selectOption('same');
  await page.locator('#picker').setInputFiles([file('photo.jpg', jpeg.bytes, 'image/jpeg')]);
  await expect(page.locator('#summary')).toHaveText('2 images');
  await expect(page.locator('#qualityField')).toBeVisible();
  await expect(page.locator('#hint')).toHaveText(/quality doesn’t apply/);
  await expectNoSideScroll(page);
});

test('compresses several images, one download each; a GIF becomes a JPEG', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday(), file('dot.gif', gif([200, 60, 40]), 'image/gif')]);
  await expect(page.locator('#summary')).toHaveText('2 images');
  await expect(page.locator('#qualityField')).toBeVisible();
  await page.getByRole('button', { name: 'Compress 2 images' }).click();
  await expect(page.locator('#compressLabel')).toHaveText('Compress');
  await expect(page.locator('#msg')).toHaveText(/^Done\. Compressed 2 images: /);
  await expect(page.locator('.track .dl')).toHaveCount(2);

  const first = await fetchDownload(page, page.locator('.track').nth(0));
  expect(first.name).toBe('holiday photo-compressed.png');
  expect(kind(first.bytes)).toBe('png');
  const dot = await fetchDownload(page, page.locator('.track').nth(1));
  expect(dot.name).toBe('dot-compressed.jpg');
  expect(kind(dot.bytes)).toBe('jpeg');
  const img = await inspect(page, dot.bytes, [[0, 0]]);
  expect([img.width, img.height]).toEqual([1, 1]);
  expect(near(img.colours[0], [200, 60, 40, 255], 12)).toBe(true);
});

test('skips files that aren’t images, and marks images the browser can’t open', async ({ page }) => {
  await page.locator('#picker').setInputFiles([
    file('notes.txt', 'hello', 'text/plain'),
    file('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml')
  ]);
  await expect(page.locator('#msg')).toHaveText('Skipped: notes.txt, logo.svg aren’t images.');
  await expect(page.locator('#filesWrap')).toBeHidden();

  await page.locator('#picker').setInputFiles([file('broken.png', 'not really a png', 'image/png'), holiday()]);
  await expect(page.locator('#msg')).toHaveText('');
  await page.locator('#picker').setInputFiles([file('readme.md', '# hi', 'text/markdown')]);
  await expect(page.locator('#msg')).toHaveText('Skipped: readme.md isn’t an image.');
  await page.getByRole('button', { name: 'Compress 2 images' }).click();
  await expect(page.locator('#msg')).toHaveText(/^Compressed 1 image: \d+ KB → \d+ KB, \d+% smaller\. 1 image couldn’t be compressed\.$/);
  await expect(page.locator('#msg')).toHaveClass(/error/);
  await expect(page.locator('.track').nth(0).locator('.file-meta')).toHaveText('Your browser can’t open this image');
  await expect(page.locator('.track').nth(0).locator('.file-meta')).toHaveClass(/error/);
  await expect(page.locator('.track').nth(0).locator('.thumb')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.track .dl')).toHaveCount(1);
});

test('says so when the browser can’t save the chosen format', async ({ page }) => {
  // Safari saves a PNG when asked for a WebP.
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(done, type, quality){
      return toBlob.call(this, done, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });
  await page.reload();
  await page.locator('#picker').setInputFiles([holiday()]);
  await page.locator('#format').selectOption('webp');
  await page.getByRole('button', { name: 'Compress 1 image' }).click();
  await expect(page.locator('.track .file-meta')).toHaveText('Couldn’t compress: your browser can’t save WebP images. Choose another format.');
  await expect(page.locator('#msg')).toHaveText('1 image couldn’t be compressed.');
});

test('images can be removed one at a time, or all at once', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday(), file('b.png', photo(50, 50), 'image/png')]);
  await expect(page.getByRole('button', { name: 'Compress 2 images' })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove holiday photo.png' }).click();
  await expect(page.locator('#summary')).toHaveText('1 image');
  await expect(page.locator('.track .file-name')).toHaveText('b.png');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('#filesWrap')).toBeHidden();
});

test('images dropped on the page are added', async ({ page }) => {
  const bytes = [...photo(40, 40)];
  const dt = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' }));
    return dt;
  }, bytes);
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt });
  await expect(page.locator('#drop')).toHaveClass(/over/);
  await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
  await expect(page.locator('#drop')).not.toHaveClass(/over/);
  await expect(page.locator('.track .file-name')).toHaveText('dropped.png');
});
