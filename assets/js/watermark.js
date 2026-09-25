// PDF watermark tool. pdf-lib stamps the pages; pdf.js (loaded on demand)
// draws the preview. Everything runs in the browser; nothing is uploaded.
(function(){
  var L = PDFLib;
  var T = window.bdnixPdf;
  function $(id){ return document.getElementById(id); }

  var drop = $('drop'), picker = $('picker');
  var fileBar = $('fileBar'), fileName = $('fileName'), fileMeta = $('fileMeta'), changeBtn = $('changeBtn');
  var msg = $('msg'), editor = $('editor'), form = $('settings');
  var stage = $('stage'), canvas = $('previewCanvas'), note = $('previewNote');
  var prevBtn = $('prevPage'), nextBtn = $('nextPage'), pageLabel = $('pageLabel');
  var applyBtn = $('applyBtn'), applyLabel = $('applyLabel');
  var downloadBtn = $('downloadBtn'), downloadLabel = $('downloadLabel');
  var imagePicker = $('imagePicker'), imageName = $('imageName');
  var posGrid = $('posGrid'), pagesHint = $('pagesHint'), chips = $('rotationChips');
  var F = form.elements;

  $('year').textContent = new Date().getFullYear();

  // src: { name, size, bytes, pages, doc (pdf-lib, read only), view (pdf.js) and its viewTask }
  var src = null;
  // image: { bytes, type: 'png' | 'jpg' }
  var image = null;
  var busy = false;
  var resultUrl = null;
  var previewIndex = 0;
  var baseCache = {};
  // Text and image watermarks want different default sizes, so each keeps its own.
  var sizes = { text: 80, image: 40 };
  var lastKind = 'text';

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function settings(){
    return {
      kind: F.kind.value,
      text: F.text.value.trim(),
      color: F.color.value,
      size: +F.size.value,
      opacity: +F.opacity.value / 100,
      rotation: +F.rotation.value,
      pos: F.pos.value,
      tile: F.tile.checked,
      pages: F.pages.value
    };
  }

  // ---- pdf.js, only fetched once a file is chosen ----
  var pdfjsPromise = null;
  function loadPdfjs(){
    if (!pdfjsPromise) {
      pdfjsPromise = import('/assets/vendor/pdfjs/pdf.min.mjs').then(function(lib){
        lib.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs/pdf.worker.min.mjs';
        return lib;
      }).catch(function(){ return null; });
    }
    return pdfjsPromise;
  }

  // ---- Stamping (shared by the preview and the real output) ----
  function rotationOf(page){
    return ((page.getRotation().angle % 360) + 360) % 360;
  }

  function hexToRgb(hex){
    var n = parseInt(hex.slice(1), 16);
    return L.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
  }

  // Draws text the built-in PDF fonts can't encode (e.g. non-Latin scripts)
  // onto a canvas, so it can be embedded as an image instead.
  var textImageCache = {};
  function textToPng(text, color){
    var key = color + '|' + text;
    if (textImageCache[key]) return Promise.resolve(textImageCache[key]);
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    var px = 160;
    var fontFor = function(size){ return '800 ' + size + 'px Inter, "Noto Sans", Arial, sans-serif'; };
    ctx.font = fontFor(px);
    var m = ctx.measureText(text);
    if (m.width > 8000) { px = Math.floor(px * 8000 / m.width); ctx.font = fontFor(px); m = ctx.measureText(text); }
    var asc = m.actualBoundingBoxAscent || px * 0.8, desc = m.actualBoundingBoxDescent || px * 0.2;
    var pad = Math.ceil(px * 0.08);
    c.width = Math.ceil(m.width) + pad * 2;
    c.height = Math.ceil(asc + desc) + pad * 2;
    ctx.font = fontFor(px);
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, pad, pad + asc);
    return new Promise(function(resolve, reject){
      c.toBlob(function(blob){
        if (!blob) return reject(new Error('Could not draw the text'));
        blob.arrayBuffer().then(function(buf){
          textImageCache = {};
          textImageCache[key] = buf;
          resolve(buf);
        }, reject);
      }, 'image/png');
    });
  }

  // Embeds the watermark into doc. Resolves to null when there's nothing to draw yet.
  function prepareMark(doc, s){
    if (s.kind === 'image') {
      if (!image) return Promise.resolve(null);
      return (image.type === 'png' ? doc.embedPng(image.bytes) : doc.embedJpg(image.bytes)).then(function(img){
        return { image: img, aspect: img.height / img.width };
      });
    }
    if (!s.text) return Promise.resolve(null);
    return doc.embedFont(L.StandardFonts.HelveticaBold).then(function(font){
      try {
        font.encodeText(s.text);
        return { font: font, text: s.text, color: hexToRgb(s.color) };
      } catch (e) {
        return textToPng(s.text, s.color).then(function(png){ return doc.embedPng(png); }).then(function(img){
          return { image: img, aspect: img.height / img.width };
        });
      }
    });
  }

  // Maps a point from the page as the reader sees it to PDF page space,
  // undoing the page's /Rotate (which turns the page clockwise).
  function toPage(vx, vy, rot, box){
    var p = rot === 90 ? [box.width - vy, vx] :
            rot === 180 ? [box.width - vx, box.height - vy] :
            rot === 270 ? [vy, box.height - vx] : [vx, vy];
    return [p[0] + box.x, p[1] + box.y];
  }

  function placeCenter(pos, vw, vh, bw, bh, margin){
    var col = pos.charAt(1), row = pos.charAt(0);
    var x = col === 'l' ? margin + bw / 2 : col === 'r' ? vw - margin - bw / 2 : vw / 2;
    var y = row === 't' ? vh - margin - bh / 2 : row === 'b' ? margin + bh / 2 : vh / 2;
    return [x, y];
  }

  // A brick pattern of copies, centred on the page, covering it edge to edge.
  function tileCenters(vw, vh, bw, bh, gap){
    var sx = bw + gap, sy = bh + gap, out = [];
    var nx = Math.ceil((vw / 2 + bw) / sx) + 1, ny = Math.ceil((vh / 2 + bh) / sy);
    for (var j = -ny; j <= ny; j++) {
      var y = vh / 2 + j * sy, shift = Math.abs(j) % 2 ? sx / 2 : 0;
      for (var i = -nx; i <= nx; i++) {
        var x = vw / 2 + i * sx + shift;
        if (x + bw / 2 > 0 && x - bw / 2 < vw && y + bh / 2 > 0 && y - bh / 2 < vh) out.push([x, y]);
      }
    }
    return out;
  }

  function stamp(page, mark, s){
    var box = page.getCropBox();
    var rot = rotationOf(page);
    var sideways = rot % 180 !== 0;
    var vw = sideways ? box.height : box.width, vh = sideways ? box.width : box.height;
    var short = Math.min(vw, vh);

    // Size is the watermark's width as a share of the page's shorter side.
    var w = short * s.size / 100, h, fontSize;
    if (mark.font) {
      fontSize = w / mark.font.widthOfTextAtSize(mark.text, 1);
      h = mark.font.heightAtSize(fontSize, { descender: false });
    } else {
      h = w * mark.aspect;
    }

    var a = s.rotation * Math.PI / 180;
    var bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    var bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    var centers = s.tile ? tileCenters(vw, vh, bw, bh, short * 0.08) : [placeCenter(s.pos, vw, vh, bw, bh, short * 0.06)];

    // pdf-lib rotates around the drawing origin (the bottom-left corner),
    // so shift the origin to keep each copy centred where we want it.
    var pageAngle = s.rotation + rot;
    var pa = pageAngle * Math.PI / 180;
    var ox = w / 2 * Math.cos(pa) - h / 2 * Math.sin(pa);
    var oy = w / 2 * Math.sin(pa) + h / 2 * Math.cos(pa);

    centers.forEach(function(c){
      var p = toPage(c[0], c[1], rot, box);
      var opts = { x: p[0] - ox, y: p[1] - oy, rotate: L.degrees(pageAngle), opacity: s.opacity };
      if (mark.font) {
        opts.font = mark.font; opts.size = fontSize; opts.color = mark.color;
        page.drawText(mark.text, opts);
      } else {
        opts.width = w; opts.height = h;
        page.drawImage(mark.image, opts);
      }
    });
  }

  function uniquePages(sel){
    return sel.pages.filter(function(p, i){ return sel.pages.indexOf(p) === i; });
  }

  // ---- Preview ----
  function stageSize(){
    var cs = getComputedStyle(stage);
    var w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { w: Math.max(120, Math.floor(w)), h: Math.max(240, Math.floor(window.innerHeight * 0.7)) };
  }

  function renderPage(pdfDoc, num, fit, transparent){
    return pdfDoc.getPage(num).then(function(page){
      var vp1 = page.getViewport({ scale: 1 });
      var scale = Math.min(fit.w / vp1.width, fit.h / vp1.height);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var vp = page.getViewport({ scale: scale * dpr });
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      c.cssWidth = Math.round(vp.width / dpr);
      return page.render({
        canvasContext: c.getContext('2d'),
        viewport: vp,
        background: transparent ? 'rgba(0,0,0,0)' : null
      }).promise.then(function(){ return c; });
    });
  }

  function basePage(index, fit){
    var key = index + '@' + fit.w + 'x' + fit.h;
    if (!baseCache[key]) baseCache[key] = renderPage(src.view, index + 1, fit, false);
    return baseCache[key];
  }

  // Stamps the watermark on a blank page shaped like the real one, and
  // renders it with a transparent background to lay over the cached page.
  function overlayPage(index, s, fit, lib){
    var original = src.doc.getPage(index);
    var box = original.getCropBox();
    return L.PDFDocument.create().then(function(doc){
      var page = doc.addPage([box.width, box.height]);
      page.setMediaBox(box.x, box.y, box.width, box.height);
      page.setRotation(L.degrees(rotationOf(original)));
      return prepareMark(doc, s).then(function(mark){
        if (!mark) return null;
        stamp(page, mark, s);
        return doc.save();
      });
    }).then(function(bytes){
      if (!bytes) return null;
      // pdf.js frees a document through the task that loaded it.
      var task = lib.getDocument({ data: bytes, isEvalSupported: false });
      return task.promise.then(function(d){ return renderPage(d, 1, fit, true); })
        .finally(function(){ task.destroy(); });
    });
  }

  function setNote(text){
    note.textContent = text || '';
    note.hidden = !text;
  }

  var previewTimer = null, previewSeq = 0;
  function schedulePreview(){
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 90);
  }

  function renderPreview(){
    if (!src) return;
    var seq = ++previewSeq;
    var i = previewIndex;
    pageLabel.textContent = 'Page ' + (i + 1) + ' of ' + src.pages;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i >= src.pages - 1;

    if (!src.view) {
      canvas.hidden = true;
      setNote(src.viewFailed ? 'The preview isn’t available for this file or browser, but you can still add the watermark.' : 'Loading preview…');
      return;
    }

    var s = settings();
    var sel = T.parseRange(s.pages, src.pages);
    var included = !sel.error && sel.pages.indexOf(i) >= 0;
    var fit = stageSize();

    loadPdfjs().then(function(lib){
      return Promise.all([basePage(i, fit), included ? overlayPage(i, s, fit, lib) : null]);
    }).then(function(r){
      if (seq !== previewSeq) return;
      var base = r[0], over = r[1];
      canvas.width = base.width;
      canvas.height = base.height;
      canvas.style.width = base.cssWidth + 'px';
      var ctx = canvas.getContext('2d');
      ctx.drawImage(base, 0, 0);
      if (over) ctx.drawImage(over, 0, 0);
      canvas.hidden = false;
      setNote(
        sel.error ? 'Fix the page list to see the watermark.' :
        !included ? 'Page ' + (i + 1) + ' isn’t in your page list, so it stays as it is.' :
        s.kind === 'image' && !image ? 'Choose an image to see it here.' :
        s.kind === 'text' && !s.text ? 'Type some text to see it here.' : ''
      );
    }).catch(function(err){
      if (seq !== previewSeq) return;
      setNote('Couldn’t draw the preview: ' + (err && err.message ? err.message : err));
    });
  }

  // ---- Form state ----
  function clearResult(){
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    downloadBtn.hidden = true;
    downloadBtn.removeAttribute('href');
  }

  function syncForm(){
    var s = settings();
    if (s.kind !== lastKind) {
      sizes[lastKind] = s.size;
      F.size.value = sizes[s.kind];
      lastKind = s.kind;
      s.size = sizes[s.kind];
    }
    form.querySelector('.for-text').hidden = s.kind !== 'text';
    form.querySelector('.for-image').hidden = s.kind !== 'image';
    $('sizeOut').textContent = s.size + '%';
    $('opacityOut').textContent = Math.round(s.opacity * 100) + '%';
    $('rotationOut').textContent = s.rotation + '°';
    Array.prototype.forEach.call(chips.children, function(b){
      b.classList.toggle('on', +b.dataset.rot === s.rotation);
    });
    posGrid.classList.toggle('off', s.tile);
    Array.prototype.forEach.call(posGrid.querySelectorAll('input'), function(r){ r.disabled = s.tile; });

    var ok = !!src;
    if (src) {
      var sel = T.parseRange(s.pages, src.pages);
      F.pages.classList.toggle('invalid', !!sel.error);
      pagesHint.classList.toggle('error', !!sel.error);
      pagesHint.textContent = sel.error ? sel.error :
        s.pages.trim() ? T.plural(uniquePages(sel).length, 'page') + ' of ' + src.pages + ' will be watermarked' :
        'All ' + T.plural(src.pages, 'page') + ' will be watermarked';
      ok = !sel.error && (s.kind === 'image' ? !!image : !!s.text);
    }
    applyBtn.disabled = busy || !ok;
  }

  function onChange(e){
    // Tiling many copies of a big watermark just covers the page, so start smaller.
    if (e && e.target === F.tile && F.tile.checked && +F.size.value > 45) F.size.value = 35;
    syncForm();
    clearResult();
    schedulePreview();
  }
  form.addEventListener('input', onChange);
  form.addEventListener('change', onChange);

  chips.addEventListener('click', function(e){
    var b = e.target.closest('button');
    if (!b) return;
    F.rotation.value = b.dataset.rot;
    onChange();
  });

  prevBtn.addEventListener('click', function(){ if (previewIndex > 0) { previewIndex--; schedulePreview(); } });
  nextBtn.addEventListener('click', function(){ if (src && previewIndex < src.pages - 1) { previewIndex++; schedulePreview(); } });

  var lastFit = '';
  window.addEventListener('resize', function(){
    if (!src) return;
    var f = stageSize(), key = f.w + 'x' + f.h;
    if (key === lastFit) return;
    lastFit = key;
    baseCache = {};
    schedulePreview();
  });

  // ---- Choosing files ----
  function openFile(file){
    if (!file || busy) return;
    if (!T.isPdf(file)) return say('That isn’t a PDF file. Choose a .pdf to watermark.', true);
    busy = true;
    syncForm();
    say('Reading ' + file.name + '…');
    var bytes;
    T.readBytes(file).then(function(buf){
      bytes = buf;
      return L.PDFDocument.load(buf, { updateMetadata: false });
    }).then(function(doc){
      if (src && src.viewTask) src.viewTask.destroy();
      src = { name: file.name, size: file.size, bytes: bytes, pages: doc.getPageCount(), doc: doc, view: null, viewTask: null };
      previewIndex = 0;
      baseCache = {};
      clearResult();
      drop.hidden = true;
      fileBar.hidden = false;
      editor.hidden = false;
      fileName.textContent = file.name;
      fileName.title = file.name;
      fileMeta.textContent = T.plural(src.pages, 'page') + ' · ' + T.fmtSize(file.size);
      say('');
      var current = src;
      loadPdfjs().then(function(lib){
        if (!lib) throw new Error('pdf.js did not load');
        // pdf.js takes ownership of the buffer it's given, so hand it a copy.
        current.viewTask = lib.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false });
        return current.viewTask.promise;
      }).then(function(view){
        if (src === current) { src.view = view; schedulePreview(); }
      }).catch(function(){
        if (src === current) { src.viewFailed = true; schedulePreview(); }
      });
    }).catch(function(err){
      var encrypted = err && /encrypt/i.test(err.message || String(err));
      say(file.name + (encrypted ? ' is password-protected, so it can’t be watermarked.' : ' could not be read as a PDF.'), true);
    }).then(function(){
      busy = false;
      syncForm();
      schedulePreview();
    });
  }

  picker.addEventListener('change', function(){
    openFile(picker.files[0]);
    picker.value = '';
  });
  changeBtn.addEventListener('click', function(){ picker.click(); });

  function hasFiles(e){
    var types = e.dataTransfer && e.dataTransfer.types;
    return !!types && Array.prototype.indexOf.call(types, 'Files') >= 0;
  }
  var depth = 0;
  document.addEventListener('dragenter', function(e){
    if (!hasFiles(e)) return;
    depth++;
    drop.classList.add('over');
  });
  document.addEventListener('dragleave', function(e){
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) drop.classList.remove('over');
  });
  document.addEventListener('dragover', function(e){
    if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
  });
  document.addEventListener('drop', function(e){
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    drop.classList.remove('over');
    var f = e.dataTransfer.files[0];
    // An image dropped while the image option is open becomes the watermark.
    if (f && /^image\//.test(f.type) && src && F.kind.value === 'image') return openImage(f);
    openFile(f);
  });

  function openImage(file){
    if (!file) return;
    var isPng = file.type === 'image/png', isJpg = file.type === 'image/jpeg';
    var ready;
    if (isPng || isJpg) {
      ready = T.readBytes(file).then(function(buf){ return { bytes: buf, type: isPng ? 'png' : 'jpg' }; });
    } else {
      // WebP, GIF and friends: redraw as PNG, which pdf-lib can embed.
      ready = createImageBitmap(file).then(function(bmp){
        var c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        return new Promise(function(resolve, reject){
          c.toBlob(function(b){ b ? resolve(b) : reject(new Error('convert failed')); }, 'image/png');
        });
      }).then(function(blob){ return blob.arrayBuffer(); }).then(function(buf){ return { bytes: buf, type: 'png' }; });
    }
    ready.then(function(img){
      // Check it embeds before accepting it.
      return L.PDFDocument.create().then(function(d){
        return img.type === 'png' ? d.embedPng(img.bytes) : d.embedJpg(img.bytes);
      }).then(function(){ return img; });
    }).then(function(img){
      image = img;
      imageName.textContent = file.name;
      imageName.title = file.name;
      say('');
      onChange();
    }).catch(function(){
      say('Couldn’t use ' + file.name + '. Try a PNG or JPG image.', true);
    });
  }
  imagePicker.addEventListener('change', function(e){
    e.stopPropagation();
    openImage(imagePicker.files[0]);
    imagePicker.value = '';
  });

  // ---- Making the file ----
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if (busy || !src) return;
    var s = settings();
    var sel = T.parseRange(s.pages, src.pages);
    if (sel.error) return;
    busy = true;
    syncForm();
    clearResult();
    applyLabel.textContent = 'Adding watermark…';
    var out, pages = uniquePages(sel);

    // Start from the original bytes each time so watermarks never stack up.
    L.PDFDocument.load(src.bytes, { updateMetadata: false }).then(function(doc){
      out = doc;
      return prepareMark(doc, s);
    }).then(function(mark){
      if (!mark) throw new Error(s.kind === 'image' ? 'choose an image first' : 'type some text first');
      var all = out.getPages();
      pages.forEach(function(i){ stamp(all[i], mark, s); });
      return out.save();
    }).then(function(bytes){
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var name = src.name.replace(/\.pdf$/i, '') + '-watermarked.pdf';
      resultUrl = URL.createObjectURL(blob);
      downloadBtn.href = resultUrl;
      downloadBtn.download = name;
      downloadLabel.textContent = 'Download (' + T.fmtSize(blob.size) + ')';
      downloadBtn.title = name;
      downloadBtn.hidden = false;
      say('Done. Watermarked ' + T.plural(pages.length, 'page') + '.');
      downloadBtn.focus();
    }).catch(function(err){
      say('Something went wrong: ' + (err && err.message ? err.message : err), true);
    }).then(function(){
      busy = false;
      applyLabel.textContent = 'Add watermark';
      syncForm();
    });
  });

  syncForm();
})();
