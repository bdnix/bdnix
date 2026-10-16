// Removing a PDF's password: the standard PDF security handler (RC4 and AES,
// 40 to 256 bit) and the hashes and ciphers it needs, written out here so
// the page needs nothing but pdf-lib. No DOM, so it can be unit tested
// (tests/unit/unlock-core.test.mjs). Bytes are Uint8Arrays throughout.
//
// open(lib, bytes) parses a file with pdf-lib (passed in as lib), and
// unlock(file, password) decrypts it in place if the password is right.
(function(){
  // ---- Hashes ----

  function concat(){
    var n = 0, i;
    for (i = 0; i < arguments.length; i++) n += arguments[i].length;
    var out = new Uint8Array(n), at = 0;
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], at); at += arguments[i].length; }
    return out;
  }

  var MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  var MD5_K = [];
  for (var k = 0; k < 64; k++) MD5_K[k] = Math.floor(Math.abs(Math.sin(k + 1)) * 4294967296) | 0;

  function md5(data){
    var n = data.length, padded = new Uint8Array(((n + 72) >> 6) << 6);
    padded.set(data);
    padded[n] = 0x80;
    var bits = n * 8, i, j;
    for (i = 0; i < 8; i++) padded[padded.length - 8 + i] = i < 4 ? (bits >>> (8 * i)) & 255 : Math.floor(n / 536870912) >>> (8 * (i - 4)) & 255;
    var h0 = 0x67452301, h1 = 0xefcdab89 | 0, h2 = 0x98badcfe | 0, h3 = 0x10325476, w = [];
    for (var off = 0; off < padded.length; off += 64) {
      for (j = 0; j < 16; j++) {
        var p = off + j * 4;
        w[j] = padded[p] | (padded[p + 1] << 8) | (padded[p + 2] << 16) | (padded[p + 3] << 24);
      }
      var a = h0, b = h1, c = h2, d = h3;
      for (i = 0; i < 64; i++) {
        var f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
        else { f = c ^ (b | ~d); g = (7 * i) & 15; }
        var t = d, s = MD5_S[(i >> 4) * 4 + (i & 3)], x = (a + f + MD5_K[i] + w[g]) | 0;
        d = c; c = b;
        b = (b + ((x << s) | (x >>> (32 - s)))) | 0;
        a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    }
    var out = new Uint8Array(16);
    [h0, h1, h2, h3].forEach(function(v, idx){
      for (var q = 0; q < 4; q++) out[idx * 4 + q] = (v >>> (8 * q)) & 255;
    });
    return out;
  }

  // Message padding for the SHA-2 family: big-endian length in the last
  // 8 bytes of a block of `block` bytes.
  function shaPad(data, block){
    var n = data.length, len = Math.ceil((n + 1 + block / 8) / block) * block;
    var padded = new Uint8Array(len);
    padded.set(data);
    padded[n] = 0x80;
    var bits = n * 8;
    for (var i = 0; i < 4; i++) padded[len - 1 - i] = (bits >>> (8 * i)) & 255;
    var high = Math.floor(n / 536870912);
    for (i = 0; i < 4; i++) padded[len - 5 - i] = (high >>> (8 * i)) & 255;
    return padded;
  }

  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function sha256(data){
    var padded = shaPad(data, 64), w = new Int32Array(64), i;
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    function ror(x, n){ return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < padded.length; off += 64) {
      for (i = 0; i < 16; i++) {
        var p = off + i * 4;
        w[i] = (padded[p] << 24) | (padded[p + 1] << 16) | (padded[p + 2] << 8) | padded[p + 3];
      }
      for (i = 16; i < 64; i++) {
        var s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var t1 = (hh + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
        var t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return words(h, 8);
  }

  // Big-endian bytes of the first n 32-bit words.
  function words(list, n){
    var out = new Uint8Array(n * 4);
    for (var i = 0; i < n; i++) {
      out[i * 4] = list[i] >>> 24; out[i * 4 + 1] = (list[i] >>> 16) & 255;
      out[i * 4 + 2] = (list[i] >>> 8) & 255; out[i * 4 + 3] = list[i] & 255;
    }
    return out;
  }

  // SHA-512 works on 64-bit words, kept here as pairs of 32-bit halves.
  var K512 = new Int32Array([
    0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
    0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
    0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
    0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
    0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
    0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
    0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
    0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
    0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
    0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
    0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
    0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
    0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
    0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
    0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
    0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
    0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
    0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
    0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
    0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a, 0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
  ]);
  var H512 = [
    0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1,
    0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179
  ];
  var H384 = [
    0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939,
    0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4
  ];

  // 64-bit sums are worked out as a low half (kept below 2^53, so exact)
  // and a high half that takes the carry.
  var TWO32 = 4294967296;
  function sha512core(data, init, outWords){
    var padded = shaPad(data, 128), w = new Int32Array(160), h = new Int32Array(init), i, lo;
    for (var off = 0; off < padded.length; off += 128) {
      for (i = 0; i < 32; i++) {
        var p = off + i * 4;
        w[i] = (padded[p] << 24) | (padded[p + 1] << 16) | (padded[p + 2] << 8) | padded[p + 3];
      }
      for (i = 32; i < 160; i += 2) {
        var xh = w[i - 30], xl = w[i - 29], yh = w[i - 4], yl = w[i - 3];
        // sigma0: rotate 1, rotate 8, shift 7; sigma1: rotate 19, rotate 61, shift 6.
        var s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
        var s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
        var s1h = ((yh >>> 19) | (yl << 13)) ^ ((yl >>> 29) | (yh << 3)) ^ (yh >>> 6);
        var s1l = ((yl >>> 19) | (yh << 13)) ^ ((yh >>> 29) | (yl << 3)) ^ ((yl >>> 6) | (yh << 26));
        lo = (s0l >>> 0) + (s1l >>> 0) + (w[i - 31] >>> 0) + (w[i - 13] >>> 0);
        w[i] = s0h + s1h + w[i - 32] + w[i - 14] + ((lo / TWO32) | 0);
        w[i + 1] = lo;
      }
      var ah = h[0], al = h[1], bh = h[2], bl = h[3], ch = h[4], cl = h[5], dh = h[6], dl = h[7];
      var eh = h[8], el = h[9], fh = h[10], fl = h[11], gh = h[12], gl = h[13], hh = h[14], hl = h[15];
      for (i = 0; i < 160; i += 2) {
        // Sigma1(e): rotate 14, 18, 41. Sigma0(a): rotate 28, 34, 39.
        var S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
        var S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
        var chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
        lo = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K512[i + 1] >>> 0) + (w[i + 1] >>> 0);
        var t1h = (hh + S1h + chh + K512[i] + w[i] + ((lo / TWO32) | 0)) | 0, t1l = lo | 0;
        var S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
        var S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
        var mjh = (ah & bh) ^ (ah & ch) ^ (bh & ch), mjl = (al & bl) ^ (al & cl) ^ (bl & cl);
        hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
        lo = (dl >>> 0) + (t1l >>> 0);
        eh = (dh + t1h + ((lo / TWO32) | 0)) | 0; el = lo | 0;
        dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
        lo = (t1l >>> 0) + (S0l >>> 0) + (mjl >>> 0);
        ah = (t1h + S0h + mjh + ((lo / TWO32) | 0)) | 0; al = lo | 0;
      }
      var v = [ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl];
      for (i = 0; i < 16; i += 2) {
        lo = (h[i + 1] >>> 0) + (v[i + 1] >>> 0);
        h[i] = h[i] + v[i] + ((lo / TWO32) | 0);
        h[i + 1] = lo;
      }
    }
    return words(h, outWords);
  }
  function sha512(data){ return sha512core(data, H512, 16); }
  function sha384(data){ return sha512core(data, H384, 12); }

  // ---- Ciphers ----

  // RC4 is its own inverse: the same call encrypts and decrypts.
  function rc4(key, data){
    var s = new Uint8Array(256), i, j = 0, t;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length]) & 255;
      t = s[i]; s[i] = s[j]; s[j] = t;
    }
    var out = new Uint8Array(data.length), x = 0, y = 0;
    for (var n = 0; n < data.length; n++) {
      x = (x + 1) & 255;
      y = (y + s[x]) & 255;
      t = s[x]; s[x] = s[y]; s[y] = t;
      out[n] = data[n] ^ s[(s[x] + s[y]) & 255];
    }
    return out;
  }

  // AES, with the usual lookup tables built once.
  var SBOX = new Uint8Array(256), INV = new Uint8Array(256);
  var TE = [new Int32Array(256), new Int32Array(256), new Int32Array(256), new Int32Array(256)];
  var TD = [new Int32Array(256), new Int32Array(256), new Int32Array(256), new Int32Array(256)];
  (function(){
    function mul(a, b){
      var p = 0;
      while (b) {
        if (b & 1) p ^= a;
        a = (a << 1) ^ (a & 0x80 ? 0x11b : 0);
        b >>= 1;
      }
      return p;
    }
    // The S-box: the multiplicative inverse in GF(2^8), then an affine map.
    for (var x = 0; x < 256; x++) {
      var inv = 0;
      for (var y = 1; x && y < 256; y++) if (mul(x, y) === 1) { inv = y; break; }
      var s = inv;
      for (var r = 1; r < 5; r++) s ^= ((inv << r) | (inv >> (8 - r))) & 255;
      s ^= 0x63;
      SBOX[x] = s;
      INV[s] = x;
    }
    for (x = 0; x < 256; x++) {
      var e = SBOX[x], d = INV[x];
      var te = (mul(e, 2) << 24) | (e << 16) | (e << 8) | mul(e, 3);
      var td = (mul(d, 14) << 24) | (mul(d, 9) << 16) | (mul(d, 13) << 8) | mul(d, 11);
      for (var t = 0; t < 4; t++) {
        TE[t][x] = (te >>> (8 * t)) | (te << (32 - 8 * t));
        TD[t][x] = (td >>> (8 * t)) | (td << (32 - 8 * t));
      }
    }
  })();

  // The round keys for a 16 or 32 byte key: encrypting and decrypting.
  function expandKey(key){
    var nk = key.length / 4, rounds = nk + 6, total = 4 * (rounds + 1), w = new Int32Array(total), i, rcon = 1;
    for (i = 0; i < nk; i++) w[i] = (key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3];
    for (i = nk; i < total; i++) {
      var t = w[i - 1];
      if (i % nk === 0) {
        t = (SBOX[(t >>> 16) & 255] << 24) | (SBOX[(t >>> 8) & 255] << 16) | (SBOX[t & 255] << 8) | SBOX[t >>> 24];
        t ^= rcon << 24;
        rcon = (rcon << 1) ^ (rcon & 0x80 ? 0x11b : 0);
      } else if (nk > 6 && i % nk === 4) {
        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 255] << 16) | (SBOX[(t >>> 8) & 255] << 8) | SBOX[t & 255];
      }
      w[i] = w[i - nk] ^ t;
    }
    // Decryption runs the rounds backwards, with InvMixColumns applied to
    // every round key but the first and last.
    var dw = new Int32Array(total);
    for (var rnd = 0; rnd <= rounds; rnd++) {
      for (var c = 0; c < 4; c++) {
        var v = w[(rounds - rnd) * 4 + c];
        dw[rnd * 4 + c] = rnd === 0 || rnd === rounds ? v :
          TD[0][SBOX[v >>> 24]] ^ TD[1][SBOX[(v >>> 16) & 255]] ^ TD[2][SBOX[(v >>> 8) & 255]] ^ TD[3][SBOX[v & 255]];
      }
    }
    return { rounds: rounds, enc: w, dec: dw };
  }

  // One 16-byte block, as four big-endian words in s, in place.
  function cryptBlock(s, keys, decrypt){
    var rk = decrypt ? keys.dec : keys.enc, T = decrypt ? TD : TE, B = decrypt ? INV : SBOX;
    // Decrypting takes its bytes from the columns the other way round.
    var c1 = decrypt ? 3 : 1, c3 = decrypt ? 1 : 3;
    var s0 = s[0] ^ rk[0], s1 = s[1] ^ rk[1], s2 = s[2] ^ rk[2], s3 = s[3] ^ rk[3], t0, t1, t2, t3, k = 4;
    var st = [0, 0, 0, 0];
    for (var r = 1; r < keys.rounds; r++) {
      st[0] = s0; st[1] = s1; st[2] = s2; st[3] = s3;
      t0 = T[0][st[0] >>> 24] ^ T[1][(st[c1] >>> 16) & 255] ^ T[2][(st[2] >>> 8) & 255] ^ T[3][st[c3] & 255] ^ rk[k];
      t1 = T[0][st[1] >>> 24] ^ T[1][(st[(1 + c1) & 3] >>> 16) & 255] ^ T[2][(st[3] >>> 8) & 255] ^ T[3][st[(1 + c3) & 3] & 255] ^ rk[k + 1];
      t2 = T[0][st[2] >>> 24] ^ T[1][(st[(2 + c1) & 3] >>> 16) & 255] ^ T[2][(st[0] >>> 8) & 255] ^ T[3][st[(2 + c3) & 3] & 255] ^ rk[k + 2];
      t3 = T[0][st[3] >>> 24] ^ T[1][(st[(3 + c1) & 3] >>> 16) & 255] ^ T[2][(st[1] >>> 8) & 255] ^ T[3][st[(3 + c3) & 3] & 255] ^ rk[k + 3];
      s0 = t0; s1 = t1; s2 = t2; s3 = t3; k += 4;
    }
    st[0] = s0; st[1] = s1; st[2] = s2; st[3] = s3;
    for (var c = 0; c < 4; c++) {
      s[c] = ((B[st[c] >>> 24] << 24) | (B[(st[(c + c1) & 3] >>> 16) & 255] << 16) |
        (B[(st[(c + 2) & 3] >>> 8) & 255] << 8) | B[st[(c + c3) & 3] & 255]) ^ rk[k + c];
    }
  }

  function toWords(bytes, at, out){
    for (var i = 0; i < 4; i++) out[i] = (bytes[at + 4 * i] << 24) | (bytes[at + 4 * i + 1] << 16) | (bytes[at + 4 * i + 2] << 8) | bytes[at + 4 * i + 3];
  }
  function fromWords(words, bytes, at){
    for (var i = 0; i < 4; i++) {
      bytes[at + 4 * i] = words[i] >>> 24; bytes[at + 4 * i + 1] = (words[i] >>> 16) & 255;
      bytes[at + 4 * i + 2] = (words[i] >>> 8) & 255; bytes[at + 4 * i + 3] = words[i] & 255;
    }
  }

  // AES-CBC over whole blocks, without padding (any partial block at the
  // end is left out).
  function aesCbc(key, iv, data, decrypt){
    var keys = expandKey(key), n = data.length - (data.length % 16), out = new Uint8Array(n);
    var prev = [0, 0, 0, 0], block = [0, 0, 0, 0], save = [0, 0, 0, 0], i;
    toWords(iv, 0, prev);
    for (var at = 0; at < n; at += 16) {
      toWords(data, at, block);
      if (decrypt) {
        save[0] = block[0]; save[1] = block[1]; save[2] = block[2]; save[3] = block[3];
        cryptBlock(block, keys, true);
        for (i = 0; i < 4; i++) { block[i] ^= prev[i]; prev[i] = save[i]; }
      } else {
        for (i = 0; i < 4; i++) block[i] ^= prev[i];
        cryptBlock(block, keys, false);
        for (i = 0; i < 4; i++) prev[i] = block[i];
      }
      fromWords(block, out, at);
    }
    return out;
  }
  function aesEncrypt(key, iv, data){ return aesCbc(key, iv, data, false); }
  function aesDecrypt(key, iv, data){ return aesCbc(key, iv, data, true); }

  // A PDF's AES data: a 16-byte IV, then the CBC blocks, ending in PKCS#5
  // padding (left alone if it doesn't look like padding).
  function aesUnwrap(key, data){
    if (data.length < 32) return new Uint8Array(0);
    var out = aesDecrypt(key, data.subarray(0, 16), data.subarray(16));
    var pad = out[out.length - 1];
    if (pad < 1 || pad > 16) return out;
    for (var i = out.length - pad; i < out.length; i++) if (out[i] !== pad) return out;
    return out.subarray(0, out.length - pad);
  }

  // ---- The standard security handler ----

  var PAD = new Uint8Array([
    0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
    0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
  ]);

  function utf8(text){
    var s = unescape(encodeURIComponent(text)), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  // Older files take the password as single bytes (Latin-1), the newest as
  // UTF-8 of up to 127 bytes.
  function passwordBytes(text, revision){
    if (revision >= 5) return utf8(text).subarray(0, 127);
    var out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 255) return utf8(text);
      out[i] = text.charCodeAt(i);
    }
    return out;
  }

  function padded(pw){
    var out = new Uint8Array(32);
    out.set(pw.subarray(0, 32));
    out.set(PAD.subarray(0, Math.max(0, 32 - pw.length)), Math.min(pw.length, 32));
    return out;
  }

  function sameBytes(a, b, n){
    if (a.length < n || b.length < n) return false;
    for (var i = 0; i < n; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // The file key from a user password (revisions 2 to 4).
  function legacyKey(enc, pw){
    var n = enc.R === 2 ? 5 : enc.length / 8;
    var p = enc.P;
    var parts = [padded(pw), enc.O.subarray(0, 32), new Uint8Array([p & 255, (p >>> 8) & 255, (p >>> 16) & 255, (p >>> 24) & 255]), enc.id];
    if (enc.R >= 4 && !enc.encryptMetadata) parts.push(new Uint8Array([255, 255, 255, 255]));
    var h = md5(concat.apply(null, parts));
    if (enc.R >= 3) for (var i = 0; i < 50; i++) h = md5(h.subarray(0, n));
    return h.slice(0, n);
  }

  function legacyUser(enc, pw){
    var key = legacyKey(enc, pw);
    if (enc.R === 2) return sameBytes(rc4(key, PAD), enc.U, 32) ? key : null;
    var x = rc4(key, md5(concat(PAD, enc.id)));
    for (var i = 1; i <= 19; i++) x = rc4(xorKey(key, i), x);
    return sameBytes(x, enc.U, 16) ? key : null;
  }

  function xorKey(key, v){
    var out = new Uint8Array(key.length);
    for (var i = 0; i < key.length; i++) out[i] = key[i] ^ v;
    return out;
  }

  // The owner password unlocks O, which holds the user password.
  function legacyOwner(enc, pw){
    var n = enc.R === 2 ? 5 : enc.length / 8;
    var h = md5(padded(pw));
    if (enc.R >= 3) for (var i = 0; i < 50; i++) h = md5(h);
    var key = h.subarray(0, n), user = enc.O.subarray(0, 32);
    if (enc.R === 2) user = rc4(key, user);
    else for (i = 19; i >= 0; i--) user = rc4(xorKey(key, i), user);
    return legacyUser(enc, user);
  }

  // The password hash of revision 6 (and the plain SHA-256 of revision 5).
  function hash6(enc, pw, salt, udata){
    var k = sha256(concat(pw, salt, udata));
    if (enc.R === 5) return k;
    for (var i = 0; i < 64 || e[e.length - 1] > i - 32; i++) {
      var one = concat(pw, k, udata), k1 = new Uint8Array(one.length * 64);
      for (var j = 0; j < 64; j++) k1.set(one, j * one.length);
      var e = aesEncrypt(k.subarray(0, 16), k.subarray(16, 32), k1);
      var sum = 0;
      for (j = 0; j < 16; j++) sum += e[j];
      k = [sha256, sha384, sha512][sum % 3](e);
    }
    return k.subarray(0, 32);
  }

  function aesKey(enc, pw){
    var zero = new Uint8Array(16), u = enc.U.subarray(0, 48), o = enc.O.subarray(0, 48);
    if (sameBytes(hash6(enc, pw, o.subarray(32, 40), u), o, 32)) {
      return { key: aesDecrypt(hash6(enc, pw, o.subarray(40, 48), u), zero, enc.OE.subarray(0, 32)), owner: true };
    }
    var none = new Uint8Array(0);
    if (sameBytes(hash6(enc, pw, u.subarray(32, 40), none), u, 32)) {
      return { key: aesDecrypt(hash6(enc, pw, u.subarray(40, 48), none), zero, enc.UE.subarray(0, 32)), owner: false };
    }
    return null;
  }

  // The file key for a password, and whether it was the owner's, or null if
  // the password is wrong. enc is what readEncryption() gives.
  function authenticate(enc, password){
    var pw = passwordBytes(password, enc.R);
    if (enc.R >= 5) return aesKey(enc, pw);
    var key = legacyOwner(enc, pw);
    if (key) return { key: key, owner: true };
    key = legacyUser(enc, pw);
    return key ? { key: key, owner: false } : null;
  }

  // Decrypts one string or stream of object (num, gen). method is 'RC4',
  // 'AESV2', 'AESV3' or 'Identity'.
  function decrypt(method, key, num, gen, data){
    if (method === 'Identity') return data;
    if (method === 'AESV3') return aesUnwrap(key, data);
    var salt = method === 'AESV2' ? [0x73, 0x41, 0x6c, 0x54] : [];
    var objKey = md5(concat(key, new Uint8Array([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255].concat(salt))));
    objKey = objKey.subarray(0, Math.min(key.length + 5, 16));
    return method === 'AESV2' ? aesUnwrap(objKey, data) : rc4(objKey, data);
  }

  // ---- Reading and rewriting the file with pdf-lib ----

  function name(lib, n){ return lib.PDFName.of(n); }
  function num(lib, dict, key, fallback){
    var v = dict.lookup(name(lib, key));
    return v instanceof lib.PDFNumber ? v.asNumber() : fallback;
  }
  function bytesOf(lib, v){
    return v instanceof lib.PDFString || v instanceof lib.PDFHexString ? v.asBytes() : new Uint8Array(0);
  }

  // The crypt filter called filterName in the encryption dictionary.
  function cryptMethod(lib, dict, filterName, V){
    if (V < 4) return 'RC4';
    if (!filterName || filterName === 'Identity') return 'Identity';
    var cf = dict.lookup(name(lib, 'CF'));
    var filter = cf instanceof lib.PDFDict ? cf.lookup(name(lib, filterName)) : null;
    var cfm = filter instanceof lib.PDFDict ? filter.lookup(name(lib, 'CFM')) : null;
    var m = cfm instanceof lib.PDFName ? cfm.decodeText() : 'None';
    if (m === 'V2') return 'RC4';
    if (m === 'AESV2' || m === 'AESV3') return m;
    if (m === 'None') return 'Identity';
    throw unsupported();
  }

  function unsupported(){
    var err = new Error('This PDF uses a kind of encryption this tool can’t remove.');
    err.unsupported = true;
    return err;
  }

  function nameOf(lib, v){ return v instanceof lib.PDFName ? v.decodeText() : null; }

  // What a file's encryption dictionary says, as plain values.
  function readEncryption(lib, context){
    var dict = context.lookup(context.trailerInfo.Encrypt);
    if (!(dict instanceof lib.PDFDict)) throw unsupported();
    if (nameOf(lib, dict.lookup(name(lib, 'Filter'))) !== 'Standard') throw unsupported();
    var V = num(lib, dict, 'V', 0), R = num(lib, dict, 'R', 0);
    if (V < 1 || V === 3 || V > 5 || R < 2 || R > 6) throw unsupported();
    var ids = context.trailerInfo.ID, id0 = ids instanceof lib.PDFArray && ids.size() ? ids.lookup(0) : null;
    var em = dict.lookup(name(lib, 'EncryptMetadata'));
    var enc = {
      V: V, R: R, length: V === 1 ? 40 : num(lib, dict, 'Length', 40),
      P: num(lib, dict, 'P', 0) | 0,
      O: bytesOf(lib, dict.lookup(name(lib, 'O'))), U: bytesOf(lib, dict.lookup(name(lib, 'U'))),
      OE: bytesOf(lib, dict.lookup(name(lib, 'OE'))), UE: bytesOf(lib, dict.lookup(name(lib, 'UE'))),
      id: bytesOf(lib, id0),
      encryptMetadata: !(em instanceof lib.PDFBool) || em.asBoolean()
    };
    var cf = dict.lookup(name(lib, 'CF'));
    var std = cf instanceof lib.PDFDict ? cf.lookup(name(lib, 'StdCF')) : null;
    var stdLength = std instanceof lib.PDFDict ? num(lib, std, 'Length', 0) : 0;
    // Some writers give a crypt filter's length in bytes rather than bits.
    if (V === 4 && stdLength) enc.length = stdLength <= 32 ? stdLength * 8 : stdLength;
    if (enc.length % 8 || enc.length < 40 || enc.length > 256) throw unsupported();
    if (enc.O.length < (R >= 5 ? 48 : 32) || enc.U.length < (R >= 5 ? 48 : 32)) throw unsupported();
    if (R >= 5 && (enc.OE.length < 32 || enc.UE.length < 32)) throw unsupported();
    enc.strings = cryptMethod(lib, dict, nameOf(lib, dict.lookup(name(lib, 'StrF'))), V);
    enc.streams = cryptMethod(lib, dict, nameOf(lib, dict.lookup(name(lib, 'StmF'))), V);
    var eff = nameOf(lib, dict.lookup(name(lib, 'EFF')));
    enc.files = eff ? cryptMethod(lib, dict, eff, V) : enc.streams;
    enc.dict = dict;
    return enc;
  }

  // Parses a PDF. Resolves to { context, encrypted, enc, needsPassword }:
  // pdf-lib's view of the file, how it's encrypted (null if it isn't), and
  // whether it takes a password to open (a file can be encrypted only to
  // restrict printing, copying or editing, with an empty user password).
  function open(lib, bytes){
    var parser = lib.PDFParser.forBytesWithOptions(new Uint8Array(bytes));
    return parser.parseDocument().then(function(context){
      if (!context.trailerInfo.Root) throw new Error('No PDF document found in this file.');
      var encrypted = !!context.trailerInfo.Encrypt, enc = encrypted ? readEncryption(lib, context) : null;
      return { lib: lib, context: context, encrypted: encrypted, enc: enc, needsPassword: !!enc && !authenticate(enc, '') };
    });
  }

  // How a file is encrypted, in words: "AES 256-bit", "RC4 40-bit".
  function describe(enc){
    var m = enc.streams === 'Identity' ? enc.strings : enc.streams;
    return (m === 'RC4' ? 'RC4 ' : 'AES ') + (m === 'AESV3' ? 256 : m === 'AESV2' ? 128 : enc.length) + '-bit';
  }

  // Decrypts the strings in a direct object (and the dictionaries and arrays
  // inside it), replacing them in place. Returns the new object.
  function decryptObject(file, key, ref, obj){
    var lib = file.lib, enc = file.enc;
    if (obj instanceof lib.PDFString || obj instanceof lib.PDFHexString) {
      return lib.PDFHexString.of(hex(decrypt(enc.strings, key, ref.objectNumber, ref.generationNumber, obj.asBytes())));
    }
    if (obj instanceof lib.PDFArray) {
      for (var i = 0; i < obj.size(); i++) obj.set(i, decryptObject(file, key, ref, obj.get(i)));
    } else if (obj instanceof lib.PDFDict) {
      var type = nameOf(lib, obj.get(name(lib, 'Type')));
      // A signature's contents are never encrypted.
      var sig = type === 'Sig' || type === 'DocTimeStamp';
      obj.entries().forEach(function(e){
        if (sig && e[0].decodeText() === 'Contents') return;
        obj.set(e[0], decryptObject(file, key, ref, e[1]));
      });
    }
    return obj;
  }

  function hex(bytes){
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  // Which crypt filter a stream uses: its own /Crypt filter, if it has one
  // (which is then removed, as it's no longer needed), or the file's.
  function streamMethod(file, dict){
    var lib = file.lib, enc = file.enc, type = nameOf(lib, dict.get(name(lib, 'Type')));
    if (type === 'Metadata' && !enc.encryptMetadata) return 'Identity';
    var filters = dict.lookup(name(lib, 'Filter')), parms = dict.lookup(name(lib, 'DecodeParms'));
    var list = filters instanceof lib.PDFArray ? filters.asArray() : filters ? [filters] : [];
    var at = list.map(function(f){ return nameOf(lib, f); }).indexOf('Crypt');
    if (at >= 0) {
      var p = parms instanceof lib.PDFArray ? parms.lookup(at) : parms;
      var cf = p instanceof lib.PDFDict ? nameOf(lib, p.lookup(name(lib, 'Name'))) : null;
      list.splice(at, 1);
      if (filters instanceof lib.PDFArray) {
        dict.set(name(lib, 'Filter'), lib.PDFArray.withContext(file.context));
        list.forEach(function(f){ dict.lookup(name(lib, 'Filter')).push(f); });
        if (parms instanceof lib.PDFArray) parms.remove(at);
      } else {
        dict.delete(name(lib, 'Filter'));
        dict.delete(name(lib, 'DecodeParms'));
      }
      return cryptMethod(lib, enc.dict, cf || 'Identity', enc.V);
    }
    return type === 'EmbeddedFile' ? enc.files : enc.streams;
  }

  function decryptStream(file, key, ref, stream){
    var lib = file.lib, dict = stream.dict;
    var method = streamMethod(file, dict);
    decryptObject(file, key, ref, dict);
    var plain = decrypt(method, key, ref.objectNumber, ref.generationNumber, stream.contents);
    dict.set(name(lib, 'Length'), lib.PDFNumber.of(plain.length));
    return lib.PDFRawStream.of(dict, plain);
  }

  // Tries a password. If it's right, decrypts every string and stream,
  // removes the encryption and resolves to { owner } (whether it was the
  // owner's password); if not, resolves to null and leaves the file as it
  // was. Afterwards file.context can be saved as an ordinary PDF.
  function unlock(file, password){
    var lib = file.lib, context = file.context;
    var auth = authenticate(file.enc, password);
    if (!auth) return Promise.resolve(null);
    var key = auth.key, encRef = context.trailerInfo.Encrypt;
    // pdf-lib can't read an object stream while it's encrypted, so it
    // keeps the whole object as raw bytes. Those are read again once the
    // stream is decrypted; the objects inside them were encrypted as part
    // of the stream, so they don't need decrypting on their own.
    var objStreams = [];
    context.enumerateIndirectObjects().forEach(function(entry){
      var ref = entry[0], obj = entry[1];
      if (encRef instanceof lib.PDFRef && ref === encRef) return;
      if (obj instanceof lib.PDFInvalidObject) {
        var parsed = null;
        try { parsed = lib.PDFObjectParser.forBytes(obj.data, context).parseObject(); } catch (e) { return; }
        if (parsed instanceof lib.PDFRawStream && nameOf(lib, parsed.dict.get(name(lib, 'Type'))) === 'ObjStm') {
          objStreams.push({ ref: ref, stream: decryptStream(file, key, ref, parsed) });
        }
      } else if (obj instanceof lib.PDFRawStream) {
        context.assign(ref, decryptStream(file, key, ref, obj));
      } else {
        context.assign(ref, decryptObject(file, key, ref, obj));
      }
    });
    return objStreams.reduce(function(chain, s){
      return chain.then(function(){
        context.delete(s.ref);
        return lib.PDFObjectStreamParser.forStream(s.stream).parseIntoContext();
      });
    }, Promise.resolve()).then(function(){
      if (encRef instanceof lib.PDFRef) context.delete(encRef);
      delete context.trailerInfo.Encrypt;
      file.encrypted = false;
      file.enc = null;
      return { owner: auth.owner };
    });
  }

  window.bdnixUnlock = {
    md5: md5, sha256: sha256, sha384: sha384, sha512: sha512, rc4: rc4,
    aesEncrypt: aesEncrypt, aesDecrypt: aesDecrypt,
    authenticate: authenticate, decrypt: decrypt, open: open, describe: describe, unlock: unlock
  };
})();
