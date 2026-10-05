// Builds the PDFs and images the UI tests upload, and reads back what the
// site produces. Uses the same vendored pdf-lib the site does.
import zlib from 'node:zlib';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { inNewWindow } from './downloads.mjs';

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

// A ticket like a printed web page: real text on page 1, and page 2 a
// picture (the ticket itself) with only a real-text footer.
export async function picturePdf(){
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('Print Tickets', { x: 40, y: 760, size: 14, font });
  const two = doc.addPage([595, 842]);
  two.drawImage(await doc.embedPng(logoPng()), { x: 40, y: 400, width: 480, height: 240 });
  two.drawText('2/2', { x: 40, y: 30, size: 10, font });
  return doc.save();
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

// Clicks a download link and returns the file's name and parsed PDF. The
// file downloads in a new window (see downloads.mjs).
export async function download(page, trigger){
  const { download: dl } = await inNewWindow(page, trigger);
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

// Encrypts a PDF with the standard security handler, the way PDF writers do,
// so the unlock tool has something to open. Written independently of the
// site's own code (assets/js/unlock-core.js), with node:crypto doing the
// hashing and AES. cipher is 'rc4-40', 'rc4-128', 'aes-128' or 'aes-256'.
// With objectStreams, every object but the streams goes in one compressed
// object stream, found through a cross-reference stream.
export async function lockedPdf(bytes, { user = '', owner = 'owner', cipher = 'aes-256', objectStreams = false, encryptMetadata = true, permissions = -3904 } = {}){
  const doc = await L.PDFDocument.load(bytes, { updateMetadata: false });
  const context = doc.context;
  const id = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
  const pw = (s) => Buffer.from(s, cipher === 'aes-256' ? 'utf8' : 'latin1');
  const enc = new Map([
    ['Filter', L.PDFName.of('Standard')],
    ['P', L.PDFNumber.of(permissions)]
  ]);
  let key, method;

  if (cipher === 'aes-256') {
    method = 'AESV3';
    key = crypto.createHash('sha256').update('file key').digest();
    const vs = Buffer.from('uservsal'), ks = Buffer.from('userksal'), ovs = Buffer.from('ownervsa'), oks = Buffer.from('ownerksa');
    const U = Buffer.concat([hash6(pw(user), vs, Buffer.alloc(0)), vs, ks]);
    const O = Buffer.concat([hash6(pw(owner), ovs, U), ovs, oks]);
    enc.set('V', L.PDFNumber.of(5)).set('R', L.PDFNumber.of(6)).set('Length', L.PDFNumber.of(256))
      .set('O', hexOf(O)).set('U', hexOf(U))
      .set('OE', hexOf(aes('aes-256-cbc', hash6(pw(owner), oks, U), Buffer.alloc(16), key)))
      .set('UE', hexOf(aes('aes-256-cbc', hash6(pw(user), ks, Buffer.alloc(0)), Buffer.alloc(16), key)));
    // Perms repeats the permissions, sealed with the file key.
    const perms = Buffer.alloc(16, 0xff);
    perms.writeInt32LE(permissions, 0);
    perms.write(`${encryptMetadata ? 'T' : 'F'}adbperm`, 8, 'latin1');
    enc.set('Perms', hexOf(aes('aes-256-ecb', key, null, perms)));
  } else {
    const R = { 'rc4-40': 2, 'rc4-128': 3, 'aes-128': 4 }[cipher];
    const n = R === 2 ? 5 : 16;
    method = cipher === 'aes-128' ? 'AESV2' : 'RC4';
    let h = md5(pad(pw(owner)));
    if (R >= 3) for (let i = 0; i < 50; i++) h = md5(h);
    let O = rc4(h.subarray(0, n), pad(pw(user)));
    if (R >= 3) for (let i = 1; i <= 19; i++) O = rc4(h.subarray(0, n).map((b) => b ^ i), O);
    const p = Buffer.alloc(4); p.writeInt32LE(permissions);
    h = md5(Buffer.concat([pad(pw(user)), O, p, id, R >= 4 && !encryptMetadata ? Buffer.from([255, 255, 255, 255]) : Buffer.alloc(0)]));
    if (R >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
    key = h.subarray(0, n);
    let U;
    if (R === 2) U = rc4(key, PAD);
    else {
      U = rc4(key, md5(Buffer.concat([PAD, id])));
      for (let i = 1; i <= 19; i++) U = rc4(key.map((b) => b ^ i), U);
      U = Buffer.concat([U, Buffer.alloc(16, 7)]);
    }
    enc.set('V', L.PDFNumber.of(R === 2 ? 1 : R === 3 ? 2 : 4)).set('R', L.PDFNumber.of(R)).set('O', hexOf(O)).set('U', hexOf(U));
    if (R >= 3) enc.set('Length', L.PDFNumber.of(128));
  }
  if (cipher === 'aes-128' || cipher === 'aes-256') {
    const std = new Map([['CFM', L.PDFName.of(method)], ['Length', L.PDFNumber.of(cipher === 'aes-128' ? 16 : 32)], ['AuthEvent', L.PDFName.of('DocOpen')]]);
    enc.set('CF', dictOf(context, new Map([['StdCF', dictOf(context, std)]])))
      .set('StmF', L.PDFName.of('StdCF')).set('StrF', L.PDFName.of('StdCF'));
    if (!encryptMetadata) enc.set('EncryptMetadata', L.PDFBool.False);
  }

  // Each object's own key, then its strings and stream.
  const objKey = (ref) => {
    if (method === 'AESV3') return key;
    const salt = method === 'AESV2' ? Buffer.from('sAlT') : Buffer.alloc(0);
    const k = md5(Buffer.concat([key, Buffer.from([ref.objectNumber & 255, ref.objectNumber >> 8 & 255, ref.objectNumber >> 16 & 255, ref.generationNumber & 255, ref.generationNumber >> 8 & 255]), salt]));
    return k.subarray(0, Math.min(key.length + 5, 16));
  };
  const seal = (ref, data) => {
    const k = objKey(ref);
    if (method === 'RC4') return rc4(k, Buffer.from(data));
    const iv = md5(Buffer.concat([Buffer.from('iv'), Buffer.from(data)]));
    return Buffer.concat([iv, aes(k.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc', k, iv, Buffer.from(data), true)]);
  };
  const sealStrings = (ref, obj) => {
    if (obj instanceof L.PDFString || obj instanceof L.PDFHexString) return hexOf(seal(ref, obj.asBytes()));
    if (obj instanceof L.PDFArray) for (let i = 0; i < obj.size(); i++) obj.set(i, sealStrings(ref, obj.get(i)));
    if (obj instanceof L.PDFDict) for (const [k, v] of obj.entries()) obj.set(k, sealStrings(ref, v));
    return obj;
  };

  const objects = context.enumerateIndirectObjects();
  const streams = [], packed = [];
  for (const [ref, obj] of objects) {
    if (obj instanceof L.PDFStream) {
      const contents = obj instanceof L.PDFRawStream ? obj.contents : obj.getContents();
      const type = String(obj.dict.get(L.PDFName.of('Type')));
      sealStrings(ref, obj.dict);
      const plain = type === '/Metadata' && !encryptMetadata;
      const sealed = plain ? Buffer.from(contents) : seal(ref, contents);
      obj.dict.set(L.PDFName.of('Length'), L.PDFNumber.of(sealed.length));
      streams.push([ref, L.PDFRawStream.of(obj.dict, sealed)]);
    } else if (objectStreams) packed.push([ref, obj]);
    else streams.push([ref, sealStrings(ref, obj)]);
  }

  // Writes the file: every object, then the cross-reference table or stream.
  const encRef = context.nextRef();
  const out = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let size = out[0].length;
  const offsets = new Map();
  const write = (ref, obj) => {
    offsets.set(ref.objectNumber, size);
    const body = Buffer.alloc(obj.sizeInBytes());
    obj.copyBytesInto(body, 0);
    const chunk = Buffer.concat([Buffer.from(`${ref.objectNumber} ${ref.generationNumber} obj\n`), body, Buffer.from('\nendobj\n')]);
    out.push(chunk);
    size += chunk.length;
  };
  for (const [ref, obj] of streams) write(ref, obj);
  write(encRef, dictOf(context, enc));
  const trailer = new Map([['Root', context.trailerInfo.Root], ['Encrypt', encRef], ['ID', L.PDFArray.withContext(context)]]);
  if (context.trailerInfo.Info) trailer.set('Info', context.trailerInfo.Info);
  trailer.get('ID').push(hexOf(id)); trailer.get('ID').push(hexOf(id));

  if (!objectStreams) {
    const max = Math.max(...offsets.keys());
    let xref = `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= max; n++) xref += offsets.has(n) ? `${String(offsets.get(n)).padStart(10, '0')} 00000 n \n` : '0000000000 00000 f \n';
    trailer.set('Size', L.PDFNumber.of(max + 1));
    out.push(Buffer.from(`${xref}trailer\n${dictOf(context, trailer)}\nstartxref\n${size}\n%%EOF\n`));
    return Buffer.concat(out);
  }

  // The object stream: "num offset" pairs, then the objects themselves.
  const stmRef = context.nextRef(), xrefRef = context.nextRef();
  const parts = packed.map(([, obj]) => obj.toString() + '\n');
  let at = 0;
  const head = packed.map(([ref], i) => { const s = `${ref.objectNumber} ${at}`; at += Buffer.byteLength(parts[i], 'latin1'); return s; }).join(' ') + '\n';
  const raw = Buffer.from(head + parts.join(''), 'latin1');
  const stmDict = new Map([['Type', L.PDFName.of('ObjStm')], ['N', L.PDFNumber.of(packed.length)], ['First', L.PDFNumber.of(Buffer.byteLength(head))], ['Filter', L.PDFName.of('FlateDecode')]]);
  const sealed = seal(stmRef, zlib.deflateSync(raw));
  stmDict.set('Length', L.PDFNumber.of(sealed.length));
  write(stmRef, L.PDFRawStream.of(dictOf(context, stmDict), sealed));
  // Cross-reference stream entries: type (1 byte), field 2 (4), field 3 (2).
  const total = xrefRef.objectNumber + 1, rows = Buffer.alloc(total * 7);
  rows.writeUInt8(0, 0); rows.writeUInt16BE(65535, 5);
  for (const [n, off] of offsets) { rows.writeUInt8(1, n * 7); rows.writeUInt32BE(off, n * 7 + 1); }
  packed.forEach(([ref], i) => { rows.writeUInt8(2, ref.objectNumber * 7); rows.writeUInt32BE(stmRef.objectNumber, ref.objectNumber * 7 + 1); rows.writeUInt16BE(i, ref.objectNumber * 7 + 5); });
  rows.writeUInt8(1, xrefRef.objectNumber * 7); rows.writeUInt32BE(size, xrefRef.objectNumber * 7 + 1);
  const W = L.PDFArray.withContext(context);
  [1, 4, 2].forEach((w) => W.push(L.PDFNumber.of(w)));
  trailer.set('Type', L.PDFName.of('XRef')).set('Size', L.PDFNumber.of(total)).set('W', W).set('Length', L.PDFNumber.of(rows.length));
  const start = size;
  write(xrefRef, L.PDFRawStream.of(dictOf(context, trailer), rows));
  out.push(Buffer.from(`startxref\n${start}\n%%EOF\n`));
  return Buffer.concat(out);
}

const PAD = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex');
const pad = (pw) => Buffer.concat([pw.subarray(0, 32), PAD.subarray(0, Math.max(0, 32 - pw.length))]);
const md5 = (data) => crypto.createHash('md5').update(data).digest();
const hexOf = (bytes) => L.PDFHexString.of(Buffer.from(bytes).toString('hex'));
const dictOf = (context, map) => { const d = L.PDFDict.withContext(context); for (const [k, v] of map) d.set(L.PDFName.of(k), v); return d; };

function rc4(key, data){
  const s = [...Array(256).keys()];
  for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; [s[i], s[j]] = [s[j], s[i]]; }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255; j = (j + s[i]) & 255; [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

function aes(algorithm, key, iv, data, padding = false){
  const c = crypto.createCipheriv(algorithm, key, iv);
  c.setAutoPadding(padding);
  return Buffer.concat([c.update(data), c.final()]);
}

// The password hash of revision 6 (ISO 32000-2, algorithm 2.B).
function hash6(pw, salt, udata){
  let k = crypto.createHash('sha256').update(Buffer.concat([pw, salt, udata])).digest();
  for (let i = 0, e = null; i < 64 || e[e.length - 1] > i - 32; i++) {
    const k1 = Buffer.concat(Array(64).fill(Buffer.concat([pw, k, udata])));
    e = aes('aes-128-cbc', k.subarray(0, 16), k.subarray(16, 32), k1);
    let sum = 0;
    for (let j = 0; j < 16; j++) sum += e[j];
    k = crypto.createHash(['sha256', 'sha384', 'sha512'][sum % 3]).update(e).digest();
  }
  return k.subarray(0, 32);
}
