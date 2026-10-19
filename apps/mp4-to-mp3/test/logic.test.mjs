import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { load, plain } from '../../../tests/unit/load.mjs';
import { flacMp4, wav, tone, box, full, u8, u16, u32 } from '../../../tests/ui/media.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { bdnixAudio: A } = load(['apps/mp4-to-mp3/audio-core.js'], { WebAssembly });
// LAME, built to WebAssembly (apps/mp4-to-mp3/lame/), as the page and its
// workers use it.
const LAME = fs.readFileSync(path.join(root, 'apps/mp4-to-mp3/vendor/lame.wasm'));
const lame = await A.lame(LAME);

// A sine tone as float samples, the way the browser hands decoded audio over.
const sine = (n, hz, rate = 44100, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate));
const bytesOf = (parts) => Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)));

// Every MPEG-1 Layer III frame header in the file.
const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];
function frames(buf){
  const out = [];
  for (let i = 0; i + 4 <= buf.length;) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xfe) !== 0xfa) { i++; continue; }
    const kbps = KBPS[buf[i + 2] >> 4], rate = RATES[(buf[i + 2] >> 2) & 3], pad = (buf[i + 2] >> 1) & 1;
    out.push({ kbps, rate, mono: buf[i + 3] >> 6 === 3 });
    i += Math.floor(144000 * kbps / rate) + pad;
  }
  return out;
}

test('isMedia: by type or by extension', () => {
  assert.equal(A.isMedia({ type: 'video/mp4', name: 'x' }), true);
  assert.equal(A.isMedia({ type: 'audio/x-m4a', name: 'x' }), true);
  assert.equal(A.isMedia({ type: '', name: 'Clip.MOV' }), true);
  assert.equal(A.isMedia({ name: 'song.flac' }), true);
  assert.equal(A.isMedia({ type: 'text/plain', name: 'notes.txt' }), false);
  assert.equal(A.isMedia({ type: '', name: 'mp4' }), false);
  assert.equal(A.isMedia({ type: 'application/pdf', name: 'a.pdf' }), false);
});

test('outName: swaps the extension', () => {
  assert.equal(A.outName('holiday clip.mp4', 'mp3'), 'holiday clip.mp3');
  assert.equal(A.outName('a.b.mov', 'wav'), 'a.b.wav');
  assert.equal(A.outName('noext', 'mp3'), 'noext.mp3');
  assert.equal(A.outName('.hidden', 'mp3'), '.hidden.mp3');
});

test('timeLeft: about how long is left, once it can tell', () => {
  // Too early to tell: under 2 seconds in, under 2% done, or done.
  assert.equal(A.timeLeft(1999, 0.5), null);
  assert.equal(A.timeLeft(60000, 0.019), null);
  assert.equal(A.timeLeft(60000, 1), null);
  assert.equal(A.timeLeft(60000, NaN), null);
  // At the same pace: 10 s for 25% leaves 30 s.
  assert.equal(A.timeLeft(10000, 0.25), 'less than a minute left');
  assert.equal(A.timeLeft(20000, 0.25), 'about 1 minute left');
  assert.equal(A.timeLeft(60000, 0.25), 'about 3 minutes left');
  assert.equal(A.timeLeft(89000, 0.5), 'about 1 minute left');
  assert.equal(A.timeLeft(91000, 0.5), 'about 2 minutes left');
  assert.equal(A.timeLeft(59 * 60000, 0.5), 'about 59 minutes left');
  assert.equal(A.timeLeft(60 * 60000, 0.5), 'about 1 h 0 min left');
  // 12 minutes for 10% leaves 108 minutes.
  assert.equal(A.timeLeft(12 * 60000, 0.1), 'about 1 h 48 min left');
});

test('reportRows: how a conversion went, in words', () => {
  const base = { took: 23160, seconds: 3600, whole: false, size: '82.4 MB', format: 'mp3', kbps: 192, rate: 44100, channels: 2, cores: 4, awake: { on: true, hidden: 0 } };
  const rows = (r) => Object.fromEntries(A.reportRows({ ...base, ...r }).map((row) => [...row]));
  assert.deepEqual(rows({ mp3: { workers: 3, pieces: [13.37, 13.37, 2.24], oneEncoder: false } }), {
    'Time taken': '23.2 s', Length: '1:00:00', Speed: '155× real time',
    Encoders: '3 at once, of 4 cores', Pieces: '3 pieces of 13.4 s, the last 2.2 s',
    'Sound read': 'A piece at a time', File: '82.4 MB · 192 kbps · 44.1 kHz · stereo', Screen: 'Kept on'
  });
  // A minute or more is minutes and seconds; under 10× real time has a decimal.
  const slow = rows({ took: 125000, seconds: 600, whole: true, cores: 0, mp3: { workers: 1, pieces: [13.4], oneEncoder: false }, awake: { on: false, hidden: 61500 } });
  assert.equal(slow['Time taken'], '2:05');
  assert.equal(slow.Speed, '4.8× real time');
  assert.equal(slow.Encoders, '1 at once');
  assert.equal(slow.Pieces, '1 piece of 13.4 s');
  assert.equal(slow['Sound read'], 'All at once');
  assert.equal(slow.Screen, 'Not kept on: this browser didn’t allow it');
  assert.equal(slow['Page hidden'], '1:02: converting pauses while the page is hidden');
  // Under a second hidden isn't worth a row.
  assert.equal(rows({ mp3: { workers: 1, pieces: [], oneEncoder: false }, awake: { on: true, hidden: 999 } })['Page hidden'], undefined);
  assert.equal(rows({ mp3: { workers: 1, pieces: [], oneEncoder: false } }).Pieces, '0 pieces of 0 s');
  assert.equal(rows({ mp3: { workers: 1, pieces: [13.4, 13.4], oneEncoder: true }, rate: 32000 }).Pieces,
    '2 pieces, one after another through one encoder: at this setting LAME lowers the sample rate, and that can’t be shared out');
  // WAV has no encoders or pieces.
  const wav = rows({ format: 'wav', mp3: null, channels: 1, size: '86 KB' });
  assert.deepEqual(Object.keys(wav), ['Time taken', 'Length', 'Speed', 'Sound read', 'File', 'Screen']);
  assert.equal(wav.File, '86 KB · 44.1 kHz · mono');
  // Instant conversions don't divide by nothing.
  assert.equal(rows({ took: 0, seconds: 1, mp3: null, format: 'wav' }).Speed, '1000× real time');
});

