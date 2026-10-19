// Audio converter (mp4-to-mp3). The browser decodes each file's audio and
// LAME encodes the MP3, in workers (audio-worker.js), so nothing is
// uploaded. The encoding itself lives in audio-core.js.
(function(){
  var T = window.bdnixFiles, A = window.bdnixAudio;
  var Lang = window.bdnixLang, t = Lang.t;
  var fmtSize = T.fmtSize, readBytes = T.readBytes;

  // Audio decoded whole is resampled to this rate, which MP3 and WAV both
  // suit.
  var RATE = 44100;
  var TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav' };

  // The page names the worker and the core it loads, so the build stamps
  // them like its other links and they always match this script.
  var me = document.currentScript;
  var WORKER = me.getAttribute('data-worker'), CORE = me.getAttribute('data-core');
  // LAME, built to WebAssembly (lame/README.md); its version, and a build
  // number for changes to how it's built.
  var LAME = '/assets/vendor/lame.wasm?v=3.100-1';
  // MP3 workers at once: one per core, leaving one for the page and the
  // decoding.
  var WORKERS = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));

  var drop = document.getElementById('drop');
  var picker = document.getElementById('picker');
  var msg = document.getElementById('msg');
  var wrap = document.getElementById('filesWrap');
  var form = document.getElementById('settings');
  var qualityField = document.getElementById('qualityField');
  var list = document.getElementById('list');
  var convertBtn = document.getElementById('convertBtn');
  var convertLabel = document.getElementById('convertLabel');
  var stopBtn = document.getElementById('stopBtn');
  var awakeNote = document.getElementById('awakeNote');
  var report = document.getElementById('report');
  var reportList = document.getElementById('reportList');
  var supportWarn = document.getElementById('supportWarn');

  document.getElementById('year').textContent = new Date().getFullYear();

  // Phones record AAC. A browser that can't decode it a piece at a time
  // (WebCodecs; iOS before 26, older Android browsers) decodes each file
  // whole, which long videos can't fit in a phone's memory, so say so.
  function streamsAac(){
    if (!window.AudioDecoder) return Promise.resolve(false);
    return AudioDecoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2 })
      .then(function(r){ return !!r.supported; }, function(){ return false; });
  }
  streamsAac().then(function(ok){ supportWarn.hidden = ok; });

  // The file open, one at a time, or null: { file, state, progress, error,
  // url, out, outSize, seconds }. state is 'ready', 'working', 'done' or
  // 'error'.
  var current = null;
  var busy = false, stopping = false;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function settings(){
    return { format: form.elements.format.value, kbps: +form.elements.kbps.value, mono: form.elements.channels.value === 'mono' };
  }

  // Drops a converted file, so it can be converted again.
  function reset(f){
    if (f.url) URL.revokeObjectURL(f.url);
    f.url = null;
    if (f.state === 'done') f.state = 'ready';
  }

  // Opens the first video or audio file of those chosen or dropped, in
  // place of the one open.
  function openFile(fileList){
    if (busy) return;
    var incoming = Array.prototype.slice.call(fileList), file = incoming.filter(A.isMedia)[0];
    if (!file) {
      if (incoming.length) say(t(incoming.length === 1 ? 'Skipped: {names} isn’t a video or audio file.' : 'Skipped: {names} aren’t a video or audio file.', { names: incoming.map(function(f){ return f.name; }).join(', ') }), true);
      return;
    }
    if (current) reset(current);
    current = { file: file, state: 'ready', progress: 0 };
    render();
    say(incoming.length > 1 ? t('This tool converts one file at a time, so it opened {name}.', { name: file.name }) : '');
  }

  function render(){
    var f = current;
    wrap.hidden = !f;
    // Once a file is open, the drop zone shrinks to a row for opening
    // another, and it's dimmed while converting, when it takes none.
    drop.classList.toggle('compact', !!f);
    drop.classList.toggle('busy', busy);
    list.textContent = '';
    if (f) {
      var li = document.createElement('li');
      li.className = 'track panel ' + f.state;

      var info = document.createElement('div');
      info.className = 'file-info';
      var name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = f.file.name;
      name.title = f.file.name;
      var meta = document.createElement('span');
      meta.className = 'file-meta';
      info.appendChild(name);
      info.appendChild(meta);
      var bar = document.createElement('span');
      bar.className = 'track-bar';
      bar.hidden = f.state !== 'working';
      info.appendChild(bar);
      f.meta = meta;
      f.bar = bar;
      showMeta(f);
      li.appendChild(info);

      if (f.state === 'done') {
        var a = document.createElement('a');
        a.className = 'btn btn-ghost dl';
        T.offer(a, f.url, f.out);
        a.setAttribute('aria-label', t('Download {name}', { name: f.out }));
        a.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7l4 4 4-4M2 14h12"/></svg><span>Download</span>';
        li.appendChild(a);
      }

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'icon-btn rm';
      rm.setAttribute('aria-label', t('Remove {name}', { name: f.file.name }));
      rm.title = 'Remove';
      rm.disabled = busy;
      rm.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
      rm.addEventListener('click', function(){
        reset(f);
        current = null;
        render();
        say('');
      });
      li.appendChild(rm);
      list.appendChild(li);
    }

    if (!busy) convertLabel.textContent = t('Convert');
    convertBtn.disabled = busy || !f || f.state !== 'ready';
    stopBtn.hidden = !busy;
    if (!busy) stopBtn.disabled = false;
    awakeNote.hidden = !busy;
    if (!busy) awakeNote.textContent = '';
    report.hidden = !(f && f.state === 'done' && f.report);
    reportList.textContent = '';
    if (!report.hidden) {
      A.reportRows(f.report).forEach(function(row){
        var dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = row[0];
        dd.textContent = row[1];
        reportList.appendChild(dt);
        reportList.appendChild(dd);
      });
    }
    picker.disabled = busy;
    Array.prototype.forEach.call(form.elements, function(el){ el.disabled = busy; });
    qualityField.hidden = settings().format !== 'mp3';
  }

  function showMeta(f){
    var meta = f.meta;
    meta.classList.toggle('error', f.state === 'error');
    if (f.state === 'error') meta.textContent = f.error;
    else if (f.state === 'working') {
      var left = A.timeLeft(Date.now() - f.started, f.progress);
      meta.textContent = t('Converting… {percent}%', { percent: Math.floor(f.progress * 100) }) + (left ? ' · ' + left : '');
    }
    else if (f.state === 'done') meta.textContent = A.fmtTime(f.seconds) + ' · ' + f.out + ' · ' + fmtSize(f.outSize);
    else meta.textContent = fmtSize(f.file.size);
    f.bar.style.setProperty('--p', f.progress);
  }

  // Bytes from..to of a file, as a Uint8Array.
  function reader(file){
    return function(from, to){
      return readBytes(file.slice(from, to)).then(function(b){ return new Uint8Array(b); });
    };
  }

  function decode(buf){
    var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    return new Promise(function(resolve, reject){
      var ctx = new Ctx(1, 1, RATE);
      // Older Safari only takes callbacks; everything else returns a promise.
      var p = ctx.decodeAudioData(buf, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }

  // Lets the page repaint between slices of work. A message isn't slowed
  // down in a background tab the way a timer is.
  var channel = new MessageChannel(), waiting = [];
  channel.port1.onmessage = function(){ waiting.shift()(); };
  function nextTick(fn){ waiting.push(fn); channel.port2.postMessage(0); }

  // The sample rates MP3 has. Streamed audio keeps its own rate; audio at
  // other rates is decoded whole, which resamples it.
  var MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

  // Whether the browser can decode the track a piece at a time (WebCodecs).
  function canStream(track, opts){
    if (!track || !track.config || !window.AudioDecoder) return Promise.resolve(false);
    if (opts.format === 'mp3' && MP3_RATES.indexOf(track.config.sampleRate) < 0) return Promise.resolve(false);
    return AudioDecoder.isConfigSupported(track.config).then(function(r){ return !!r.supported; }, function(){ return false; });
  }

  // How many encoded frames may wait in the decoder. Reading pauses until
  // it catches up, so only a little of the file is in memory at a time.
  var QUEUE = 64;

  // Where the decoded sound goes. write(channels, rate) is as
  // bdnixAudio.stream()'s, and end() resolves to { parts, frames, rate }.
  // While full() is true, wait for room: the sink calls onRoom when it has
  // some. broken rejects if encoding fails before the end.
  // expect(samples) says, before the first write, how long the sound will
  // be, and progress() is how much of that is done, 0 to 1 (0 if it isn't
  // known). stop() drops the work, and stopped() says whether it has been.
  function wavSink(cut){
    var out = A.stream({ format: 'wav' }, null, cut), dead = false, length = 0;
    return {
      write: out.write,
      end: function(){ return Promise.resolve(out.end()); },
      full: function(){ return false; },
      broken: new Promise(function(){}),
      expect: function(samples){ length = samples; },
      progress: function(){ return length > 0 ? Math.min(1, out.written() / length) : 0; },
      stop: function(){ dead = true; },
      stopped: function(){ return dead; }
    };
  }

  // MP3 is cut into pieces (bdnixAudio.splitter), encoded in up to WORKERS
  // workers at once and put back together in order; pieces that carry on
  // into the next all go through one worker. A recording too short to
  // keep every worker busy with full-length pieces is shared out evenly
  // (bdnixAudio.pieceSize). lame is LAME's module and enc a LAME encoder
  // (bdnixAudio.lame) for the page's own use. onEncoded is
  // called as each piece is done.
  function mp3Sink(opts, lame, enc, cut, onEncoded){
    var workers = [], idle = [], queue = [], blobs = [], own = [], most = WORKERS, length = 0, split = null;
    var sent = 0, done = 0, written = 0, encoded = 0, rate = 0, dead = false, failure = null, settle = null, breaks;
    // For the report: workers hired, whether the pieces were chained
    // through one, and the MP3's channels and rate.
    var hired = 0, chained = false, channels = 1, outRate = 0;
    // Made with the first sound, once the length is known.
    function splitter(){
      return split || (split = A.splitter(opts.kbps, enc, cut, function(piece){
        if (piece.more) chained = true;
        if (chained) most = 1;
        if (!sent) {
          channels = piece.channels.length || 1;
          outRate = A.mp3Rate(enc, channels, piece.rate, opts.kbps);
        }
        piece.index = sent++;
        own[piece.index] = piece.samples;
        written += piece.samples;
        rate = piece.rate;
        queue.push(piece);
        run();
      }, A.pieceSize(length, WORKERS)));
    }
    var sink = {
      write: function(channels, sampleRate){ if (!dead) splitter().write(channels, sampleRate); },
      end: function(){
        return new Promise(function(resolve, reject){
          if (failure) return reject(failure);
          settle = { resolve: resolve, reject: reject };
          splitter().end();
          finish();
        });
      },
      expect: function(samples){ length = samples; },
      full: function(){ return sent - done > most; },
      progress: function(){ return length > 0 ? Math.min(1, encoded / length) : 0; },
      // A failure can come while the decoding waits for room that never
      // comes.
      broken: new Promise(function(resolve, reject){ breaks = reject; }),
      stop: stop,
      stopped: function(){ return dead; },
      onRoom: null
    };

    function unloaded(){ fail(new Error(t('the MP3 encoder didn’t load. Check your connection and try again'))); }
    function fail(err){
      if (failure) return;
      failure = err;
      stop();
      breaks(err);
      if (settle) settle.reject(err);
    }
    function stop(){
      dead = true;
      workers.forEach(function(w){ w.terminate(); });
      workers = [];
      idle = [];
      queue = [];
    }
    function hire(){
      var w = new Worker(WORKER);
      hired++;
      w.onmessage = function(e){
        var d = e.data;
        if (d.unloaded) return unloaded();
        if (d.error) return fail(new Error(d.error));
        blobs[d.index] = new Blob([d.bytes]);
        encoded += own[d.index];
        done++;
        idle.push(w);
        run();
        onEncoded();
        var room = sink.onRoom;
        sink.onRoom = null;
        if (room) room();
        finish();
      };
      // The worker's own script didn't load.
      w.onerror = function(e){
        e.preventDefault();
        unloaded();
      };
      w.postMessage({ load: CORE, lame: lame });
      workers.push(w);
      return w;
    }
    function run(){
      while (!dead && queue.length && (idle.length || workers.length < most)) {
        var w = idle.length ? idle.pop() : hire(), piece = queue.shift();
        w.postMessage(piece, piece.channels.map(function(c){ return c.buffer; }));
      }
    }
    function finish(){
      if (settle && !dead && done === sent) {
        settle.resolve({
          parts: blobs, frames: written, rate: rate, channels: channels,
          mp3: { workers: hired, pieces: own.slice(), oneEncoder: chained, rate: outRate }
        });
      }
    }
    return sink;
  }

  // LAME is only fetched the first time someone makes an MP3, and compiled
  // once: the page keeps an encoder of its own (to see which sample rate an
  // MP3 will have) and hands the module to the workers. Resolves to
  // { module, enc }, or null for WAV. A failure is tried again next time.
  var loading = null;
  function loadEncoder(opts){
    if (opts.format !== 'mp3') return Promise.resolve(null);
    loading = loading || fetch(LAME).then(function(res){
      if (!res.ok) throw new Error(res.status);
      return res.arrayBuffer();
    }).then(function(bytes){ return WebAssembly.compile(bytes); }).then(function(module){
      return A.lame(module).then(function(enc){ return { module: module, enc: enc }; });
    });
    return loading.catch(function(){
      loading = null;
      throw new Error(t('the MP3 encoder didn’t load. Check your connection and try again'));
    });
  }

  // Decodes an MP4's audio track piece by piece and hands each piece to the
  // sink as it comes, so the decoded sound is never all in memory at once.
  // Resolves to what the sink's end() does.
  function streamed(track, read, opts, out, unreadable, onProgress){
    return new Promise(function(resolve, reject){
      var failed = false, wake = null, next = 0;
      function fail(err){
        if (failed) return;
        failed = true;
        wake = null;
        if (decoder.state !== 'closed') decoder.close();
        reject(err);
      }
      function resume(){
        var w = wake;
        wake = null;
        if (w) w();
      }
      // Stopping closes the decoder.
      stoppers.push(function(){ fail(STOPPED); });
      // As long as the edit list says, if it says.
      var cut = track.cut, seconds = cut ? Math.min(track.seconds - cut.skip, cut.keep) : track.seconds;
      out.expect(seconds * track.config.sampleRate);
      var decoder = new AudioDecoder({
        output: function(data){
          try {
            if (!failed) {
              var channels = [];
              for (var c = 0; c < data.numberOfChannels; c++) {
                var plane = new Float32Array(data.numberOfFrames);
                data.copyTo(plane, { planeIndex: c, format: 'f32-planar' });
                channels.push(plane);
              }
              out.write(A.mix(channels, opts.mono), data.sampleRate);
            }
          } catch (err) {
            fail(err);
          }
          data.close();
          resume();
        },
        error: function(){ fail(unreadable); }
      });
      decoder.ondequeue = resume;
      decoder.configure(track.config);

      function feed(){
        if (failed) return;
        if (next === track.chunks.length) {
          decoder.flush().then(function(){
            decoder.close();
            resolve(out.end());
          }, function(){ fail(unreadable); }).catch(reject);
          return;
        }
        if (out.full()) {
          // Woken when an encoder is free.
          wake = feed;
          out.onRoom = resume;
          return;
        }
        if (decoder.decodeQueueSize > QUEUE) {
          // Woken by the decoder; the timer is in case a browser sends no
          // event for this.
          wake = feed;
          setTimeout(resume, 100);
          return;
        }
        var ch = track.chunks[next++];
        read(ch.from, ch.from + ch.bytes).then(function(b){
          if (failed) return;
          for (var k = 0, at = 0; k < ch.sizes.length; at += ch.sizes[k++]) {
            decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: ch.times[k], data: b.subarray(at, at + ch.sizes[k]) }));
          }
          onProgress();
          feed();
        }).catch(function(){ fail(unreadable); });
      }
      feed();
    });
  }

  // Samples handed to a sink at a time from sound that's all in memory.
  var BLOCK = 1152 * 64;

  // Hands sound that's all in memory to the sink a block at a time, so the
  // page can show progress and stay responsive, waiting while it's full.
  function pump(channels, rate, out, onProgress){
    var total = channels[0].length, pos = 0;
    return new Promise(function(resolve){
      (function slice(){
        if (out.stopped()) return;
        var until = Date.now() + 40;
        while (pos < total && !out.full() && Date.now() < until) {
          var end = Math.min(total, pos + BLOCK);
          out.write(channels.map(function(c){ return c.subarray(pos, end); }), rate);
          pos = end;
        }
        onProgress();
        if (pos >= total) resolve(out.end());
        else if (out.full()) out.onRoom = slice;
        else nextTick(slice);
      })();
    });
  }

  // Decodes the whole sound at once: for files that aren't MP4, and for
  // browsers without WebCodecs. From an MP4 only the audio track is read.
  function whole(f, track, opts, out, unreadable, onProgress){
    return (track ? track.audioOnly() : readBytes(f.file)).then(function(b){ return b.buffer || b; })
      .then(decode).catch(function(){ throw unreadable; }).then(function(audio){
        var channels = [];
        for (var c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c));
        out.expect(audio.length);
        return pump(A.mix(channels, opts.mono), audio.sampleRate, out, onProgress);
      });
  }

  // Keeps the screen on while converting, where the browser can (the
  // Screen Wake Lock API): a phone that locks itself pauses the page, and
  // the converting with it. The browser lets go whenever the page is
  // hidden, so it's asked again on coming back. awake is how it went, for
  // the report: whether the screen was kept on, and for how long (ms) the
  // page was hidden.
  var lock = null, hiddenAt = 0, awake = { on: false, hidden: 0 };
  function wake(){
    if (!navigator.wakeLock) return Promise.resolve();
    return navigator.wakeLock.request('screen').then(function(l){
      lock = l;
      awake.on = true;
      if (!busy) sleep();
    }, function(){});
  }
  function sleep(){
    if (lock) Promise.resolve(lock.release()).catch(function(){});
    lock = null;
  }
  function hidden(){
    if (hiddenAt) awake.hidden += Date.now() - hiddenAt;
    hiddenAt = document.hidden ? Date.now() : 0;
  }
  document.addEventListener('visibilitychange', function(){
    if (!busy) return;
    hidden();
    if (!document.hidden) wake();
  });

  // The conversion under way: halt() stops it at once, and stoppers are
  // what then closes its decoder and workers. They're also run when it
  // ends.
  var STOPPED = {}, halt = null, stoppers = [];

  function convert(f, opts){
    f.state = 'working';
    f.progress = 0;
    f.started = Date.now();
    render();
    var unreadable = {}, read = reader(f.file), out = null, lame;
    // How much of the sound is encoded (or written, for WAV), as the sink
    // says.
    function progress(){
      f.progress = out ? out.progress() : 0;
      showMeta(f);
    }
    var streams = false, live = true, stopped = new Promise(function(resolve, reject){
      halt = function(){
        live = false;
        reject(STOPPED);
      };
    });
    var work = loadEncoder(opts).then(function(l){
      lame = l;
      return A.mp4(read, f.file.size).catch(function(){ throw unreadable; });
    }).then(function(track){
      return canStream(track, opts).then(function(ok){
        // Stopped while the file was being opened: start nothing.
        if (!live) throw STOPPED;
        streams = ok;
        var cut = ok ? track.cut : null;
        out = lame ? mp3Sink(opts, lame.module, lame.enc, cut, function(){ progress(); }) : wavSink(cut);
        stoppers.push(out.stop);
        return Promise.race([ok ? streamed(track, read, opts, out, unreadable, progress) : whole(f, track, opts, out, unreadable, progress), out.broken]);
      });
    });
    return Promise.race([work, stopped]).then(function(result){
      var blob = new Blob(result.parts, { type: TYPES[opts.format] });
      f.url = URL.createObjectURL(blob);
      f.out = A.outName(f.file.name, opts.format);
      f.outSize = blob.size;
      f.seconds = result.frames / result.rate;
      f.state = 'done';
      // The rest of the report (awake) is filled in as converting ends.
      f.report = {
        took: Date.now() - f.started, seconds: f.seconds, whole: !streams,
        size: fmtSize(blob.size), format: opts.format, kbps: opts.kbps, channels: result.channels,
        rate: result.mp3 ? result.mp3.rate : result.rate, mp3: result.mp3 || null,
        cores: navigator.hardwareConcurrency || 0, awake: awake
      };
      if (result.mp3) f.report.mp3.pieces = result.mp3.pieces.map(function(n){ return n / result.rate; });
    }).catch(function(err){
      if (err === STOPPED) {
        f.state = 'ready';
        f.progress = 0;
        return;
      }
      f.state = 'error';
      f.error = err === unreadable ? t('No audio your browser can read in this file')
        : t('Couldn’t convert: {error}', { error: err && err.message ? err.message : err });
    }).then(function(){
      halt = null;
      stoppers.splice(0).forEach(function(stop){ stop(); });
    });
  }

  convertBtn.addEventListener('click', function(){
    var f = current;
    if (busy || !f || f.state !== 'ready') return;
    busy = true;
    stopping = false;
    say('');
    convertLabel.textContent = t('Converting…');
    awake = { on: false, hidden: 0 };
    hiddenAt = document.hidden ? Date.now() : 0;
    wake().then(function(){
      if (busy) awakeNote.textContent = awake.on ? t('The screen stays on until converting is done.') : t('Keep the screen on: converting pauses if the phone locks.');
    });
    convert(f, settings()).then(function(){
      hidden();
      hiddenAt = 0;
      sleep();
      busy = false;
      render();
      if (stopping) say(t('Stopped.'));
      else if (f.state === 'done') say(t('Done.'));
      else say(t('This file couldn’t be converted. Your browser may not support its audio format.'), true);
      var dl = list.querySelector('.dl');
      if (dl) dl.focus();
      else if (stopping) convertBtn.focus();
    });
  });

  stopBtn.addEventListener('click', function(){
    stopping = true;
    stopBtn.disabled = true;
    if (halt) halt();
  });

  // Different settings make an earlier result stale.
  form.addEventListener('change', function(){
    if (current) reset(current);
    render();
    say('');
  });

  picker.addEventListener('change', function(){
    openFile(picker.files);
    picker.value = '';
  });
  T.onFileDrop(drop, openFile);

  render();
})();
