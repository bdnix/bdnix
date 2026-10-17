import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, fitsScreen } from '../../../tests/ui/fixture.mjs';

// editor.css: a preview beside a settings panel, one above the other on a
// narrow screen. On a page of its own.
const BODY = '<div class="editor"><div class="preview panel" id="preview"><div class="preview-stage"><canvas width="300" height="400" role="img" aria-label="Page"></canvas></div><div class="preview-nav"><button class="icon-btn" type="button" aria-label="Previous page" disabled></button><span>Page 1 of 1</span></div></div><div class="settings panel" id="settings">Settings</div></div>';
const open = (page) => openFixture(page, { css: ['/assets/css/base.css', '/assets/css/icon-btn.css', '/assets/css/editor.css'], body: BODY });

test('the preview sits beside the settings on a wide screen, and above them on a narrow one', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page);
  let preview = await page.locator('#preview').boundingBox(), settings = await page.locator('#settings').boundingBox();
  expect(settings.x).toBeGreaterThan(preview.x + preview.width);
  await page.setViewportSize({ width: 390, height: 800 });
  preview = await page.locator('#preview').boundingBox();
  settings = await page.locator('#settings').boundingBox();
  expect(settings.y).toBeGreaterThan(preview.y + preview.height);
  await fitsScreen(page);
});

test('the page drawn in the preview never overflows it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  await page.locator('.preview-stage canvas').evaluate((c) => { c.width = 2000; c.height = 2600; });
  const stage = await page.locator('.preview-stage').boundingBox();
  const canvas = await page.locator('.preview-stage canvas').boundingBox();
  expect(canvas.width).toBeLessThanOrEqual(stage.width);
});

// A control that's wide by nature (a select with a long option) mustn't
// push the editor, or the page, past the narrowest phones: it shrinks to
// fit instead.
test('a wide control still fits the narrowest phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const body = BODY.replace('<div class="preview-nav">', '<select aria-label="Font"><option>Helvetica (sans-serif), the font every PDF reader has</option></select><div class="preview-nav">');
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/icon-btn.css', '/assets/css/editor.css'], body });
  for (const sel of ['#preview', '#settings', '#preview select']) {
    const box = await page.locator(sel).boundingBox();
    expect(box.x + box.width, sel).toBeLessThanOrEqual(320);
  }
  await fitsScreen(page);
});