test('fmtTime', () => {
  assert.equal(A.fmtTime(0), '0:00');
  assert.equal(A.fmtTime(1.04), '0:01');
  assert.equal(A.fmtTime(59.6), '1:00');
  assert.equal(A.fmtTime(65), '1:05');
  assert.equal(A.fmtTime(3725), '1:02:05');
  assert.equal(A.fmtTime(36000), '10:00:00');
});

test('mix: stereo keeps the first two channels; mono averages them all', () => {
  const l = Float32Array.from([1, 0.5]), r = Float32Array.from([0, -0.5]), c = Float32Array.from([0.5, 0.5]);
  assert.deepEqual(A.mix([l, r], false), [l, r]);
  assert.deepEqual(A.mix([l, r, c], false), [l, r]);
  assert.deepEqual(A.mix([l], false), [l]);
  assert.deepEqual(A.mix([l], true), [l]);
  assert.deepEqual([...A.mix([l, r], true)[0]], [0.5, 0]);
  assert.deepEqual([...A.mix([l, r, c], true)[0]], [0.5, 0.1666666716337204]);
});

test('toPcm16: scales, rounds and clips', () => {
  const src = Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -3, 0.25]);
  assert.deepEqual([...A.toPcm16(src, 0, src.length)], [0, 32767, -32768, 16384, -16384, 32767, -32768, 8192]);
  assert.deepEqual([...A.toPcm16(src, 3, 5)], [16384, -16384]);
});

const mp3Of = (channels, rate, kbps, block = channels[0].length) => {
  const out = A.stream({ format: 'mp3', kbps }, lame);
  for (let at = 0; at < channels[0].length; at += block) out.write(channels.map((c) => c.subarray(at, at + block)), rate);
  return bytesOf(out.end().parts);
};

test('stream: WAV has the right header and samples', () => {
  const l = Float32Array.from([0, 0.5, -0.5]), r = Float32Array.from([1, -1, 0]);
  const wav = A.stream({ format: 'wav' });
  wav.write([l, r], 48000);
  const out = wav.end();
  assert.equal(out.frames, 3);
  assert.equal(out.rate, 48000);
  const buf = bytesOf(out.parts);
  assert.equal(buf.length, 44 + 3 * 2 * 2);
  assert.equal(buf.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buf.readUInt32LE(4), 36 + 12);
  assert.equal(buf.toString('latin1', 8, 16), 'WAVEfmt ');
  assert.equal(buf.readUInt16LE(20), 1, 'PCM');
  assert.equal(buf.readUInt16LE(22), 2, 'channels');
  assert.equal(buf.readUInt32LE(24), 48000);
  assert.equal(buf.readUInt32LE(28), 48000 * 4, 'bytes per second');
  assert.equal(buf.readUInt16LE(32), 4, 'block align');
  assert.equal(buf.readUInt16LE(34), 16, 'bits');
  assert.equal(buf.toString('latin1', 36, 40), 'data');
  assert.equal(buf.readUInt32LE(40), 12);
  const samples = [];
  for (let o = 44; o < buf.length; o += 2) samples.push(buf.readInt16LE(o));
  assert.deepEqual(samples, [0, 32767, 16384, -32768, -16384, 0], 'interleaved left, right');
});

test('stream: MP3 frames carry the chosen bitrate and channel count', () => {
  const second = 44100;
  // Like its command line, LAME lowers the sample rate for stereo at
  // lower bitrates (96 kbps is 32 kHz; 64 kbps drops to MPEG-2, which this
  // test doesn't read).
  for (const [kbps, rate] of [[96, 32000], [128, 44100], [192, 44100], [320, 44100]]) {
    const f = frames(mp3Of([sine(second, 440), sine(second, 660)], 44100, kbps));
    // One second is rate / 1152 frames, plus the encoder's padding.
    const expected = rate / 1152;
    assert.ok(f.length >= expected && f.length <= expected + 4, `${kbps} kbps: ${f.length} frames`);
    assert.ok(f.every((x) => x.kbps === kbps && x.rate === rate && !x.mono), `${kbps} kbps frames`);
  }
  const f = frames(mp3Of([sine(second, 440)], 44100, 64));
  assert.ok(f.length >= 38 && f.every((x) => x.kbps === 64 && x.rate === 44100 && x.mono));
});

// --- MP3 in pieces, on several cores ---

