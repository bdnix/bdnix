// PDF watermark tool. pdf-lib stamps the pages; pdf.js (loaded on demand)
// draws the preview. Everything runs in the browser; nothing is uploaded.
(function(){
  var L = PDFLib;
  var T = window.bdnixPdf;
  var Layout = window.bdnixWatermarkLayout;
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
  var fontPick = $('fontPick'), fontPicker = $('fontPicker'), fontName = $('fontName');
  var layerHint = $('layerHint'), resetBtn = $('resetBtn');
  var F = form.elements;

  $('year').textContent = new Date().getFullYear();

  // src: { name, size, bytes, pages, doc (pdf-lib, read only), view (pdf.js) and its viewTask }
  var src = null;
  // image: { bytes, type: 'png' | 'jpg', name }
  var image = null;
  // customFont: { bytes, name }, an uploaded .ttf/.otf
  var customFont = null;
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
      font: F.font.value,
      bold: F.bold.checked,
      italic: F.italic.checked,
      layer: F.layer.value,
      pages: F.pages.value
    };
  }

  // ---- Remembering settings ----
  // Settings go in localStorage; the image and font files go in IndexedDB,
  // which handles binary data and has room for them. All of it is optional:
  // private windows or blocked storage just mean nothing is remembered.
  var STORE_KEY = 'bdnix_watermark_v1';
  var REMEMBERED = ['kind', 'text', 'color', 'size', 'opacity', 'rotation', 'pos', 'tile', 'font', 'bold', 'italic', 'layer'];

  var files = (function(){
    var dbPromise = null;
    function open(){
      if (!dbPromise) dbPromise = new Promise(function(resolve, reject){
        var req = indexedDB.open('bdnix-tools', 1);
        req.onupgradeneeded = function(){ req.result.createObjectStore('files'); };
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error); };
      });
      return dbPromise;
    }
    function run(mode, fn){
      return open().then(function(db){
        return new Promise(function(resolve, reject){
          var tx = db.transaction('files', mode);
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

  function saveSettings(){
    var s = settings(), out = { sizes: sizes };
    sizes[s.kind] = s.size;
    REMEMBERED.forEach(function(k){ out[k] = s[k]; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(out)); } catch (e) {}
  }

  function restoreSettings(){
    var saved;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
    if (!saved || typeof saved !== 'object') return;
    function setRadio(name, value){
      Array.prototype.forEach.call(form.querySelectorAll('input[name=' + name + ']'), function(r){
        if (r.value === value) r.checked = true;
      });
    }
    function setRange(name, value){
      var el = F[name], n = +value;
      if (isFinite(n)) el.value = Math.min(+el.max, Math.max(+el.min, n));
    }
    if (typeof saved.kind === 'string') setRadio('kind', saved.kind);
    if (typeof saved.text === 'string') F.text.value = saved.text.slice(0, 200);
    if (/^#[0-9a-f]{6}$/i.test(saved.color)) F.color.value = saved.color;
    if (saved.sizes) {
      if (isFinite(saved.sizes.text)) sizes.text = +saved.sizes.text;
      if (isFinite(saved.sizes.image)) sizes.image = +saved.sizes.image;
    }
    setRange('size', saved.size);
    setRange('opacity', saved.opacity * 100);
    setRange('rotation', saved.rotation);
    if (typeof saved.pos === 'string') setRadio('pos', saved.pos);
    F.tile.checked = !!saved.tile;
    if (F.font.querySelector('option[value="' + saved.font + '"]')) F.font.value = saved.font;
    if (typeof saved.bold === 'boolean') F.bold.checked = saved.bold;
    if (typeof saved.italic === 'boolean') F.italic.checked = saved.italic;
    if (typeof saved.layer === 'string') setRadio('layer', saved.layer);
    lastKind = F.kind.value;
  }

  function restoreFiles(){
    files.get('image').then(function(v){
      if (!v || image || !v.bytes) return;
      image = { bytes: v.bytes, type: v.type === 'jpg' ? 'jpg' : 'png', name: v.name };
      imageName.textContent = v.name;
      imageName.title = v.name;
      syncForm();
      schedulePreview();
    });
    files.get('font').then(function(v){
      if (!v || customFont || !v.bytes) return;
      useFont(v.bytes, v.name).catch(function(){ files.remove('font'); });
    });
  }
  // ---- fontkit, only fetched when someone uses their own font ----
  var fontkitPromise = null;
  function loadFontkit(){
    if (!fontkitPromise) {
      fontkitPromise = new Promise(function(resolve, reject){
        var tag = document.createElement('script');
        tag.src = '/assets/vendor/fontkit.umd.min.js?v=1.1.1';
        tag.onload = function(){ window.fontkit ? resolve(window.fontkit) : reject(new Error('fontkit did not load')); };
        tag.onerror = function(){ fontkitPromise = null; reject(new Error('Couldn’t load the font tools. Check your connection.')); };
        document.head.appendChild(tag);
      });
    }
    return fontkitPromise;
  }

  // ---- Stamping (shared by the preview and the real output) ----
  // The 14 standard PDF fonts need no embedding. Index: bold + 2 * italic.
  var STANDARD = {
    helvetica: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'],
    times: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'],
    courier: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique']
  };
  // Closest browser fonts, for text drawn on a canvas instead (see textToPng).
  var CSS_FAMILY = {
    helvetica: 'Helvetica, Arial, "Liberation Sans", "Noto Sans", sans-serif',
    times: '"Times New Roman", Times, "Liberation Serif", "Noto Serif", serif',
    courier: '"Courier New", Courier, "Liberation Mono", "Noto Sans Mono", monospace',
    custom: '"bdnix-wm-custom", sans-serif'
  };
  // pdf-lib places glyphs one after another without shaping, which is fine
  // for Latin, Greek, Cyrillic and CJK but garbles scripts like Bangla or
  // Arabic. Text with anything outside these ranges goes through the canvas.
  var NO_SHAPING = /^[\u0000-\u052F\u1E00-\u1FFF\u2000-\u206F\u20A0-\u20CF\u2100-\u214F\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]*$/;
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
  function textToPng(text, color, s){
    var custom = s.font === 'custom';
    var style = (s.italic && !custom ? 'italic ' : '') + (s.bold && !custom ? '700 ' : '400 ');
    var key = [color, s.font, style, text].join('|');
    if (textImageCache[key]) return Promise.resolve(textImageCache[key]);
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    var px = 160;
    var fontFor = function(size){ return style + size + 'px ' + CSS_FAMILY[s.font]; };
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
    function asImage(){
      return textToPng(s.text, s.color, s).then(function(png){ return doc.embedPng(png); }).then(function(img){
        return { image: img, aspect: img.height / img.width };
      });
    }
    if (s.font === 'custom') {
      if (!customFont) return Promise.resolve(null);
      if (!NO_SHAPING.test(s.text)) return asImage();
      return loadFontkit().then(function(fontkit){
        doc.registerFontkit(fontkit);
        // Embed the whole font: pdf-lib's subsetting breaks some fonts.
        return doc.embedFont(customFont.bytes, { subset: false });
      }).then(function(font){
        return { font: font, text: s.text, color: hexToRgb(s.color) };
      });
    }
    var name = STANDARD[s.font][(s.bold ? 1 : 0) + (s.italic ? 2 : 0)];
    return doc.embedFont(L.StandardFonts[name]).then(function(font){
      try {
        font.encodeText(s.text);
        return { font: font, text: s.text, color: hexToRgb(s.color) };
      } catch (e) {
        // Standard fonts only cover Western European letters.
        return asImage();
      }
    });
  }

  function stamp(page, mark, s){
    var box = page.getCropBox();
    var rot = rotationOf(page);

    // Size is the watermark's width as a share of the page's shorter side.
    var w = Layout.viewSize(box, rot).short * s.size / 100, h, fontSize;
    if (mark.font) {
      fontSize = w / mark.font.widthOfTextAtSize(mark.text, 1);
      h = mark.font.heightAtSize(fontSize, { descender: false });
    } else {
      h = w * mark.aspect;
    }

    var placed = Layout.place(box, rot, w, h, s);
    placed.origins.forEach(function(o){
      var opts = { x: o[0], y: o[1], rotate: L.degrees(placed.angle), opacity: s.opacity };
      if (mark.font) {
        opts.font = mark.font; opts.size = fontSize; opts.color = mark.color;
        page.drawText(mark.text, opts);
      } else {
        opts.width = w; opts.height = h;
        page.drawImage(mark.image, opts);
      }
    });
    if (s.layer === 'back') sendToBack(page);
  }

  // pdf-lib appends what it draws as the page's last content stream. Moving
  // that stream to the front makes the page's own content paint over it.
  // pdf-lib wraps both its drawing and the original content in q/Q, so
  // neither can leak graphics state into the other.
  function sendToBack(page){
    var contents = page.node.Contents();
    if (!(contents instanceof L.PDFArray) || contents.size() < 2) return;
    var last = contents.size() - 1;
    var ours = contents.get(last);
    contents.remove(last);
    contents.insert(0, ours);
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

  // A one-page copy of page `index`, so a "behind" preview can stamp the real
  // page without reloading the whole file each time.
  var pageCopies = {};
  function pageCopy(index){
    if (!pageCopies[index]) {
      pageCopies[index] = L.PDFDocument.create().then(function(doc){
        return doc.copyPages(src.doc, [index]).then(function(pages){
          doc.addPage(pages[0]);
          return doc.save();
        });
      });
    }
    return pageCopies[index];
  }

  // Behind the content can't be faked with an overlay, so stamp a copy of
  // the real page and render that instead. Resolves to null with no watermark.
  function behindPage(index, s, fit, lib){
    return pageCopy(index).then(function(bytes){
      return L.PDFDocument.load(bytes);
    }).then(function(doc){
      return prepareMark(doc, s).then(function(mark){
        if (!mark) return null;
        stamp(doc.getPage(0), mark, s);
        return doc.save();
      });
    }).then(function(bytes){
      if (!bytes) return null;
      var task = lib.getDocument({ data: bytes, isEvalSupported: false });
      return task.promise.then(function(d){ return renderPage(d, 1, fit, false); })
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

    T.loadPdfjs().then(function(lib){
      if (included && s.layer === 'back') {
        return behindPage(i, s, fit, lib).then(function(c){
          return c ? [c, null] : Promise.all([basePage(i, fit), null]);
        });
      }
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
        s.kind === 'text' && s.font === 'custom' && !customFont ? 'Choose a font file to see it here.' :
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
    fontPick.hidden = s.font !== 'custom';
    F.bold.disabled = F.italic.disabled = s.font === 'custom';
    layerHint.hidden = s.layer !== 'back';
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
      ok = !sel.error && (s.kind === 'image' ? !!image : !!s.text && (s.font !== 'custom' || !!customFont));
    }
    applyBtn.disabled = busy || !ok;
  }

  function onChange(e){
    // Tiling many copies of a big watermark just covers the page, so start smaller.
    if (e && e.target === F.tile && F.tile.checked && +F.size.value > 45) F.size.value = 35;
    syncForm();
    clearResult();
    schedulePreview();
    saveSettings();
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
      pageCopies = {};
      clearResult();
      drop.hidden = true;
      fileBar.hidden = false;
      editor.hidden = false;
      fileName.textContent = file.name;
      fileName.title = file.name;
      fileMeta.textContent = T.plural(src.pages, 'page') + ' · ' + T.fmtSize(file.size);
      say('');
      var current = src;
      T.loadPdfjs().then(function(lib){
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

  T.onFileDrop(drop, function(list){
    var f = list[0];
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
      image.name = file.name;
      files.set('image', { bytes: img.bytes, type: img.type, name: file.name });
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

  // Checks a font file with fontkit, then registers it with the browser too,
  // so text that has to go through the canvas uses the same font.
  var fontFace = null;
  function useFont(bytes, name){
    return loadFontkit().then(function(fontkit){
      var parsed = fontkit.create(new Uint8Array(bytes));
      if (!parsed || typeof parsed.layout !== 'function') throw new Error('not a single font');
      var face = new FontFace('bdnix-wm-custom', bytes);
      return face.load().then(function(loaded){
        if (fontFace) document.fonts.delete(fontFace);
        document.fonts.add(loaded);
        fontFace = loaded;
      }, function(){ /* The PDF can still use it; only the canvas fallback loses it. */ });
    }).then(function(){
      customFont = { bytes: bytes, name: name };
      textImageCache = {};
      fontName.textContent = name;
      fontName.title = name;
      syncForm();
      clearResult();
      schedulePreview();
    });
  }

  fontPicker.addEventListener('change', function(e){
    e.stopPropagation();
    var file = fontPicker.files[0];
    fontPicker.value = '';
    if (!file) return;
    T.readBytes(file).then(function(bytes){
      return useFont(bytes, file.name).then(function(){
        files.set('font', { bytes: bytes, name: file.name });
        say('');
      });
    }).catch(function(){
      say('Couldn’t use ' + file.name + '. Choose a .ttf or .otf font file.', true);
    });
  });

  resetBtn.addEventListener('click', function(){
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    files.remove('image');
    files.remove('font');
    var pages = F.pages.value;
    form.reset();
    // The page list belongs to this file, not the settings, so keep it.
    F.pages.value = pages;
    image = null;
    customFont = null;
    if (fontFace) { document.fonts.delete(fontFace); fontFace = null; }
    imageName.textContent = 'PNG or JPG, e.g. a logo';
    fontName.textContent = 'A .ttf or .otf file';
    sizes = { text: 80, image: 40 };
    lastKind = 'text';
    onChange();
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    say('Settings reset to the defaults.');
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

  restoreSettings();
  syncForm();
  restoreFiles();
})();
