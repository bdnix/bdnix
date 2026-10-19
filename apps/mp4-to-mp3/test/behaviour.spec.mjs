import fs from 'node:fs';
import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { inNewWindow } from '../../../tests/ui/downloads.mjs';
import { flacMp4, wav, tone, readWav, mp3Header, analyse, box, full, u32 } from '../../../tests/ui/media.mjs';

const file = (name, buffer, mimeType) => ({ name, mimeType, buffer: Buffer.from(buffer) });
// One second of 440 Hz on the left and 660 Hz on the right.
const clip = () => file('holiday clip.mp4', flacMp4(tone(1, 2)), 'video/mp4');

async function fetchDownload(page, row){
  const { download: dl } = await inNewWindow(page, () => row.locator('.dl').click());
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/mp4-to-mp3/');
});

test('keeps its title, and describes what it does', async ({ page }) => {
  await expect(page).toHaveTitle('MP4 to MP3 — Convert video to audio free | bdnix');
  await expect(page.locator('h1')).toHaveText('MP4 to MP3');
  await expect(page.locator('.features li b')).toHaveText(['Any video or audio in.', 'MP3 or WAV out.', 'Stereo or mono.', 'Named after the original.', 'Long phone videos.']);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /MP3 \(64 to 320 kbps\) or WAV, in stereo or mono/);
  await expectNoSideScroll(page);
});