const LEAD = 1152 * 8;
function piecesOf(channels, rate, kbps, { size = LEAD, block = 1000, cut = null } = {}){
  const out = [], split = A.splitter(kbps, lame, cut, (p) => out.push(p), size);
  for (let at = 0; at < channels[0].length; at += block) split.write(channels.map((c) => c.subarray(at, at + block)), rate);
  split.end();
  return out;
}
// The pieces through their encoders: one each, or one for a run of pieces
// that carry on into the next.
function joined(pieces){
  let encode = null;
  return Buffer.concat(pieces.map((p) => {
    encode = encode || A.pieceEncoder(lame);
    const out = Buffer.from(encode(p));
    if (!p.more) encode = null;
    return out;
  }));
}
const shape = (pieces) => pieces.map((p) => [p.skip, p.keep, p.samples, p.channels.length && p.channels[0].length, p.more]);
const floats = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
// Bitrates and sample rates of MPEG-2 and 2.5, the rates below 32 kHz.
const LOW_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const LOW_RATES = { 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// An MP3's frames, each as its bytes.
function frameBytes(buf){
  const out = [];
  for (let i = 0; i < buf.length;) {
    const version = buf[i + 1] >> 3 & 3, mpeg1 = version === 3;
    const kbps = (mpeg1 ? KBPS : LOW_KBPS)[buf[i + 2] >> 4], rate = (mpeg1 ? RATES : LOW_RATES[version])[(buf[i + 2] >> 2) & 3];
    out.push(buf.subarray(i, i + Math.floor((mpeg1 ? 144000 : 72000) * kbps / rate) + ((buf[i + 2] >> 1) & 1)));
    i += out[out.length - 1].length;
  }
  return out;
}

// Compares the pieces' MP3 with one encoder's: the same frames, with the
// same headers. Each piece's encoder starts the 44.1 kHz pattern of frames
// a byte longer (padding) afresh, so a frame can differ in that bit and
// that byte. Returns how many frames hold their sound differently.
function compare(a, b){
  const fa = frameBytes(a), fb = frameBytes(b);
  assert.equal(fb.length, fa.length, 'frames');
  return fa.filter((x, i) => {
    const y = fb[i], n = Math.min(x.length, y.length);
    assert.ok(Math.abs(x.length - y.length) <= 1, `frame ${i} length`);
    assert.deepEqual([x[0], x[1], x[2] & ~2, x[3]], [y[0], y[1], y[2] & ~2, y[3]], `frame ${i} header`);
    return !Buffer.from(x.subarray(4, n)).equals(Buffer.from(y.subarray(4, n)));
  }).length;
}

test('mp3Rate: the rate lame makes MP3s at', () => {
  assert.equal(A.mp3Rate(lame, 2, 44100, 128), 44100);
  assert.equal(A.mp3Rate(lame, 1, 44100, 64), 44100);
  assert.equal(A.mp3Rate(lame, 2, 48000, 192), 48000);
  assert.equal(A.mp3Rate(lame, 1, 16000, 64), 16000);
  // Stereo at low bitrates is made at a lower rate.
  assert.equal(A.mp3Rate(lame, 2, 44100, 96), 32000);
  assert.equal(A.mp3Rate(lame, 2, 48000, 64), 24000);
});

test('lame: starts from a compiled module as well as from the file', async () => {
  const sound = [sine(1152 * 4, 440), sine(1152 * 4, 660)];
  const fromModule = await A.lame(new WebAssembly.Module(LAME));
  const mp3 = (enc) => {
    enc.start(2, 44100, 192);
    return Buffer.concat([...enc.encode(sound, 0, sound[0].length), enc.flush()].map((b) => Buffer.from(b)));
  };
  assert.deepEqual(mp3(fromModule), mp3(lame));
});

// LAME with its calls answered as a test says: { calls: { name: fn } }.
async function fakeLame(calls){
  const memory = new WebAssembly.Memory({ initial: 1 });
  const exports = { memory, _initialize(){}, enc_left: () => 0, enc_right: () => 4096, enc_out: () => 8192, enc_init: () => 44100, enc_encode: () => 0, enc_flush: () => 0, ...calls };
  const { bdnixAudio } = load(['apps/mp4-to-mp3/audio-core.js'], { WebAssembly: { instantiate: () => Promise.resolve({ exports }) } });
  return bdnixAudio.lame(LAME);
}

test('lame: settings LAME can’t start with, and LAME’s errors, are errors', async () => {
  // LAME adjusts settings it doesn't take; it fails to start only when out
  // of memory.
  const refused = await fakeLame({ enc_init: () => 0 });
  assert.throws(() => refused.start(2, 44100, 128), /LAME can’t make 128 kbps MP3 from 2 channels at 44100 Hz/);
  const failing = await fakeLame({ enc_encode: () => -2, enc_flush: () => -1 });
  assert.equal(failing.start(2, 44100, 128), 44100);
  assert.throws(() => failing.encode([sine(10, 440)], 0, 10), /LAME couldn’t encode \(error -2\)/);
  assert.throws(() => failing.flush(), /LAME couldn’t encode \(error -1\)/);
  // Nothing made yet is no bytes.
  const quiet = await fakeLame({});
  assert.equal(quiet.encode([sine(10, 440)], 0, 10).length, 0);
});

test('lame: LAME giving up is an error', async () => {
  // proc_exit is how LAME's C library stops; it never should.
  let exit = null;
  const real = WebAssembly.instantiate;
  const { bdnixAudio } = load(['apps/mp4-to-mp3/audio-core.js'], { WebAssembly: { instantiate: (m, imports) => { exit = imports.wasi_snapshot_preview1.proc_exit; return real(m, imports); } } });
  await bdnixAudio.lame(LAME);
  assert.throws(() => exit(1), /LAME stopped/);
  const quiet = await bdnixAudio.lame(LAME);
  assert.ok(quiet);
});

test('splitter: pieces of the sound, with the sound around each', () => {
  const n = LEAD * 3 + 100, left = sine(n, 440), right = sine(n, 660);
  const pieces = piecesOf([left, right], 44100, 128);
  assert.deepEqual(shape(pieces), [
    [0, 8, LEAD, LEAD * 2, false],
    [8, 8, LEAD, LEAD * 3, false],
    [8, -1, LEAD + 100, LEAD * 2 + 100, false]
  ]);
  assert.ok(pieces.every((p) => p.rate === 44100 && p.kbps === 128 && p.channels.length === 2));
  // Each piece is the sound from LEAD before its own.
  assert.deepEqual(floats(pieces[1].channels[1]), floats(right.slice(0, LEAD * 3)));
  assert.deepEqual(floats(pieces[2].channels[0]), floats(left.slice(LEAD, n)));
});

test('splitter: the sound after a piece is the next one’s, even at the end', () => {
  const pieces = piecesOf([sine(LEAD * 3, 440)], 44100, 128, { block: 777, size: LEAD * 2 });
  assert.deepEqual(shape(pieces), [[0, 16, LEAD * 2, LEAD * 3, false], [8, -1, LEAD, LEAD * 2, false]]);
});

test('splitter: pieces are 512 frames long unless asked otherwise', () => {
  const pieces = piecesOf([new Float32Array(1152 * 1100)], 44100, 128, { size: 0, block: 1152 * 100 });
  assert.deepEqual(shape(pieces), [[0, 512, 1152 * 512, 1152 * 520, false], [8, 512, 1152 * 512, 1152 * 528, false], [8, -1, 1152 * 76, 1152 * 84, false]]);
});

test('pieceSize: a shorter recording is shared out between the workers', () => {
  const PIECE = 1152 * 512, SHORTEST = 1152 * 128;
  // Long enough for full pieces.
  assert.equal(A.pieceSize(44100 * 3600, 6), PIECE);
  assert.equal(A.pieceSize(PIECE * 6, 6), PIECE);
  // 30 seconds on 6 workers: 5 seconds each, rounded up to whole frames.
  assert.equal(A.pieceSize(44100 * 30, 6), 1152 * 192);
  assert.equal(A.pieceSize(1152 * 300 + 1, 2), 1152 * 151);
  // No shorter than SHORTEST, so 12 seconds makes 4 pieces, not 6.
  assert.equal(A.pieceSize(44100 * 12, 6), SHORTEST);
  assert.equal(Math.ceil(44100 * 12 / SHORTEST), 4);
  // One worker: full pieces.
  assert.equal(A.pieceSize(44100 * 60, 1), PIECE);
  // A length that isn't known.
  for (const n of [0, NaN, undefined, -5]) assert.equal(A.pieceSize(n, 6), PIECE);
  // PIECE is the longest, even below SHORTEST (as tests set it).
  A.PIECE = 1152 * 16;
  try {
    assert.equal(A.pieceSize(44100 * 30, 6), 1152 * 16);
  } finally {
    A.PIECE = PIECE;
  }
});

test('splitter: frames are counted in 576 samples below 32 kHz', () => {
  const pieces = piecesOf([sine(LEAD * 2 + 10, 440, 16000)], 16000, 64);
  assert.deepEqual(pieces.map((p) => [p.skip, p.keep]), [[0, 16], [16, -1]]);
});

test('splitter: where lame changes the rate, pieces carry on through one encoder', () => {
  const n = LEAD * 2 + 100, sound = sine(n, 440);
  const pieces = piecesOf([sound, sound], 44100, 96);
  assert.deepEqual(shape(pieces), [[0, -1, LEAD, LEAD, true], [0, -1, LEAD, LEAD, true], [0, -1, 100, 100, false]]);
  assert.deepEqual(floats(pieces[1].channels[0]), floats(sound.slice(LEAD, LEAD * 2)));
});

test('splitter: an edit list trims the sound first', () => {
  const sound = sine(44100, 440);
  const pieces = piecesOf([sound], 44100, 128, { cut: { skip: 0.1, keep: 0.5 } });
  assert.equal(pieces.reduce((sum, p) => sum + p.samples, 0), 22050);
  assert.deepEqual(floats(pieces[0].channels[0].subarray(0, 100)), floats(sound.subarray(4410, 4510)));
});

test('splitter: no sound still makes a piece, and a valid empty MP3', () => {
  const pieces = piecesOf([new Float32Array(0)], 44100, 128);
  assert.deepEqual(shape(pieces), [[0, -1, 0, 0, false]]);
  assert.ok(frameBytes(joined(pieces)).length <= 2);
});

// A tone on the left and something busier on the right.
const busy = (n, rate) => [sine(n, 440, rate), Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i / 7) + 0.3 * Math.sin(i * i / 1e6))];
const cases = [[44100, 128, LEAD * 5 + 77, LEAD], [44100, 192, LEAD * 4, LEAD * 2], [16000, 64, LEAD * 3 + 5, LEAD], [48000, 128, LEAD * 4, LEAD]];

