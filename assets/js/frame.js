// Fit to Frame (fit-to-frame). The browser decodes each image and a canvas
// draws it in the middle of a frame of the chosen shape and colour, then
// saves it, so nothing is uploaded. Where the image goes is worked out in
// frame-core.js; formats and file names come from image-core.js.
(function(){
  var T = window.bdnixFiles, I = window.bdnixImages, F = window.bdnixFrame;
  var fmtSize = T.fmtSize, plural = T.plural;

  var drop = document.getElementById('drop');
  var picker = document.getElementById('picker');
  var msg = document.getElementById('msg');
  var wrap = document.getElementById('filesWrap');
  var form = document.getElementById('settings');
  var shape = document.getElementById('shape');
  var widthIn = document.getElementById('width');
  var heightIn = document.getElementById('height');
  var dimsHint = document.getElementById('dimsHint');
  var exactLabel = document.getElementById('exactLabel');
  var swatches = document.getElementById('swatches');
  var colorIn = document.getElementById('color');
  var marginOut = document.getElementById('marginOut');
  var canvas = document.getElementById('previewCanvas');
  var note = document.getElementById('previewNote');
  var previewSize = document.getElementById('previewSize');
  var nav = document.getElementById('previewNav');
  var prevBtn = document.getElementById('prevImage');
  var nextBtn = document.getElementById('nextImage');
  var imageLabel = document.getElementById('imageLabel');
  var list = document.getElementById('list');
  var summary = document.getElementById('summary');
  var clearBtn = document.getElementById('clearBtn');
  var fitBtn = document.getElementById('fitBtn');
  var fitLabel = document.getElementById('fitLabel');

  document.getElementById('year').textContent = new Date().getFullYear();

  // JPEG and WebP are saved at this quality: high, since the point is a
  // better-fitting image, not a smaller one.
  var QUALITY = 92;
  // The preview's longest side, in canvas pixels.
  var PREVIEW = 640;

  // Each entry: { id, file, src, tile, state, error, url, out, outSize,
  // width, height }. src is an object URL of the file; tile is its
  // thumbnail. state is 'ready', 'working', 'done' or 'error'.
  var files = [];
  var nextId = 1;
  var busy = false;
  // The entry shown in the preview, and its decoded image once loaded.
  var current = 0;
  var shown = null;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  // The chosen settings. width or height is null while what's typed isn't
  // a size.
  function settings(){
    var el = form.elements;
    return {
      width: F.side(el.width.value), height: F.side(el.height.value),
      exact: el.size.value === 'exact', color: el.color.value,
      margin: +el.margin.value, format: el.format.value
    };
  }

  function layoutOf(img, s){
    return F.layout(img.naturalWidth, img.naturalHeight, s.width, s.height, { exact: s.exact, margin: s.margin, area: I.MAX_AREA });
  }

  // Draws img framed as layout L on a canvas, scaled by k (1 for the
  // saved image, less for the preview).
  function paint(c, img, L, color, k){
    c.width = Math.max(1, Math.round(L.width * k));
    c.height = Math.max(1, Math.round(L.height * k));
    var ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, L.x * k, L.y * k, L.w * k, L.h * k);
  }

  // Drops a framed file, so the entry can be framed again.
  function reset(f){
    if (f.url) URL.revokeObjectURL(f.url);
    f.url = null;
    if (f.state === 'done') f.state = 'ready';
  }

  function forget(f){
    reset(f);
    URL.revokeObjectURL(f.src);
    if (shown && shown.f === f) shown = null;
  }

  function decode(f){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = f.src;
    });
  }

  // Thumbnails are drawn small on a canvas, so a list of big photos doesn't
  // keep every one of them on the page at full size.
  var TILE = 88;
  function thumbnail(f){
    var tile = document.createElement('canvas');
    tile.className = 'thumb';
    tile.width = tile.height = TILE;
    decode(f).then(function(img){
      var c = I.cover(img.naturalWidth, img.naturalHeight);
      tile.getContext('2d').drawImage(img, c.x, c.y, c.size, c.size, 0, 0, TILE, TILE);
    }, function(){
      // A format the browser can't show gets a blank tile instead.
      tile.style.visibility = 'hidden';
    });
    return tile;
  }

  function addFiles(fileList){
    if (busy) return;
    var incoming = Array.prototype.slice.call(fileList);
    var skipped = incoming.filter(function(f){ return !I.isImage(f); });
    var first = files.length;
    incoming.filter(I.isImage).forEach(function(file){
      var f = { id: nextId++, file: file, src: URL.createObjectURL(file), state: 'ready' };
      f.tile = thumbnail(f);
      files.push(f);
    });
    // Show the first of the new images.
    if (files.length > first) current = first;
    render();
    preview();
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
      li.classList.toggle('current', i === current);

      // Clicking a thumbnail shows that image in the preview.
      var pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'thumb-btn';
      pick.setAttribute('aria-label', 'Preview ' + f.file.name);
      pick.appendChild(f.tile);
      pick.addEventListener('click', function(){ show(i); });
      li.appendChild(pick);

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
        if (current > i || current >= files.length) current = Math.max(0, current - 1);
        render();
        preview();
        say('');
      });
      li.appendChild(rm);
      list.appendChild(li);
    });

    var s = settings();
    var valid = s.width && s.height;
    var ready = files.filter(function(f){ return f.state === 'ready'; }).length;
    summary.textContent = plural(files.length, 'image');
    if (!busy) fitLabel.textContent = ready ? 'Fit ' + plural(ready, 'image') : 'Fit to frame';
    fitBtn.disabled = busy || !ready || !valid;
    clearBtn.disabled = busy;
    picker.disabled = busy;
    Array.prototype.forEach.call(form.elements, function(el){ el.disabled = busy; });
    nav.hidden = files.length < 2;
    imageLabel.textContent = 'Image ' + (current + 1) + ' of ' + files.length;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current >= files.length - 1;
  }

  function describe(f){
    if (f.state === 'error') return f.error;
    if (f.state === 'working') return 'Fitting…';
    if (f.state !== 'done') return fmtSize(f.file.size);
    return f.width + '×' + f.height + ' · ' + fmtSize(f.outSize);
  }

  // Updates the labels and marks what's wrong with the size typed in.
  function showSettings(){
    var s = settings();
    marginOut.textContent = s.margin + '%';
    widthIn.classList.toggle('invalid', !s.width);
    heightIn.classList.toggle('invalid', !s.height);
    dimsHint.textContent = s.width && s.height ? '' : 'Width and height are whole numbers of pixels, from 1 to ' + F.MAX_SIDE + '.';
    dimsHint.classList.toggle('error', !(s.width && s.height));
    exactLabel.textContent = s.width && s.height ? 'Exactly ' + s.width + ' × ' + s.height : 'Exact size';
    Array.prototype.forEach.call(swatches.querySelectorAll('button'), function(b){
      var on = b.getAttribute('data-color') === s.color;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    fitBtn.disabled = busy || !(s.width && s.height) || !files.some(function(f){ return f.state === 'ready'; });
  }

  function show(i){
    if (i < 0 || i >= files.length || i === current) return;
    current = i;
    render();
    preview();
  }

  // Draws the current image with the current settings. The decoded image
  // is kept for as long as it's the one shown, so settings redraw at once.
  function preview(){
    var f = files[current];
    if (!f) return;
    var s = settings();
    if (!s.width || !s.height) return;
    if (shown && shown.f === f) {
      if (!shown.img) return;
      var L = layoutOf(shown.img, s);
      paint(canvas, shown.img, L, s.color, Math.min(1, PREVIEW / Math.max(L.width, L.height)));
      canvas.hidden = false;
      note.hidden = true;
      previewSize.textContent = L.width + ' × ' + L.height + ' px';
      return;
    }
    shown = { f: f, img: null };
    canvas.hidden = true;
    note.hidden = false;
    note.textContent = 'Loading preview…';
    previewSize.textContent = '';
    decode(f).then(function(img){
      if (!shown || shown.f !== f) return;
      shown.img = img;
      preview();
    }, function(){
      if (!shown || shown.f !== f) return;
      note.textContent = 'Your browser can’t open this image';
    });
  }

  function encode(c, format){
    return new Promise(function(resolve){ c.toBlob(resolve, I.FORMATS[format].type, QUALITY / 100); });
  }

  function fit(f, s){
    f.state = 'working';
    render();
    var format = I.target(s.format, f.file), unreadable = {};
    return decode(f).catch(function(){ throw unreadable; }).then(function(img){
      var L = layoutOf(img, s);
      var c = document.createElement('canvas');
      paint(c, img, L, s.color, 1);
      return encode(c, format).then(function(blob){
        c.width = c.height = 0;
        // Browsers that can't save a format quietly save a PNG instead.
        if (!blob || blob.type !== I.FORMATS[format].type) {
          throw new Error('your browser can’t save ' + I.FORMATS[format].name + ' images. Choose another format.');
        }
        f.url = URL.createObjectURL(blob);
        f.out = I.outName(f.file.name, format, 'framed');
        f.outSize = blob.size;
        f.width = L.width;
        f.height = L.height;
        f.state = 'done';
      });
    }).catch(function(err){
      f.state = 'error';
      f.error = err === unreadable ? 'Your browser can’t open this image'
        : 'Couldn’t fit: ' + (err && err.message ? err.message : err);
    });
  }

  fitBtn.addEventListener('click', function(){
    var s = settings();
    var todo = files.filter(function(f){ return f.state === 'ready'; });
    if (busy || !todo.length || !s.width || !s.height) return;
    busy = true;
    say('');
    todo.reduce(function(chain, f, i){
      return chain.then(function(){
        fitLabel.textContent = 'Fitting ' + (i + 1) + ' of ' + todo.length + '…';
        return fit(f, s);
      });
    }, Promise.resolve()).then(function(){
      busy = false;
      render();
      var ok = todo.filter(function(f){ return f.state === 'done'; }).length;
      var failed = todo.length - ok;
      var done = ok ? plural(ok, 'image') + ' ready to download.' : '';
      if (!failed) say('Done. ' + done);
      else say((done ? done + ' ' : '') + plural(failed, 'image') + ' couldn’t be fitted.', true);
      var first = list.querySelector('.dl');
      if (first) first.focus();
    });
  });

  // A preset fills in its size; typing a size picks the preset it matches.
  form.addEventListener('input', function(e){
    var t = e.target;
    if (t === shape && Object.prototype.hasOwnProperty.call(F.SHAPES, shape.value)) {
      widthIn.value = F.SHAPES[shape.value].width;
      heightIn.value = F.SHAPES[shape.value].height;
    } else if (t === widthIn || t === heightIn) {
      var s = settings();
      shape.value = s.width && s.height ? F.shapeOf(s.width, s.height) : 'custom';
    }
    showSettings();
    preview();
  });
  // Different settings make earlier results stale.
  form.addEventListener('change', function(){
    files.forEach(reset);
    render();
    showSettings();
    say('');
  });
  // Pressing Enter in the width or height doesn't reload the page.
  form.addEventListener('submit', function(e){ e.preventDefault(); });

  swatches.addEventListener('click', function(e){
    var b = e.target.closest('button[data-color]');
    if (!b || busy) return;
    colorIn.value = b.getAttribute('data-color');
    colorIn.dispatchEvent(new Event('input', { bubbles: true }));
    colorIn.dispatchEvent(new Event('change', { bubbles: true }));
  });

  prevBtn.addEventListener('click', function(){ show(current - 1); });
  nextBtn.addEventListener('click', function(){ show(current + 1); });

  picker.addEventListener('change', function(){
    addFiles(picker.files);
    picker.value = '';
  });
  T.onFileDrop(drop, addFiles);

  clearBtn.addEventListener('click', function(){
    files.forEach(forget);
    files = [];
    current = 0;
    shown = null;
    render();
    say('');
  });

  render();
  showSettings();
})();