test('converts an MP4 to a stereo MP3 of the same sound', async ({ page }) => {
  await expect(page.locator('#filesWrap')).toBeHidden();
  await page.locator('#picker').setInputFiles([clip()]);
  await expect(page.locator('.track .file-meta')).toHaveText(/^\d+ KB$/);

  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
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

// Counts the page's reads of the file and whole-file decodes.
async function spy(page){
  await page.evaluate(() => {
    window.reads = [];
    window.wholeDecodes = 0;
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function(){ window.reads.push(this.size); return read.call(this); };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function(...args){ window.wholeDecodes++; return decode.apply(this, args); };
  });
}

async function convertOne(page, upload, format = 'mp3'){
  await page.locator('#picker').setInputFiles([upload]);
  if (format === 'wav') await page.getByText('WAV', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
  return fetchDownload(page, page.locator('.track'));
}

test('decodes a big video’s audio piece by piece, never reading or decoding it whole', async ({ page }) => {
  // Reading all of a long phone video at once, or decoding all its sound
  // at once, made iPhones run out of memory and reload the page.
  await spy(page);
  // 1 MB of video after every two audio frames, index first, 64-bit offsets.
  const video = flacMp4(tone(1, 2), 44100, { video: 1024 * 1024, perChunk: 2, moovFirst: true, co64: true });
  expect(video.length).toBeGreaterThan(6 * 1024 * 1024);
  const out = await convertOne(page, file('phone video.mov', video, 'video/quicktime'));
  expect(Math.max(...await page.evaluate(() => window.reads))).toBeLessThan(64 * 1024);
  expect(await page.evaluate(() => window.wholeDecodes)).toBe(0);
  expect(out.name).toBe('phone video.mp3');
  const sound = await analyse(page, out.bytes);
  expect(sound.seconds).toBeGreaterThanOrEqual(1);
  expect(sound.seconds).toBeLessThan(1.1);
  expect(sound.hz).toEqual([440, 660]);
});

test('an MP4’s edit list trims the sound, sample for sample', async ({ page }) => {
  // Start half a second in (22050 samples) and keep one second (1000 ms).
  const edts = box('edts', full('elst', 0, 0, u32(1), u32(1000), u32(22050), u32(0x10000)));
  const out = await convertOne(page, file('trimmed.mp4', flacMp4(tone(2, 2), 44100, { edts }), 'video/mp4'), 'wav');
  expect(readWav(out.bytes)).toEqual({ channels: 2, rate: 44100, bits: 16, frames: 44100 });
  expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
  await expect(page.locator('.track .file-meta')).toHaveText(/^0:01 · trimmed\.wav · /);
});

test('waits for a busy decoder before reading more', async ({ page }) => {
  await page.addInitScript(() => {
    // Busy for the first few checks, so reading has to pause and resume.
    const size = Object.getOwnPropertyDescriptor(AudioDecoder.prototype, 'decodeQueueSize').get;
    let busy = 3;
    Object.defineProperty(AudioDecoder.prototype, 'decodeQueueSize', { get(){ return busy-- > 0 ? 1000 : size.call(this); } });
  });
  await page.reload();
  const out = await convertOne(page, clip());
  expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
});

// Browsers without WebCodecs, or that can't stream a codec, decode the
// audio track whole instead.
for (const [name, script] of [
  ['without WebCodecs', () => { delete window.AudioDecoder; }],
  ['when the codec isn’t supported', () => { AudioDecoder.isConfigSupported = () => Promise.resolve({ supported: false }); }],
  ['when the codec check fails', () => { AudioDecoder.isConfigSupported = () => Promise.reject(new TypeError('bad config')); }]
]) {
  test(`decodes the audio track whole ${name}`, async ({ page }) => {
    await page.addInitScript(script);
    await page.reload();
    await spy(page);
    const out = await convertOne(page, file('clip.mp4', flacMp4(tone(1, 2), 44100, { video: 50000 }), 'video/mp4'));
    expect(await page.evaluate(() => window.wholeDecodes)).toBe(1);
    // Only the audio track was read, not the video.
    expect(Math.max(...await page.evaluate(() => window.reads))).toBeLessThan(50000);
    expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
  });
}

test('audio at a rate MP3 doesn’t have is decoded whole, and resampled', async ({ page }) => {
  await spy(page);
  const out = await convertOne(page, file('studio.m4a', flacMp4(tone(1, 2, 96000), 96000), 'audio/mp4'));
  expect(await page.evaluate(() => window.wholeDecodes)).toBe(1);
  expect(mp3Header(out.bytes)).toEqual({ kbps: 192, rate: 44100, mono: false });
  expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
});

test('a 48 kHz video stays 48 kHz', async ({ page }) => {
  await spy(page);
  const out = await convertOne(page, file('camera.mp4', flacMp4(tone(1, 2, 48000), 48000), 'video/mp4'));
  expect(await page.evaluate(() => window.wholeDecodes)).toBe(0);
  expect(mp3Header(out.bytes)).toEqual({ kbps: 192, rate: 48000, mono: false });
  expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
});

test('a video with no sound track says so', async ({ page }) => {
  const silent = Buffer.from(flacMp4(tone(1, 2)).toString('latin1').replace('soun', 'vide'), 'latin1');
  await page.locator('#picker').setInputFiles([file('silent.mp4', silent, 'video/mp4')]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('No audio your browser can read in this file');
});

test('a file that can’t be read part way through says so', async ({ page }) => {
  // The index reads fine; the audio (16 KB frames) doesn't, as when a file
  // is removed while it's being converted.
  await page.evaluate(() => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function(){ return this.size > 10000 ? Promise.reject(new DOMException('gone', 'NotReadableError')) : read.call(this); };
  });
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('No audio your browser can read in this file');
});

test('a decoder that fails at the end says the audio can’t be read', async ({ page }) => {
  await page.addInitScript(() => { AudioDecoder.prototype.flush = () => Promise.reject(new DOMException('bad data', 'EncodingError')); });
  await page.reload();
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('No audio your browser can read in this file');
});

// lamejs is fetched with the first MP3 (see libraries.spec.mjs); load it
// now so a test can swap parts of it out.
const loadLame = (page) => page.evaluate(() => window.bdnixFiles.loadScript('/assets/vendor/lame.min.js?v=1.2.1', 'lamejs'));

// Stands in for the workers that encode MP3. The first `real` workers the
// page hires are real ones; the others answer each piece as `mode` says:
// 'hang' never answers (the pieces wait in window.held), 'fail' sends an
// encoder's error, 'unloaded' says the scripts didn't load and 'error' is
// the worker's own script failing. window.workers counts those hired and
// stopped.
async function fakeWorkers(page, mode, real = 0){
  await page.evaluate(([mode, real]) => {
    const Real = window.RealWorker = window.RealWorker || window.Worker;
    window.workers = { made: 0, ended: 0 };
    window.held = [];
    window.Worker = function(url){
      const self = this;
      this.terminate = () => { window.workers.ended++; };
      if (++window.workers.made <= real) {
        const w = new Real(url);
        w.onmessage = (e) => self.onmessage(e);
        w.onerror = (e) => self.onerror(e);
        this.postMessage = (data, transfer) => w.postMessage(data, transfer);
        this.terminate = () => { window.workers.ended++; w.terminate(); };
        return;
      }
      this.postMessage = (data) => {
        if (data.load) return;
        if (mode === 'hang') window.held.push({ worker: self, index: data.index });
        else if (mode === 'error') setTimeout(() => self.onerror(new ErrorEvent('error', { message: 'NetworkError' })));
        else setTimeout(() => self.onmessage({ data: mode === 'fail' ? { index: data.index, error: 'out of memory' } : { index: data.index, unloaded: true } }));
      };
    };
  }, [mode, real]);
}

test('an encoder failure in a worker is reported on the file', async ({ page }) => {
  await fakeWorkers(page, 'fail');
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: out of memory');
  expect(await page.evaluate(() => window.workers)).toEqual({ made: 1, ended: 1 });
});

for (const mode of ['unloaded', 'error']) {
  test(`a worker whose scripts don’t load says so (${mode})`, async ({ page }) => {
    await fakeWorkers(page, mode);
    await page.locator('#picker').setInputFiles([clip()]);
    await page.getByRole('button', { name: 'Convert', exact: true }).click();
    await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: the MP3 encoder didn’t load. Check your connection and try again');
  });
}

// Three seconds of the two tones, in pieces of 16 frames (18,432 samples)
// rather than 512, so there are several pieces, and several workers,
// without encoding a long recording.
const long = () => file('lecture.mp4', flacMp4(tone(3, 2)), 'video/mp4');
const smallPieces = (page) => page.evaluate(() => { window.bdnixAudio.PIECE = 1152 * 16; });
const cores = (page, n) => page.addInitScript((n) => Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => n }), n);

test('a worker failing while the decoding waits for it is reported on the file', async ({ page }) => {
  // One worker, so the decoding waits once a second piece is cut: after
  // 2 × 16 frames and the 8 after them, of 1152 samples each.
  await cores(page, 2);
  await page.addInitScript(() => {
    window.decoded = 0;
    const copy = AudioData.prototype.copyTo;
    AudioData.prototype.copyTo = function(dest, options){
      if (!options.planeIndex) window.decoded += this.numberOfFrames;
      return copy.call(this, dest, options);
    };
  });
  await page.reload();
  await fakeWorkers(page, 'hang');
  await smallPieces(page);
  await page.locator('#picker').setInputFiles([long()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await page.waitForFunction(() => window.held.length === 1 && window.decoded >= 1152 * (2 * 16 + 8));
  await page.evaluate(() => {
    const { worker, index } = window.held[0];
    worker.onmessage({ data: { index, error: 'out of memory' } });
  });
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: out of memory');
  expect(await page.evaluate(() => window.workers)).toEqual({ made: 1, ended: 1 });
});

test('a long recording is encoded in pieces on several cores at once, and joined seamlessly', async ({ page }) => {
  await cores(page, 4);
  await page.reload();
  await fakeWorkers(page, 'hang', 99);
  await smallPieces(page);
  const out = await convertOne(page, long());
  // One core is left for the page.
  expect(await page.evaluate(() => window.workers)).toEqual({ made: 3, ended: 3 });
  expect(mp3Header(out.bytes)).toEqual({ kbps: 192, rate: 44100, mono: false });
  const sound = await analyse(page, out.bytes);
  expect(sound.seconds).toBeGreaterThanOrEqual(3);
  expect(sound.seconds).toBeLessThan(3.1);
  expect(sound.hz).toEqual([440, 660]);
  // Sounding as one encoder makes it, joins and all: a seam would be a
  // click, near the tones' own level (0.37). The joined MP3 is the same
  // frames, a few quantized slightly differently, so within 0.001 (-60 dB).
  const diff = await page.evaluate(async ([bytes, tones]) => {
    const A = window.bdnixAudio, n = 3 * 44100;
    const channels = tones.map((hz) => Float32Array.from({ length: n }, (_, i) => Math.round(12000 * Math.sin(2 * Math.PI * hz * i / 44100)) / 32768));
    const one = A.stream({ format: 'mp3', kbps: 192 }, window.lamejs);
    one.write(channels, 44100);
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const decode = (data) => ctx.decodeAudioData(data);
    const a = await decode(await new Blob(one.end().parts).arrayBuffer()), b = await decode(new Uint8Array(bytes).buffer);
    let most = a.length === b.length ? 0 : Infinity;
    for (let c = 0; c < 2; c++) {
      const x = a.getChannelData(c), y = b.getChannelData(c);
      for (let i = 0; i < x.length; i++) most = Math.max(most, Math.abs(x[i] - y[i]));
    }
    return most;
  }, [[...out.bytes], [440, 660]]);
  expect(diff).toBeLessThan(0.001);
});

// A short recording is shared out between the workers: 4 seconds is two
// pieces of the shortest, 128 frames (3.3 s), rather than one of 512.
for (const [decoded, upload] of [
  ['a piece at a time', () => file('short.mp4', flacMp4(tone(4, 1)), 'video/mp4')],
  ['whole', () => file('short.wav', wav(tone(4, 1)), 'audio/wav')]
]) {
  test(`a short recording is shared out between the workers, decoded ${decoded}`, async ({ page }) => {
    await cores(page, 8);
    await page.reload();
    await fakeWorkers(page, 'hang', 99);
    const out = await convertOne(page, upload());
    expect(await page.evaluate(() => window.workers)).toEqual({ made: 2, ended: 2 });
    const sound = await analyse(page, out.bytes);
    expect(sound.seconds).toBeGreaterThanOrEqual(4);
    expect(sound.seconds).toBeLessThan(4.1);
    expect(sound.hz).toEqual([440]);
  });
}

test('stereo at a low bitrate, which lamejs resamples, goes through one encoder', async ({ page }) => {
  await cores(page, 4);
  await page.reload();
  await fakeWorkers(page, 'hang', 99);
  await smallPieces(page);
  await page.locator('#picker').setInputFiles([long()]);
  await page.getByLabel('Quality').selectOption('96');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
  expect(await page.evaluate(() => window.workers)).toEqual({ made: 1, ended: 1 });
  const out = await fetchDownload(page, page.locator('.track'));
  expect(mp3Header(out.bytes)).toEqual({ kbps: 96, rate: 32000, mono: false });
  const sound = await analyse(page, out.bytes);
  expect(sound.seconds).toBeGreaterThanOrEqual(3);
  expect(sound.seconds).toBeLessThan(3.1);
  expect(sound.hz).toEqual([440, 660]);
});

test('Stop stops converting at once; the file can be converted again', async ({ page }) => {
  await fakeWorkers(page, 'hang');
  await page.locator('#picker').setInputFiles([clip()]);
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText(/^Converting… \d+%$/);
  await page.waitForFunction(() => window.workers.made === 1);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('#msg')).toHaveText('Stopped.');
  await expect(page.locator('#msg')).not.toHaveClass(/error/);
  await expect(page.locator('.file-meta')).toHaveText(/^\d+ KB$/);
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Convert', exact: true })).toBeFocused();
  // Its workers were stopped too.
  expect(await page.evaluate(() => window.workers)).toEqual({ made: 1, ended: 1 });

  await page.evaluate(() => { window.Worker = window.RealWorker; });
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
});

test('Stop before converting gets going starts nothing', async ({ page }) => {
  // lamejs arrives only when the test lets it.
  let arrive;
  const held = new Promise((resolve) => { arrive = resolve; });
  await page.route(/\/assets\/vendor\/lame\.min\.js/, async (route) => { await held; await route.continue(); });
  await fakeWorkers(page, 'hang', 99);
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('#msg')).toHaveText('Stopped.');
  arrive();
  await page.unroute(/\/assets\/vendor\/lame\.min\.js/);
  // Converting again takes the same steps, after the stopped conversion's
  // own; only this one hires a worker.
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
  expect(await page.evaluate(() => window.workers)).toEqual({ made: 1, ended: 1 });
});

test('Stop works while a whole file is being decoded, and while making WAV', async ({ page }) => {
  // Decoding whole waits until the test lets it finish.
  await page.addInitScript(() => {
    delete window.AudioDecoder;
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function(...args){
      return new Promise((resolve) => { window.release = () => resolve(decode.apply(this, args)); });
    };
  });
  await page.reload();
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByText('WAV', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await page.waitForFunction(() => window.release);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('#msg')).toHaveText('Stopped.');
  // The decoding finishing late changes nothing.
  await page.evaluate(() => window.release());
  await expect(page.locator('.file-meta')).toHaveText(/^\d+ KB$/);
  await expect(page.locator('.track .dl')).toHaveCount(0);
  await expect(page.locator('#msg')).toHaveText('Stopped.');
});

test('a decoder that fails part way says the audio can’t be read', async ({ page }) => {
  await page.addInitScript(() => {
    const configure = AudioDecoder.prototype.configure;
    AudioDecoder.prototype.configure = function(config){ return configure.call(this, { ...config, codec: 'nonsense' }); };
  });
  await page.reload();
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('No audio your browser can read in this file');
});

// The warning for browsers that can't decode phone videos' AAC audio a
// piece at a time. It depends on what the browser can do, not on which
// phone it is, so it covers old iPhones and Android phones alike.
const warning = (page) => page.getByRole('note');

test('no warning where AAC can be decoded a piece at a time', async ({ page }) => {
  await page.addInitScript(() => {
    const check = AudioDecoder.isConfigSupported;
    AudioDecoder.isConfigSupported = (config) => {
      if (config.codec !== 'mp4a.40.2') return check.call(AudioDecoder, config);
      window.aacChecked = true;
      return Promise.resolve({ supported: true, config });
    };
  });
  await page.reload();
  // The warning starts hidden, so wait until the page has checked.
  await page.waitForFunction(() => window.aacChecked);
  await expect(warning(page)).toBeHidden();
});

for (const [name, script] of [
  ['without WebCodecs (iOS before 26, older Android browsers)', () => { delete window.AudioDecoder; }],
  ['when AAC can’t be decoded that way', () => { AudioDecoder.isConfigSupported = () => Promise.resolve({ supported: false }); }],
  ['when the check fails', () => { AudioDecoder.isConfigSupported = () => Promise.reject(new TypeError('bad config')); }]
]) {
  test(`warns about long videos ${name}`, async ({ page }) => {
    await page.addInitScript(script);
    await page.reload();
    await expect(warning(page)).toBeVisible();
    await expect(warning(page)).toContainText('Long videos may not convert in this browser.');
    await expect(warning(page)).toContainText('on iPhone and iPad, to iOS 26 or later; on Android, to the latest Chrome');
    await expectNoSideScroll(page);
    // Converting still works.
    await page.locator('#picker').setInputFiles([clip()]);
    await page.getByRole('button', { name: 'Convert', exact: true }).click();
    await expect(page.locator('#msg')).toHaveText('Done.');
  });
}

test('quality and mono settings shape the MP3', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByLabel('Quality').selectOption('96');
  await page.getByText('Mono', { exact: true }).click();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  const out = await fetchDownload(page, page.locator('.track'));
  expect(mp3Header(out.bytes)).toEqual({ kbps: 96, rate: 44100, mono: true });
  const sound = await analyse(page, out.bytes);
  expect(sound.hz.length).toBe(1);
});

