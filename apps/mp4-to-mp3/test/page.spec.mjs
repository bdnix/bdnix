import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { checkPage, watch } from '../../../tests/ui/checks.mjs';
import { flacMp4, tone } from '../../../tests/ui/media.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/mp4-to-mp3/', { languages: false, schema: 'WebApplication', category: 'MultimediaApplication', footer: true });

// LAME isn't part of the page: it's fetched the first time an MP3 is made,
// compiled once and handed to the workers, and a failed fetch says so and
// is tried again next time.
const LAME = /\/assets\/vendor\/lame\.wasm/;
const clip = () => ({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: flacMp4(tone(1, 2)) });

test('/mp4-to-mp3/: LAME is only fetched to make an MP3, and only once', async ({ page }) => {
  const seen = watch(page, LAME);
  await page.goto('/mp4-to-mp3/');
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByText('WAV', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
  expect(seen).toEqual([]);

  await page.getByText('MP3', { exact: true }).click();
  for (const kbps of ['192', '128']) {
    await page.getByLabel('Quality').selectOption(kbps);
    await page.getByRole('button', { name: 'Convert', exact: true }).click();
    await expect(page.locator('.track .dl')).toHaveCount(1);
  }
  expect(seen).toEqual([expect.stringMatching(/\/assets\/vendor\/lame\.wasm\?v=3\.100-1$/)]);
});

test('/mp4-to-mp3/: says so when LAME can\'t be fetched, and tries again', async ({ page }) => {
  await page.route(LAME, (route) => route.abort());
  await page.goto('/mp4-to-mp3/');
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: the MP3 encoder didn’t load. Check your connection and try again');
  await page.unroute(LAME);
  // A server error says the same.
  await page.route(LAME, (route) => route.fulfill({ status: 503, body: 'busy' }));
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: the MP3 encoder didn’t load. Check your connection and try again');
  await page.unroute(LAME);
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.track .dl')).toHaveCount(1);
});

test('/mp4-to-mp3/: says so when the encoding workers can\'t load their script', async ({ page }) => {
  await page.goto('/mp4-to-mp3/');
  // The page has audio-core.js, but the workers can't fetch it.
  await page.route(/\/assets\/js\/audio-core\.js/, (route) => route.abort());
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: the MP3 encoder didn’t load. Check your connection and try again');
});