test('pieceEncoder: the pieces of a tone joined are the MP3 one encoder makes', () => {
  for (const [rate, kbps, n, size] of cases) {
    const sound = [sine(n, 440, rate), sine(n, 660, rate)], pieces = piecesOf(sound, rate, kbps, { size });
    assert.ok(pieces.length >= 2, `${rate} Hz ${kbps} kbps: ${pieces.length} pieces`);
    assert.equal(compare(mp3Of(sound, rate, kbps), joined(pieces)), 0, `${rate} Hz ${kbps} kbps`);
  }
});

test('pieceEncoder: busier sound joins into the same frames, a few quantized differently', () => {
  // lame carries a little from frame to frame beyond the sound around a
  // piece, so a few frames, anywhere in a piece, come out slightly
  // differently: still the same sound. The page's tests check the joins
  // by ear (behaviour.spec.mjs).
  for (const [rate, kbps, n, size] of cases) {
    const sound = busy(n, rate), pieces = piecesOf(sound, rate, kbps, { size });
    const frames = frameBytes(joined(pieces)).length, differ = compare(mp3Of(sound, rate, kbps), joined(pieces));
    assert.ok(differ <= frames * 0.05, `${rate} Hz ${kbps} kbps: ${differ} of ${frames} frames differ`);
  }
});

test('pieceEncoder: pieces through one encoder are exactly its MP3', () => {
  // Resampling depends on where each call to lame starts, so the encoder
  // here gets the sound in the same blocks.
  for (const [rate, kbps] of [[44100, 96], [48000, 64]]) {
    const sound = busy(LEAD * 3 + 9, rate), pieces = piecesOf(sound, rate, kbps);
    assert.ok(pieces.length >= 3 && pieces[0].more);
    assert.deepEqual(joined(pieces), mp3Of(sound, rate, kbps, LEAD));
  }
});

test('keepFrames: picks frames by number', () => {
  const mp3 = mp3Of([sine(1152 * 10, 440)], 44100, 128), all = frameBytes(mp3);
  const at = (n) => all.slice(0, n).reduce((sum, f) => sum + f.length, 0);
  assert.deepEqual(Buffer.from(A.keepFrames(mp3, 2, 3)), mp3.subarray(at(2), at(5)));
  assert.deepEqual(Buffer.from(A.keepFrames(mp3, 4, -1)), mp3.subarray(at(4)));
  assert.equal(A.keepFrames(mp3, all.length, 2).length, 0);
  assert.equal(A.keepFrames(new Uint8Array(0), 0, -1).length, 0);
  const low = mp3Of([sine(1152 * 10, 440, 8000)], 8000, 32);
  assert.equal(A.keepFrames(low, 1, -1).length, low.length - frameBytes(low)[0].length);
});

test('keepFrames: something that isn’t MP3 frames is an error', () => {
  const mp3 = mp3Of([sine(1152 * 4, 440)], 44100, 128);
  const unsynced = Buffer.from(mp3);
  unsynced[0] = 0;
  // A reserved version, and a bitrate of 0 ("free").
  const reserved = Buffer.from(mp3);
  reserved[1] = (reserved[1] & ~0x18) | 0x08;
  const free = Buffer.from(mp3);
  free[2] &= 0x0f;
  for (const bad of [Buffer.from('not an mp3 at all'), unsynced, reserved, free]) assert.throws(() => A.keepFrames(bad, 0, -1), /the MP3 encoder made a broken frame/);
});

// --- audio-worker.js: encoding pieces off the page ---

