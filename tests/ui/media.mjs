// Builds the video and audio files the audio converter's UI tests upload,
// and reads back the MP3 and WAV files it produces. Everything is made in
// code, so no binary fixtures are committed.
//
// The MP4 carries FLAC audio: most real MP4s use AAC, but the open-source
// Chromium that Playwright runs can't decode AAC, and FLAC is simple enough
// to write by hand. The page decodes both the same way.

// One second of a sine tone per channel (440 Hz left, 660 Hz right).
export const RATE = 44100;
export const TONES = [440, 660];

export function tone(seconds, channels, rate = RATE){
  const n = Math.round(seconds * rate), out = [];
  for (let c = 0; c < channels; c++) {
    const s = new Int16Array(n);
    for (let i = 0; i < n; i++) s[i] = Math.round(12000 * Math.sin(2 * Math.PI * TONES[c] * i / rate));
    out.push(s);
  }
  return out;
}

// --- MP4 with FLAC audio ---

const u8 = (n) => Buffer.from([n & 255]);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u24 = (n) => Buffer.from([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(8 + body.length), Buffer.from(type, 'latin1'), body]);
};
const full = (type, version, flags, ...parts) => box(type, u8(version), u24(flags), ...parts);

function crc8(bytes){
  let c = 0;
  for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255; }
  return c;
}
function crc16(bytes){
  let c = 0;
  for (const b of bytes) { c ^= b << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x8005) & 0xffff : (c << 1) & 0xffff; }
  return c;
}

const BLOCK = 4096;

// FLAC frames with uncompressed ("verbatim") 16-bit subframes.
function flacFrames(channels, rate){
  const total = channels[0].length, frames = [];
  for (let start = 0, n = 0; start < total; start += BLOCK, n++) {
    const size = Math.min(BLOCK, total - start);
    const head = Buffer.concat([
      Buffer.from([0xff, 0xf8]),
      u8(0x70 | (rate === 44100 ? 0x9 : 0x0)),          // block size in the header's tail; 44.1 kHz
      u8(((channels.length - 1) << 4) | 0x08),           // independent channels, 16-bit
      u8(n),                                             // frame number (under 128)
      u16(size - 1)
    ]);
    const parts = [head, u8(crc8(head))];
    for (const ch of channels) {
      const s = Buffer.alloc(1 + size * 2);
      s[0] = 0x02;                                       // verbatim subframe
      for (let i = 0; i < size; i++) s.writeInt16BE(ch[start + i], 1 + i * 2);
      parts.push(s);
    }
    const frame = Buffer.concat(parts);
    frames.push(Buffer.concat([frame, u16(crc16(frame))]));
  }
  return frames;
}

function streamInfo(channels, rate){
  const total = channels[0].length, b = Buffer.alloc(34);
  b.writeUInt16BE(BLOCK, 0); b.writeUInt16BE(BLOCK, 2);
  // Bytes 10-17: sample rate (20 bits), channels - 1 (3), bits - 1 (5), total samples (36).
  const hi = rate * 2 ** 12 + (channels.length - 1) * 2 ** 9 + 15 * 2 ** 4 + Math.floor(total / 2 ** 32);
  b.writeUInt32BE(hi, 10); b.writeUInt32BE(total >>> 0, 14);
  return b;
}

// An .mp4 holding one FLAC audio track.
export function flacMp4(channels, rate = RATE){
  const frames = flacFrames(channels, rate), total = channels[0].length;
  const ftyp = box('ftyp', Buffer.from('isom'), u32(512), Buffer.from('isomiso2mp41'));
  const mdat = box('mdat', ...frames);
  const last = total - (frames.length - 1) * BLOCK;
  const stts = last === BLOCK ? [u32(1), u32(frames.length), u32(BLOCK)]
    : [u32(2), u32(frames.length - 1), u32(BLOCK), u32(1), u32(last)];
  const entry = box('fLaC',
    Buffer.alloc(6), u16(1), Buffer.alloc(8), u16(channels.length), u16(16), u16(0), u16(0), u32(rate * 65536),
    full('dfLa', 0, 0, u8(0x80), u24(34), streamInfo(channels, rate)));
  const stbl = box('stbl',
    full('stsd', 0, 0, u32(1), entry),
    full('stts', 0, 0, ...stts),
    full('stsc', 0, 0, u32(1), u32(1), u32(frames.length), u32(1)),
    full('stsz', 0, 0, u32(0), u32(frames.length), ...frames.map((f) => u32(f.length))),
    full('stco', 0, 0, u32(1), u32(ftyp.length + 8)));
  const matrix = Buffer.concat([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]);
  const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(rate), u32(total), u16(0x55c4), u16(0));
  const hdlr = full('hdlr', 0, 0, u32(0), Buffer.from('soun'), Buffer.alloc(12), Buffer.from('Sound\0'));
  const minf = box('minf', full('smhd', 0, 0, u32(0)),
    box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
  const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(Math.round(total * 1000 / rate)),
    Buffer.alloc(8), u16(0), u16(0), u16(0x0100), u16(0), matrix, u32(0), u32(0));
  const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(Math.round(total * 1000 / rate)),
    u32(0x10000), u16(0x0100), Buffer.alloc(10), matrix, Buffer.alloc(24), u32(2));
  const moov = box('moov', mvhd, box('trak', tkhd, box('mdia', mdhd, hdlr, minf)));
  return Buffer.concat([ftyp, mdat, moov]);
}

// --- WAV ---

export function wav(channels, rate = RATE){
  const n = channels[0].length, c = channels.length, data = Buffer.alloc(n * c * 2);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) data.writeInt16LE(channels[k][i], (i * c + k) * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(c, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * c * 2, 28); h.writeUInt16LE(c * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Reads a 16-bit PCM WAV back: { channels, rate, frames }.
export function readWav(buf){
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  return { channels: buf.readUInt16LE(22), rate: buf.readUInt32LE(24), bits: buf.readUInt16LE(34), frames: buf.readUInt32LE(40) / (buf.readUInt16LE(22) * 2) };
}

// --- MP3 ---

const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];

// The first MPEG-1 Layer III frame header: { kbps, rate, mono }.
export function mp3Header(buf){
  for (let i = 0; i + 4 <= buf.length; i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xfe) === 0xfa) {
      return { kbps: KBPS[buf[i + 2] >> 4], rate: RATES[(buf[i + 2] >> 2) & 3], mono: (buf[i + 3] >> 6) === 3 };
    }
  }
  throw new Error('no MP3 frame found');
}

// Decodes an audio file in the page and returns its length in seconds and,
// per channel, its pitch in Hz, rounded to the nearest 10. The pitch is
// counted from zero crossings over the middle half second, away from the
// quiet padding an MP3 encoder adds at each end.
export function analyse(page, buf){
  return page.evaluate(async (bytes) => {
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const audio = await ctx.decodeAudioData(new Uint8Array(bytes).buffer);
    const from = Math.round(audio.sampleRate * (audio.duration / 2 - 0.25)), to = from + audio.sampleRate / 2;
    const hz = [];
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      let crossings = 0;
      for (let i = from + 1; i < to; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) crossings++;
      hz.push(Math.round(crossings / 10) * 10);
    }
    return { seconds: audio.duration, hz };
  }, [...buf]);
}
