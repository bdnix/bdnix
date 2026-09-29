import fs from 'node:fs';
import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { png, kind, inspect, near } from './images.mjs';

// Photos of one colour each, so the tests can tell which went where.
const COLOURS = [
  [220, 40, 40], [40, 180, 60], [40, 70, 220], [230, 210, 40], [200, 40, 200],
  [40, 200, 210], [240, 140, 30], [110, 50, 160], [130, 130, 130], [20, 20, 20], [250, 190, 200]
];
const photo = (i, width = 120, height = 80) => ({
  name: `photo ${i + 1}.png`, mimeType: 'image/png',
  buffer: png(width, height, () => [...COLOURS[i], 255])
});
const photos = (n) => Array.from({ length: n }, (_, i) => photo(i));
const rgba = (i) => [...COLOURS[i], 255];
const WHITE = [255, 255, 255, 255];

async function add(page, files){
  await page.locator('#picker').setInputFiles(files);
}

// Waits until every photo is loaded and the preview is drawn.
async function ready(page){
  await expect(page.locator('#previewCanvas')).toBeVisible();
  await expect(page.locator('#downloadBtn')).toBeEnabled();
}

async function download(page){
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#downloadBtn').click()]);
  const out = { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
  await expect(page.locator('#msg')).toHaveText(new RegExp('^Saved ' + out.name.replace('.', '\\.') + ': '));
  return out;
}

// The middle of each cell of a layout, as fractions of the collage.
const middles = (cells) => cells.map(([x, y, w, h]) => [x + w / 2, y + h / 2]);
const cellsOf = (page, count, id) => page.evaluate(([count, id]) => window.bdnixCollage.layout(count, id).cells, [count, id]);

test.beforeEach(async ({ page }) => {
  await page.goto('/photo-collage/');
});

test('describes what it does', async ({ page }) => {
  await expect(page).toHaveTitle('Photo Collage Maker — 3, 6 or 9 photos free | bdnix');
  await expect(page.locator('h1')).toHaveText('Photo Collage');
  await expect(page.locator('.features li')).toHaveCount(5);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /never uploaded/);
  await expect(page.locator('#editor')).toBeHidden();
  await expectNoSideScroll(page);
});

test('puts 3 photos side by side in a square JPEG', async ({ page }) => {
  await add(page, photos(3));
  await ready(page);
  await expect(page.locator('#summary')).toHaveText('3 photos');
  await expect(page.locator('.layout-opt input')).toHaveCount(4);
  await expect(page.getByRole('radio', { name: 'Side by side' })).toBeChecked();
  await expect(page.locator('#gapOut')).toHaveText('25 px');
  await expect(page.locator('#radiusOut')).toHaveText('Square');
  await expect(page.locator('#sizeHint')).toHaveText('2048 × 2048 px');

  const out = await download(page);
  expect(out.name).toBe('collage.jpg');
  expect(kind(out.bytes)).toBe('jpeg');
  await expect(page.locator('#msg')).toHaveText(/^Saved collage\.jpg: 2048 × 2048 px, [\d.]+ [KM]B\.$/);
  // Each photo fills a third, with white spacing at the edges.
  const img = await inspect(page, out.bytes, [[1 / 6, 0.5], [0.5, 0.5], [5 / 6, 0.5], [0.004, 0.5], [0.5, 0.004]]);
  expect([img.width, img.height]).toEqual([2048, 2048]);
  expect(near(img.colours[0], rgba(0))).toBe(true);
  expect(near(img.colours[1], rgba(1))).toBe(true);
  expect(near(img.colours[2], rgba(2))).toBe(true);
  expect(near(img.colours[3], WHITE)).toBe(true);
  expect(near(img.colours[4], WHITE)).toBe(true);
  await expect(page.locator('#downloadBtn')).toBeEnabled();
  await expectNoSideScroll(page);
});

