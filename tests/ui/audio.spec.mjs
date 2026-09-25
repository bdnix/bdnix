import fs from 'node:fs';
import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { flacMp4, wav, tone, readWav, mp3Header, analyse } from './media.mjs';

const file = (name, buffer, mimeType) => ({ name, mimeType, buffer: Buffer.from(buffer) });
// One second of 440 Hz on the left and 660 Hz on the right.
const clip = () => file('holiday clip.mp4', flacMp4(tone(1, 2)), 'video/mp4');

async function fetchDownload(page, row){
  const [dl] = await Promise.all([page.waitForEvent('download'), row.locator('.dl').click()]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/mp4-to-mp3/');
});

test('converts an MP4 to a stereo MP3 of the same sound', async ({ page }) => {
  await expect(page.locator('#filesWrap')).toBeHidden();
  await page.locator('#picker').setInputFiles([clip()]);
  await expect(page.locator('#summary')).toHaveText('1 file');
  await expect(page.locator('.track .file-meta')).toHaveText(/^\d+ KB$/);

  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('#msg')).toHaveText('Done. Converted 1 file.');
  await expect(page.locator('.track .file-meta')).toHaveText(/^0:01 · holiday clip\.mp3 · \d+ KB$/);
  await expect(page.getByRole('link', { name: 'Download holiday clip.mp3' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Convert' })).toBeDisabled();

  const out = await fetchDownload(page, page.locator('.track'));
  expect(out.name).toBe('holiday clip.mp3');
  expect(mp3Header(out.bytes)).toEqual({ kbps: 192, rate: 44100, mono: false });
  const sound = await analyse(page, out.bytes);
  // MP3 pads the start and end a little.
  expect(sound.seconds).toBeGreaterThanOrEqual(1);
  expect(sound.seconds).toBeLessThan(1.1);
  expect(sound.hz).toEqual([440, 660]);
  await expectNoSideScroll(page);
});

test('quality and mono settings shape the MP3', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByLabel('Quality').selectOption('96');
  await page.getByText('Mono', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  const out = await fetchDownload(page, page.locator('.track'));
  expect(mp3Header(out.bytes)).toEqual({ kbps: 96, rate: 44100, mono: true });
  const sound = await analyse(page, out.bytes);
  expect(sound.hz.length).toBe(1);
});

test('converts to WAV, sample for sample', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByText('WAV', { exact: true }).click();
  await expect(page.getByLabel('Quality')).toBeHidden();
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  const out = await fetchDownload(page, page.locator('.track'));
  expect(out.name).toBe('holiday clip.wav');
  expect(readWav(out.bytes)).toEqual({ channels: 2, rate: 44100, bits: 16, frames: 44100 });
  expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
});

test('audio files convert too, several at once', async ({ page }) => {
  await page.locator('#picker').setInputFiles([
    file('voice memo.wav', wav(tone(1, 1)), 'audio/wav'),
    clip()
  ]);
  await expect(page.locator('#summary')).toHaveText('2 files');
  await page.getByRole('button', { name: 'Convert 2 files' }).click();
  await expect(page.locator('#msg')).toHaveText('Done. Converted 2 files.');
  const memo = await fetchDownload(page, page.locator('.track').first());
  expect(memo.name).toBe('voice memo.mp3');
  // A mono source stays mono even with Stereo picked.
  expect(mp3Header(memo.bytes).mono).toBe(true);
  expect((await analyse(page, memo.bytes)).hz).toEqual([440]);
});

test('skips files that aren’t video or audio, and explains ones it can’t read', async ({ page }) => {
  await page.locator('#picker').setInputFiles([
    file('notes.txt', 'hello', 'text/plain'),
    file('broken.mp4', 'not really a video', 'video/mp4')
  ]);
  await expect(page.locator('#msg')).toHaveText('Skipped: notes.txt isn’t a video or audio file.');
  await expect(page.locator('.file-name')).toHaveText(['broken.mp4']);

  await page.locator('#picker').setInputFiles([file('a.txt', 'x', 'text/plain'), file('b.txt', 'y', 'text/plain')]);
  await expect(page.locator('#msg')).toHaveText('Skipped: a.txt, b.txt aren’t a video or audio file.');

  await page.locator('#picker').setInputFiles([clip()]);
  await expect(page.locator('#msg')).toHaveText('');
  await page.getByRole('button', { name: 'Convert 2 files' }).click();
  await expect(page.locator('#msg')).toHaveText('Converted 1 file. 1 file couldn’t be converted. Your browser may not support its audio format.');
  await expect(page.locator('.file-meta').first()).toHaveText('No audio your browser can read in this file');
  await expect(page.locator('.track').first().locator('.dl')).toHaveCount(0);
  await expect(page.locator('.track').nth(1).locator('.dl')).toHaveCount(1);
});

test('when nothing converts, the message says so', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('a.mp4', 'x', 'video/mp4'), file('b.mov', 'y', '')]);
  await page.getByRole('button', { name: 'Convert 2 files' }).click();
  await expect(page.locator('#msg')).toHaveText('2 files couldn’t be converted. Your browser may not support their audio format.');
});

