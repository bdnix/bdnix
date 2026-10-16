import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// tracks.css: a list of files, each with its own progress and download. On
// a page of its own.
const BODY = '<ol class="track-list"><li class="track panel" id="t"><div class="file-info"><span class="file-name">song.mp4</span><span class="file-meta">Ready</span><span class="track-bar" id="bar"></span></div><a class="btn btn-primary dl" href="#">Download</a><button class="icon-btn rm" type="button" aria-label="Remove"></button></li></ol>';
const open = (page) => openFixture(page, { css: ['/assets/css/base.css', '/assets/css/icon-btn.css', '/assets/css/file.css', '/assets/css/tracks.css'], body: BODY });

test('each track shows its progress, and is marked when done', async ({ page }) => {
  await open(page);
  expect(await style(page, '.track-list', 'list-style-type')).toBe('none');
  await page.locator('#bar').evaluate((b) => b.style.setProperty('--p', '0.5'));
  expect(await style(page, '#bar', 'background-image')).toContain('50%');
  const before = await style(page, '#t', 'border-top-color');
  await page.locator('#t').evaluate((t) => t.classList.add('done'));
  await expect.poll(() => style(page, '#t', 'border-top-color')).not.toBe(before);
  await fitsScreen(page);
});

test('on a phone, the download takes a row of its own', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  const dl = await page.locator('.dl').boundingBox();
  const info = await page.locator('.file-info').boundingBox();
  expect(dl.y).toBeGreaterThanOrEqual(info.y + info.height);
  await fitsScreen(page);
});
