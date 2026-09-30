import fs from 'node:fs';
import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { png, photo, kind, inspect, near } from './images.mjs';

const file = (name, buffer, mimeType) => ({ name, mimeType, buffer: Buffer.from(buffer) });
const holiday = () => file('holiday photo.png', photo(600, 400), 'image/png');
// The photo's colours, left half and right half, give or take its grain.
const RED = [212, 130, 52, 255], BLUE = [52, 130, 212, 255];
const WHITE = [255, 255, 255, 255], BLACK = [0, 0, 0, 255];

async function fetchDownload(page, row){
  const [dl] = await Promise.all([page.waitForEvent('download'), row.locator('.dl').click()]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
}

// Fits the one image on the list and downloads the result.
async function fitOne(page){
  await page.getByRole('button', { name: 'Resize 1 image' }).click();
  await expect(page.locator('#msg')).toHaveText('Done. 1 image ready to download.');
  return fetchDownload(page, page.locator('.track'));
}

// The preview's size, and the colour at each [x, y] given as a fraction of
// its width and height.
function previewAt(page, points){
  return page.locator('#previewCanvas').evaluate((c, points) => {
    const ctx = c.getContext('2d');
    return {
      width: c.width, height: c.height,
      colours: points.map(([fx, fy]) => Array.from(ctx.getImageData(Math.floor(fx * c.width), Math.floor(fy * c.height), 1, 1).data))
    };
  }, points);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/fit-to-frame/');
});

test('describes what it does', async ({ page }) => {
  await expect(page).toHaveTitle('Resize Without Cropping — Fit any shape, free | bdnix');
  await expect(page.locator('h1')).toHaveText('Resize Without Cropping');
  await expect(page.locator('.features li')).toHaveCount(5);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /never uploaded/);
  await expect(page.locator('#filesWrap')).toBeHidden();
  await expectNoSideScroll(page);
});

test('adds white space above and below a landscape photo to make it square', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday()]);
  await expect(page.locator('#summary')).toHaveText('1 image');
  await expect(page.locator('.track .file-meta')).toHaveText(/^\d+ KB$/);
  await expect(page.locator('#shape')).toHaveValue('square');
  await expect(page.locator('#previewNav')).toBeHidden();

  // The preview shows the result: white bands, then the photo.
  await expect(page.locator('#previewSize')).toHaveText('600 × 600 px');
  await expect(page.locator('#previewCanvas')).toBeVisible();
  await expect(page.locator('#previewNote')).toBeHidden();
  const shown = await previewAt(page, [[0.5, 0.05], [0.25, 0.5], [0.75, 0.5], [0.5, 0.95]]);
  expect([shown.width, shown.height]).toEqual([600, 600]);
  expect(shown.colours[0]).toEqual(WHITE);
  expect(near(shown.colours[1], RED)).toBe(true);
  expect(near(shown.colours[2], BLUE)).toBe(true);
  expect(shown.colours[3]).toEqual(WHITE);

  const out = await fitOne(page);
  await expect(page.locator('.track .file-meta')).toHaveText(/^600×600 · \d+ KB$/);
  await expect(page.getByRole('link', { name: 'Download holiday photo-framed.png' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Resize images' })).toBeDisabled();
  expect(out.name).toBe('holiday photo-framed.png');
  expect(kind(out.bytes)).toBe('png');
  // The photo is 400 high, in rows 100 to 499.
  const img = await inspect(page, out.bytes, [[0.5, 0], [0.5, 99 / 600], [0.25, 100 / 600], [0.75, 0.5], [0.25, 499 / 600], [0.5, 500 / 600], [0.5, 599 / 600]]);
  expect([img.width, img.height]).toEqual([600, 600]);
  expect(img.colours[0]).toEqual(WHITE);
  expect(img.colours[1]).toEqual(WHITE);
  expect(near(img.colours[2], RED)).toBe(true);
  expect(near(img.colours[3], BLUE)).toBe(true);
  expect(near(img.colours[4], RED)).toBe(true);
  expect(img.colours[5]).toEqual(WHITE);
  expect(img.colours[6]).toEqual(WHITE);
  await expectNoSideScroll(page);
});

test('adds space to the sides of a tall photo, in the colour chosen', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('tall.png', photo(300, 600), 'image/png')]);
  await page.getByRole('button', { name: 'Black' }).click();
  await expect(page.getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'White' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#color')).toHaveValue('#000000');
  await page.locator('#shape').selectOption('portrait');
  await expect(page.locator('#width')).toHaveValue('1080');
  await expect(page.locator('#height')).toHaveValue('1350');
  await expect(page.locator('#previewSize')).toHaveText('480 × 600 px');

  let img = await inspect(page, (await fitOne(page)).bytes, [[0.05, 0.5], [0.3, 0.5], [0.7, 0.5], [0.95, 0.5]]);
  expect([img.width, img.height]).toEqual([480, 600]);
  expect(img.colours[0]).toEqual(BLACK);
  expect(near(img.colours[1], RED)).toBe(true);
  expect(near(img.colours[2], BLUE)).toBe(true);
  expect(img.colours[3]).toEqual(BLACK);

  // Any other colour, from the colour picker. No swatch is marked then.
  await page.locator('#color').fill('#ff8800');
  await expect(page.locator('.track .dl')).toHaveCount(0);
  await expect(page.locator('#swatches .on')).toHaveCount(0);
  const shown = await previewAt(page, [[0.05, 0.5]]);
  expect(shown.colours[0]).toEqual([255, 136, 0, 255]);
  img = await inspect(page, (await fitOne(page)).bytes, [[0.05, 0.5], [0.95, 0.5]]);
  expect(img.colours).toEqual([[255, 136, 0, 255], [255, 136, 0, 255]]);
});