// lamejs lowers the sample rate for stereo at 96 kbps (to 32 kHz) and
// 64 kbps (to 24 kHz). Given more than a few hundred samples at a time, as
// when a file is decoded whole, it made near silence.
for (const [kbps, decoded] of [[96, 'whole'], [64, 'whole'], [96, 'a piece at a time']]) {
  test(`stereo at ${kbps} kbps keeps its sound, decoded ${decoded}`, async ({ page }) => {
    const upload = decoded === 'whole' ? file('song.wav', wav(tone(2, 2)), 'audio/wav') : clip();
    await page.locator('#picker').setInputFiles([upload]);
    await page.getByLabel('Quality').selectOption(String(kbps));
    await page.getByRole('button', { name: 'Convert', exact: true }).click();
    const out = await fetchDownload(page, page.locator('.track'));
    if (kbps === 96) expect(mp3Header(out.bytes)).toEqual({ kbps: 96, rate: 32000, mono: false });
    expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
  });
}

test('converts to WAV, sample for sample', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByText('WAV', { exact: true }).click();
  await expect(page.getByLabel('Quality')).toBeHidden();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  const out = await fetchDownload(page, page.locator('.track'));
  expect(out.name).toBe('holiday clip.wav');
  expect(readWav(out.bytes)).toEqual({ channels: 2, rate: 44100, bits: 16, frames: 44100 });
  expect((await analyse(page, out.bytes)).hz).toEqual([440, 660]);
});

