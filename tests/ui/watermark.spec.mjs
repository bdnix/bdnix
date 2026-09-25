import { test, expect } from './fixtures.mjs';
import { upload, samplePdf, logoPng, download, contentStreams, hexText, baseFonts, imageCount } from './pdfs.mjs';

const CONFIDENTIAL = hexText('CONFIDENTIAL');

async function openSample(page){
  await page.goto('/watermark-pdf/');
  await page.locator('#picker').setInputFiles(upload('report.pdf', await samplePdf()));
  await expect(page.locator('#fileMeta')).toHaveText(/^3 pages · \d+ KB$/);
  // The preview is drawn once pdf.js has loaded and rendered the page.
  await expect(page.locator('#previewCanvas')).toBeVisible({ timeout: 20_000 });
}

const apply = (page) => download(page, async () => {
  await page.getByRole('button', { name: 'Add watermark' }).click();
  await expect(page.locator('#downloadBtn')).toBeVisible();
  await page.locator('#downloadBtn').click();
});

// Radio buttons and checkboxes here are visually hidden behind styled labels.
const choose = (page, name, value) => page.locator(`input[name=${name}][value=${value}]`).check({ force: true });
const setRange = (page, name, value) => page.locator(`input[name=${name}]`).evaluate((el, v) => {
  el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

test('the preview shows the page with the watermark on it', async ({ page }) => {
  await openSample(page);
  await expect(page.locator('#pageLabel')).toHaveText('Page 1 of 3');
  const ink = await page.locator('#previewCanvas').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let text = 0, mark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 120 && d[i + 1] < 120 && d[i + 2] < 120) text++;
      if (d[i] - d[i + 1] > 25 && d[i] - d[i + 2] > 10) mark++;
    }
    return { text, mark };
  });
  expect(ink.text, 'page text drawn').toBeGreaterThan(200);
  expect(ink.mark, 'red watermark drawn').toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('#pageLabel')).toHaveText('Page 2 of 3');
});

test('adds the text watermark on top of every page by default', async ({ page }) => {
  await openSample(page);
  const out = await apply(page);
  expect(out.name).toBe('report-watermarked.pdf');
  expect(out.doc.getPageCount()).toBe(3);
  expect(baseFonts(out.doc)).toContain('Helvetica-Bold');
  for (let i = 0; i < 3; i++) {
    const streams = contentStreams(out.doc, i);
    expect(streams.at(-1), `page ${i + 1}: watermark drawn last`).toContain(CONFIDENTIAL);
  }
  await expect(page.locator('#msg')).toHaveText('Done. Watermarked 3 pages.');
});

test('only watermarks the pages listed', async ({ page }) => {
  await openSample(page);
  await page.locator('input[name=pages]').fill('1, 3');
  await expect(page.locator('#pagesHint')).toHaveText('2 pages of 3 will be watermarked');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('#previewNote')).toHaveText('Page 2 isn’t in your page list, so it stays as it is.');
  const out = await apply(page);
  const has = (i) => contentStreams(out.doc, i).some((s) => s.includes(CONFIDENTIAL));
  expect([has(0), has(1), has(2)]).toEqual([true, false, true]);
});

test('an invalid page list is explained and blocks the button', async ({ page }) => {
  await openSample(page);
  await page.locator('input[name=pages]').fill('2-9');
  await expect(page.locator('#pagesHint')).toHaveText('No page 9 (this file has 3 pages)');
  await expect(page.getByRole('button', { name: 'Add watermark' })).toBeDisabled();
});

test('"Behind content" draws the watermark before the page content', async ({ page }) => {
  await openSample(page);
  await choose(page, 'layer', 'back');
  await expect(page.locator('#layerHint')).toBeVisible();
  const out = await apply(page);
  for (let i = 0; i < 3; i++) {
    const streams = contentStreams(out.doc, i);
    expect(streams[0], `page ${i + 1}: watermark drawn first`).toContain(CONFIDENTIAL);
    expect(streams.at(-1)).not.toContain(CONFIDENTIAL);
  }
});

test('uses the chosen built-in font and style', async ({ page }) => {
  await openSample(page);
  await page.locator('#font').selectOption('times');
  await page.locator('input[name=bold]').setChecked(false, { force: true });
  await page.locator('input[name=italic]').setChecked(true, { force: true });
  expect(baseFonts((await apply(page)).doc)).toContain('Times-Italic');

  await page.locator('#font').selectOption('courier');
  await page.locator('input[name=bold]').setChecked(true, { force: true });
  expect(baseFonts((await apply(page)).doc)).toContain('Courier-BoldOblique');
});

test('"Your own font file" needs a font before it can be used', async ({ page }) => {
  await openSample(page);
  await page.locator('#font').selectOption('custom');
  await expect(page.locator('#fontPick')).toBeVisible();
  await expect(page.locator('input[name=bold]')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add watermark' })).toBeDisabled();
  await page.locator('#fontPicker').setInputFiles(upload('fake.ttf', 'not a font', 'font/ttf'));
  await expect(page.locator('#msg')).toHaveText('Couldn’t use fake.ttf. Choose a .ttf or .otf font file.');
});

test('text the built-in fonts can’t show is embedded as an image', async ({ page }) => {
  await openSample(page);
  await page.locator('input[name=text]').fill('গোপনীয়');
  const out = await apply(page);
  expect(imageCount(out.doc)).toBeGreaterThan(0);
});

test('image watermark', async ({ page }) => {
  await openSample(page);
  await choose(page, 'kind', 'image');
  await expect(page.getByRole('button', { name: 'Add watermark' })).toBeDisabled();
  await page.locator('#imagePicker').setInputFiles(upload('logo.png', logoPng(), 'image/png'));
  await expect(page.locator('#imageName')).toHaveText('logo.png');
  const out = await apply(page);
  expect(imageCount(out.doc)).toBeGreaterThan(0);
});

test('remembers settings after a reload, and resets them', async ({ page }) => {
  await openSample(page);
  await page.locator('input[name=text]').fill('DRAFT');
  await setRange(page, 'opacity', 60);
  await page.locator('#font').selectOption('courier');
  await choose(page, 'layer', 'back');
  await page.locator('#rotationChips').getByRole('button', { name: '0°', exact: true }).click();

  await page.reload();
  const form = () => page.locator('#settings').evaluate((f) => ({
    text: f.elements.text.value, opacity: f.elements.opacity.value, font: f.elements.font.value,
    layer: f.elements.layer.value, rotation: f.elements.rotation.value
  }));
  expect(await form()).toEqual({ text: 'DRAFT', opacity: '60', font: 'courier', layer: 'back', rotation: '0' });

  await openSample(page);
  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('#msg')).toHaveText('Settings reset to the defaults.');
  await page.reload();
  expect(await form()).toEqual({ text: 'CONFIDENTIAL', opacity: '25', font: 'helvetica', layer: 'front', rotation: '45' });
});

test('rejects files that are not PDFs', async ({ page }) => {
  await page.goto('/watermark-pdf/');
  await page.locator('#picker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#msg')).toHaveText('That isn’t a PDF file. Choose a .pdf to watermark.');
  await expect(page.locator('#editor')).toBeHidden();
});