test('an exact size scales the photo to fit, and saves JPEG when asked', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday()]);
  await page.locator('#shape').selectOption('story');
  await expect(page.locator('#exactLabel')).toHaveText('Exactly 1080 × 1920');
  await page.getByText('Exactly 1080 × 1920').click();
  await expect(page.locator('#previewSize')).toHaveText('1080 × 1920 px');
  await page.locator('#format').selectOption('jpeg');

  const out = await fitOne(page);
  await expect(page.locator('.track .file-meta')).toHaveText(/^1080×1920 · \d+ KB$/);
  expect(out.name).toBe('holiday photo-framed.jpg');
  expect(kind(out.bytes)).toBe('jpeg');
  // The photo is scaled to 1080 × 720, in the middle.
  const img = await inspect(page, out.bytes, [[0.5, 0.1], [0.25, 0.5], [0.75, 0.5], [0.5, 0.9]]);
  expect([img.width, img.height]).toEqual([1080, 1920]);
  expect(near(img.colours[0], WHITE, 8)).toBe(true);
  expect(near(img.colours[1], RED)).toBe(true);
  expect(near(img.colours[2], BLUE)).toBe(true);
  expect(near(img.colours[3], WHITE, 8)).toBe(true);
});

test('a margin adds space on every side', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('square.png', photo(400, 400), 'image/png')]);
  await page.locator('#margin').fill('20');
  await expect(page.locator('#marginOut')).toHaveText('20%');
  // 400 is 60% of the frame, so it's 666 or 667 wide.
  await expect(page.locator('#previewSize')).toHaveText(/^66[67] × 66[67] px$/);
  const img = await inspect(page, (await fitOne(page)).bytes, [[0.1, 0.5], [0.5, 0.1], [0.3, 0.5], [0.7, 0.5], [0.9, 0.5], [0.5, 0.9]]);
  expect(img.colours[0]).toEqual(WHITE);
  expect(img.colours[1]).toEqual(WHITE);
  expect(near(img.colours[2], RED)).toBe(true);
  expect(near(img.colours[3], BLUE)).toBe(true);
  expect(img.colours[4]).toEqual(WHITE);
  expect(img.colours[5]).toEqual(WHITE);
});

