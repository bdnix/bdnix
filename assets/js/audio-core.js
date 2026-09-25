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

  window.bdnixAudio = {
    isMedia: isMedia, outName: outName, fmtTime: fmtTime,
    mix: mix, toPcm16: toPcm16, encoder: encoder
  };
})();
