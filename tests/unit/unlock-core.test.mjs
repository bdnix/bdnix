import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { load } from './load.mjs';
import { L, lockedPdf, samplePdf, contentStreams } from '../ui/pdfs.mjs';

const FILE = 'assets/js/unlock-core.js';
const { bdnixUnlock: U } = load(FILE);
const hex = (bytes) => Buffer.from(bytes).toString('hex');
// Fixed bytes of any length, so the tests don't depend on randomness.
const bytes = (n, seed = 1) => Uint8Array.from({ length: n }, (_, i) => (i * 131 + seed * 17 + (i >> 3)) & 255);

// pdf-lib warns about each object stream it can't read while the file is
// still encrypted; that's expected here.
const quiet = async (fn) => {
  const warn = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = warn; }
};

test('md5 and the SHA-2 hashes match node:crypto, across block boundaries', () => {
  for (const n of [0, 1, 3, 55, 56, 57, 63, 64, 65, 111, 112, 113, 127, 128, 129, 1000]) {
    const data = bytes(n, n);
    for (const h of ['md5', 'sha256', 'sha384', 'sha512']) {
      assert.equal(hex(U[h](data)), crypto.createHash(h).update(data).digest('hex'), `${h} of ${n} bytes`);
    }
  }
  assert.equal(hex(U.md5(new TextEncoder().encode('abc'))), '900150983cd24fb0d6963f7d28e17f72');
});

test('rc4 matches the published test vector and undoes itself', () => {
  const key = new TextEncoder().encode('Key'), text = new TextEncoder().encode('Plaintext');
  const sealed = U.rc4(key, text);
  assert.equal(hex(sealed), 'bbf316e8d940af0ad3');
  assert.deepEqual([...U.rc4(key, sealed)], [...text]);
});

