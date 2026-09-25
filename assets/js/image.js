// Image compressor (compress-image). The browser decodes each image and a
// canvas saves it again at the chosen format, quality and size, so nothing
// is uploaded. The rules for names, sizes and formats live in image-core.js.
(function(){
  var T = window.bdnixPdf, I = window.bdnixImage;
  var fmtSize = T.fmtSize, plural = T.plural;

  var drop = document.getElementById('drop');
  var picker = document.getElementById('picker');
  var msg = document.getElementById('msg');
  var wrap = document.getElementById('filesWrap');
  var form = document.getElementById('settings');
  var qualityField = document.getElementById('qualityField');
  var qualityOut = document.getElementById('qualityOut');
  var hint = document.getElementById('hint');
  var list = document.getElementById('list');
  var summary = document.getElementById('summary');
  var clearBtn = document.getElementById('clearBtn');
  var compressBtn = document.getElementById('compressBtn');
  var compressLabel = document.getElementById('compressLabel');

  document.getElementById('year').textContent = new Date().getFullYear();

  // Each entry: { id, file, thumb, state, error, url, out, outSize, width,
  // height, kept }. state is 'ready', 'working', 'done' or 'error'.
  var files = [];
  var nextId = 1;
  var busy = false;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function settings(){
    return { format: form.elements.format.value, quality: +form.elements.quality.value, longest: +form.elements.longest.value };
  }

  // Drops a compressed file, so the entry can be compressed again.
  function reset(f){
    if (f.url) URL.revokeObjectURL(f.url);
    f.url = null;
    if (f.state === 'done') f.state = 'ready';
  }

  function forget(f){
    reset(f);
    URL.revokeObjectURL(f.thumb);
  }

  function addFiles(fileList){
    if (busy) return;
    var incoming = Array.prototype.slice.call(fileList);
    var skipped = incoming.filter(function(f){ return !I.isImage(f); });
    incoming.filter(I.isImage).forEach(function(file){
      files.push({ id: nextId++, file: file, thumb: URL.createObjectURL(file), state: 'ready' });
    });
    render();
    if (skipped.length) {
      say('Skipped: ' + skipped.map(function(f){ return f.name; }).join(', ') + (skipped.length === 1 ? ' isn’t an image.' : ' aren’t images.'), true);
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

      var img = document.createElement('img');
      img.className = 'thumb';
      img.alt = '';
      img.src = f.thumb;
      // A format the browser can't show gets a blank tile instead.
      img.onerror = function(){ img.style.visibility = 'hidden'; };
      li.appendChild(img);

      var info = document.createElement('div');
      info.className = 'file-info';
      var name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = f.file.name;
      name.title = f.file.name;
      var meta = document.createElement('span');
      meta.className = 'file-meta';
      meta.classList.toggle('error', f.state === 'error');
      meta.textContent = describe(f);
      info.appendChild(name);
      info.appendChild(meta);
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
        forget(f);
        files.splice(i, 1);
        render();
        say('');
      });
      li.appendChild(rm);
      list.appendChild(li);
    });

    var ready = files.filter(function(f){ return f.state === 'ready'; }).length;
    summary.textContent = plural(files.length, 'image');
    if (!busy) compressLabel.textContent = ready ? 'Compress ' + plural(ready, 'image') : 'Compress';
    compressBtn.disabled = busy || !ready;
    clearBtn.disabled = busy;
    picker.disabled = busy;
    Array.prototype.forEach.call(form.elements, function(el){ el.disabled = busy; });
    showSettings();
  }

  function describe(f){
    if (f.state === 'error') return f.error;
    if (f.state === 'working') return 'Compressing…';
    if (f.state !== 'done') return fmtSize(f.file.size);
    var dims = f.width + '×' + f.height;
    if (f.kept) return dims + ' · ' + fmtSize(f.outSize) + ' · already as small as these settings allow, so it’s unchanged';
    return dims + ' · ' + fmtSize(f.file.size) + ' → ' + fmtSize(f.outSize) + ' · ' + I.saving(f.file.size, f.outSize);
  }

  // Quality only applies to JPEG and WebP. PNG is lossless, so say how a
  // PNG can be made smaller instead.
  function showSettings(){
    var s = settings();
    qualityOut.textContent = s.quality + '%';
    var targets = files.map(function(f){ return I.target(s.format, f.file); });
    qualityField.hidden = targets.every(function(t){ return t === 'png'; });
    hint.textContent = targets.indexOf('png') >= 0
      ? 'PNG keeps every pixel, so quality doesn’t apply to it. To make a PNG much smaller, choose a smaller size, or save it as JPEG or WebP.'
      : '';
  }

  function decode(f){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = f.thumb;
    });
  }

  function encode(canvas, format, quality){
    return new Promise(function(resolve){ canvas.toBlob(resolve, I.FORMATS[format].type, quality / 100); });
  }

  function compress(f, opts){
    f.state = 'working';
    render();
    var format = I.target(opts.format, f.file), unreadable = {};
    return decode(f).catch(function(){ throw unreadable; }).then(function(img){
      var size = I.fit(img.naturalWidth, img.naturalHeight, opts.longest);
      var canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      var ctx = canvas.getContext('2d');
      // JPEG has no transparency, and would turn clear areas black.
      if (format === 'jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size.width, size.height);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size.width, size.height);
      return encode(canvas, format, opts.quality).then(function(blob){
        canvas.width = canvas.height = 0;
        // Browsers that can't save a format quietly save a PNG instead.
        if (!blob || blob.type !== I.FORMATS[format].type) {
          throw new Error('your browser can’t save ' + I.FORMATS[format].name + ' images. Choose another format.');
        }
        f.kept = I.keepOriginal(f.file, format, blob.size, size.scaled);
        var out = f.kept ? f.file : blob;
        f.url = URL.createObjectURL(out);
        f.out = I.outName(f.file.name, format);
        f.outSize = out.size;
        f.width = size.width;
        f.height = size.height;
        f.state = 'done';
      });
    }).catch(function(err){
      f.state = 'error';
      f.error = err === unreadable ? 'Your browser can’t open this image'
        : 'Couldn’t compress: ' + (err && err.message ? err.message : err);
    });
  }

  compressBtn.addEventListener('click', function(){
    var todo = files.filter(function(f){ return f.state === 'ready'; });
    if (busy || !todo.length) return;
    busy = true;
    say('');
    var opts = settings();
    todo.reduce(function(chain, f, i){
      return chain.then(function(){
        compressLabel.textContent = 'Compressing ' + (i + 1) + ' of ' + todo.length + '…';
        return compress(f, opts);
      });
    }, Promise.resolve()).then(function(){
      busy = false;
      render();
      var ok = todo.filter(function(f){ return f.state === 'done'; });
      var failed = todo.length - ok.length;
      var before = 0, after = 0;
      ok.forEach(function(f){ before += f.file.size; after += f.outSize; });
      var total = ok.length ? 'Compressed ' + plural(ok.length, 'image') + ': ' + fmtSize(before) + ' → ' + fmtSize(after) + ', ' + I.saving(before, after) + '.' : '';
      if (!failed) say('Done. ' + total);
      else say((total ? total + ' ' : '') + plural(failed, 'image') + ' couldn’t be compressed.', true);
      var first = list.querySelector('.dl');
      if (first) first.focus();
    });
  });

  // Different settings make earlier results stale. Moving the quality
  // slider only updates its label until it's let go.
  form.addEventListener('input', showSettings);
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
    files.forEach(forget);
    files = [];
    render();
    say('');
  });

  render();
})();
