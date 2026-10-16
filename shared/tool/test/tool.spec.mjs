import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// tool.css: what every tool page has, the lede, the drop zone, fields, the
// files area and the action buttons. On a page of its own.
const BODY = [
  '<main><p class="lede">What it does.</p>',
  '<label class="drop panel" id="drop"><input type="file"><b>Drop a PDF file here</b><span>or <u>choose a file</u></span></label>',
  '<div class="field"><span class="label">Text <output>12</output></span><input type="text" id="text" placeholder="Type"></div>',
  '<label class="field field-color"><span class="label">Colour</span><input type="color"></label>',
  '<div class="files"><div class="files-head"><span>2 files</span></div></div>',
  '<div class="actions"><button class="btn btn-primary" type="button" id="go">Go</button><button class="btn btn-ghost" type="button">Clear</button></div></main>'
].join('');
const open = (page) => openFixture(page, { css: ['/assets/css/base.css', '/assets/css/tool.css'], body: BODY });

test('the drop zone is dashed and hides its file input; fields stack their label over the box', async ({ page }) => {
  await open(page);
  expect(await style(page, '#drop', 'border-top-style')).toBe('dashed');
  const input = await page.locator('#drop input').boundingBox();
  expect(input.width).toBeLessThanOrEqual(1);
  expect(await style(page, '.field', 'flex-direction')).toBe('column');
  expect(await style(page, '.field-color', 'flex-direction')).toBe('row');
  expect(await style(page, '.actions', 'display')).toBe('flex');
  await fitsScreen(page);
});

test('the drop zone lights up while a file is dragged over it, and a bad field is marked', async ({ page }) => {
  await open(page);
  const plain = await style(page, '#drop', 'background-color');
  await page.locator('#drop').evaluate((d) => d.classList.add('over'));
  // (after its short transition)
  await expect.poll(() => style(page, '#drop', 'background-color')).not.toBe(plain);
  await page.locator('#text').evaluate((i) => i.classList.add('invalid'));
  expect(await style(page, '#text', 'border-top-color')).toBe('rgb(244, 114, 182)');
});

test('on a phone, each action button takes the whole width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  const go = await page.locator('#go').boundingBox();
  const actions = await page.locator('.actions').boundingBox();
  expect(go.width).toBeCloseTo(actions.width, 0);
});