test('an encoder failure is reported on the file', async ({ page }) => {
  await page.evaluate(() => { window.lamejs.Mp3Encoder = function(){ throw new Error('out of memory'); }; });
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: out of memory');
});

test('changing a setting clears earlier results; new files convert on their own', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.dl')).toHaveCount(1);

  await page.locator('#picker').setInputFiles([file('second.wav', wav(tone(1, 2)), 'audio/wav')]);
  await expect(page.locator('.dl')).toHaveCount(1);
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('.dl')).toHaveCount(2);

  await page.getByLabel('Quality').selectOption('320');
  await expect(page.locator('.dl')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Convert 2 files' })).toBeEnabled();
});

test('removing a file and clearing the list', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip(), file('two.wav', wav(tone(1, 1)), 'audio/wav')]);
  await page.getByRole('button', { name: 'Convert 2 files' }).click();
  await expect(page.locator('.dl')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove holiday clip.mp4' }).click();
  await expect(page.locator('.file-name')).toHaveText(['two.wav']);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('.track')).toHaveCount(0);
  await expect(page.locator('#filesWrap')).toBeHidden();
});

test('files can be dropped anywhere on the page', async ({ page }) => {
  const data = flacMp4(tone(1, 2)).toString('base64');
  const transfer = await page.evaluateHandle((b64) => {
    const dt = new DataTransfer();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    dt.items.add(new File([bytes], 'dropped.mp4', { type: 'video/mp4' }));
    return dt;
  }, data);
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: transfer });
  await expect(page.locator('#drop')).toHaveClass(/over/);
  await page.dispatchEvent('body', 'drop', { dataTransfer: transfer });
  await expect(page.locator('#drop')).not.toHaveClass(/over/);
  await expect(page.locator('.file-name')).toHaveText(['dropped.mp4']);
});

test('controls are locked while converting, and progress is shown', async ({ page }) => {
  // Converting can finish between two checks, so record what the page
  // showed along the way instead.
  await page.evaluate(() => {
    window.seen = [];
    new MutationObserver(() => {
      const meta = document.querySelector('.track .file-meta');
      window.seen.push({
        meta: meta && meta.textContent,
        bar: !!document.querySelector('.track-bar:not([hidden])'),
        label: document.getElementById('convertLabel').textContent,
        locked: document.getElementById('clearBtn').disabled && document.querySelector('[name=kbps]').disabled
      });
    }).observe(document.getElementById('filesWrap'), { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await page.locator('#picker').setInputFiles([file('long.wav', wav(tone(5, 2)), 'audio/wav')]);
  await page.getByRole('button', { name: 'Convert 1 file' }).click();
  await expect(page.locator('#msg')).toHaveText('Done. Converted 1 file.');
  const seen = await page.evaluate(() => window.seen);
  expect(seen).toContainEqual({ meta: 'Converting… 0%', bar: true, label: 'Converting 1 of 1…', locked: true });
  expect(seen).toContainEqual({ meta: 'Converting… 100%', bar: true, label: 'Converting 1 of 1…', locked: true });
  await expect(page.getByRole('button', { name: 'Clear all' })).toBeEnabled();
  await expect(page.locator('.track-bar')).toBeHidden();
});