test('9 photos in the feature layout, as a story-shaped PNG on black', async ({ page }) => {
  await add(page, photos(9));
  await ready(page);
  await expect(page.locator('.layout-opt input')).toHaveCount(4);
  await expect(page.getByRole('radio', { name: 'Grid' })).toBeChecked();
  await page.getByRole('radio', { name: 'Feature' }).check({ force: true });
  await page.locator('#shape').selectOption('story');
  await page.locator('#longest').selectOption('1080');
  await page.locator('#gap').fill('0');
  await page.locator('#background').fill('#000000');
  await page.locator('label:has(input[value=png])').click();
  await expect(page.locator('#gapOut')).toHaveText('None');
  await expect(page.locator('#sizeHint')).toHaveText('608 × 1080 px');

  const out = await download(page);
  expect(out.name).toBe('collage.png');
  expect(kind(out.bytes)).toBe('png');
  const cells = await cellsOf(page, 9, 'feature');
  const img = await inspect(page, out.bytes, middles(cells));
  expect([img.width, img.height]).toEqual([608, 1080]);
  img.colours.forEach((c, i) => expect(near(c, rgba(i), 4), `photo ${i + 1}`).toBe(true));
});

test('every layout puts each photo in its own place', async ({ page }) => {
  for (const count of [3, 6, 9]) {
    if (count > 3) await page.locator('#clearBtn').click();
    await add(page, photos(count));
    await ready(page);
    await page.locator('label:has(input[value=png])').click();
    const ids = await page.locator('.layout-opt input').evaluateAll((els) => els.map((e) => e.value));
    for (const id of ids) {
      await page.locator(`.layout-opt input[value="${id}"]`).check({ force: true });
      const out = await download(page);
      const img = await inspect(page, out.bytes, middles(await cellsOf(page, count, id)));
      img.colours.forEach((c, i) => expect(near(c, rgba(i), 4), `${count} ${id}: photo ${i + 1}`).toBe(true));
    }
  }
});

