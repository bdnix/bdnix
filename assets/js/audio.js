// Audio converter (mp4-to-mp3). The browser decodes each file's audio and
// lamejs encodes the MP3, so nothing is uploaded. The encoding itself lives
// in audio-core.js.
(function(){
  var T = window.bdnixPdf, A = window.bdnixAudio;
  var fmtSize = T.fmtSize, plural = T.plural, readBytes = T.readBytes;

  // Decoded audio is resampled to this rate, which MP3 and WAV both suit.
  var RATE = 44100;
  var TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav' };

  var drop = document.getElementById('drop');
  var picker = document.getElementById('picker');
  var msg = document.getElementById('msg');
  var wrap = document.getElementById('filesWrap');
  var form = document.getElementById('settings');
  var qualityField = document.getElementById('qualityField');
  var list = document.getElementById('list');
  var summary = document.getElementById('summary');
  var clearBtn = document.getElementById('clearBtn');
  var convertBtn = document.getElementById('convertBtn');
  var convertLabel = document.getElementById('convertLabel');

  document.getElementById('year').textContent = new Date().getFullYear();

  // Each entry: { id, file, state, progress, error, url, out, outSize, seconds }
  // state is 'ready', 'working', 'done' or 'error'.
  var files = [];
  var nextId = 1;
  var busy = false;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function settings(){
    return { format: form.elements.format.value, kbps: +form.elements.kbps.value, mono: form.elements.channels.value === 'mono' };
  }

  // Drops a converted file, so the entry can be converted again.
  function reset(f){
    if (f.url) URL.revokeObjectURL(f.url);
    f.url = null;
    if (f.state === 'done') f.state = 'ready';
  }

  function addFiles(fileList){
    if (busy) return;
    var incoming = Array.prototype.slice.call(fileList);
    var skipped = incoming.filter(function(f){ return !A.isMedia(f); });
    incoming.filter(A.isMedia).forEach(function(file){
      files.push({ id: nextId++, file: file, state: 'ready', progress: 0 });
    });
    render();
    if (skipped.length) {
      say('Skipped: ' + skipped.map(function(f){ return f.name; }).join(', ') + (skipped.length === 1 ? ' isn’t' : ' aren’t') + ' a video or audio file.', true);
    } else {
      say('');
    }
  }

  function render(){
    wrap.hidden = files.length === 0;
    list.textContent = '';
    files.forEach(function(f, i){
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
        a.href = f.url;
        a.download = f.out;
        a.setAttribute('aria-label', 'Download ' + f.out);
        a.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7l4 4 4-4M2 14h12"/></svg><span>Download</span>';
        li.appendChild(a);
      }

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'icon-btn rm';
      rm.setAttribute('aria-label', 'Remove ' + f.file.name);
      rm.title = 'Remove';
      rm.disabled = busy;
      rm.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
      rm.addEventListener('click', function(){
        reset(f);
        files.splice(i, 1);
        render();
        say('');
      });
      li.appendChild(rm);
      list.appendChild(li);
    });

    var ready = files.filter(function(f){ return f.state === 'ready'; }).length;
    summary.textContent = plural(files.length, 'file');
    if (!busy) convertLabel.textContent = ready ? 'Convert ' + plural(ready, 'file') : 'Convert';
    convertBtn.disabled = busy || !ready;
    clearBtn.disabled = busy;
    picker.disabled = busy;
    Array.prototype.forEach.call(form.elements, function(el){ el.disabled = busy; });
    qualityField.hidden = settings().format !== 'mp3';
  }

  function showMeta(f){
    var meta = f.meta;
    meta.classList.toggle('error', f.state === 'error');
    if (f.state === 'error') meta.textContent = f.error;
    else if (f.state === 'working') meta.textContent = 'Converting… ' + Math.floor(f.progress * 100) + '%';
    else if (f.state === 'done') meta.textContent = A.fmtTime(f.seconds) + ' · ' + f.out + ' · ' + fmtSize(f.outSize);
    else meta.textContent = fmtSize(f.file.size);
    f.bar.style.setProperty('--p', f.progress);
  }

  // Only the audio of an MP4 or MOV is read, so a long phone video doesn't
  // have to fit in memory. Other files are read whole.
  function audioData(file){
    return A.audioOnly(function(from, to){
      return readBytes(file.slice(from, to)).then(function(b){ return new Uint8Array(b); });
    }, file.size).then(function(bytes){ return bytes ? bytes.buffer : readBytes(file); });
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

  function encode(job, onProgress){
    return new Promise(function(resolve){
      (function slice(){
        var until = Date.now() + 40;
        while (!job.done && Date.now() < until) job.step(1152 * 16);
        onProgress(job.progress);
        if (job.done) resolve(job.parts);
        else nextTick(slice);
      })();
    });
  }

  function convert(f, opts){
    f.state = 'working';
    f.progress = 0;
    render();
    var unreadable = {};
    return audioData(f.file).then(decode).catch(function(){ throw unreadable; }).then(function(audio){
      var channels = [];
      for (var c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c));
      var job = A.encoder(A.mix(channels, opts.mono), audio.sampleRate, opts, window.lamejs);
      return encode(job, function(p){ f.progress = p; showMeta(f); }).then(function(parts){
        var blob = new Blob(parts, { type: TYPES[opts.format] });
        f.url = URL.createObjectURL(blob);
        f.out = A.outName(f.file.name, opts.format);
        f.outSize = blob.size;
        f.seconds = audio.duration;
        f.state = 'done';
      });
    }).catch(function(err){
      f.state = 'error';
      f.error = err === unreadable ? 'No audio your browser can read in this file'
        : 'Couldn’t convert: ' + (err && err.message ? err.message : err);
    });
  }

  convertBtn.addEventListener('click', function(){
    var todo = files.filter(function(f){ return f.state === 'ready'; });
    if (busy || !todo.length) return;
    busy = true;
    say('');
    var opts = settings();
    todo.reduce(function(chain, f, i){
      return chain.then(function(){
        convertLabel.textContent = 'Converting ' + (i + 1) + ' of ' + todo.length + '…';
        return convert(f, opts);
      });
    }, Promise.resolve()).then(function(){
      busy = false;
      render();
      var failed = todo.filter(function(f){ return f.state === 'error'; }).length;
      var done = todo.length - failed;
      if (!failed) say('Done. Converted ' + plural(done, 'file') + '.');
      else say((done ? 'Converted ' + plural(done, 'file') + '. ' : '') + plural(failed, 'file') + ' couldn’t be converted. Your browser may not support ' + (failed === 1 ? 'its' : 'their') + ' audio format.', true);
      var first = list.querySelector('.dl');
      if (first) first.focus();
    });
  });

  // Different settings make earlier results stale.
  form.addEventListener('change', function(){
    files.forEach(reset);
    render();
    say('');
  });

  picker.addEventListener('change', function(){
    addFiles(picker.files);
    picker.value = '';
  });
  T.onFileDrop(drop, addFiles);

  clearBtn.addEventListener('click', function(){
    files.forEach(reset);
    files = [];
    render();
    say('');
  });

  render();
})();