// The worker in a sandbox: importScripts is given, and what it posts is
// recorded.
function worker(importScripts){
  const posted = [], sandbox = load([], { WebAssembly }), file = path.join(root, 'apps/mp4-to-mp3/audio-worker.js');
  Object.assign(sandbox, { self: sandbox, importScripts, postMessage: (data, transfer) => posted.push({ data, transfer }) });
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return {
    send: (data) => sandbox.onmessage({ data }),
    // Answers come once LAME has started, in turn.
    answers: async (n) => {
      for (let i = 0; i < 1000 && posted.length < n; i++) await new Promise((resolve) => setImmediate(resolve));
      return JSON.parse(JSON.stringify(posted.map((p) => p.data)));
    },
    raw: posted, sandbox
  };
}
const CORE = '/assets/js/audio-core.js?v=1';
const LOAD = { load: true, core: '1' };
// Loads the real audio-core.js into the worker's sandbox.
const realCore = (w) => (url) => {
  assert.equal(url, CORE);
  vm.runInContext(fs.readFileSync(path.join(root, 'apps/mp4-to-mp3/audio-core.js'), 'utf8'), w.sandbox);
};

test('worker: loads what it is sent, then encodes pieces in turn, carrying on where they do', async () => {
  const w = worker((url) => realCore(w)(url));
  w.send({ ...LOAD, lame: new WebAssembly.Module(LAME) });
  assert.equal(typeof w.sandbox.bdnixAudio.pieceEncoder, 'function');
  const sound = busy(LEAD * 3, 44100), pieces = [...piecesOf(sound, 44100, 128), ...piecesOf(sound, 44100, 96)];
  pieces.forEach((p, index) => w.send({ ...p, index }));
  assert.deepEqual((await w.answers(pieces.length)).map((d) => d.index), pieces.map((p, i) => i));
  const bytes = w.raw.map((p) => Buffer.from(p.data.bytes));
  assert.deepEqual(Buffer.concat(bytes.slice(0, 3)), joined(pieces.slice(0, 3)));
  assert.deepEqual(Buffer.concat(bytes.slice(3)), mp3Of(sound, 44100, 96, LEAD));
  assert.ok(w.raw.every((p) => p.transfer.length === 1 && p.transfer[0] === p.data.bytes.buffer));
});

test('worker: an encoder failure is sent back', async () => {
  const w = worker((url) => {
    realCore(w)(url);
    w.sandbox.bdnixAudio.lame = () => Promise.resolve({ start(){ throw new Error('out of memory'); } });
  });
  w.send({ ...LOAD, lame: LAME });
  w.send({ ...piecesOf([sine(100, 440)], 44100, 128)[0], index: 0 });
  assert.deepEqual(await w.answers(1), [{ index: 0, error: 'out of memory' }]);
  // Something thrown that isn't an Error.
  const odd = worker(() => { odd.sandbox.bdnixAudio = { lame: () => Promise.resolve({}), pieceEncoder: () => () => { throw 'odd'; } }; });
  odd.send(LOAD);
  odd.send({ index: 1 });
  assert.deepEqual(await odd.answers(1), [{ index: 1, error: 'odd' }]);
});

test('worker: loads audio-core.js from its own place, whatever version it is told', async () => {
  const urls = [];
  for (const core of ['1', '', 'a b&x=//elsewhere.example/']) {
    const w = worker((url) => { urls.push(url); throw new Error('stop'); });
    w.send({ load: true, core });
  }
  assert.deepEqual(urls, ['/assets/js/audio-core.js?v=1', '/assets/js/audio-core.js', '/assets/js/audio-core.js?v=a%20b%26x%3D%2F%2Felsewhere.example%2F']);
});

test('worker: when its script or LAME doesn’t load, each piece says so', async () => {
  const w = worker(() => { throw new Error('NetworkError'); });
  w.send(LOAD);
  w.send({ index: 2 });
  w.send({ index: 3 });
  assert.deepEqual(await w.answers(2), [{ index: 2, unloaded: true }, { index: 3, unloaded: true }]);
  const broken = worker((url) => realCore(broken)(url));
  broken.send({ ...LOAD, lame: new Uint8Array([0, 97, 115, 109]) });
  broken.send({ index: 4 });
  assert.deepEqual(await broken.answers(1), [{ index: 4, unloaded: true }]);
});

// --- audioOnly: the audio track of an MP4 or MOV ---

// Reads from a Buffer the way audio.js reads from a File, noting each read.
function reader(buf, reads = []){
  return (from, to) => { reads.push(to - from); return Promise.resolve(new Uint8Array(buf.subarray(from, to))); };
}

function boxesOf(buf, from = 0, to = buf.length){
  const out = [];
  while (from + 8 <= to) {
    let size = buf.readUInt32BE(from), head = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(from + 8)); head = 16; } else if (size === 0) size = to - from;
    out.push({ type: buf.toString('latin1', from + 4, from + 8), body: from + head, end: from + size });
    from += size;
  }
  return out;
}
const child = (buf, box, type) => boxesOf(buf, box.body, box.end).find((c) => c.type === type);

// The audio track's samples, found through its own index: { traks, samples }.
function audioSamples(buf){
  const moov = boxesOf(buf).find((b) => b.type === 'moov');
  const traks = boxesOf(buf, moov.body, moov.end).filter((b) => b.type === 'trak');
  const trak = traks.find((t) => { const h = child(buf, child(buf, t, 'mdia'), 'hdlr'); return buf.toString('latin1', h.body + 8, h.body + 12) === 'soun'; });
  const stbl = ['mdia', 'minf', 'stbl'].reduce((b, type) => child(buf, b, type), trak);
  const stsc = child(buf, stbl, 'stsc'), stsz = child(buf, stbl, 'stsz');
  const co64 = child(buf, stbl, 'co64'), stco = co64 || child(buf, stbl, 'stco');
  const fixed = buf.readUInt32BE(stsz.body + 4), runs = buf.readUInt32BE(stsc.body + 4);
  const samples = [];
  let n = 0;
  for (let c = 0; c < buf.readUInt32BE(stco.body + 4); c++) {
    let run = 0;
    for (let r = 0; r < runs; r++) if (buf.readUInt32BE(stsc.body + 8 + r * 12) - 1 <= c) run = r;
    let at = co64 ? Number(buf.readBigUInt64BE(stco.body + 8 + c * 8)) : buf.readUInt32BE(stco.body + 8 + c * 4);
    for (let k = 0; k < buf.readUInt32BE(stsc.body + 12 + run * 12); k++, n++) {
      const size = fixed || buf.readUInt32BE(stsz.body + 12 + n * 4);
      samples.push(buf.subarray(at, at + size));
      at += size;
    }
  }
  return { traks: traks.length, samples, co64: !!co64 };
}

const audioOf = (buf, reads) => A.audioOnly(reader(buf, reads), buf.length).then((out) => out && Buffer.from(out));

