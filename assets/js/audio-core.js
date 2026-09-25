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

  // Encodes audio handed over a block at a time, as it's decoded, so the
  // whole sound never has to be in memory. opts: { format: 'mp3' or 'wav',
  // kbps }. lame is the lamejs library, needed for MP3. cut (optional,
  // { skip, keep } in seconds) drops the start and caps the length, as an
  // MP4's edit list asks.
  // write(channels, rate) takes Float32Arrays (one or two, the same length);
  // the first call sets the rate and channel count. end() finishes the file
  // and returns { parts (its bytes), frames, rate }.
  function stream(opts, lame, cut){
    var mp3 = opts.format === 'mp3', enc = null, count = 0, rate = 0, frames = 0;
    var skip = 0, keep = Infinity, parts = [];

    function start(channels, sampleRate){
      count = channels;
      rate = sampleRate;
      if (cut) {
        skip = Math.round(cut.skip * rate);
        if (cut.keep !== Infinity) keep = Math.round(cut.keep * rate);
      }
      if (mp3) enc = new lame.Mp3Encoder(count, rate, opts.kbps);
      // The WAV header needs the length, so it's filled in at the end.
      else parts.push(null);
    }

    function write(channels, sampleRate){
      if (!count) start(channels.length, sampleRate);
      var n = channels[0].length, from = Math.min(n, skip), to = Math.min(n, from + keep - frames);
      skip -= from;
      if (to <= from) return;
      if (mp3) {
        var left = toPcm16(channels[0], from, to);
        var chunk = count > 1 ? enc.encodeBuffer(left, toPcm16(channels[1], from, to)) : enc.encodeBuffer(left);
        if (chunk.length) parts.push(chunk);
      } else {
        parts.push(interleave(channels, from, to));
      }
      frames += to - from;
    }

    function end(){
      // Nothing to encode still makes a valid (empty) file.
      if (!count) start(1, 44100);
      if (mp3) {
        var tail = enc.flush();
        if (tail.length) parts.push(tail);
      } else {
        parts[0] = wavHeader(frames, count, rate);
      }
      return { parts: parts, frames: frames, rate: rate };
    }

    return { start: start, write: write, end: end, parts: parts };
  }

  // Encodes channels (Float32Arrays, one or two) that are all in memory, a
  // piece at a time, so the page can show progress and stay responsive.
  // Call step() until done is true; parts then holds the file's bytes.
  function encoder(channels, rate, opts, lame){
    var total = channels[0].length, pos = 0, out = stream(opts, lame);
    out.start(channels.length, rate);
    var job = { parts: out.parts, progress: 0, done: false, step: step };

    function step(size){
      var end = Math.min(total, pos + Math.max(FRAME, size - size % FRAME));
      out.write(channels.map(function(c){ return c.subarray(pos, end); }), rate);
      pos = end;
      if (pos >= total) {
        out.end();
        job.done = true;
      }
      job.progress = total ? pos / total : 1;
      return job.progress;
    }
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
  // the audio pieces need reading. Where the browser can decode audio a
  // piece at a time (WebCodecs), audio.js feeds it the pieces in turn;
  // otherwise audioOnly() puts them in a much smaller MP4 holding just the
  // audio track, which the browser decodes whole.

  // The index is small next to the file; one bigger than this is left alone.
  var MAX_INDEX = 64 * 1024 * 1024;

  function u32(b, at){ return b[at] * 16777216 + (b[at + 1] << 16 | b[at + 2] << 8 | b[at + 3]); }
  function u64(b, at){ return u32(b, at) * 4294967296 + u32(b, at + 4); }
  function setU32(b, at, v){ b[at] = v / 16777216 & 255; b[at + 1] = v >> 16 & 255; b[at + 2] = v >> 8 & 255; b[at + 3] = v & 255; }

  // The box header at b[at], if the box fits in the `room` bytes left:
  // { type, head (header length), size }. Size 1 means a 64-bit size
  // follows; size 0 means the box runs to the end.
  function header(b, at, room){
    if (room < 8) return null;
    var size = u32(b, at), head = 8;
    if (size === 1) {
      if (room < 16) return null;
      size = u64(b, at + 8);
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

  function first(list, type){ return list.filter(function(c){ return c.type === type; })[0] || null; }

  // Follows a path of box types down from a box; null if one is missing.
  function find(b, box, path){
    for (var i = 0; box && i < path.length; i++) box = first(children(b, box.body, box.end), path[i]);
    return box || null;
  }

  // A full box's timescale (mvhd, mdhd): version 1 has 64-bit times first.
  function timescale(b, box){ return u32(b, box.body + (b[box.body] ? 20 : 12)); }

  // read(from, to) resolves to those bytes of the file (a Uint8Array); size
  // is the file's length. Resolves to null for anything this can't take
  // apart (another format, or an MP4 without the index, as when it's
  // streamed in fragments), which the caller then reads whole. Otherwise to
  // the audio track: {
  //   config: what WebCodecs' AudioDecoder needs, or null for a codec this
  //     doesn't know,
  //   chunks: [{ from, bytes, sizes, times }], where the audio sits in the
  //     file; each chunk holds samples (encoded frames) of these sizes,
  //     starting at these times (microseconds),
  //   samples: how many there are in all,
  //   cut: the edit list's { skip, keep } in seconds, or null,
  //   audioOnly(): resolves to a Uint8Array holding an MP4 with only this
  //     track
  // }. Rejects when the file has no audio.
  function mp4(read, size){
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
      ]).then(function(r){ return track(r[0], r[1], read, size); });
    });
  }

  function audioOnly(read, size){
    return mp4(read, size).then(function(t){ return t && t.audioOnly(); });
  }

  function track(m, ftyp, read, size){
    var moov = children(m, 0, m.length)[0];
    var parts = children(m, moov.body, moov.end);
    var mvhd = first(parts, 'mvhd');
    var trak = parts.filter(function(c){
      var hdlr = c.type === 'trak' && find(m, c, ['mdia', 'hdlr']);
      return hdlr && hdlr.body + 12 <= hdlr.end && String.fromCharCode.apply(null, m.subarray(hdlr.body + 8, hdlr.body + 12)) === 'soun';
    })[0];
    if (!mvhd) return null;
    if (!trak) throw new Error('no audio track');
    var mdhd = find(m, trak, ['mdia', 'mdhd']), stbl = find(m, trak, ['mdia', 'minf', 'stbl']);
    var stsc = find(m, stbl, ['stsc']), stsz = find(m, stbl, ['stsz']), stts = find(m, stbl, ['stts']);
    var stco = find(m, stbl, ['stco']), wide = !stco;
    if (wide) stco = find(m, stbl, ['co64']);
    if (!mdhd || !stsc || !stsz || !stts || !stco) return null;

    // Each chunk is a run of samples stored together: its offset in the
    // file, and its length from the sizes of the samples in it.
    var fixed = u32(m, stsz.body + 4), samples = u32(m, stsz.body + 8);
    var runs = u32(m, stsc.body + 4), count = u32(m, stco.body + 4), durations = u32(m, stts.body + 4);
    var step = wide ? 8 : 4, scale = timescale(m, mdhd), chunks = [], sample = 0, run = 0, total = 0;
    if (!samples || !runs || !scale || stco.body + 8 + count * step > stco.end || stsc.body + 8 + runs * 12 > stsc.end ||
        stts.body + 8 + durations * 8 > stts.end || (!fixed && stsz.body + 12 + samples * 4 > stsz.end)) return null;
    // Sample times, from stts: runs of { count, duration }.
    var time = 0, left = 0, entry = -1, delta = 0;
    for (var c = 0; c < count; c++) {
      while (run + 1 < runs && u32(m, stsc.body + 8 + (run + 1) * 12) - 1 <= c) run++;
      var per = Math.min(u32(m, stsc.body + 12 + run * 12), samples - sample), bytes = 0, sizes = [], times = [];
      for (var k = 0; k < per; k++) {
        var n = fixed || u32(m, stsz.body + 12 + (sample + k) * 4);
        sizes.push(n);
        bytes += n;
        while (!left && ++entry < durations) {
          left = u32(m, stts.body + 8 + entry * 8);
          delta = u32(m, stts.body + 12 + entry * 8);
        }
        times.push(Math.round(time * 1e6 / scale));
        time += delta;
        if (left) left--;
      }
      sample += per;
      var at = stco.body + 8 + c * step;
      var from = wide ? u64(m, at) : u32(m, at);
      if (from + bytes > size) return null;
      chunks.push({ from: from, bytes: bytes, sizes: sizes, times: times });
      total += bytes;
    }

    return {
      config: config(m, find(m, stbl, ['stsd']), scale),
      chunks: chunks,
      samples: sample,
      cut: edit(m, trak, timescale(m, mvhd), scale),
      audioOnly: function(){ return rebuild(m, ftyp, mvhd, trak, stco, wide, chunks, total, read); }
    };
  }

  // The edit list says where in the samples the sound starts (after the
  // encoder's warm-up, for AAC) and how long it lasts. Only the first entry
  // with media is used; phones write just that one.
  function edit(m, trak, movieScale, mediaScale){
    var elst = find(m, trak, ['edts', 'elst']);
    if (!elst) return null;
    var v = m[elst.body], size = v ? 20 : 12, n = u32(m, elst.body + 4);
    for (var i = 0, at = elst.body + 8; i < n && at + size <= elst.end; i++, at += size) {
      var duration = v ? u64(m, at) : u32(m, at), hi = u32(m, at + (v ? 8 : 4));
      // A media time of -1 is an empty edit (a pause before the track).
      if (hi === 0xffffffff) continue;
      var start = v ? hi * 4294967296 + u32(m, at + 12) : hi;
      return { skip: start / mediaScale, keep: duration && movieScale ? duration / movieScale : Infinity };
    }
    return null;
  }

  // MPEG-4 descriptors (in esds): [{ tag, body, end }]. Lengths take one to
  // four bytes, seven bits each.
  function descriptors(m, at, end){
    var out = [];
    while (at + 2 <= end) {
      var tag = m[at++], len = 0, k = 0, byte;
      do { byte = m[at++]; len = len * 128 + (byte & 127); } while (byte & 128 && ++k < 4);
      if (at + len > end) break;
      out.push({ tag: tag, body: at, end: at + len });
      at += len;
    }
    return out;
  }

  // What the esds box says: the codec (objectTypeIndication) and, for AAC,
  // its AudioSpecificConfig.
  function esds(m, box){
    var es = descriptors(m, box.body + 4, box.end).filter(function(d){ return d.tag === 3; })[0];
    if (!es) return null;
    var at = es.body + 2, flags = m[at++];
    if (flags & 128) at += 2;
    if (flags & 64) at += m[at] + 1;
    if (flags & 32) at += 2;
    var dc = descriptors(m, at, es.end).filter(function(d){ return d.tag === 4; })[0];
    if (!dc) return null;
    var dsi = descriptors(m, dc.body + 13, dc.end).filter(function(d){ return d.tag === 5; })[0];
    return { type: m[dc.body], info: dsi ? m.slice(dsi.body, dsi.end) : null };
  }

  // The AudioDecoder config for the track's first sample entry, or null.
  function config(m, stsd, rate){
    var entry = stsd && children(m, stsd.body + 8, stsd.end)[0];
    if (!entry) return null;
    // A sound sample entry: QuickTime's version 1 and 2 add fields, and
    // keep the codec's box inside a 'wave' box.
    var b = entry.body, version = m[b + 8] << 8 | m[b + 9];
    var channels = version === 2 ? u32(m, b + 40) : m[b + 16] << 8 | m[b + 17];
    var inner = children(m, b + 28 + (version === 1 ? 16 : version === 2 ? 36 : 0), entry.end);
    var wave = first(inner, 'wave');
    if (wave) inner = inner.concat(children(m, wave.body, wave.end));
    var out = { codec: '', sampleRate: rate, numberOfChannels: channels };
    if (entry.type === 'fLaC') {
      var dfla = first(inner, 'dfLa');
      if (!dfla) return null;
      // FLAC's own stream header: the marker, then the metadata blocks.
      out.codec = 'flac';
      out.description = new Uint8Array(4 + dfla.end - dfla.body - 4);
      out.description.set([102, 76, 97, 67]);
      out.description.set(m.subarray(dfla.body + 4, dfla.end), 4);
      return out;
    }
    if (entry.type === '.mp3') { out.codec = 'mp3'; return out; }
    var es = entry.type === 'mp4a' && first(inner, 'esds'), d = es && esds(m, es);
    if (!d) return null;
    if (d.type === 0x69 || d.type === 0x6b) { out.codec = 'mp3'; return out; }
    // AAC, MPEG-4 or MPEG-2: the audio object type opens its config, with
    // 31 meaning a bigger number follows.
    if ([0x40, 0x66, 0x67, 0x68].indexOf(d.type) < 0 || !d.info || d.info.length < 2) return null;
    var aot = d.info[0] >> 3;
    if (aot === 31) aot = 32 + ((d.info[0] & 7) << 3 | d.info[1] >> 5);
    out.codec = 'mp4a.40.' + aot;
    out.description = d.info;
    return out;
  }

  // ftyp, then a moov with mvhd and the audio trak, then the audio.
  function rebuild(m, ftyp, mvhd, trak, stco, wide, chunks, total, read){
    var moovSize = 8 + (mvhd.end - mvhd.start) + (trak.end - trak.start), step = wide ? 8 : 4;
    var out = new Uint8Array(ftyp.length + moovSize + 8 + total);
    var pos = 0;
    out.set(ftyp, pos); pos += ftyp.length;
    setU32(out, pos, moovSize); out.set([109, 111, 111, 118], pos + 4); pos += 8;
    out.set(m.subarray(mvhd.start, mvhd.end), pos); pos += mvhd.end - mvhd.start;
    var trakAt = pos - trak.start;
    out.set(m.subarray(trak.start, trak.end), pos); pos += trak.end - trak.start;
    setU32(out, pos, 8 + total); out.set([109, 100, 97, 116], pos + 4); pos += 8;
    // The chunks now sit one after another; point the index at them.
    var places = chunks.map(function(ch, i){
      var at = trakAt + stco.body + 8 + i * step;
      if (wide) { setU32(out, at, Math.floor(pos / 4294967296)); at += 4; }
      setU32(out, at, pos % 4294967296);
      pos += ch.bytes;
      return pos - ch.bytes;
    });
    return chunks.reduce(function(done, ch, i){
      return done.then(function(){
        return read(ch.from, ch.from + ch.bytes).then(function(b){ out.set(b, places[i]); });
      });
    }, Promise.resolve()).then(function(){ return out; });
  }

  window.bdnixAudio = {
    isMedia: isMedia, outName: outName, fmtTime: fmtTime,
    mix: mix, toPcm16: toPcm16, stream: stream, encoder: encoder, mp4: mp4, audioOnly: audioOnly
  };
})();
