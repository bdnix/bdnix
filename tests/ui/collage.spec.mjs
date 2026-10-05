import fs from 'node:fs';
import { test, expect, expectNoSideScroll, inNewWindow } from './fixtures.mjs';
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

// The button opens a new window, and the collage downloads there once it's made.
async function download(page){
  const { download: dl } = await inNewWindow(page, () => page.locator('#downloadBtn').click());
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
  await expect(page.locator('.layout-opt input')).toHaveCount(7);
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
  await expect(page.locator('.layout-opt input')).toHaveCount(10);
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

// One test per number of photos, each saving a small PNG per layout, so
// the many layouts fit in a test's time.
for (const count of [3, 6, 9]) {
  test(`every layout for ${count} photos puts each photo in its own place`, async ({ page }) => {
    await add(page, photos(count));
    await ready(page);
    await page.locator('#longest').selectOption('1080');
    await page.locator('label:has(input[value=png])').click();
    const ids = await page.locator('.layout-opt input').evaluateAll((els) => els.map((e) => e.value));
    expect(ids.length).toBeGreaterThanOrEqual(7);
    for (const id of ids) {
      await page.locator(`.layout-opt input[value="${id}"]`).check({ force: true });
      const out = await download(page);
      const img = await inspect(page, out.bytes, middles(await cellsOf(page, count, id)));
      img.colours.forEach((c, i) => expect(near(c, rgba(i), 4), `${count} ${id}: photo ${i + 1}`).toBe(true));
    }
  });
}

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
  await expect(page.locator('.layout-opt input')).toHaveCount(7);
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
  await page.getByRole('radio', { name: 'Steps', exact: true }).check({ force: true });
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
  await expect(page.getByRole('radio', { name: 'Steps', exact: true })).toBeChecked();
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

test('zooming a photo in its place, with the slider, the mouse wheel or a pinch', async ({ page }) => {
  // A blue photo with a red square in its middle. In the tall first place
  // the top and bottom show blue; zoomed 4x only the red shows.
  const BLUE = [40, 70, 220, 255], RED = [220, 40, 40, 255];
  const target = { name: 'target.png', mimeType: 'image/png', buffer: png(100, 100, (x, y) => (x >= 30 && x < 70 && y >= 30 && y < 70 ? RED : BLUE)) };
  await add(page, [target, photo(3), photo(4)]);
  await ready(page);
  await page.locator('#gap').fill('0');
  await page.locator('label:has(input[value=png])').click();
  const canvas = page.locator('#previewCanvas');
  const slider = page.locator('#zoom');
  const first = page.getByRole('button', { name: 'Photo 1: target.png' });
  const colours = async () => (await inspect(page, (await download(page)).bytes, [[1 / 6, 0.02], [0.01, 0.98], [0.32, 0.02], [0.5, 0.5]])).colours;
  const zoomedIn = async () => {
    const c = await colours();
    [0, 1, 2].forEach((i) => expect(near(c[i], RED, 4), `corner ${i}`).toBe(true));
    // The photo beside it isn't zoomed.
    expect(near(c[3], rgba(3), 4)).toBe(true);
  };
  const zoomedOut = async () => expect(near((await colours())[0], BLUE, 4)).toBe(true);
  // The middle of the first place, in the page.
  const middle = async () => {
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    return { x: box.x + box.width / 6, y: box.y + box.height / 2 };
  };

  // The slider is for the photo picked in the list.
  await expect(page.locator('#zoomField')).toBeHidden();
  await first.click();
  await expect(page.locator('#zoomField')).toBeVisible();
  await expect(page.locator('#zoomName')).toHaveText('Zoom photo 1');
  await expect(page.locator('#zoomOut')).toHaveText('100%');
  await zoomedOut();
  await slider.fill('400');
  await expect(page.locator('#zoomOut')).toHaveText('400%');
  await zoomedIn();
  await slider.fill('100');
  await zoomedOut();
  await first.click();
  await expect(page.locator('#zoomField')).toBeHidden();

  // The mouse wheel over a photo: up zooms in, as far as 4x, and down
  // zooms out. The slider follows it.
  await first.click();
  let m = await middle();
  await page.mouse.move(m.x, m.y);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -500);
  await expect(page.locator('#zoomOut')).toHaveText('400%');
  await first.click();
  await zoomedIn();
  await first.click();
  m = await middle();
  await page.mouse.move(m.x, m.y);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 500);
  await expect(page.locator('#zoomOut')).toHaveText('100%');
  await first.click();
  await zoomedOut();

  // Two fingers moving apart on the photo zoom it in; it isn't picked.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  m = await middle();
  await touch('touchStart', [[m.x, m.y - 10]]);
  await touch('touchStart', [[m.x, m.y - 10], [m.x, m.y + 10]]);
  for (const d of [15, 25, 40]) await touch('touchMove', [[m.x, m.y - d], [m.x, m.y + d]]);
  // One finger lifts, then the other.
  await touch('touchEnd', [[m.x, m.y - 40]]);
  await touch('touchEnd', []);
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await first.click();
  await expect(page.locator('#zoomOut')).toHaveText('400%');
  await first.click();
  await zoomedIn();

  // The zoom goes with the photo when it's swapped.
  await first.click();
  await page.getByRole('button', { name: 'Photo 2: photo 4.png' }).click();
  await page.getByRole('button', { name: 'Photo 2: target.png' }).click();
  await expect(page.locator('#zoomName')).toHaveText('Zoom photo 2');
  await expect(page.locator('#zoomOut')).toHaveText('400%');  await expectNoSideScroll(page);
});

test('fits a phone screen with 9 photos', async ({ page }) => {
  await add(page, photos(9));
  await ready(page);
  await expectNoSideScroll(page);
});

test('a collage that can\'t be saved closes the window it opened, and says why', async ({ page }) => {
  await page.goto('/photo-collage/');
  await add(page, photos(3));
  await ready(page);
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function(done){ done(null); }; });
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#downloadBtn').click()]);
  await expect(page.locator('#msg')).toHaveText('Couldn’t make the collage: your browser couldn’t save it. Try a smaller size.');
  await expect.poll(() => popup.isClosed()).toBe(true);
});