test('a size can be typed in, and a wrong one is pointed out', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday()]);
  await page.locator('#width').fill('300');
  await expect(page.locator('#shape')).toHaveValue('custom');
  await page.locator('#height').fill('100');
  await expect(page.locator('#previewSize')).toHaveText('1200 × 400 px');
  await expect(page.locator('#exactLabel')).toHaveText('Exactly 300 × 100');

  await page.locator('#height').fill('abc');
  await expect(page.locator('#height')).toHaveClass(/invalid/);
  await expect(page.locator('#width')).not.toHaveClass(/invalid/);
  await expect(page.locator('#dimsHint')).toHaveText('Width and height are whole numbers of pixels, from 1 to 10000.');
  await expect(page.locator('#dimsHint')).toHaveClass(/error/);
  await expect(page.locator('#exactLabel')).toHaveText('Exact size');
  await expect(page.locator('#fitBtn')).toBeDisabled();
  // Enter doesn't reload the page.
  await page.locator('#height').press('Enter');
  await expect(page.locator('#summary')).toHaveText('1 image');

  // Typing a preset's size picks it.
  await page.locator('#width').fill('1920');
  await page.locator('#height').fill('1080');
  await expect(page.locator('#shape')).toHaveValue('wide');
  await expect(page.locator('#height')).not.toHaveClass(/invalid/);
  await expect(page.locator('#dimsHint')).toBeHidden();
  await expect(page.locator('#previewSize')).toHaveText('711 × 400 px');
  // Choosing Custom keeps the size typed.
  await page.locator('#shape').selectOption('custom');
  await expect(page.locator('#width')).toHaveValue('1920');
  const img = await inspect(page, (await fitOne(page)).bytes);
  expect([img.width, img.height]).toEqual([711, 400]);
  await expectNoSideScroll(page);
});

test('several images: each is previewed and gets its own download', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday(), file('tall.png', photo(200, 400), 'image/png')]);
  await expect(page.locator('#summary')).toHaveText('2 images');
  await expect(page.locator('#previewNav')).toBeVisible();
  await expect(page.locator('#imageLabel')).toHaveText('Image 1 of 2');
  await expect(page.locator('#prevImage')).toBeDisabled();
  await expect(page.locator('#previewSize')).toHaveText('600 × 600 px');
  await expect(page.locator('.track').nth(0)).toHaveClass(/current/);

  await page.locator('#nextImage').click();
  await expect(page.locator('#imageLabel')).toHaveText('Image 2 of 2');
  await expect(page.locator('#nextImage')).toBeDisabled();
  await expect(page.locator('#previewSize')).toHaveText('400 × 400 px');
  await expect(page.locator('.track').nth(1)).toHaveClass(/current/);
  await page.getByRole('button', { name: 'Preview holiday photo.png' }).click();
  await expect(page.locator('#imageLabel')).toHaveText('Image 1 of 2');
  await expect(page.locator('#previewSize')).toHaveText('600 × 600 px');

  await page.getByRole('button', { name: 'Resize 2 images' }).click();
  await expect(page.locator('#fitLabel')).toHaveText('Resize images');
  await expect(page.locator('#msg')).toHaveText('Done. 2 images ready to download.');
  const first = await fetchDownload(page, page.locator('.track').nth(0));
  const second = await fetchDownload(page, page.locator('.track').nth(1));
  expect(first.name).toBe('holiday photo-framed.png');
  expect(second.name).toBe('tall-framed.png');
  expect([(await inspect(page, second.bytes)).width, (await inspect(page, second.bytes)).height]).toEqual([400, 400]);

  // Removing the image shown moves the preview on to the next.
  await page.getByRole('button', { name: 'Remove holiday photo.png' }).click();
  await expect(page.locator('#summary')).toHaveText('1 image');
  await expect(page.locator('#previewNav')).toBeHidden();
  await expect(page.locator('#previewSize')).toHaveText('400 × 400 px');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('#filesWrap')).toBeHidden();

  // New images are shown first.
  await page.locator('#picker').setInputFiles([holiday()]);
  await page.locator('#picker').setInputFiles([file('tall.png', photo(200, 400), 'image/png')]);
  await expect(page.locator('#imageLabel')).toHaveText('Image 2 of 2');
  await expect(page.locator('#previewSize')).toHaveText('400 × 400 px');
  await page.locator('#prevImage').click();
  await expect(page.locator('#previewSize')).toHaveText('600 × 600 px');
  // Removing an image before the one shown keeps showing it.
  await page.locator('#nextImage').click();
  await page.getByRole('button', { name: 'Remove holiday photo.png' }).click();
  await expect(page.locator('.track')).toHaveClass(/current/);
  await expect(page.locator('#previewSize')).toHaveText('400 × 400 px');
  await expectNoSideScroll(page);
});