// Swaps every occurrence of one 4-letter box type for another.
const retype = (buf, from, to) => Buffer.from(buf.toString('latin1').split(from).join(to), 'latin1');

test('audioOnly: keeps just the audio of a video, reading only small pieces', async () => {
  const video = flacMp4(tone(1, 2), 44100, { video: 100000, perChunk: 3, moovFirst: true, co64: true });
  const reads = [];
  const out = await audioOf(video, reads);
  const before = audioSamples(video), after = audioSamples(out);
  assert.equal(before.traks, 2);
  assert.equal(before.samples.length, 11);
  assert.equal(after.traks, 1);
  assert.equal(after.co64, true);
  assert.deepEqual(after.samples, before.samples);
  assert.deepEqual(boxesOf(out).map((b) => b.type), ['ftyp', 'moov', 'mdat']);
  // The filler video isn't in the output, and no read went near it.
  assert.ok(out.length < 5000 + before.samples.reduce((n, s) => n + s.length, 0));
  // Three frames of verbatim FLAC are about 50 KB; the filler is 100 KB.
  assert.ok(Math.max(...reads) < 60000);
});

test('audioOnly: index at the end, 32-bit offsets', async () => {
  const file = flacMp4(tone(1, 2), 44100, { video: 5000 });
  const out = await audioOf(file);
  assert.deepEqual(boxesOf(out).map((b) => b.type), ['ftyp', 'moov', 'mdat']);
  assert.equal(audioSamples(out).co64, false);
  assert.deepEqual(audioSamples(out).samples, audioSamples(file).samples);
});

test('audioOnly: an audio-only MP4 comes out holding the same samples', async () => {
  const file = flacMp4(tone(0.5, 1));
  const out = await audioOf(file);
  assert.deepEqual(audioSamples(out).samples, audioSamples(file).samples);
});

test('audioOnly: samples all one size, and a 64-bit mdat header', async () => {
  // Three whole blocks make three frames of one size.
  const file = flacMp4(tone(3 * 4096 / 44100, 1));
  const sizes = audioSamples(file).samples.map((s) => s.length);
  assert.deepEqual([...new Set(sizes)].length, 1);
  // Record the one size in stsz, and leave the table (now ignored) as it is.
  const fixed = Buffer.from(file), stsz = file.indexOf('stsz') + 4;
  fixed.writeUInt32BE(sizes[0], stsz + 4);
  // ftyp, then mdat rewritten with a 64-bit size: 8 more bytes in front of
  // the audio, so the offsets move along by 8.
  const ftyp = boxesOf(fixed)[0], mdat = boxesOf(fixed)[1];
  const wide = Buffer.concat([
    fixed.subarray(0, ftyp.end),
    Buffer.from([0, 0, 0, 1]), Buffer.from('mdat'), Buffer.alloc(4), Buffer.from([0, 0, 0, 0]),
    fixed.subarray(mdat.body)
  ]);
  wide.writeUInt32BE(mdat.end - mdat.body + 16, ftyp.end + 12);
  const stco = wide.indexOf('stco') + 4;
  for (let i = 0; i < wide.readUInt32BE(stco + 4); i++) wide.writeUInt32BE(wide.readUInt32BE(stco + 8 + i * 4) + 8, stco + 8 + i * 4);
  const out = await audioOf(wide);
  assert.deepEqual(audioSamples(out).samples, audioSamples(file).samples);
});

test('audioOnly: an index that runs to the end of the file (size 0)', async () => {
  const file = Buffer.from(flacMp4(tone(0.5, 2)));
  const moov = boxesOf(file).find((b) => b.type === 'moov');
  file.writeUInt32BE(0, moov.body - 8);
  const out = await audioOf(file);
  assert.deepEqual(audioSamples(out).samples, audioSamples(flacMp4(tone(0.5, 2))).samples);
});

test('audioOnly: no ftyp box is fine', async () => {
  const file = flacMp4(tone(0.5, 2));
  const ftyp = boxesOf(file)[0];
  const bare = file.subarray(ftyp.end);
  // Offsets are from the start of the file, which is now ftyp.end earlier.
  const moved = Buffer.from(bare), stco = moved.indexOf('stco') + 4;
  for (let i = 0; i < moved.readUInt32BE(stco + 4); i++) moved.writeUInt32BE(moved.readUInt32BE(stco + 8 + i * 4) - ftyp.end, stco + 8 + i * 4);
  const out = await audioOf(moved);
  assert.deepEqual(boxesOf(out).map((b) => b.type), ['moov', 'mdat']);
  assert.deepEqual(audioSamples(out).samples, audioSamples(file).samples);
});

test('audioOnly: other formats, and MP4s it can’t take apart, are left to be read whole', async () => {
  assert.equal(await audioOf(wav(tone(0.1, 1))), null);
  assert.equal(await audioOf(Buffer.from('not really a video')), null);
  assert.equal(await audioOf(Buffer.alloc(0)), null);
  // A 64-bit size with no room for it.
  assert.equal(await audioOf(Buffer.from('\0\0\0\x01mdat\0\0\0\0', 'latin1')), null);
  const file = flacMp4(tone(0.5, 2));
  // No index, as in a fragmented MP4.
  assert.equal(await audioOf(file.subarray(0, boxesOf(file).find((b) => b.type === 'moov').body - 8)), null);
  // Parts of the index missing.
  assert.equal(await audioOf(retype(file, 'mvhd', 'free')), null);
  assert.equal(await audioOf(retype(file, 'stsc', 'free')), null);
  assert.equal(await audioOf(retype(file, 'stco', 'free')), null);
  // A table longer than its box.
  const long = Buffer.from(file);
  long.writeUInt32BE(1000, long.indexOf('stsz') + 12);
  assert.equal(await audioOf(long), null);
  // Audio that would be past the end of the file (cut short).
  const cut = Buffer.from(file), stco = cut.indexOf('stco') + 4;
  cut.writeUInt32BE(cut.length, stco + 12);
  assert.equal(await audioOf(cut), null);
});

