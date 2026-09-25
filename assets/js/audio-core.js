// Pure logic for the audio converter (mp4-to-mp3): which files it takes,
// naming the output, mixing channels and encoding MP3 or WAV. No DOM here,
// so it can be unit tested; audio.js does the decoding and the page.
(function(){
  // What the browser can usually decode. The file type is checked first;
  // the extension covers files the browser gives no type for.
  var EXTENSIONS = /\.(mp4|m4a|m4v|mov|3gp|webm|mkv|ogg|oga|ogv|opus|mp3|wav|flac|aac)$/i;

  function isMedia(file){
    return /^(audio|video)\//.test(file.type || '') || EXTENSIONS.test(file.name);
  }

  // "clip.mov" becomes "clip.mp3". A name with no extension, or only a
  // leading dot, keeps all of it.
  function outName(name, ext){
    var dot = name.lastIndexOf('.');
    return (dot > 0 ? name.slice(0, dot) : name) + '.' + ext;
  }

  // 65 -> "1:05", 3725 -> "1:02:05". Partial seconds round to the nearest.
  function fmtTime(seconds){
    var s = Math.round(seconds), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    var ss = s % 60 < 10 ? '0' + s % 60 : String(s % 60);
    if (h) return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
    return m + ':' + ss;
  }

  // Picks the channels to encode from the decoded ones (Float32Arrays).
  // Mono averages every channel. Stereo keeps the first two (front left and
  // right in a surround file); a mono source stays mono.
  function mix(channels, mono){
    if (!mono || channels.length === 1) return channels.slice(0, 2);
    var n = channels[0].length, out = new Float32Array(n), k = channels.length;
    for (var i = 0; i < n; i++) {
      var sum = 0;
      for (var c = 0; c < k; c++) sum += channels[c][i];
      out[i] = sum / k;
    }
    return [out];
  }

  // Float samples (-1..1) to 16-bit, clipping anything louder.
  function toPcm16(src, from, to){
    var out = new Int16Array(to - from);
    for (var i = from; i < to; i++) {
      var v = src[i];
      out[i - from] = v >= 1 ? 32767 : v <= -1 ? -32768 : Math.round(v * (v < 0 ? 32768 : 32767));
    }
    return out;
  }

  function wavHeader(frames, channels, rate){
    var bytes = frames * channels * 2, b = new DataView(new ArrayBuffer(44));
    function text(at, s){ for (var i = 0; i < 4; i++) b.setUint8(at + i, s.charCodeAt(i)); }
    text(0, 'RIFF'); b.setUint32(4, 36 + bytes, true); text(8, 'WAVE');
    text(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, channels, true);
    b.setUint32(24, rate, true); b.setUint32(28, rate * channels * 2, true);
    b.setUint16(32, channels * 2, true); b.setUint16(34, 16, true);
    text(36, 'data'); b.setUint32(40, bytes, true);
    return new Uint8Array(b.buffer);
  }

  // Samples per MP3 frame; the encoder is fed a whole number of them.
  var FRAME = 1152;

  // Encodes channels (Float32Arrays, one or two) a piece at a time, so the
  // page can show progress and stay responsive. opts: { format: 'mp3' or
  // 'wav', kbps }. lame is the lamejs library, needed for MP3.
  // Call step() until done is true; parts then holds the file's bytes.
  function encoder(channels, rate, opts, lame){
    var total = channels[0].length, pos = 0;
    var mp3 = opts.format === 'mp3';
    var mp3enc = mp3 ? new lame.Mp3Encoder(channels.length, rate, opts.kbps) : null;
    var job = { parts: mp3 ? [] : [wavHeader(total, channels.length, rate)], progress: 0, done: false, step: step };

    function step(size){
      var end = Math.min(total, pos + Math.max(FRAME, size - size % FRAME));
      if (mp3) {
        var left = toPcm16(channels[0], pos, end);
        var chunk = channels.length > 1 ? mp3enc.encodeBuffer(left, toPcm16(channels[1], pos, end)) : mp3enc.encodeBuffer(left);
        if (chunk.length) job.parts.push(chunk);
      } else {
        job.parts.push(interleave(channels, pos, end));
      }
      pos = end;
      if (pos >= total) {
        if (mp3) {
          var tail = mp3enc.flush();
          if (tail.length) job.parts.push(tail);
        }
        job.done = true;
      }
      job.progress = total ? pos / total : 1;
      return job.progress;
    }
    // Nothing to encode still makes a valid (empty) file.
    if (!total) step(FRAME);
    return job;
  }

  // 16-bit little-endian samples, channels interleaved, as WAV stores them.
  function interleave(channels, from, to){
    var k = channels.length, out = new DataView(new ArrayBuffer((to - from) * k * 2));
    for (var c = 0; c < k; c++) {
      var pcm = toPcm16(channels[c], from, to);
      for (var i = 0; i < pcm.length; i++) out.setInt16((i * k + c) * 2, pcm[i], true);
    }
    return new Uint8Array(out.buffer);
  }

  // --- The audio track of an MP4 or MOV ---
  // Phone videos run to hundreds of megabytes, and reading one whole into
  // memory makes iPhones reload the page. These files keep an index (the
  // moov box) of where each piece of each track sits, so only the index and
  // the audio pieces are read, and put in a much smaller MP4 holding just
  // the audio track, which the browser decodes like any other.

  // The index is small next to the file; one bigger than this is left alone.
  var MAX_INDEX = 64 * 1024 * 1024;

  function u32(b, at){ return b[at] * 16777216 + (b[at + 1] << 16 | b[at + 2] << 8 | b[at + 3]); }
  function setU32(b, at, v){ b[at] = v / 16777216 & 255; b[at + 1] = v >> 16 & 255; b[at + 2] = v >> 8 & 255; b[at + 3] = v & 255; }

  // The box header at b[at], if the box fits in the `room` bytes left:
  // { type, head (header length), size }. Size 1 means a 64-bit size
  // follows; size 0 means the box runs to the end.
  function header(b, at, room){
    if (room < 8) return null;
    var size = u32(b, at), head = 8;
    if (size === 1) {
      if (room < 16) return null;
      size = u32(b, at + 8) * 4294967296 + u32(b, at + 12);
      head = 16;
    } else if (size === 0) {
      size = room;
    }
    var type = String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]);
    return /^[\x20-\x7e]{4}$/.test(type) && size >= head && size <= room ? { type: type, head: head, size: size } : null;
  }

  // The boxes inside a box (or b[from..to)): [{ type, start, body, end }].
  function children(b, from, to){
    var out = [], h;
    while ((h = header(b, from, to - from))) {
      out.push({ type: h.type, start: from, body: from + h.head, end: from + h.size });
      from += h.size;
    }
    return out;
  }

  // Follows a path of box types down from a box; null if one is missing.
  function find(b, box, path){
    for (var i = 0; box && i < path.length; i++) {
      box = children(b, box.body, box.end).filter(function(c){ return c.type === path[i]; })[0];
    }
    return box || null;
  }

  // read(from, to) resolves to those bytes of the file (a Uint8Array); size
  // is the file's length. Resolves to a Uint8Array holding an MP4 with only
  // the audio track, or null for anything this can't take apart (another
  // format, or an MP4 without the index, as when it's streamed in fragments),
  // which the caller then reads whole. Rejects when the file has no audio.
  function audioOnly(read, size){
    var top = {};
    // Top-level boxes, up to the index; mdat alone can be gigabytes.
    function walk(pos){
      if (pos >= size) return Promise.resolve();
      return read(pos, Math.min(size, pos + 16)).then(function(b){
        var h = header(b, 0, size - pos);
        if (!h) return;
        if (!top[h.type]) top[h.type] = { start: pos, end: pos + h.size };
        if (h.type !== 'moov') return walk(pos + h.size);
      });
    }
    return walk(0).then(function(){
      var moov = top.moov;
      if (!moov || moov.end - moov.start > MAX_INDEX) return null;
      return Promise.all([
        read(moov.start, moov.end),
        top.ftyp && top.ftyp.start < moov.start ? read(top.ftyp.start, top.ftyp.end) : new Uint8Array(0)
      ]).then(function(r){ return rebuild(r[0], r[1], read, size); });
    });
  }

  function rebuild(m, ftyp, read, size){
    var moov = children(m, 0, m.length)[0];
    var parts = children(m, moov.body, moov.end);
    var mvhd = parts.filter(function(c){ return c.type === 'mvhd'; })[0];
    var trak = parts.filter(function(c){
      var hdlr = c.type === 'trak' && find(m, c, ['mdia', 'hdlr']);
      return hdlr && hdlr.body + 12 <= hdlr.end && String.fromCharCode.apply(null, m.subarray(hdlr.body + 8, hdlr.body + 12)) === 'soun';
    })[0];
    if (!mvhd) return null;
    if (!trak) throw new Error('no audio track');
    var stbl = find(m, trak, ['mdia', 'minf', 'stbl']);
    var stsc = find(m, stbl, ['stsc']), stsz = find(m, stbl, ['stsz']);
    var stco = find(m, stbl, ['stco']), wide = !stco;
    if (wide) stco = find(m, stbl, ['co64']);
    if (!stsc || !stsz || !stco) return null;

    // Each chunk is a run of samples stored together: its offset in the
    // file, and its length from the sizes of the samples in it.
    var fixed = u32(m, stsz.body + 4), samples = u32(m, stsz.body + 8);
    var runs = u32(m, stsc.body + 4), count = u32(m, stco.body + 4);
    var step = wide ? 8 : 4, chunks = [], sample = 0, run = 0, total = 0;
    if (!samples || !runs || stco.body + 8 + count * step > stco.end || stsc.body + 8 + runs * 12 > stsc.end ||
        (!fixed && stsz.body + 12 + samples * 4 > stsz.end)) return null;
    for (var c = 0; c < count; c++) {
      while (run + 1 < runs && u32(m, stsc.body + 8 + (run + 1) * 12) - 1 <= c) run++;
      var per = Math.min(u32(m, stsc.body + 12 + run * 12), samples - sample), bytes = 0;
      for (var k = 0; k < per; k++) bytes += fixed || u32(m, stsz.body + 12 + (sample + k) * 4);
      sample += per;
      var at = stco.body + 8 + c * step;
      var from = wide ? u32(m, at) * 4294967296 + u32(m, at + 4) : u32(m, at);
      if (from + bytes > size) return null;
      chunks.push({ from: from, bytes: bytes });
      total += bytes;
    }

    // ftyp, then a moov with mvhd and the audio trak, then the audio.
    var moovSize = 8 + (mvhd.end - mvhd.start) + (trak.end - trak.start);
    var out = new Uint8Array(ftyp.length + moovSize + 8 + total);
    var pos = 0;
    out.set(ftyp, pos); pos += ftyp.length;
    setU32(out, pos, moovSize); out.set([109, 111, 111, 118], pos + 4); pos += 8;
    out.set(m.subarray(mvhd.start, mvhd.end), pos); pos += mvhd.end - mvhd.start;
    var trakAt = pos - trak.start;
    out.set(m.subarray(trak.start, trak.end), pos); pos += trak.end - trak.start;
    setU32(out, pos, 8 + total); out.set([109, 100, 97, 116], pos + 4); pos += 8;
    // The chunks now sit one after another; point the index at them.
    chunks.forEach(function(ch, i){
      var at = trakAt + stco.body + 8 + i * step;
      if (wide) { setU32(out, at, Math.floor(pos / 4294967296)); at += 4; }
      setU32(out, at, pos % 4294967296);
      ch.to = pos;
      pos += ch.bytes;
    });
    return chunks.reduce(function(done, ch){
      return done.then(function(){
        return read(ch.from, ch.from + ch.bytes).then(function(b){ out.set(b, ch.to); });
      });
    }, Promise.resolve()).then(function(){ return out; });
  }

  window.bdnixAudio = {
    isMedia: isMedia, outName: outName, fmtTime: fmtTime,
    mix: mix, toPcm16: toPcm16, encoder: encoder, audioOnly: audioOnly
  };
})();
