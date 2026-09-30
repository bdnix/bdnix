// Photo collage (photo-collage). The browser decodes each photo and a
// canvas draws them into the chosen layout, so nothing is uploaded. The
// layouts, shapes and sizes live in collage-core.js.
(function(){
  var T = window.bdnixFiles, I = window.bdnixImages, C = window.bdnixCollage;
  var fmtSize = T.fmtSize, plural = T.plural;

  function $(id){ return document.getElementById(id); }
  var drop = $('drop'), picker = $('picker'), msg = $('msg'), editor = $('editor');
  var canvas = $('previewCanvas'), note = $('previewNote');
  var summary = $('summary'), clearBtn = $('clearBtn'), tray = $('photos'), photosHint = $('photosHint');
  var form = $('settings'), layoutField = $('layoutField'), layoutsEl = $('layouts');
  var gapOut = $('gapOut'), radiusOut = $('radiusOut'), sizeHint = $('sizeHint');
  var downloadBtn = $('downloadBtn'), downloadLabel = $('downloadLabel');
  var zoomField = $('zoomField'), zoomName = $('zoomName'), zoomIn = $('zoom'), zoomOut = $('zoomOut');

  $('year').textContent = new Date().getFullYear();

  // Each entry: { id, file, src, small, tile, pos, zoom }. src is an
  // object URL of the file; small is a copy at most SMALL pixels across for
  // the preview, set once the photo is decoded; tile is its thumbnail in
  // the list; pos and zoom are which part of it shows in its box, and how
  // big (see C.cover).
  var photos = [];
  var nextId = 1;
  // The photo picked to swap with the next one tapped, or -1.
  var selected = -1;
  // The layout chosen for each number of photos, so it comes back when a
  // photo is removed and added again.
  var chosen = {};
  var busy = false;
  var saved = null;

  var SMALL = 1024, PREVIEW = 900, TILE = 112;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function settings(){
    var el = form.elements;
    return {
      layout: C.layout(photos.length, chosen[photos.length]),
      shape: el.shape.value, gap: +el.gap.value, radius: +el.radius.value,
      background: el.background.value, longest: +el.longest.value, format: el.format.value
    };
  }

  function decode(src){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Keeps a small copy of the photo for the preview, so moving a slider
  // doesn't redraw nine full-size photos.
  function load(f){
    return decode(f.src).then(function(img){
      var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, SMALL / Math.max(w, h));
      var small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(w * s));
      small.height = Math.max(1, Math.round(h * s));
      small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
      var c = I.cover(small.width, small.height);
      f.tile.getContext('2d').drawImage(small, c.x, c.y, c.size, c.size, 0, 0, TILE, TILE);
      f.small = small;
    });
  }

  function addFiles(fileList){
    if (busy) return;
    var incoming = Array.prototype.slice.call(fileList);
    var skipped = incoming.filter(function(f){ return !I.isImage(f); });
    var images = incoming.filter(I.isImage);
    var room = C.MAX - photos.length;
    var left = images.length - Math.max(0, room);
    var problems = [];
    if (skipped.length) problems.push('Skipped: ' + skipped.map(function(f){ return f.name; }).join(', ') + (skipped.length === 1 ? ' isn’t an image.' : ' aren’t images.'));
    if (left > 0) problems.push('A collage holds up to ' + C.MAX + ' photos, so ' + plural(left, 'photo') + (left === 1 ? ' was' : ' were') + ' left out.');
    images.slice(0, Math.max(0, room)).forEach(function(file){
      var f = { id: nextId++, file: file, src: URL.createObjectURL(file), small: null, pos: { x: 0.5, y: 0.5 }, zoom: 1 };
      f.tile = document.createElement('canvas');
      f.tile.width = f.tile.height = TILE;
      photos.push(f);
      load(f).then(render, function(){
        // A photo the browser can't open is taken off the list.
        remove(f);
        say('Your browser can’t open ' + file.name + '.', true);
      });
    });
    selected = -1;
    render();
    say(problems.join(' '), problems.length > 0);
  }

  function remove(f){
    var i = photos.indexOf(f);
    if (i < 0) return;
    URL.revokeObjectURL(f.src);
    photos.splice(i, 1);
    selected = -1;
    render();
  }

  // Tapping a photo picks it; tapping another swaps the two.
  function pick(i){
    if (busy) return;
    if (selected < 0) selected = i;
    else if (selected === i) selected = -1;
    else {
      var a = photos[selected];
      photos[selected] = photos[i];
      photos[i] = a;
      selected = -1;
    }
    render();
  }

  function render(){
    editor.hidden = photos.length === 0;
    summary.textContent = plural(photos.length, 'photo');
    renderTray();
    renderLayouts();
    showSettings();
    drawPreview();
    showZoom();
    var s = settings();
    var ready = !!s.layout && photos.every(function(f){ return f.small; });
    downloadBtn.disabled = busy || !ready;
    clearBtn.disabled = busy;
    picker.disabled = busy;
    Array.prototype.forEach.call(form.elements, function(el){ if (el !== downloadBtn) el.disabled = busy; });
  }

  function renderTray(){
    tray.textContent = '';
    photos.forEach(function(f, i){
      var li = document.createElement('li');
      li.className = 'photo';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-btn';
      btn.setAttribute('aria-label', 'Photo ' + (i + 1) + ': ' + f.file.name);
      btn.setAttribute('aria-pressed', String(selected === i));
      btn.title = f.file.name;
      btn.disabled = busy;
      btn.appendChild(f.tile);
      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      btn.appendChild(num);
      btn.addEventListener('click', function(){ pick(i); });
      li.appendChild(btn);

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'icon-btn rm';
      rm.setAttribute('aria-label', 'Remove ' + f.file.name);
      rm.title = 'Remove';
      rm.disabled = busy;
      rm.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
      rm.addEventListener('click', function(){
        remove(f);
        say('');
      });
      li.appendChild(rm);
      tray.appendChild(li);
    });
    photosHint.hidden = photos.length < 2;
  }

  // A choice of layouts for 3, 6 or 9 photos, each drawn as a small icon.
  var shownFor = null;
  function renderLayouts(){
    var count = photos.length, list = C.layoutsFor(count);
    layoutField.hidden = !list.length;
    if (shownFor === count) return;
    shownFor = count;
    layoutsEl.textContent = '';
    var current = C.layout(count, chosen[count]);
    list.forEach(function(l){
      var label = document.createElement('label');
      label.className = 'layout-opt';
      label.title = l.name;
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'layout';
      input.value = l.id;
      input.checked = l === current;
      input.setAttribute('aria-label', l.name);
      var rects = C.boxes(l.cells, 40, 40, 3).map(function(b){
        return '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="1.5"/>';
      }).join('');
      var span = document.createElement('span');
      span.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true">' + rects + '</svg>';
      label.appendChild(input);
      label.appendChild(span);
      layoutsEl.appendChild(label);
    });
  }

  function showSettings(){
    var s = settings(), size = C.size(s.shape, s.longest);
    gapOut.textContent = s.gap ? C.scaled(s.gap, s.longest) + ' px' : 'None';
    radiusOut.textContent = s.radius ? C.scaled(s.radius, s.longest) + ' px' : 'Square';
    sizeHint.textContent = size.width + ' × ' + size.height + ' px';
  }

  // Draws a photo into its box, cropped to fill it at `pos` and `zoom`,
  // with the corners rounded by `radius` pixels.
  function paint(ctx, box, img, width, height, radius, pos, zoom){
    var r = Math.min(radius, box.w / 2, box.h / 2);
    var c = C.cover(width, height, box.w, box.h, pos, zoom);
    ctx.save();
    if (r > 0) {
      ctx.beginPath();
      ctx.moveTo(box.x + r, box.y);
      ctx.arcTo(box.x + box.w, box.y, box.x + box.w, box.y + box.h, r);
      ctx.arcTo(box.x + box.w, box.y + box.h, box.x, box.y + box.h, r);
      ctx.arcTo(box.x, box.y + box.h, box.x, box.y, r);
      ctx.arcTo(box.x, box.y, box.x + box.w, box.y, r);
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, box.x, box.y, box.w, box.h);
    ctx.restore();
  }

  // The collage's canvas, filled with the background, and where each
  // photo goes on it.
  function frame(target, s, longest){
    var size = C.size(s.shape, longest);
    target.width = size.width;
    target.height = size.height;
    var ctx = target.getContext('2d');
    ctx.fillStyle = s.background;
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = 'high';
    return { ctx: ctx, boxes: C.boxes(s.layout.cells, size.width, size.height, C.scaled(s.gap, longest)), radius: C.scaled(s.radius, longest) };
  }

  var previewBoxes = [];
  function drawPreview(){
    var s = settings();
    var text = C.advice(photos.length);
    if (!text && !photos.every(function(f){ return f.small; })) text = 'Loading photos…';
    note.textContent = text;
    note.hidden = !text;
    canvas.hidden = !!text;
    previewBoxes = [];
    if (text) return;
    var f = frame(canvas, s, PREVIEW);
    f.boxes.forEach(function(box, i){
      paint(f.ctx, box, photos[i].small, photos[i].small.width, photos[i].small.height, f.radius, photos[i].pos, photos[i].zoom);
    });
    if (selected >= 0) {
      var b = f.boxes[selected];
      f.ctx.lineWidth = 6;
      f.ctx.strokeStyle = '#a855f7';
      f.ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    }
    previewBoxes = f.boxes;
  }

  // Zooms a photo in its box of the preview to `zoom`, about the middle of
  // what shows.
  function zoomPhoto(f, box, zoom){
    var z = C.zoomTo(f.pos, f.zoom, zoom, f.small.width, f.small.height, box.w, box.h);
    f.zoom = z.zoom;
    f.pos = z.pos;
    drawPreview();
    showZoom();
  }

  // The zoom slider is for the photo picked in the list or the preview.
  function showZoom(){
    var f = photos[selected];
    zoomField.hidden = !f || !previewBoxes.length;
    if (zoomField.hidden) return;
    zoomName.textContent = 'Zoom photo ' + (selected + 1);
    zoomIn.value = Math.round(f.zoom * 100);
    zoomOut.textContent = Math.round(f.zoom * 100) + '%';
    zoomIn.disabled = busy;
  }
  zoomIn.addEventListener('input', function(){
    var f = photos[selected];
    if (f && previewBoxes.length) zoomPhoto(f, previewBoxes[selected], zoomIn.value / 100);
  });

  // In the preview, dragging a photo moves it within its box, pinching it
  // with two fingers or turning the mouse wheel over it zooms it, and
  // tapping it without moving picks it, as in the list.
  var drag = null, fingers = {}, NUDGE = 5;
  function point(e){
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * canvas.width / rect.width, y: (e.clientY - rect.top) * canvas.height / rect.height, scale: canvas.width / rect.width };
  }
  function held(){
    return Object.keys(fingers).map(function(id){ return fingers[id]; });
  }
  function apart(){
    var p = held();
    return Math.max(1, Math.sqrt(Math.pow(p[0].x - p[1].x, 2) + Math.pow(p[0].y - p[1].y, 2)));
  }
  canvas.addEventListener('pointerdown', function(e){
    if (busy) return;
    var p = point(e);
    if (drag) {
      // A second finger on the photo being dragged starts a pinch.
      if (held().length !== 1) return;
      fingers[e.pointerId] = p;
      drag.moved = true;
      drag.pinch = { apart: apart(), zoom: photos[drag.i].zoom };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button > 0) return;
    var i = C.hit(previewBoxes, p.x, p.y);
    if (i < 0) return;
    fingers = {};
    fingers[e.pointerId] = p;
    drag = { i: i, x: p.x, y: p.y, pos: photos[i].pos, box: previewBoxes[i], moved: false, pinch: null };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function(e){
    if (!drag || !fingers[e.pointerId]) return;
    var p = point(e), f = photos[drag.i];
    fingers[e.pointerId] = p;
    if (drag.pinch) {
      if (held().length === 2) zoomPhoto(f, drag.box, drag.pinch.zoom * apart() / drag.pinch.apart);
      return;
    }
    var dx = p.x - drag.x, dy = p.y - drag.y;
    if (!drag.moved && Math.max(Math.abs(dx), Math.abs(dy)) < NUDGE * p.scale) return;
    drag.moved = true;
    f.pos = C.pan(drag.pos, f.small.width, f.small.height, drag.box.w, drag.box.h, dx, dy, f.zoom);
    drawPreview();
  });
  function lift(e){
    if (!drag || !fingers[e.pointerId]) return;
    delete fingers[e.pointerId];
    var left = held();
    if (left.length) {
      // One finger of a pinch lifted: the other drags on from where it is.
      drag.pinch = null;
      drag.x = left[0].x;
      drag.y = left[0].y;
      drag.pos = photos[drag.i].pos;
      return;
    }
    var d = drag;
    drag = null;
    if (!d.moved && e.type === 'pointerup') pick(d.i);
  }
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  canvas.addEventListener('wheel', function(e){
    if (busy || drag) return;
    var p = point(e), i = C.hit(previewBoxes, p.x, p.y);
    if (i < 0) return;
    e.preventDefault();
    // Scrolling down zooms out; a notch of the wheel is about 100.
    var dy = e.deltaMode ? e.deltaY * 33 : e.deltaY;
    zoomPhoto(photos[i], previewBoxes[i], photos[i].zoom * Math.pow(2, -dy / 500));
  }, { passive: false });

  // The full-size collage decodes each photo again, one at a time, so
  // nine phone photos aren't all held in memory at full size at once.
  function make(s){
    var out = document.createElement('canvas');
    var f = frame(out, s, s.longest);
    return f.boxes.reduce(function(chain, box, i){
      return chain.then(function(){
        return decode(photos[i].src).then(function(img){
          paint(f.ctx, box, img, img.naturalWidth, img.naturalHeight, f.radius, photos[i].pos, photos[i].zoom);
        });
      });
    }, Promise.resolve()).then(function(){
      return new Promise(function(resolve){ out.toBlob(resolve, C.FORMATS[s.format].type, 0.92); });
    }).then(function(blob){
      var size = { width: out.width, height: out.height };
      out.width = out.height = 0;
      if (!blob || blob.type !== C.FORMATS[s.format].type) throw new Error('your browser couldn’t save it. Try a smaller size.');
      return { blob: blob, size: size };
    });
  }

  downloadBtn.addEventListener('click', function(){
    var s = settings();
    if (busy || !s.layout) return;
    busy = true;
    render();
    downloadLabel.textContent = 'Making collage…';
    say('');
    make(s).then(function(r){
      if (saved) URL.revokeObjectURL(saved);
      saved = URL.createObjectURL(r.blob);
      var name = C.outName(s.format);
      var a = document.createElement('a');
      a.href = saved;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      say('Saved ' + name + ': ' + r.size.width + ' × ' + r.size.height + ' px, ' + fmtSize(r.blob.size) + '.');
    }, function(err){
      say('Couldn’t make the collage: ' + (err && err.message ? err.message : 'one of the photos couldn’t be opened.'), true);
    }).then(function(){
      busy = false;
      downloadLabel.textContent = 'Download collage';
      render();
    });
  });

  form.addEventListener('input', function(e){
    if (e.target.name === 'layout') chosen[photos.length] = e.target.value;
    showSettings();
    drawPreview();
  });
  form.addEventListener('submit', function(e){ e.preventDefault(); });

  picker.addEventListener('change', function(){
    addFiles(picker.files);
    picker.value = '';
  });
  T.onFileDrop(drop, addFiles);

  clearBtn.addEventListener('click', function(){
    photos.forEach(function(f){ URL.revokeObjectURL(f.src); });
    photos = [];
    selected = -1;
    render();
    say('');
  });

  render();
})();