test('audio files convert too, and a mono one stays mono', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('voice memo.wav', wav(tone(1, 1)), 'audio/wav')]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
  const memo = await fetchDownload(page, page.locator('.track'));
  expect(memo.name).toBe('voice memo.mp3');
  // A mono source stays mono even with Stereo picked.
  expect(mp3Header(memo.bytes).mono).toBe(true);
  expect((await analyse(page, memo.bytes)).hz).toEqual([440]);
});

test('skips files that aren’t video or audio, and explains one it can’t read', async ({ page }) => {
  await page.locator('#picker').setInputFiles([file('notes.txt', 'hello', 'text/plain')]);
  await expect(page.locator('#msg')).toHaveText('Skipped: notes.txt isn’t a video or audio file.');
  await expect(page.locator('#filesWrap')).toBeHidden();

  await dropFiles(page, [file('a.txt', 'x', 'text/plain'), file('b.txt', 'y', 'text/plain')]);
  await expect(page.locator('#msg')).toHaveText('Skipped: a.txt, b.txt aren’t a video or audio file.');

  await page.locator('#picker').setInputFiles([file('broken.mp4', 'not really a video', 'video/mp4')]);
  await expect(page.locator('#msg')).toHaveText('');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('This file couldn’t be converted. Your browser may not support its audio format.');
  await expect(page.locator('#msg')).toHaveClass(/error/);
  await expect(page.locator('.file-meta')).toHaveText('No audio your browser can read in this file');
  await expect(page.locator('.track .dl')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Convert', exact: true })).toBeDisabled();

  // A file that isn't video or audio leaves the one open as it is.
  await page.locator('#picker').setInputFiles([file('notes.txt', 'hello', 'text/plain')]);
  await expect(page.locator('.file-name')).toHaveText(['broken.mp4']);
});

test('an encoder failure is reported on the file', async ({ page }) => {
  await loadLame(page);
  await page.evaluate(() => { window.lamejs.Mp3Encoder = function(){ throw new Error('out of memory'); }; });
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-meta')).toHaveText('Couldn’t convert: out of memory');
});

test('changing a setting clears the result, and opening another file replaces the one open', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.dl')).toHaveCount(1);
  await page.getByLabel('Quality').selectOption('320');
  await expect(page.locator('.dl')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Convert', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.dl')).toHaveCount(1);

  // The result of the first file goes with it.
  const url = await page.locator('.dl').getAttribute('href');
  await page.locator('#picker').setInputFiles([file('second.wav', wav(tone(1, 2)), 'audio/wav')]);
  await expect(page.locator('.file-name')).toHaveText(['second.wav']);
  await expect(page.locator('.dl')).toHaveCount(0);
  expect(await page.evaluate((u) => fetch(u).then(() => 'kept', () => 'gone'), url)).toBe('gone');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download second.mp3' })).toBeVisible();
});

