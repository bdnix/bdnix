import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { upload, secretPdf, picturePdf, download, widths, contentStreams, hexText, imageCount } from './pdfs.mjs';

async function openSecret(page){
  const pdf = await secretPdf();
  await page.goto('/redact-pdf/');
  await page.locator('#picker').setInputFiles(upload('secret.pdf', pdf.bytes));
  await expect(page.locator('#fileMeta')).toHaveText(/^3 pages · \d+ KB$/);
  await expect(page.locator('#pageCanvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#previewNote')).toBeHidden();
  return pdf;
}

const redact = (page) => download(page, async () => {
  await page.getByRole('button', { name: 'Redact PDF' }).click();
  await expect(page.locator('#downloadBtn')).toBeVisible({ timeout: 20_000 });
  await page.locator('#downloadBtn').click();
});

const find = async (page, text) => {
  await page.locator('#query').fill(text);
  await page.getByRole('button', { name: 'Mark all' }).click();
};

// Drags across the page shown, between two points given as fractions of it.
async function drag(page, [x0, y0], [x1, y1]){
  const box = await page.locator('#marks').boundingBox();
  await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * (x0 + x1) / 2, box.y + box.height * (y0 + y1) / 2);
  await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1);
  await page.mouse.up();
}

// Reads a PDF back with the site's own pdf.js: each page's text, and the
// colour at some points ([page number, x, y], as fractions from the top-left).
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

const isBlack = ([r, g, b]) => r < 40 && g < 40 && b < 40;
const isWhite = ([r, g, b]) => r > 215 && g > 215 && b > 215;

test('marks every match of a search, and the download has that text taken out', async ({ page }) => {
  const { name } = await openSecret(page);
  await find(page, 'jane doe');
  await expect(page.locator('#findHint')).toHaveText('Marked 2 matches on 2 pages. Check them before you redact.');
  await expect(page.locator('#summary')).toHaveText('2 areas on 2 pages');
  await expect(page.locator('#marks .mark')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('#pageLabel')).toHaveText('Page 2 of 3');
  await expect(page.locator('#marks .mark')).toHaveCount(1);
  await expectNoSideScroll(page);

  const out = await redact(page);
  expect(out.name).toBe('secret-redacted.pdf');
  await expect(page.locator('#msg')).toHaveText('Done. Blacked out 2 areas on 2 pages.');
  // The turned page comes out the way it was read: landscape, not rotated.
  expect(widths(out.doc)).toEqual([595, 842, 595]);
  expect(out.doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0, 0]);
  expect(imageCount(out.doc)).toBe(2);
  // Page 3 had nothing marked, so it's copied as it was.
  expect(contentStreams(out.doc, 2).join('')).toContain(hexText('Nothing to hide here.'));

  // A grid of points over the name: text alone would leave white between
  // its letters, so every point is only black if it's covered.
  const grid = [];
  for (let i = 0; i <= 8; i++) for (const dy of [-0.004, 0, 0.004]) grid.push([1, name.x0 + (name.x1 - name.x0) * i / 8, name.y + dy]);
  const back = await readBack(page, out.bytes, [...grid, [1, 0.9, name.y]]);
  // Marked pages are images now, so none of their text is left to find.
  expect(back.texts).toEqual(['', '', 'Nothing to hide here.']);
  const colours = back.colours.slice(0, grid.length);
  expect(colours.filter((c) => !isBlack(c)), 'points over the name that aren’t black').toEqual([]);
  expect(isWhite(back.colours.at(-1)), `rest of the line stays white: ${back.colours.at(-1)}`).toBe(true);
});

test('draws a box by dragging; a tap alone draws nothing', async ({ page }) => {
  await openSecret(page);
  await expect(page.getByRole('button', { name: 'Redact PDF' })).toBeDisabled();
  await page.locator('#marks').click({ position: { x: 30, y: 30 } });
  await expect(page.locator('#summary')).toHaveText('Nothing marked yet');

  // Cover the account number line: baseline at y 730 of 842.
  await drag(page, [0.04, 0.115], [0.5, 0.14]);
  await expect(page.locator('#summary')).toHaveText('1 area on 1 page');
  await expect(page.locator('#marks .mark')).toHaveCount(1);

  const out = await redact(page);
  const back = await readBack(page, out.bytes);
  expect(back.texts[0]).toBe('');
  expect(back.texts[1]).toBe('Signed by Jane Doe');
  expect(contentStreams(out.doc, 1).join('')).toContain(hexText('Signed by Jane Doe'));
});