test('audioOnly: an index too big to be real is left alone', async () => {
  const file = flacMp4(tone(0.1, 1));
  const moov = boxesOf(file).find((b) => b.type === 'moov');
  const reads = [];
  // Claims to be 100 MB, running past the file, so it isn't a box at all.
  const big = Buffer.from(file);
  big.writeUInt32BE(100 * 1024 * 1024, moov.body - 8);
  assert.equal(await audioOf(big, reads), null);
  // A real 65 MB index isn't read either.
  const huge = Buffer.concat([file.subarray(0, moov.body - 8), Buffer.alloc(8)]);
  huge.writeUInt32BE(65 * 1024 * 1024, moov.body - 8);
  huge.write('moov', moov.body - 4, 'latin1');
  const reader65 = (from, to) => Promise.resolve(new Uint8Array(huge.subarray(from, Math.min(to, huge.length))));
  assert.equal(await A.audioOnly(reader65, moov.body - 8 + 65 * 1024 * 1024), null);
});

test('audioOnly: a video with no sound says so', async () => {
  const file = retype(flacMp4(tone(0.5, 2)), 'soun', 'vide');
  await assert.rejects(audioOf(file), /no audio track/);
});

// --- stream: encoding as the audio is decoded ---

test('stream: WAV written in blocks matches the whole, with the header filled in at the end', () => {
  const l = sine(5000, 440), r = sine(5000, 660);
  const out = A.stream({ format: 'wav' });
  for (let at = 0; at < 5000; at += 1024) out.write([l.subarray(at, at + 1024), r.subarray(at, at + 1024)], 48000);
  const res = out.end();
  assert.equal(res.frames, 5000);
  assert.equal(res.rate, 48000);
  const whole = A.stream({ format: 'wav' });
  whole.write([l, r], 48000);
  assert.deepEqual(bytesOf(res.parts), bytesOf(whole.end().parts));
});

test('stream: MP3 written in odd-sized blocks matches the whole', () => {
  const l = sine(30000, 440), r = sine(30000, 550);
  const out = A.stream({ format: 'mp3', kbps: 128 }, lame);
  for (let at = 0; at < 30000; at += 1000) out.write([l.subarray(at, at + 1000), r.subarray(at, at + 1000)], 44100);
  assert.deepEqual(bytesOf(out.end().parts), mp3Of([l, r], 44100, 128));
});

test('stream: an edit list cut drops the start and caps the length, across blocks', () => {
  // Samples numbered 0..9999, so what's kept shows exactly which they were.
  const ramp = Float32Array.from({ length: 10000 }, (_, i) => i / 32767);
  const out = A.stream({ format: 'wav' }, null, { skip: 1500 / 1000, keep: 6000 / 1000 });
  for (let at = 0; at < 10000; at += 1000) out.write([ramp.subarray(at, at + 1000)], 1000);
  const res = out.end(), buf = bytesOf(res.parts);
  assert.equal(res.frames, 6000);
  assert.equal(buf.readInt16LE(44), 1500);
  assert.equal(buf.readInt16LE(buf.length - 2), 7499);
  // No cap on the length.
  const open = A.stream({ format: 'wav' }, null, { skip: 0.5, keep: Infinity });
  assert.equal(open.written(), 0);
  open.write([ramp.subarray(0, 1000)], 1000);
  assert.equal(open.written(), 500, 'after the edit list');
  open.write([ramp.subarray(1000)], 1000);
  assert.equal(open.written(), 9500);
  assert.equal(open.end().frames, 9500);
});

test('stream: nothing written still makes a valid, empty file', () => {
  const wav = A.stream({ format: 'wav' }).end();
  assert.equal(bytesOf(wav.parts).length, 44);
  assert.deepEqual([wav.frames, wav.rate], [0, 44100]);
  const mp3 = A.stream({ format: 'mp3', kbps: 128 }, lame).end();
  assert.equal(mp3.frames, 0);
});

test('stream: MP3 is the same in any blocks, more or less than LAME takes at once', () => {
  const sound = [sine(1152 * 12, 440), sine(1152 * 12, 660)];
  for (const block of [1000, 1152 * 4, 1152 * 5 + 7]) assert.deepEqual(mp3Of(sound, 44100, 192, block), mp3Of(sound, 44100, 192));
});

test('stream: take() hands over the MP3 made so far', () => {
  const sound = [sine(1152 * 20, 440)], whole = mp3Of(sound, 44100, 128);
  const out = A.stream({ format: 'mp3', kbps: 128 }, lame), taken = [];
  out.write([sound[0].subarray(0, 1152 * 10)], 44100);
  taken.push(...out.take());
  assert.ok(taken.length);
  assert.equal(out.take().length, 0);
  out.write([sound[0].subarray(1152 * 10)], 44100);
  assert.deepEqual(bytesOf(taken.concat(out.end().parts)), whole);
});

// --- mp4: what the decoder needs ---

const trackOf = (buf) => A.mp4(reader(buf), buf.length);

// A sound sample entry: QuickTime version 0, 1 or 2, holding these boxes.
function soundEntry(type, { version = 0, channels = 2, rate = 44100 } = {}, ...boxes){
  const extra = version === 1 ? Buffer.alloc(16) : version === 2 ? Buffer.concat([u32(72), Buffer.alloc(8), u32(channels), Buffer.alloc(20)]) : Buffer.alloc(0);
  return box(type, Buffer.alloc(6), u16(1), u16(version), Buffer.alloc(6), u16(version === 2 ? 3 : channels), u16(16), u16(0), u16(0), u32(rate * 65536), extra, ...boxes);
}

// A descriptor with its length in the four-byte form some muxers write.
const desc = (tag, ...parts) => {
  const body = Buffer.concat(parts), n = body.length;
  return Buffer.concat([u8(tag), Buffer.from([0x80 | (n >> 21) & 127, 0x80 | (n >> 14) & 127, 0x80 | (n >> 7) & 127, n & 127]), body]);
};
// esds for codec `type`, with DecoderSpecificInfo `info` (if any) and ES
// flags that add optional fields.
function esds(type, info, flags = 0){
  const optional = Buffer.concat([
    flags & 128 ? u16(1) : Buffer.alloc(0),
    flags & 64 ? Buffer.from([3, 97, 98, 99]) : Buffer.alloc(0),
    flags & 32 ? u16(2) : Buffer.alloc(0)
  ]);
  const config = desc(4, u8(type), u8(0x15), Buffer.alloc(3), u32(0), u32(0), ...(info ? [desc(5, info)] : []));
  return full('esds', 0, 0, desc(3, u16(1), u8(flags), optional, config));
}