test('removing the file', async ({ page }) => {
  await page.locator('#picker').setInputFiles([clip()]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.dl')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove holiday clip.mp4' }).click();
  await expect(page.locator('.track')).toHaveCount(0);
  await expect(page.locator('#filesWrap')).toBeHidden();
  await expect(page.locator('#drop')).not.toHaveClass(/compact/);
});

// Drops files on the page, as from a file manager.
async function dropFiles(page, files, { enter = false } = {}){
  const transfer = await page.evaluateHandle((list) => {
    const dt = new DataTransfer();
    for (const f of list) dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.name, { type: f.mimeType }));
    return dt;
  }, files.map((f) => ({ name: f.name, mimeType: f.mimeType, b64: Buffer.from(f.buffer).toString('base64') })));
  if (enter) {
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: transfer });
    await expect(page.locator('#drop')).toHaveClass(/over/);
  }
  await page.dispatchEvent('body', 'drop', { dataTransfer: transfer });
}

test('a file can be dropped anywhere on the page', async ({ page }) => {
  await dropFiles(page, [file('dropped.mp4', flacMp4(tone(1, 2)), 'video/mp4')], { enter: true });
  await expect(page.locator('#drop')).not.toHaveClass(/over/);
  await expect(page.locator('.file-name')).toHaveText(['dropped.mp4']);
});

