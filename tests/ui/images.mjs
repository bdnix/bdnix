// Builds the images the image compressor's UI tests upload, and reads back
// the files it produces. Everything is made in code, so no binary fixtures
// are committed.
import zlib from 'node:zlib';

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf){
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// An RGBA PNG. pixel(x, y) returns [r, g, b, a].
export function png(width, height, pixel){
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0, at = 0; y < height; y++) {
    raw[at++] = 0;                                        // no filter
    for (let x = 0; x < width; x++) for (const v of pixel(x, y)) raw[at++] = v;
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 6, 0, 0, 0], 8);                           // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

// Like a photo: smooth colour with fine grain, which PNG stores poorly and
// JPEG and WebP well. The left half is reddish and the right half bluish,
// so the tests can tell the image kept its shape and its colours.
export function photo(width, height){
  let seed = 1;
  const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >> 16) % 24; };
  return png(width, height, (x, y) => {
    const g = Math.round(90 + 60 * y / height) + noise();
    return x < width / 2 ? [200 + noise(), g, 40 + noise(), 255] : [40 + noise(), g, 200 + noise(), 255];
  });
}

// A 1 x 1 GIF of one colour: canvases can't save GIFs, so it's written
// by hand. Its one pixel is colour 0 of a two-colour palette.
export function gif([r, g, b]){
  return Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0,  // GIF89a, 1 x 1, 2 colours
    r, g, b, 0, 0, 0,
    0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0,                               // the image
    2, 2, 0x44, 0x01, 0, 0x3b                                      // LZW: clear, 0, end
  ]);
}

// Which format a file is, from its first bytes.
export function kind(bytes){
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return 'unknown';
}

// Decodes an image in the page: its size and the colour at each [x, y]
// given as a fraction of the width and height.
export function inspect(page, bytes, points = []){
  return page.evaluate(async ({ b64, points }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes]));
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const colours = points.map(([fx, fy]) => Array.from(ctx.getImageData(Math.floor(fx * bmp.width), Math.floor(fy * bmp.height), 1, 1).data));
    return { width: bmp.width, height: bmp.height, colours };
  }, { b64: Buffer.from(bytes).toString('base64'), points });
}

// Whether colour a is within `by` of colour b in every channel.
export const near = (a, b, by = 40) => a.every((v, i) => Math.abs(v - b[i]) <= by);