test('boxes can be removed one by one, undone, or all cleared', async ({ page }) => {
  await openSecret(page);
  await find(page, 'jane doe');
  await expect(page.locator('#summary')).toHaveText('2 areas on 2 pages');
  await drag(page, [0.04, 0.115], [0.5, 0.14]);
  await expect(page.locator('#summary')).toHaveText('3 areas on 2 pages');

  // Undo takes back the last step: the drawn box, then the whole search.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#summary')).toHaveText('2 areas on 2 pages');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#summary')).toHaveText('Nothing marked yet');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await find(page, 'jane doe');
  await page.getByRole('button', { name: 'Remove this box' }).click();
  await expect(page.locator('#summary')).toHaveText('1 area on 1 page');
  await expect(page.locator('#marks .mark')).toHaveCount(0);
  // The same search again only adds back what's missing.
  await find(page, 'jane doe');
  await expect(page.locator('#summary')).toHaveText('2 areas on 2 pages');
  await find(page, 'jane doe');
  await expect(page.locator('#findHint')).toHaveText('Every “jane doe” is already marked.');

  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('#summary')).toHaveText('Nothing marked yet');
  await expect(page.locator('#marks .mark')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Redact PDF' })).toBeDisabled();
});

test('a search jumps to the first page with a match', async ({ page }) => {
  await openSecret(page);
  await find(page, 'nothing to hide');
  await expect(page.locator('#findHint')).toHaveText('Marked 1 match on 1 page. Check them before you redact.');
  await expect(page.locator('#pageLabel')).toHaveText('Page 3 of 3');
  await expect(page.locator('#marks .mark')).toHaveCount(1);
});

test('search works in browsers whose streams can’t be read with for await (Safari, iOS)', async ({ page }) => {
  await page.addInitScript(() => { delete ReadableStream.prototype[Symbol.asyncIterator]; });
  await openSecret(page);
  await find(page, 'jane doe');
  await expect(page.locator('#findHint')).toHaveText('Marked 2 matches on 2 pages. Check them before you redact.');
  await expect(page.locator('#marks .mark')).toHaveCount(1);
});

test('explains an empty search and one with no matches', async ({ page }) => {
  await openSecret(page);
  await page.getByRole('button', { name: 'Mark all' }).click();
  await expect(page.locator('#findHint')).toHaveText('Type the text you want to black out.');
  await find(page, 'John Smith');
  await expect(page.locator('#findHint')).toHaveText('“John Smith” isn’t in this file’s text. Scanned pages are pictures with no text to search, so draw boxes over those instead.');
  await expect(page.locator('#summary')).toHaveText('Nothing marked yet');
  await page.locator('#query').fill('J');
  await expect(page.locator('#findHint')).toHaveText(/^Marks every place it appears/);
});

test('a search says which pages have pictures, since words in them can’t be found', async ({ page }) => {
  await page.goto('/redact-pdf/');
  await page.locator('#picker').setInputFiles(upload('ticket.pdf', await picturePdf()));
  await expect(page.locator('#pageCanvas')).toBeVisible({ timeout: 20_000 });
  const note = 'Search can’t read words inside pictures, so drag boxes over any on page 2.';
  await find(page, 'ticket');
  await expect(page.locator('#findHint')).toHaveText('Marked 1 match on 1 page. Check them before you redact. ' + note);
  await expect(page.locator('#findHint')).not.toHaveClass(/error/);
  await find(page, 'Ticket');
  await expect(page.locator('#findHint')).toHaveText('Every “Ticket” is already marked. ' + note);
  await find(page, 'admission');
  await expect(page.locator('#findHint')).toHaveText('“admission” isn’t in this file’s text. ' + note);
  await expect(page.locator('#findHint')).toHaveClass(/error/);
  await expect(page.locator('#summary')).toHaveText('1 area on 1 page');
  await expectNoSideScroll(page);
});

test('opening another file starts over', async ({ page }) => {
  await openSecret(page);
  await find(page, 'jane doe');
  await expect(page.locator('#summary')).toHaveText('2 areas on 2 pages');
  const pdf = await secretPdf();
  await page.locator('#picker').setInputFiles(upload('other.pdf', pdf.bytes));
  await expect(page.locator('#fileName')).toHaveText('other.pdf');
  await expect(page.locator('#summary')).toHaveText('Nothing marked yet');
  await expect(page.locator('#pageLabel')).toHaveText('Page 1 of 3');
});

test('rejects files that are not PDFs', async ({ page }) => {
  await page.goto('/redact-pdf/');
  await page.locator('#picker').setInputFiles(upload('notes.txt', 'hello', 'text/plain'));
  await expect(page.locator('#msg')).toHaveText('That isn’t a PDF file. Choose a .pdf to redact.');
  await expect(page.locator('#editor')).toBeHidden();
  await page.locator('#picker').setInputFiles(upload('broken.pdf', 'not really a pdf'));
  await expect(page.locator('#msg')).toHaveText('broken.pdf could not be read as a PDF.');
});