test('of several files dropped at once, the first video or audio file opens', async ({ page }) => {
  await dropFiles(page, [file('notes.txt', 'hello', 'text/plain'), file('first.wav', wav(tone(1, 1)), 'audio/wav'), clip()]);
  await expect(page.locator('.file-name')).toHaveText(['first.wav']);
  await expect(page.locator('#msg')).toHaveText('This tool converts one file at a time, so it opened first.wav.');
  await expect(page.locator('#msg')).not.toHaveClass(/error/);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
  await expect(page.locator('.track .dl')).toHaveCount(1);
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
        locked: document.querySelector('.rm').disabled && document.querySelector('[name=kbps]').disabled,
        stop: !document.getElementById('stopBtn').hidden,
        drop: document.getElementById('drop').className
      });
    }).observe(document.getElementById('filesWrap'), { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await page.locator('#picker').setInputFiles([file('long.wav', wav(tone(5, 2)), 'audio/wav')]);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('#msg')).toHaveText('Done.');
  const seen = await page.evaluate(() => window.seen);
  const busy = { bar: true, label: 'Converting…', locked: true, stop: true, drop: 'drop panel compact busy' };
  expect(seen).toContainEqual({ meta: 'Converting… 0%', ...busy });
  expect(seen).toContainEqual({ meta: 'Converting… 100%', ...busy });
  await expect(page.locator('.rm')).toBeEnabled();
  await expect(page.locator('.track-bar')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeHidden();
  await expect(page.locator('#drop')).toHaveClass('drop panel compact');
});

test('once a file is open, the drop zone is a row for opening another', async ({ page }) => {
  const drop = page.locator('#drop');
  await expect(page.locator('#picker')).not.toHaveAttribute('multiple');
  await expect(drop.getByText('Drop a video or audio file here')).toBeVisible();
  await expect(drop.getByText('Open another file')).toBeHidden();
  const tall = (await drop.boundingBox()).height;

  await page.locator('#picker').setInputFiles([clip()]);
  await expect(drop).toHaveClass(/compact/);
  await expect(drop.getByText('Open another file')).toBeVisible();
  await expect(drop.getByText('Drop a video or audio file here')).toBeHidden();
  await expect(drop.getByText('or choose a file')).toBeHidden();
  expect((await drop.boundingBox()).height).toBeLessThan(tall / 2);
  await expectNoSideScroll(page);

  // While converting, it's dimmed and takes no file.
  await fakeWorkers(page, 'hang');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(drop).toHaveClass(/busy/);
  await expect(drop).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('#picker')).toBeDisabled();
  await dropFiles(page, [file('other.wav', wav(tone(1, 1)), 'audio/wav')]);
  await expect(page.locator('.file-name')).toHaveText(['holiday clip.mp4']);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(drop).not.toHaveClass(/busy/);
});
