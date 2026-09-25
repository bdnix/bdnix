import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const { bdnixAudio: A, lamejs } = load(['assets/vendor/lame.min.js', 'assets/js/audio-core.js']);

// A sine tone as float samples, the way the browser hands decoded audio over.
const sine = (n, hz, rate = 44100, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate));
const bytesOf = (parts) => Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)));
const run = (job, size = 1152 * 4) => { let steps = 0; while (!job.done) { job.step(size); steps++; } return steps; };

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

test('encoder: WAV has the right header and samples', () => {
  const l = Float32Array.from([0, 0.5, -0.5]), r = Float32Array.from([1, -1, 0]);
  const job = A.encoder([l, r], 48000, { format: 'wav' });
  assert.equal(run(job), 1);
  assert.equal(job.progress, 1);
  const buf = bytesOf(job.parts);
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

test('encoder: WAV in pieces, with progress along the way', () => {
  const n = 1152 * 10 + 5, job = A.encoder([sine(n, 440)], 44100, { format: 'wav' });
  const seen = [];
  while (!job.done) seen.push(job.step(1152 * 3));
  assert.deepEqual(seen, [1152 * 3 / n, 1152 * 6 / n, 1152 * 9 / n, 1]);
  assert.equal(bytesOf(job.parts).length, 44 + n * 2);
});

test('encoder: step sizes round down to whole MP3 frames, at least one', () => {
  const job = A.encoder([sine(1152 * 4, 440)], 44100, { format: 'wav' });
  assert.equal(job.step(1152 * 2 + 700), 0.5);
  assert.equal(job.step(1), 0.75);
});

test('encoder: no audio still makes a valid, empty file', () => {
  const wav = A.encoder([new Float32Array(0)], 44100, { format: 'wav' });
  assert.equal(wav.done, true);
  assert.equal(wav.progress, 1);
  assert.equal(bytesOf(wav.parts).length, 44);
  const mp3 = A.encoder([new Float32Array(0), new Float32Array(0)], 44100, { format: 'mp3', kbps: 128 }, lamejs);
  assert.equal(mp3.done, true);
});

test('encoder: MP3 frames carry the chosen bitrate and channel count', () => {
  const second = 44100;
  // Like the lame command line, lamejs lowers the sample rate for stereo at
  // lower bitrates (96 kbps is 32 kHz; 64 kbps drops to MPEG-2, which this
  // test doesn't read).
  for (const [kbps, rate] of [[96, 32000], [128, 44100], [192, 44100], [320, 44100]]) {
    const job = A.encoder([sine(second, 440), sine(second, 660)], 44100, { format: 'mp3', kbps }, lamejs);
    run(job);
    const f = frames(bytesOf(job.parts));
    // One second is rate / 1152 frames, plus the encoder's padding.
    const expected = rate / 1152;
    assert.ok(f.length >= expected && f.length <= expected + 4, `${kbps} kbps: ${f.length} frames`);
    assert.ok(f.every((x) => x.kbps === kbps && x.rate === rate && !x.mono), `${kbps} kbps frames`);
  }
  const mono = A.encoder([sine(second, 440)], 44100, { format: 'mp3', kbps: 64 }, lamejs);
  run(mono);
  const f = frames(bytesOf(mono.parts));
  assert.ok(f.length >= 38 && f.every((x) => x.kbps === 64 && x.rate === 44100 && x.mono));
});

test('encoder: MP3 output is the same however it is split up', () => {
  const make = () => A.encoder([sine(30000, 440), sine(30000, 550)], 44100, { format: 'mp3', kbps: 128 }, lamejs);
  const a = make(), b = make();
  assert.equal(run(a, 1152), 27);
  assert.equal(run(b, 1152 * 100), 1);
  assert.deepEqual(bytesOf(a.parts), bytesOf(b.parts));
});