test('transparent areas take the frame’s colour', async ({ page }) => {
  // Left half see-through, right half solid blue.
  const logo = file('logo.png', png(100, 50, (x) => (x < 50 ? [0, 0, 0, 0] : [30, 60, 220, 255])), 'image/png');
  await page.locator('#picker').setInputFiles([logo]);
  await page.locator('#color').fill('#00ff00');
  const img = await inspect(page, (await fitOne(page)).bytes, [[0.5, 0.1], [0.25, 0.5], [0.75, 0.5]]);
  expect(img.colours).toEqual([[0, 255, 0, 255], [0, 255, 0, 255], [30, 60, 220, 255]]);
});

test('skips files that aren’t images, and marks images the browser can’t open', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('notes.txt', 'hello', 'text/plain')]);
  await expect(page.locator('#msg')).toHaveText('Skipped: notes.txt isn’t an image.');
  await expect(page.locator('#filesWrap')).toBeHidden();

  await page.locator('#picker').setInputFiles([file('broken.png', 'not really a png', 'image/png')]);
  await expect(page.locator('#msg')).toHaveText('');
  await expect(page.locator('#previewNote')).toHaveText('Your browser can’t open this image');
  await expect(page.locator('#previewCanvas')).toBeHidden();
  await page.locator('#picker').setInputFiles([holiday(), file('a.md', '#', 'text/markdown'), file('b.txt', '', 'text/plain')]);
  await expect(page.locator('#msg')).toHaveText('Skipped: a.md, b.txt aren’t images.');
  await expect(page.locator('#previewSize')).toHaveText('600 × 600 px');

  await page.getByRole('button', { name: 'Resize 2 images' }).click();
  await expect(page.locator('#msg')).toHaveText('1 image ready to download. 1 image couldn’t be resized.');
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
  await page.getByRole('button', { name: 'Resize 1 image' }).click();
  await expect(page.locator('.track .file-meta')).toHaveText('Couldn’t fit: your browser can’t save WebP images. Choose another format.');
  await expect(page.locator('#msg')).toHaveText('1 image couldn’t be resized.');
});

test('saves WebP, and a changed setting clears the result', async ({ page }) => {
  await page.locator('#picker').setInputFiles([holiday()]);
  await page.locator('#format').selectOption('webp');
  const out = await fitOne(page);
  expect(out.name).toBe('holiday photo-framed.webp');
  expect(kind(out.bytes)).toBe('webp');
  await page.getByRole('button', { name: 'Light grey' }).click();
  await expect(page.locator('.track .dl')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resize 1 image' })).toBeEnabled();
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
  await expect(page.locator('.track .file-name')).toHaveText('dropped.png');
  await expect(page.locator('#previewSize')).toHaveText('40 × 40 px');
});