test('AES-CBC (128 and 256 bit) matches node:crypto both ways', () => {
  for (const size of [16, 32]) {
    const key = bytes(size, size), iv = bytes(16, 99), data = bytes(80, 7);
    const c = crypto.createCipheriv(`aes-${size * 8}-cbc`, key, iv);
    c.setAutoPadding(false);
    const want = Buffer.concat([c.update(data), c.final()]);
    assert.equal(hex(U.aesEncrypt(key, iv, data)), hex(want));
    assert.equal(hex(U.aesDecrypt(key, iv, want)), hex(data));
  }
  // FIPS-197 appendix C.1: one block, AES-128.
  const key = Uint8Array.from(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'));
  const block = Uint8Array.from(Buffer.from('00112233445566778899aabbccddeeff', 'hex'));
  assert.equal(hex(U.aesEncrypt(key, new Uint8Array(16), block)), '69c4e0d86a7b0430d8cdb78070b4c55a');
  // A partial block at the end is left out.
  assert.equal(U.aesDecrypt(key, new Uint8Array(16), bytes(20)).length, 16);
});

test('decrypt: AES strings shorter than the IV and a block are empty, padding is stripped', () => {
  const key = bytes(32, 3);
  assert.equal(U.decrypt('AESV3', key, 1, 0, bytes(16)).length, 0);
  const iv = bytes(16, 4);
  const c = crypto.createCipheriv('aes-256-cbc', key, iv);
  const sealed = Buffer.concat([iv, c.update('hello'), c.final()]);
  assert.equal(Buffer.from(U.decrypt('AESV3', key, 1, 0, sealed)).toString(), 'hello');
  // Not padding after all: left as it is.
  const raw = bytes(32, 5);
  raw[31] = 200;
  const c2 = crypto.createCipheriv('aes-256-cbc', key, iv);
  c2.setAutoPadding(false);
  const odd = Buffer.concat([iv, c2.update(raw), c2.final()]);
  assert.equal(hex(U.decrypt('AESV3', key, 1, 0, odd)), hex(raw));
  const ends = (last) => { const b = bytes(32, 6); b[31] = last; b[30] = 9; return b; };
  for (const last of [0, 2]) {   // 0 isn't padding; 2 needs the byte before it to be 2 too
    const c3 = crypto.createCipheriv('aes-256-cbc', key, iv);
    c3.setAutoPadding(false);
    assert.equal(U.decrypt('AESV3', key, 1, 0, Buffer.concat([iv, c3.update(ends(last)), c3.final()])).length, 32);
  }
  assert.equal(hex(U.decrypt('Identity', key, 1, 0, raw)), hex(raw));
});

const CIPHERS = ['rc4-40', 'rc4-128', 'aes-128', 'aes-256'];
const sample = await (await L.PDFDocument.load(await samplePdf())).save();
const original = await L.PDFDocument.load(sample);

// Opens a locked file, unlocks it, and reads the result back with pdf-lib.
async function roundTrip(locked, password){
  return quiet(async () => {
    const file = await U.open(L, locked);
    const result = await U.unlock(file, password);
    if (!result) return { file, result };
    const out = await new L.PDFDocument(file.context, false, false).save();
    return { file, result, doc: await L.PDFDocument.load(out) };
  });
}

function sameContent(doc){
  assert.equal(doc.getPageCount(), 3);
  for (let i = 0; i < 3; i++) assert.deepEqual(contentStreams(doc, i), contentStreams(original, i));
}

for (const cipher of CIPHERS) {
  for (const objectStreams of [false, true]) {
    test(`${cipher}${objectStreams ? ', object streams' : ''}: the user password unlocks it`, async () => {
      const doc = await L.PDFDocument.load(sample);
      doc.setTitle('Quarterly figures – draft');
      const locked = await lockedPdf(await doc.save(), { user: 'open sesame', owner: 'boss', cipher, objectStreams });
      await assert.rejects(L.PDFDocument.load(locked), /encrypted/i);

      const file = await quiet(() => U.open(L, locked));
      assert.equal(file.encrypted, true);
      assert.equal(file.needsPassword, true);
      assert.equal(U.describe(file.enc), { 'rc4-40': 'RC4 40-bit', 'rc4-128': 'RC4 128-bit', 'aes-128': 'AES 128-bit', 'aes-256': 'AES 256-bit' }[cipher]);

      const out = await roundTrip(locked, 'open sesame');
      assert.deepEqual({ ...out.result }, { owner: false });
      assert.equal(out.file.encrypted, false);
      assert.equal(out.doc.context.trailerInfo.Encrypt, undefined);
      sameContent(out.doc);
      assert.equal(out.doc.getTitle(), 'Quarterly figures – draft');
    });
  }

  test(`${cipher}: the owner password unlocks it too, a wrong one doesn't`, async () => {
    const locked = await lockedPdf(sample, { user: 'open sesame', owner: 'boss', cipher });
    const wrong = await roundTrip(locked, 'Open sesame');
    assert.equal(wrong.result, null);
    // Nothing was changed by the wrong guess, so the right one still works.
    const file = wrong.file;
    assert.equal(file.encrypted, true);
    assert.deepEqual({ ...(await U.unlock(file, 'boss')) }, { owner: true });
    sameContent(await L.PDFDocument.load(await new L.PDFDocument(file.context, false, false).save()));
  });

  test(`${cipher}: a file that opens without a password needs its owner password`, async () => {
    const locked = await lockedPdf(sample, { user: '', owner: 'boss', cipher });
    const file = await U.open(L, locked);
    assert.equal(file.encrypted, true);
    assert.equal(file.needsPassword, false);
    assert.deepEqual({ ...(await U.authenticate(file.enc, 'boss')) }.owner, true);
    assert.equal((await roundTrip(locked, 'boss')).result.owner, true);
  });
}

test('passwords outside Latin-1 and the 32-byte limit', async () => {
  // Revisions 2-4 use the first 32 bytes; revision 6 takes UTF-8.
  const long = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const old = await lockedPdf(sample, { user: long, cipher: 'rc4-128' });
  assert.equal((await roundTrip(old, long.slice(0, 32) + 'whatever')).result.owner, false);
  const aes = await lockedPdf(sample, { user: 'пароль ✓', owner: 'x', cipher: 'aes-256' });
  assert.equal((await roundTrip(aes, 'пароль ✓')).result.owner, false);
  assert.equal((await roundTrip(aes, 'пароль')).result, null);
  assert.equal((await roundTrip(old, 'пароль')).result, null);
});

test('metadata left unencrypted stays readable', async () => {
  const doc = await L.PDFDocument.load(sample);
  const xml = '<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta><?xpacket end="w"?>';
  const meta = doc.context.stream(xml, { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(L.PDFName.of('Metadata'), doc.context.register(meta));
  const plain = await doc.save({ useObjectStreams: false });
  for (const cipher of ['aes-128', 'aes-256']) {
    const locked = await lockedPdf(plain, { user: 'pw', cipher, encryptMetadata: false });
    assert.ok(Buffer.from(locked).includes(xml), 'the metadata is in the clear');
    const out = await roundTrip(locked, 'pw');
    const stream = out.doc.context.lookup(out.doc.catalog.get(L.PDFName.of('Metadata')));
    assert.equal(Buffer.from(stream.contents).toString(), xml);
    sameContent(out.doc);
  }
});

test('open: a file without encryption, and encryption it can\'t remove', async () => {
  const plain = await U.open(L, sample);
  assert.equal(plain.encrypted, false);
  assert.equal(plain.enc, null);
  assert.equal(plain.needsPassword, false);

  // Swaps one value in the encryption dictionary of a locked file.
  const tamper = async (change) => {
    const file = await U.open(L, await lockedPdf(sample, { user: 'pw', cipher: 'aes-128' }));
    const dict = file.context.lookup(file.context.trailerInfo.Encrypt);
    change(dict, file.context);
    const out = await new L.PDFDocument(file.context, true, false).save({ useObjectStreams: false });
    return U.open(L, out);
  };
  const set = (k, v) => (d) => d.set(L.PDFName.of(k), v);
  const cf = (k, v) => (d) => d.lookup(L.PDFName.of('CF')).lookup(L.PDFName.of('StdCF')).set(L.PDFName.of(k), v);
  for (const change of [
    set('Filter', L.PDFName.of('Adobe.PubSec')),
    set('V', L.PDFNumber.of(3)),
    set('R', L.PDFNumber.of(7)),
    (d) => { set('V', L.PDFNumber.of(2))(d); set('Length', L.PDFNumber.of(44))(d); },
    set('O', L.PDFHexString.of('00')),
    cf('CFM', L.PDFName.of('Secret')),
    cf('Length', L.PDFNumber.of(3))
  ]) {
    await assert.rejects(tamper(change), (err) => err.unsupported === true && /can’t remove/.test(err.message));
  }
  // A crypt filter given in bytes rather than bits, and one that isn't there.
  assert.equal((await tamper(cf('Length', L.PDFNumber.of(128)))).enc.length, 128);
  assert.equal((await tamper(set('StrF', L.PDFName.of('Identity')))).enc.strings, 'Identity');
  assert.equal((await tamper(set('StrF', L.PDFName.of('Missing')))).enc.strings, 'Identity');
  assert.equal((await tamper(cf('CFM', L.PDFName.of('V2')))).enc.streams, 'RC4');
  // An encryption dictionary that isn't a dictionary.
  await assert.rejects(tamper((d, ctx) => { ctx.trailerInfo.Encrypt = L.PDFNumber.of(1); }), (err) => err.unsupported);
  await assert.rejects(U.open(L, Buffer.from('%PDF-1.7\n%%EOF\n')), /No PDF document/);
});

test('streams with their own crypt filter, embedded files and signatures', async () => {
  const doc = await L.PDFDocument.load(sample);
  const ctx = doc.context;
  const filters = (...names) => { const a = L.PDFArray.withContext(ctx); names.forEach((n) => a.push(L.PDFName.of(n))); return a; };
  const named = (cfName) => ctx.obj({ Name: L.PDFName.of(cfName) });
  // Left alone by the writer below: an Identity crypt filter in a filter list, ...
  const own = ctx.register(ctx.stream('kept as is', { Filter: filters('Crypt'), DecodeParms: named('Identity') }));
  const listed = ctx.register(ctx.stream('also as is', { Filter: filters('Crypt'), DecodeParms: (() => { const a = L.PDFArray.withContext(ctx); a.push(named('Identity')); return a; })() }));
  const single = ctx.register(ctx.stream('one filter', { Filter: L.PDFName.of('Crypt') }));
  const file = ctx.register(ctx.stream('attached file', { Type: 'EmbeddedFile' }));
  const sig = ctx.register(ctx.obj({ Type: 'Sig', Contents: L.PDFHexString.of('cafe'), Name: L.PDFString.of('Signer') }));
  ctx.trailerInfo.Info = ctx.register(ctx.obj({ Own: own, Listed: listed, Single: single, File: file, Sig: sig }));
  const locked = await lockedPdf(await doc.save({ useObjectStreams: false }), { user: 'pw', cipher: 'aes-256' });

  // The writer encrypts every stream; undo it for the ones meant to be in
  // the clear, as a real writer would have left them.
  const opened = await U.open(L, locked);
  const key = U.authenticate(opened.enc, 'pw').key;
  const info = opened.context.lookup(opened.context.trailerInfo.Info);
  for (const k of ['Own', 'Listed', 'Single']) {
    const ref = info.get(L.PDFName.of(k));
    const s = opened.context.lookup(ref);
    opened.context.assign(ref, L.PDFRawStream.of(s.dict, U.decrypt('AESV3', key, ref.objectNumber, 0, s.contents)));
  }
  const sigDict = opened.context.lookup(info.get(L.PDFName.of('Sig')));
  sigDict.set(L.PDFName.of('Contents'), L.PDFHexString.of('cafe'));
  assert.deepEqual({ ...(await U.unlock(opened, 'pw')) }, { owner: false });
  const out = await L.PDFDocument.load(await new L.PDFDocument(opened.context, false, false).save());
  const get = (k) => out.context.lookup(out.context.lookup(out.context.trailerInfo.Info).get(L.PDFName.of(k)));
  assert.equal(Buffer.from(get('Own').contents).toString(), 'kept as is');
  assert.equal(get('Own').dict.lookup(L.PDFName.of('Filter')).size(), 0);
  assert.equal(Buffer.from(get('Listed').contents).toString(), 'also as is');
  assert.equal(get('Listed').dict.lookup(L.PDFName.of('DecodeParms')).size(), 0);
  assert.equal(Buffer.from(get('Single').contents).toString(), 'one filter');
  assert.equal(get('Single').dict.get(L.PDFName.of('Filter')), undefined);
  assert.equal(Buffer.from(get('File').contents).toString(), 'attached file');
  assert.equal(get('Sig').get(L.PDFName.of('Contents')).asString(), 'cafe');
  assert.equal(get('Sig').get(L.PDFName.of('Name')).decodeText(), 'Signer');
});
