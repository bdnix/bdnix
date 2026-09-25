import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
import { flacMp4, wav, tone } from '../ui/media.mjs';

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
