// PDF signing tool. A signature is drawn on a pad, typed in a handwriting
// font or taken from a picture, and kept as a PNG with a see-through
// background. pdf.js draws the pages so the visitor can put signatures on
// them; pdf-lib stamps them into the file. Everything runs in the browser;
// nothing is uploaded.
(function(){
  var T = window.bdnixFiles, P = window.bdnixPdf;
  var S = window.bdnixSign;
  function $(id){ return document.getElementById(id); }

  var drop = $('drop'), picker = $('picker');
  var fileBar = $('fileBar'), fileName = $('fileName'), fileMeta = $('fileMeta'), changeBtn = $('changeBtn');
  var msg = $('msg'), editor = $('editor');
  var stage = $('stage'), sheet = $('sheet'), canvas = $('pageCanvas'), layer = $('layer'), note = $('previewNote');
  var prevBtn = $('prevPage'), nextBtn = $('nextPage'), pageLabel = $('pageLabel');
  var modes = $('modes'), forDraw = $('forDraw'), forType = $('forType'), forImage = $('forImage'), inks = $('inks');
  var pad = $('pad'), padClear = $('padClear');
  var typed = $('typed'), fonts = $('fonts');
  var imagePicker = $('imagePicker'), imageName = $('imageName'), clearBg = $('clearBg');
  var addBtn = $('addBtn'), addHint = $('addHint');
  var sigList = $('sigList'), sigNone = $('sigNone'), remember = $('remember');
  var selectedBox = $('selected'), sizeRange = $('sizeRange'), sizeOut = $('sizeOut');
  var angleRange = $('angleRange'), angleOut = $('angleOut'), everyBtn = $('everyBtn'), removeBtn = $('removeBtn');
  var summary = $('summary'), clearBtn = $('clearBtn');
  var applyBtn = $('applyBtn'), applyLabel = $('applyLabel');
  var downloadBtn = $('downloadBtn'), downloadLabel = $('downloadLabel');

  $('year').textContent = new Date().getFullYear();

  // src: { name, bytes, pages, views: [{ box, rot, vw, vh }], view (pdf.js) and its viewTask }
  var src = null;
  // The visitor's signatures: { id, png (bytes), w, h, url, n }.
  var sigs = [];
  var sigCount = 0;
  // Signatures on the pages: { sig, page, x, y, w, angle } (see sign-core.js).
  var placed = [];
  var selected = null;
  var busy = false;
  var resultUrl = null;
  var pageIndex = 0;
  var image = null;   // the picture chosen in Image mode, a File

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function hint(text, isError){
    addHint.textContent = text || '';
    addHint.hidden = !text;
    addHint.classList.toggle('error', !!isError);
  }

  function errText(err){ return err && err.message ? err.message : String(err); }

  function mode(){ return modes.querySelector('input:checked').value; }
  function ink(){ return inks.querySelector('input:checked').value; }
  function font(){ return fonts.querySelector('input:checked').value; }

  function pagesWith(){
    return placed.reduce(function(list, p){
      if (list.indexOf(p.page) < 0) list.push(p.page);
      return list;
    }, []);
  }

  function canAdd(){
    var m = mode();
    if (m === 'draw') return strokes.length > 0;
    if (m === 'type') return !!S.cleanName(typed.value);
    return !!image;
  }

  function syncUi(){
    var n = placed.length;
    summary.textContent = n ? T.plural(n, 'signature') + ' on ' + T.plural(pagesWith().length, 'page') : 'Nothing placed yet';
    clearBtn.disabled = busy || !n;
    applyBtn.disabled = busy || !src || !n;
    addBtn.disabled = busy || !src || !canAdd();
    padClear.disabled = !strokes.length;
    sigNone.hidden = sigs.length > 0;
    selectedBox.hidden = !selected;
    if (selected) {
      sizeRange.value = Math.round(selected.w * 100);
      sizeOut.textContent = Math.round(selected.w * 100) + '%';
      angleRange.value = Math.round(selected.angle);
      angleOut.textContent = Math.round(selected.angle) + '°';
      everyBtn.disabled = busy || !src || src.pages < 2;
    }
  }

  function clearResult(){
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    downloadBtn.hidden = true;
    downloadBtn.removeAttribute('href');
  }

  function changed(){
    clearResult();
    drawPlaced();
    syncUi();
  }

  // ---- Making a signature ----
  function showMode(){
    var m = mode();
    forDraw.hidden = m !== 'draw';
    forType.hidden = m !== 'type';
    forImage.hidden = m !== 'image';
    inks.hidden = m === 'image';
    hint('');
    if (m === 'draw') sizePad();
    syncUi();
  }
  modes.addEventListener('change', showMode);

  // The pad keeps each stroke as points, in fractions of the pad's width,
  // so it can be redrawn crisply at any size.
  var strokes = [], stroke = null;
  var LINE = 2.6;   // pen width in CSS pixels

  function drawStrokes(ctx, scale, color){
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = LINE * scale / pad.clientWidth;
    ctx.lineCap = ctx.lineJoin = 'round';
    strokes.forEach(function(pts){
      var p = pts.map(function(q){ return [q[0] * scale, q[1] * scale]; });
      if (p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0][0], p[0][1], ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      S.smooth(p).forEach(function(c){ ctx.quadraticCurveTo(c.cx, c.cy, c.x, c.y); });
      ctx.stroke();
    });
  }

  function drawPad(){
    if (!pad.clientWidth) return;
    var ctx = pad.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pad.width, pad.height);
    drawStrokes(ctx, pad.width, ink());
  }

  function sizePad(){
    var w = pad.clientWidth, h = pad.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (pad.width !== cw || pad.height !== ch) { pad.width = cw; pad.height = ch; }
    drawPad();
  }

  function padPoint(e){
    var r = pad.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width];
  }

  pad.addEventListener('pointerdown', function(e){
    if (stroke || e.button > 0) return;
    stroke = { id: e.pointerId, pts: [padPoint(e)] };
    strokes.push(stroke.pts);
    try { pad.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    drawPad();
    hint('');
    syncUi();
  });
  pad.addEventListener('pointermove', function(e){
    if (!stroke || e.pointerId !== stroke.id) return;
    var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (events.length ? events : [e]).forEach(function(ev){ stroke.pts.push(padPoint(ev)); });
    drawPad();
  });
  function endStroke(e){
    if (stroke && e.pointerId === stroke.id) stroke = null;
  }
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);

  function clearPad(){
    strokes = [];
    stroke = null;
    drawPad();
    syncUi();
  }
  padClear.addEventListener('click', clearPad);

  inks.addEventListener('change', drawPad);

  // The font samples show the name being typed.
  function showName(){
    var name = S.cleanName(typed.value) || 'Your name';
    Array.prototype.forEach.call(fonts.querySelectorAll('span'), function(s){ s.textContent = name; });
    hint('');
    syncUi();
  }
  typed.addEventListener('input', showName);

  imagePicker.addEventListener('change', function(){
    var f = imagePicker.files[0];
    imagePicker.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) {
      return hint('That isn’t an image. Choose a PNG or JPG of your signature.', true);
    }
    image = f;
    imageName.textContent = f.name;
    imageName.title = f.name;
    hint('');
    syncUi();
  });

  function pngBytes(c){
    return new Promise(function(resolve, reject){
      c.toBlob(function(blob){
        blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error('Could not make the image'));
      }, 'image/png');
    });
  }

  // Crops a canvas to what's drawn on it and makes it a signature. Resolves
  // to null if nothing is drawn.
  function fromCanvas(c){
    var ctx = c.getContext('2d');
    var b = S.inkBounds(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, 6, 8);
    if (!b) return Promise.resolve(null);
    var out = document.createElement('canvas');
    out.width = b.w;
    out.height = b.h;
    out.getContext('2d').drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return pngBytes(out).then(function(png){ return { png: png, w: b.w, h: b.h }; });
  }

  function fromPad(){
    var c = document.createElement('canvas');
    var scale = 1200;   // the pad's width in the image, in pixels
    c.width = scale;
    c.height = Math.round(scale * pad.clientHeight / pad.clientWidth);
    drawStrokes(c.getContext('2d'), scale, ink());
    return fromCanvas(c);
  }

  function fromText(){
    var text = S.cleanName(typed.value), family = font(), size = 140;
    var css = size + 'px "' + family + '"';
    var loaded = document.fonts && document.fonts.load ? document.fonts.load(css, text) : Promise.resolve();
    return loaded.catch(function(){}).then(function(){
      var c = document.createElement('canvas'), ctx = c.getContext('2d');
      ctx.font = css;
      c.width = Math.ceil(ctx.measureText(text).width + size * 2);
      c.height = Math.ceil(size * 2.2);
      ctx.font = css;   // resizing a canvas resets it
      ctx.fillStyle = ink();
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, size, size * 1.4);
      return fromCanvas(c);
    });
  }

  function decode(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){ URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  function fromImage(){
    var see = clearBg.checked;
    return decode(image).then(function(img){
      var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas'), ctx = c.getContext('2d');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      if (see) {
        var data = ctx.getImageData(0, 0, c.width, c.height);
        S.clearPaper(data.data);
        ctx.putImageData(data, 0, 0);
      }
      return fromCanvas(c);
    });
  }

  function addSig(s){
    s.n = ++sigCount;
    s.url = URL.createObjectURL(new Blob([s.png], { type: 'image/png' }));
    sigs.push(s);
    drawSigs();
    return s;
  }

  addBtn.addEventListener('click', function(){
    if (busy || !src || !canAdd()) return;
    var m = mode();
    busy = true;
    syncUi();
    (m === 'draw' ? fromPad() : m === 'type' ? fromText() : fromImage()).then(function(made){
      if (!made) {
        return hint(m === 'image' ? 'That image looks blank. Try one with darker ink, or untick “Make white paper see-through”.' : 'There’s nothing to see. Try again.', true);
      }
      made.id = 'sig-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      var s = addSig(made);
      if (m === 'draw') clearPad();
      store();
      hint('');
      place(s);
    }).catch(function(){
      hint(m === 'image' ? image.name + ' couldn’t be read as an image.' : 'Couldn’t make the signature.', true);
    }).then(function(){
      busy = false;
      syncUi();
    });
  });

  // ---- Your signatures ----
  function sigLabel(s){ return 'signature ' + s.n; }

  function drawSigs(){
    sigList.textContent = '';
    sigs.forEach(function(s){
      var li = document.createElement('li');
      li.className = 'sig';
      var put = document.createElement('button');
      put.type = 'button';
      put.className = 'sig-place';
      put.dataset.id = s.id;
      put.setAttribute('aria-label', 'Put ' + sigLabel(s) + ' on this page');
      put.title = 'Put it on this page';
      var img = document.createElement('img');
      img.src = s.url;
      img.alt = '';
      put.appendChild(img);
      var links = document.createElement('span');
      links.className = 'sig-links';
      var save = document.createElement('a');
      save.className = 'link-btn';
      save.href = s.url;
      save.download = 'signature-' + s.n + '.png';
      save.textContent = 'Save image';
      save.setAttribute('aria-label', 'Save ' + sigLabel(s) + ' as an image');
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'link-btn sig-del';
      del.dataset.id = s.id;
      del.textContent = 'Delete';
      del.setAttribute('aria-label', 'Delete ' + sigLabel(s));
      links.appendChild(save);
      links.appendChild(del);
      li.appendChild(put);
      li.appendChild(links);
      sigList.appendChild(li);
    });
    syncUi();
  }

  function sigById(id){
    return sigs.filter(function(s){ return s.id === id; })[0];
  }

  sigList.addEventListener('click', function(e){
    var put = e.target.closest('.sig-place'), del = e.target.closest('.sig-del');
    if (busy) return;
    if (put && src) place(sigById(put.dataset.id));
    if (del) {
      var s = sigById(del.dataset.id);
      var had = placed.length;
      sigs = sigs.filter(function(o){ return o !== s; });
      placed = placed.filter(function(p){ return p.sig !== s; });
      if (selected && selected.sig === s) selected = null;
      URL.revokeObjectURL(s.url);
      store();
      drawSigs();
      say(had > placed.length ? 'Deleted ' + sigLabel(s) + ' and took it off the pages.' : '');
      changed();
    }
  });

  // ---- Remembering signatures ----
  // Only when the visitor asks: the images go in IndexedDB, in this browser
  // alone. Private windows or blocked storage just mean nothing is kept.
  var db = (function(){
    var dbPromise = null;
    function open(){
      if (!dbPromise) dbPromise = new Promise(function(resolve, reject){
        var req = indexedDB.open('bdnix-sign', 1);
        req.onupgradeneeded = function(){ req.result.createObjectStore('files'); };
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error); };
      });
      return dbPromise;
    }
    function run(mode, fn){
      return open().then(function(d){
        return new Promise(function(resolve, reject){
          var tx = d.transaction('files', mode);
          var req = fn(tx.objectStore('files'));
          tx.oncomplete = function(){ resolve(req.result); };
          tx.onerror = tx.onabort = function(){ reject(tx.error); };
        });
      }).catch(function(){ return undefined; });
    }
    return {
      get: function(key){ return run('readonly', function(st){ return st.get(key); }); },
      set: function(key, value){ return run('readwrite', function(st){ return st.put(value, key); }); },
      remove: function(key){ return run('readwrite', function(st){ return st.delete(key); }); }
    };
  })();
  var KEY = 'signatures';

  function isBytes(b){ return b instanceof ArrayBuffer; }

  // Keeps the list as it is now, if the visitor chose to remember it.
  var storing = Promise.resolve();
  function store(){
    if (!remember.checked) return storing;
    var list = sigs.map(function(s){ return { id: s.id, png: s.png, w: s.w, h: s.h }; });
    storing = storing.then(function(){ return db.set(KEY, list); });
    return storing;
  }

  remember.addEventListener('change', function(){
    if (remember.checked) {
      store();
      say(sigs.length ? 'Your signatures will be here next time, in this browser only.' : 'Signatures you make will be kept in this browser for next time.');
    } else {
      storing = storing.then(function(){ return db.remove(KEY); });
      say('Your signatures are no longer kept in this browser.');
    }
  });

  var restored = db.get(KEY).then(function(list){
    if (!Array.isArray(list)) return;
    remember.checked = true;
    list.map(function(s){ return S.checkSaved(s, isBytes); }).filter(Boolean).forEach(function(s){
      if (!sigById(s.id)) addSig(s);
    });
  });

  // ---- Signatures on the page ----
  function view(i){ return src.views[i]; }

  function heightOf(p){
    var v = view(p.page), s = p.sig;
    return S.heightOf(p, v.vw, v.vh, s.w / s.h);
  }

  function place(s){
    if (!s || !src) return;
    var v = view(pageIndex);
    var p = S.newPlacement(v.vw, v.vh, s.w / s.h);
    // A second copy on the same page sits a little higher, not on top.
    var same = placed.filter(function(o){ return o.page === pageIndex; }).length;
    p.y = Math.max(0.1, p.y - same * 0.08);
    p.sig = s;
    p.page = pageIndex;
    placed.push(p);
    selected = p;
    say('');
    changed();
    focusSelected();
  }

  function position(el, p){
    var h = heightOf(p);
    el.style.left = (p.x - p.w / 2) * 100 + '%';
    el.style.top = (p.y - h / 2) * 100 + '%';
    el.style.width = p.w * 100 + '%';
    el.style.height = h * 100 + '%';
    el.style.transform = p.angle ? 'rotate(' + p.angle + 'deg)' : '';
  }

  function onPage(){
    return placed.filter(function(p){ return p.page === pageIndex; });
  }

  function drawPlaced(){
    layer.textContent = '';
    if (!src) return;
    onPage().forEach(function(p){
      var el = document.createElement('div');
      el.className = 'placed' + (p === selected ? ' on' : '');
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Signature ' + p.sig.n + '. Drag to move it, or use the arrow keys. Delete removes it.');
      el.setAttribute('aria-pressed', p === selected ? 'true' : 'false');
      var img = document.createElement('img');
      img.src = p.sig.url;
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
      ['grow', 'turn'].forEach(function(k){
        var h = document.createElement('span');
        h.className = 'handle ' + k;
        h.setAttribute('aria-hidden', 'true');
        el.appendChild(h);
      });
      position(el, p);
      el.placement = p;
      layer.appendChild(el);
    });
  }

  function elOf(p){
    return Array.prototype.filter.call(layer.children, function(el){ return el.placement === p; })[0];
  }

  function focusSelected(){
    var el = selected && elOf(selected);
    if (el) el.focus({ preventScroll: true });
  }

  function select(p){
    if (selected === p) return;
    selected = p;
    Array.prototype.forEach.call(layer.children, function(el){
      el.classList.toggle('on', el.placement === p);
      el.setAttribute('aria-pressed', el.placement === p ? 'true' : 'false');
    });
    syncUi();
  }

  // Changes the selected placement's spot, size or angle.
  function update(p, next){
    p.x = next.x; p.y = next.y; p.w = next.w; p.angle = next.angle;
    var el = elOf(p);
    if (el) position(el, p);
    clearResult();
    syncUi();
  }

  function remove(p){
    placed = placed.filter(function(o){ return o !== p; });
    if (selected === p) selected = null;
    changed();
  }

  // Dragging: the signature itself moves it, the corner handle resizes it
  // and the handle above turns it. Mouse, pen or finger.
  var drag = null;
  layer.addEventListener('pointerdown', function(e){
    if (busy || drag || e.button > 0) return;
    var el = e.target.closest('.placed');
    if (!el) { select(null); return; }
    var p = el.placement, r = layer.getBoundingClientRect();
    var cx = r.left + p.x * r.width, cy = r.top + p.y * r.height;
    select(p);
    drag = {
      id: e.pointerId, p: p, rect: r, cx: cx, cy: cy,
      kind: e.target.classList.contains('grow') ? 'grow' : e.target.classList.contains('turn') ? 'turn' : 'move',
      dx: e.clientX - cx, dy: e.clientY - cy,
      dist: Math.hypot(e.clientX - cx, e.clientY - cy), start: S.fix(p)
    };
    try { layer.setPointerCapture(e.pointerId); } catch (err) {}
    el.focus({ preventScroll: true });
    e.preventDefault();
  });
  layer.addEventListener('pointermove', function(e){
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag, r = d.rect, next;
    if (d.kind === 'move') next = S.moveTo(d.start, (e.clientX - d.dx - r.left) / r.width, (e.clientY - d.dy - r.top) / r.height);
    else if (d.kind === 'grow') next = S.resize(d.start, d.dist, Math.hypot(e.clientX - d.cx, e.clientY - d.cy));
    else next = S.fix({ x: d.start.x, y: d.start.y, w: d.start.w, angle: S.angleFrom(d.cx, d.cy, e.clientX, e.clientY) });
    update(d.p, next);
  });
  function endDrag(e){
    if (drag && e.pointerId === drag.id) drag = null;
  }
  layer.addEventListener('pointerup', endDrag);
  layer.addEventListener('pointercancel', endDrag);

  layer.addEventListener('keydown', function(e){
    var el = e.target.closest('.placed');
    if (!el || busy) return;
    var p = el.placement;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(p);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(p);
      return;
    }
    var next = S.nudge(p, e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    select(p);
    update(p, next);
  });
  layer.addEventListener('focusin', function(e){
    var el = e.target.closest('.placed');
    if (el) select(el.placement);
  });

  sizeRange.addEventListener('input', function(){
    if (!selected) return;
    update(selected, S.fix({ x: selected.x, y: selected.y, w: sizeRange.value / 100, angle: selected.angle }));
  });
  angleRange.addEventListener('input', function(){
    if (!selected) return;
    update(selected, S.fix({ x: selected.x, y: selected.y, w: selected.w, angle: +angleRange.value }));
  });

  removeBtn.addEventListener('click', function(){
    if (busy || !selected) return;
    remove(selected);
  });

  // The same signature, at the same spot and size, on every other page.
  everyBtn.addEventListener('click', function(){
    if (busy || !selected || !src) return;
    var p = selected, added = 0;
    for (var i = 0; i < src.pages; i++) {
      if (placed.some(function(o){ return o.page === i && o.sig === p.sig && Math.abs(o.x - p.x) < 1e-6 && Math.abs(o.y - p.y) < 1e-6; })) continue;
      placed.push({ sig: p.sig, page: i, x: p.x, y: p.y, w: p.w, angle: p.angle });
      added++;
    }
    say(added ? 'Copied to ' + T.plural(added, 'more page') + '.' : 'It’s already on every page.');
    changed();
  });

  clearBtn.addEventListener('click', function(){
    if (busy) return;
    placed = [];
    selected = null;
    say('');
    changed();
  });

  // ---- The page ----
  function setNote(text){
    note.textContent = text || '';
    note.hidden = !text;
  }

  function stageSize(){
    var cs = getComputedStyle(stage);
    var w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { w: Math.max(120, Math.floor(w)), h: Math.max(240, Math.floor(window.innerHeight * 0.75)) };
  }

  var showSeq = 0;
  function showPage(){
    if (!src) return;
    var seq = ++showSeq, i = pageIndex;
    pageLabel.textContent = 'Page ' + (i + 1) + ' of ' + src.pages;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i >= src.pages - 1;
    drawPlaced();
    if (!src.view) {
      sheet.hidden = true;
      setNote(src.viewFailed ? 'This file’s pages can’t be shown in this browser, so it can’t be signed here.' : 'Loading the page…');
      return;
    }
    var fit = stageSize(), dpr = Math.min(window.devicePixelRatio || 1, 2), cssWidth;
    src.view.getPage(i + 1).then(function(page){
      var vp1 = page.getViewport({ scale: 1 });
      var scale = Math.min(fit.w / vp1.width, fit.h / vp1.height);
      var vp = page.getViewport({ scale: scale * dpr });
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      cssWidth = Math.round(vp.width / dpr);
      return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function(){ return c; });
    }).then(function(c){
      if (seq !== showSeq) return;
      canvas.width = c.width;
      canvas.height = c.height;
      canvas.style.width = cssWidth + 'px';
      canvas.getContext('2d').drawImage(c, 0, 0);
      sheet.hidden = false;
      setNote('');
    }).catch(function(err){
      if (seq !== showSeq) return;
      setNote('Couldn’t draw this page: ' + errText(err));
    });
  }

  function goTo(i){
    if (!src || i < 0 || i >= src.pages || i === pageIndex) return;
    pageIndex = i;
    selected = null;
    showPage();
    syncUi();
  }
  prevBtn.addEventListener('click', function(){ goTo(pageIndex - 1); });
  nextBtn.addEventListener('click', function(){ goTo(pageIndex + 1); });

  var lastFit = '';
  window.addEventListener('resize', function(){
    if (mode() === 'draw') sizePad();
    if (!src) return;
    var f = stageSize(), key = f.w + 'x' + f.h;
    if (key === lastFit) return;
    lastFit = key;
    showPage();
  });

  // ---- Choosing a file ----
  function openFile(file){
    if (!file || busy) return;
    if (!P.isPdf(file)) return say('That isn’t a PDF file. Choose a .pdf to sign.', true);
    busy = true;
    syncUi();
    say('Reading ' + file.name + '…');
    var bytes;
    T.readBytes(file).then(function(buf){
      bytes = buf;
      return P.loadPdfLib();
    }).then(function(L){
      return L.PDFDocument.load(bytes, { updateMetadata: false });
    }).then(function(doc){
      if (src && src.viewTask) src.viewTask.destroy();
      var views = doc.getPages().map(function(pg){
        var box = pg.getCropBox(), rot = ((pg.getRotation().angle % 360) + 360) % 360;
        var v = S.viewSize(box, rot);
        return { box: box, rot: rot, vw: v.vw, vh: v.vh };
      });
      src = { name: file.name, bytes: bytes, pages: doc.getPageCount(), views: views, view: null, viewTask: null };
      placed = [];
      selected = null;
      pageIndex = 0;
      clearResult();
      drop.hidden = true;
      fileBar.hidden = false;
      editor.hidden = false;
      sizePad();
      fileName.textContent = file.name;
      fileName.title = file.name;
      fileMeta.textContent = T.plural(src.pages, 'page') + ' · ' + T.fmtSize(file.size);
      say('');
      var current = src;
      P.loadPdfjs().then(function(lib){
        if (!lib) throw new Error('pdf.js did not load');
        // pdf.js takes ownership of the buffer it's given, so hand it a copy.
        current.viewTask = lib.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false });
        return current.viewTask.promise;
      }).then(function(v){
        if (src === current) src.view = v;
      }).catch(function(){
        if (src === current) src.viewFailed = true;
      }).then(function(){
        if (src === current) { showPage(); syncUi(); }
      });
    }).catch(function(err){
      if (err && err.library) return say(err.message, true);
      var encrypted = err && /encrypt/i.test(errText(err));
      say(file.name + (encrypted ? ' is password-protected, so it can’t be signed.' : ' could not be read as a PDF.'), true);
    }).then(function(){
      busy = false;
      syncUi();
      showPage();
    });
  }

  picker.addEventListener('change', function(){
    openFile(picker.files[0]);
    picker.value = '';
  });
  changeBtn.addEventListener('click', function(){ picker.click(); });
  T.onFileDrop(drop, function(list){ openFile(list[0]); });

  // ---- Making the file ----
  applyBtn.addEventListener('click', function(){
    if (busy || !src || !placed.length) return;
    busy = true;
    syncUi();
    clearResult();
    applyLabel.textContent = 'Signing…';
    var L, out, embedded = {}, count = placed.length, pages = pagesWith().length;
    P.loadPdfLib().then(function(lib){
      L = lib;
      return L.PDFDocument.load(src.bytes, { updateMetadata: false });
    }).then(function(doc){
      out = doc;
      var chain = Promise.resolve();
      placed.forEach(function(p){
        chain = chain.then(function(){
          var s = p.sig;
          if (!embedded[s.id]) embedded[s.id] = out.embedPng(s.png);
          return embedded[s.id];
        }).then(function(png){
          var v = view(p.page);
          var d = S.drawParams(p, v.box, v.rot, p.sig.w / p.sig.h);
          out.getPage(p.page).drawImage(png, { x: d.x, y: d.y, width: d.width, height: d.height, rotate: L.degrees(d.rotate) });
        });
      });
      return chain;
    }).then(function(){
      return out.save();
    }).then(function(bytes){
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var name = S.signedName(src.name);
      resultUrl = URL.createObjectURL(blob);
      downloadBtn.href = resultUrl;
      downloadBtn.download = name;
      downloadBtn.title = name;
      downloadLabel.textContent = 'Download (' + T.fmtSize(blob.size) + ')';
      downloadBtn.hidden = false;
      say('Done. Added ' + T.plural(count, 'signature') + ' on ' + T.plural(pages, 'page') + '.');
      downloadBtn.focus();
    }).catch(function(err){
      say('Something went wrong: ' + errText(err), true);
    }).then(function(){
      busy = false;
      applyLabel.textContent = 'Sign PDF';
      syncUi();
    });
  });

  // A name from the visitor's profile starts them off in Type mode.
  var profile = window.bdnixProfile;
  if (profile && profile.getName() !== profile.DEFAULT_NAME) {
    typed.value = profile.getName();
    showName();
  }

  restored.then(syncUi);
  syncUi();
})();