test('tapping two photos swaps them, in the list or the preview', async ({ page }) => {
  await add(page, photos(3));
  await ready(page);
  const first = page.getByRole('button', { name: 'Photo 1: photo 1.png' });
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await first.click();
  await page.getByRole('button', { name: 'Photo 3: photo 3.png' }).click();
  await expect(page.getByRole('button', { name: 'Photo 1: photo 3.png' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Photo 3: photo 1.png' })).toBeVisible();

  // Now tap the middle photo, then the left one, in the preview.
  const canvas = page.locator('#previewCanvas');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByRole('button', { name: 'Photo 2: photo 2.png' })).toHaveAttribute('aria-pressed', 'true');
  // The spacing isn't a photo, so tapping it does nothing.
  await canvas.click({ position: { x: 1, y: 1 } });
  await expect(page.getByRole('button', { name: 'Photo 2: photo 2.png' })).toHaveAttribute('aria-pressed', 'true');
  await canvas.click({ position: { x: box.width / 6, y: box.height / 2 } });
  await expect(page.getByRole('button', { name: 'Photo 1: photo 2.png' })).toBeVisible();

  const out = await download(page);
  const img = await inspect(page, out.bytes, [[1 / 6, 0.5], [0.5, 0.5], [5 / 6, 0.5]]);
  expect(near(img.colours[0], rgba(1))).toBe(true);
  expect(near(img.colours[1], rgba(2))).toBe(true);
  expect(near(img.colours[2], rgba(0))).toBe(true);
});

test('says how many photos to add or remove, and only makes 3, 6 or 9', async ({ page }) => {
  const note = page.locator('#previewNote');
  await add(page, [photo(0)]);
  await expect(note).toHaveText('Add 2 more for a collage of 3.');
  await expect(page.locator('#downloadBtn')).toBeDisabled();
  await expect(page.locator('#layoutField')).toBeHidden();
  await expect(page.locator('#photosHint')).toBeHidden();

  await add(page, [photo(1), photo(2), photo(3)]);
  await expect(page.locator('#summary')).toHaveText('4 photos');
  await expect(note).toHaveText('Add 2 more for a collage of 6, or remove 1 for a collage of 3.');
  await expect(page.locator('#previewCanvas')).toBeHidden();
  await expect(page.locator('#downloadBtn')).toBeDisabled();

  await page.getByRole('button', { name: 'Remove photo 2.png' }).click();
  await ready(page);
  await expect(note).toBeHidden();
  await expect(page.locator('.layout-opt input')).toHaveCount(4);
  await expect(page.locator('.photo-btn')).toHaveText(['1', '2', '3']);

  // A collage holds 9 at most; the rest are left out.
  await add(page, [4, 5, 6, 7, 8, 9, 10].map((i) => photo(i)));
  await expect(page.locator('#summary')).toHaveText('9 photos');
  await expect(page.locator('#msg')).toHaveText('A collage holds up to 9 photos, so 1 photo was left out.');
  await expect(page.locator('#msg')).toHaveClass(/error/);
  await ready(page);
  await add(page, [photo(0), photo(1)]);
  await expect(page.locator('#msg')).toHaveText('A collage holds up to 9 photos, so 2 photos were left out.');

  await page.locator('#clearBtn').click();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#msg')).toHaveText('');
});

test('skips files that aren’t images and photos the browser can’t open', async ({ page }) => {
  await add(page, [
    photo(0),
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    { name: 'song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3') }
  ]);
  await expect(page.locator('#msg')).toHaveText('Skipped: notes.txt, song.mp3 aren’t images.');
  await add(page, [{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }]);
  await expect(page.locator('#msg')).toHaveText('Skipped: notes.txt isn’t an image.');

  await add(page, [{ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') }]);
  await expect(page.locator('#msg')).toHaveText('Your browser can’t open broken.png.');
  await expect(page.locator('#summary')).toHaveText('1 photo');
});

test('spacing, rounded corners and the chosen layout for each count', async ({ page }) => {
  await add(page, photos(6));
  await ready(page);
  await page.getByRole('radio', { name: 'Steps' }).check({ force: true });
  await page.locator('#longest').selectOption('1080');
  await page.locator('#gap').fill('40');
  await page.locator('#radius').fill('60');
  await expect(page.locator('#gapOut')).toHaveText('43 px');
  await expect(page.locator('#radiusOut')).toHaveText('65 px');
  await expect(page.locator('#sizeHint')).toHaveText('1080 × 1080 px');

  const out = await download(page);
  const boxes = await page.evaluate(() => {
    const C = window.bdnixCollage;
    return C.boxes(C.layout(6, 'steps').cells, 1080, 1080, 43);
  });
  const b = boxes[0];
  const at = (x, y) => [x / 1080, y / 1080];
  const img = await inspect(page, out.bytes, [
    at(b.x + b.w / 2, b.y + b.h / 2), at(b.x + 3, b.y + 3), at(b.x + b.w / 2, b.y + 3), at(b.x - 5, b.y + b.h / 2)
  ]);
  expect(near(img.colours[0], rgba(0))).toBe(true);
  // The corner is rounded off, but the edge beside it isn't.
  expect(near(img.colours[1], WHITE)).toBe(true);
  expect(near(img.colours[2], rgba(0))).toBe(true);
  // And the spacing is the background.
  expect(near(img.colours[3], WHITE)).toBe(true);

  // Going to 3 photos and back brings the chosen layout back.
  await page.getByRole('button', { name: 'Remove photo 6.png' }).click();
  await page.getByRole('button', { name: 'Remove photo 5.png' }).click();
  await page.getByRole('button', { name: 'Remove photo 4.png' }).click();
  await ready(page);
  await expect(page.getByRole('radio', { name: 'Side by side' })).toBeChecked();
  await add(page, [photo(3), photo(4), photo(5)]);
  await ready(page);
  await expect(page.getByRole('radio', { name: 'Steps' })).toBeChecked();
});

test('each photo is cropped from its middle to fill its place', async ({ page }) => {
  // A wide photo: a red middle with blue at both ends.
  const wide = { name: 'wide.png', mimeType: 'image/png', buffer: png(300, 60, (x) => (x < 100 || x >= 200 ? [40, 70, 220, 255] : [220, 40, 40, 255])) };
  await add(page, [wide, photo(1), photo(2)]);
  await ready(page);
  await page.locator('#gap').fill('0');
  await page.locator('label:has(input[value=png])').click();
  const out = await download(page);
  // The first third is a tall box, so only the red middle of the photo shows.
  const img = await inspect(page, out.bytes, [[0.01, 0.5], [0.32, 0.5]]);
  expect(near(img.colours[0], [220, 40, 40, 255], 4)).toBe(true);
  expect(near(img.colours[1], [220, 40, 40, 255], 4)).toBe(true);
});

test('dragging a photo in the preview moves it within its place', async ({ page }) => {
  // A photo with thin blue and green edges on a red middle. In the tall
  // first place only its middle two thirds show at first.
  const BLUE = [40, 70, 220, 255], RED = [220, 40, 40, 255], GREEN = [40, 180, 60, 255];
  const wide = { name: 'wide.png', mimeType: 'image/png', buffer: png(100, 200, (x) => (x < 12 ? BLUE : x < 88 ? RED : GREEN)) };
  await add(page, [wide, photo(3), photo(4)]);
  await ready(page);
  await page.locator('#gap').fill('0');
  await page.locator('label:has(input[value=png])').click();
  const canvas = page.locator('#previewCanvas');
  let box = await canvas.boundingBox();
  const drag = async (fromX, toX) => {
    await canvas.scrollIntoViewIfNeeded();
    box = await canvas.boundingBox();
    await page.mouse.move(box.x + fromX, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + toX, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
  };

  let img = await inspect(page, (await download(page)).bytes, [[0.01, 0.5], [0.32, 0.5]]);
  expect(near(img.colours[0], RED, 4)).toBe(true);
  expect(near(img.colours[1], RED, 4)).toBe(true);

  // Dragging right shows the left of the photo, as far as its edge.
  await drag(box.width / 6, box.width / 3 - 2);
  // A drag isn't a tap: nothing is picked.
  await expect(page.getByRole('button', { name: 'Photo 1: wide.png' })).toHaveAttribute('aria-pressed', 'false');
  img = await inspect(page, (await download(page)).bytes, [[0.01, 0.5], [0.32, 0.5], [0.5, 0.5]]);
  expect(near(img.colours[0], BLUE, 4)).toBe(true);
  expect(near(img.colours[1], RED, 4)).toBe(true);
  // The photo beside it didn't move.
  expect(near(img.colours[2], rgba(3), 4)).toBe(true);

  // Dragging left, past the other edge, shows the right of it.
  await drag(box.width / 6, 2);
  await drag(box.width / 6, 2);
  img = await inspect(page, (await download(page)).bytes, [[0.01, 0.5], [0.32, 0.5]]);
  expect(near(img.colours[0], RED, 4)).toBe(true);
  expect(near(img.colours[1], GREEN, 4)).toBe(true);

  // A photo keeps its place when it's swapped into another box.
  await page.getByRole('button', { name: 'Photo 1: wide.png' }).click();
  await page.getByRole('button', { name: 'Photo 2: photo 4.png' }).click();
  img = await inspect(page, (await download(page)).bytes, [[1 / 6, 0.5], [0.37, 0.5], [0.63, 0.5]]);
  expect(near(img.colours[0], rgba(3), 4)).toBe(true);
  expect(near(img.colours[1], RED, 4)).toBe(true);
  expect(near(img.colours[2], GREEN, 4)).toBe(true);

  // Dragging from the spacing moves nothing.
  await page.locator('#gap').fill('40');
  await drag(2, box.width / 2);
  img = await inspect(page, (await download(page)).bytes, [[1 / 6, 0.5], [0.37, 0.5], [0.63, 0.5]]);
  expect(near(img.colours[0], rgba(3), 4)).toBe(true);
  expect(near(img.colours[1], RED, 4)).toBe(true);
  expect(near(img.colours[2], GREEN, 4)).toBe(true);
  await expect(page.locator('.photo-btn[aria-pressed=true]')).toHaveCount(0);
});

test('fits a phone screen with 9 photos', async ({ page }) => {
  await add(page, photos(9));
  await ready(page);
  await expectNoSideScroll(page);
});
