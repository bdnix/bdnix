import { test, expect } from './fixtures.mjs';
import { checkPage, watch } from './checks.mjs';
import { flacMp4, tone } from './media.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/mp4-to-mp3/', { schema: 'WebApplication', category: 'MultimediaApplication', footer: true });

// lamejs isn't part of the page: it's fetched the first time an MP3 is made,
// and a failed fetch says so and is tried again next time.
const LAME = /\/assets\/vendor\/lame\.min\.js/;
const clip = () => ({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: flacMp4(tone(1, 2)) });

test('/mp4-to-mp3/: lamejs is only fetched to make an MP3', async ({ page }) => {
  const seen = watch(page, LAME);
  await page.goto('/mp4-to-mp3/');
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByText('WAV', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
  expect(seen).toEqual([]);

  await page.getByText('MP3', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
  expect(seen).toEqual([expect.stringContaining('/assets/vendor/lame.min.js?v=1.2.1')]);
});

test('/mp4-to-mp3/: says so when lamejs can\'t be fetched, and tries again', async ({ page }) => {
  await page.route(LAME, (route) => route.abort());
  await page.goto('/mp4-to-mp3/');
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: the MP3 encoder didn’t load. Check your connection and try again');
  await page.unroute(LAME);
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: /Convert/ }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
});
