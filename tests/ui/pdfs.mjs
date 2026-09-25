// Builds the PDFs and images the UI tests upload, and reads back what the
// site produces. Uses the same vendored pdf-lib the site does.
import zlib from 'node:zlib';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const L = require('../../assets/vendor/pdf-lib.min.js');

export const upload = (name, buffer, mimeType = 'application/pdf') => ({ name, mimeType, buffer: Buffer.from(buffer) });

// A PDF whose page i is (base + i) points wide, so page order can be read back.
export async function numberedPdf(base, count){
  const doc = await L.PDFDocument.create();
  for (let i = 1; i <= count; i++) doc.addPage([base + i, 300]);
  return doc.save();
}

// Three pages with text: portrait, one with /Rotate 90, and a landscape page
// whose crop box doesn't start at the origin.
export async function samplePdf(){
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  const fill = (page, title) => {
    const { height } = page.getSize();
    page.drawText(title, { x: 40, y: height - 60, size: 22, font });
    for (let y = height - 100; y > 60; y -= 18) page.drawText('Lorem ipsum dolor sit amet.', { x: 40, y, size: 10, font });
  };
  fill(doc.addPage([595, 842]), 'Page one');
  const two = doc.addPage([595, 842]); fill(two, 'Page two'); two.setRotation(L.degrees(90));
  const three = doc.addPage([842, 595]); fill(three, 'Page three'); three.setCropBox(60, 40, 700, 480);
  return doc.save();
}

// Three pages for redacting: a name and an account number on page 1, the
// name again on page 2 (turned with /Rotate 90), and nothing secret on page 3.
// Also returns where "Jane Doe" sits on page 1, as fractions of the page
// from its top-left corner.
export async function secretPdf(){
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  const one = doc.addPage([595, 842]);
  one.drawText('Name: Jane Doe', { x: 40, y: 760, size: 14, font });
  one.drawText('Account: 12345678', { x: 40, y: 730, size: 14, font });
  one.drawText('Public line', { x: 40, y: 700, size: 14, font });
  const two = doc.addPage([595, 842]);
  two.drawText('Signed by Jane Doe', { x: 40, y: 760, size: 14, font });
  two.setRotation(L.degrees(90));
  doc.addPage([595, 842]).drawText('Nothing to hide here.', { x: 40, y: 760, size: 14, font });
  const x = 40 + font.widthOfTextAtSize('Name: ', 14), w = font.widthOfTextAtSize('Jane Doe', 14);
  const name = { x0: x / 595, x1: (x + w) / 595, y: (842 - 760 - 5) / 842 };
  return { bytes: await doc.save(), name };
}

// A 120x60 blue PNG with transparent edges, built by hand to avoid dependencies.
export function logoPng(){
  const W = 120, H = 60, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * (W * 4 + 1) + 1 + x * 4;
    raw[o] = 30; raw[o + 1] = 80; raw[o + 2] = 255; raw[o + 3] = x < 10 || x > W - 10 ? 0 : 255;
  }
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = ~0; for (const v of b) c = table[(c ^ v) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Clicks a download link and returns the file's name and parsed PDF.
export async function download(page, trigger){
  const [dl] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const bytes = fs.readFileSync(await dl.path());
  return { name: dl.suggestedFilename(), bytes, doc: await L.PDFDocument.load(bytes) };
}

export const widths = (doc) => doc.getPages().map((p) => Math.round(p.getWidth()));

// Each content stream of a page, decoded to text, in drawing order.
export function contentStreams(doc, index){
  const contents = doc.getPage(index).node.Contents();
  const refs = contents instanceof L.PDFArray ? contents.asArray() : [contents];
  return refs.map((ref) => {
    const stream = doc.context.lookup(ref);
    const bytes = stream instanceof L.PDFRawStream ? L.decodePDFRawStream(stream).decode() : stream.getContents();
    return Buffer.from(bytes).toString('latin1');
  });
}

// pdf-lib writes standard-font text as hex, e.g. <434F4E46...> Tj.
export const hexText = (text) => '<' + Buffer.from(text, 'latin1').toString('hex').toUpperCase() + '>';

export function baseFonts(doc){
  const out = new Set();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof L.PDFDict) {
      const name = obj.get(L.PDFName.of('BaseFont'));
      if (name) out.add(name.toString().slice(1));
    }
  }
  return [...out];
}

export function imageCount(doc){
  let n = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj.dict && String(obj.dict.get(L.PDFName.of('Subtype'))) === '/Image') n++;
  }
  return n;
}