test('mp4: a FLAC track, with the pieces and times to feed the decoder', async () => {
  const file = flacMp4(tone(1, 2), 44100, { video: 3000, perChunk: 3 });
  const t = await trackOf(file);
  assert.equal(t.config.codec, 'flac');
  assert.equal(t.config.sampleRate, 44100);
  assert.equal(t.config.numberOfChannels, 2);
  const d = Buffer.from(t.config.description);
  assert.equal(d.toString('latin1', 0, 4), 'fLaC');
  assert.equal(d.length, 4 + 4 + 34, 'marker, block header, STREAMINFO');
  assert.equal(t.samples, 11);
  assert.deepEqual(plain(t.chunks.map((c) => c.sizes.length)), [3, 3, 3, 2]);
  // Every frame is 4096 samples long, the last one shorter.
  const times = plain(t.chunks.flatMap((c) => c.times));
  assert.deepEqual(times, Array.from({ length: 11 }, (_, i) => Math.round(i * 4096 * 1e6 / 44100)));
  // All of them last a second.
  assert.equal(t.seconds, 1);
  // The pieces are where the samples are.
  const pieces = [...t.chunks].flatMap((c) => { let at = c.from; return [...c.sizes].map((n) => file.subarray(at, (at += n))); });
  assert.deepEqual(pieces, audioSamples(file).samples);
  assert.equal(t.cut, null);
});

test('mp4: AAC config from esds, in MP4 and QuickTime layouts', async () => {
  const asc = Buffer.from([0x12, 0x10]); // AAC LC, 44.1 kHz, stereo
  const cases = [
    [soundEntry('mp4a', {}, esds(0x40, asc)), 'mp4a.40.2', 2],
    // QuickTime version 1 keeps esds inside a wave box.
    [soundEntry('mp4a', { version: 1, channels: 1 }, box('wave', box('frma', Buffer.from('mp4a')), esds(0x40, asc))), 'mp4a.40.2', 1],
    // Version 2 has the channel count further on; optional ES fields.
    [soundEntry('mp4a', { version: 2, channels: 6 }, esds(0x67, Buffer.from([0x2b, 0x10]), 0xe0)), 'mp4a.40.5', 6],
    // Audio object type 31 means the real one follows: 32 + 10 = 42.
    [soundEntry('mp4a', {}, esds(0x40, Buffer.from([0xf9, 0x40, 0]))), 'mp4a.40.42', 2]
  ];
  for (const [entry, codec, channels] of cases) {
    const t = await trackOf(flacMp4(tone(0.2, 1), 44100, { entry }));
    assert.equal(t.config.codec, codec);
    assert.equal(t.config.numberOfChannels, channels);
    assert.ok(Buffer.from(t.config.description).length >= 2);
  }
});

test('mp4: MP3 in an MP4', async () => {
  for (const entry of [soundEntry('mp4a', {}, esds(0x6b)), soundEntry('mp4a', {}, esds(0x69)), soundEntry('.mp3')]) {
    const t = await trackOf(flacMp4(tone(0.2, 1), 44100, { entry }));
    assert.equal(t.config.codec, 'mp3');
    assert.equal(t.config.description, undefined);
  }
});

test('mp4: codecs it doesn’t know, or can’t configure, get no config', async () => {
  const entries = [
    soundEntry('alac'),
    soundEntry('fLaC'),                                          // no dfLa
    soundEntry('mp4a'),                                          // no esds
    soundEntry('mp4a', {}, esds(0x40)),                          // AAC without its config
    soundEntry('mp4a', {}, esds(0xa5, Buffer.from([1, 2]))),     // AC-3
    soundEntry('mp4a', {}, full('esds', 0, 0, desc(4, u8(0x40)))), // no ES descriptor
    soundEntry('mp4a', {}, full('esds', 0, 0, desc(3, u16(1), u8(0), desc(6, u8(2))))), // no decoder config
    soundEntry('mp4a', {}, full('esds', 0, 0, Buffer.from([3, 50, 0, 1, 0])))  // a descriptor longer than the box
  ];
  for (const entry of entries) {
    const t = await trackOf(flacMp4(tone(0.2, 1), 44100, { entry }));
    assert.equal(t.config, null);
    // It can still be decoded whole.
    assert.ok((await t.audioOnly()).length > 0);
  }
  // No sample entry at all.
  const empty = retype(flacMp4(tone(0.2, 1)), 'stsd', 'free');
  assert.equal((await trackOf(empty)).config, null);
});

test('mp4: the edit list gives where the sound starts and how long it lasts', async () => {
  const elst = (version, ...entries) => box('edts', full('elst', version, 0, u32(entries.length), ...entries));
  const v0 = (duration, time) => Buffer.concat([u32(duration), u32(time), u32(0x10000)]);
  const v1 = (duration, time) => Buffer.concat([u32(0), u32(duration), time < 0 ? u32(-1) : u32(0), u32(time), u32(0x10000)]);
  const cut = async (edts) => plain((await trackOf(flacMp4(tone(0.2, 1), 44100, { edts }))).cut);
  // AAC's usual warm-up: 2112 samples in, then 0.1 s (movie time is in ms).
  assert.deepEqual(await cut(elst(0, v0(100, 2112))), { skip: 2112 / 44100, keep: 0.1 });
  assert.deepEqual(await cut(elst(1, v1(100, 2112))), { skip: 2112 / 44100, keep: 0.1 });
  // An empty edit (a pause) first is passed over.
  assert.deepEqual(await cut(elst(0, v0(50, 0xffffffff), v0(100, 0))), { skip: 0, keep: 0.1 });
  assert.deepEqual(await cut(elst(1, v1(50, -1), v1(100, 0))), { skip: 0, keep: 0.1 });
  // No duration means to the end.
  assert.equal((await cut(elst(0, v0(0, 0)))).keep, null, 'Infinity, as JSON has it');
  // Nothing but empty edits.
  assert.equal(await cut(elst(0, v0(50, 0xffffffff))), null);
});

test('mp4: missing timing tables are left to be read whole', async () => {
  const file = flacMp4(tone(0.2, 1));
  assert.equal(await trackOf(retype(file, 'stts', 'free')), null);
  assert.equal(await trackOf(retype(file, 'mdhd', 'free')), null);
});

test('mp4: a track header with 64-bit times', async () => {
  const t = await trackOf(flacMp4(tone(0.5, 1), 44100, { longTimes: true }));
  assert.equal(t.config.sampleRate, 44100);
  assert.equal(t.chunks[1].times[0], Math.round(4096 * 1e6 / 44100));
});
