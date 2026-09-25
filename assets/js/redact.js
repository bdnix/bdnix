// PDF redaction tool. pdf.js draws the pages and finds the text. Pages with
// marked areas are redrawn as images with those areas filled black, so the
// text under them is gone from the file, not just covered up. pdf-lib puts
// the result together. Everything runs in the browser; nothing is uploaded.
(function(){
  var L = PDFLib;
  var T = window.bdnixPdf;
  var R = window.bdnixRedact;
  function $(id){ return document.getElementById(id); }

  var drop = $('drop'), picker = $('picker');
  var fileBar = $('fileBar'), fileName = $('fileName'), fileMeta = $('fileMeta'), changeBtn = $('changeBtn');
  var msg = $('msg'), editor = $('editor');
  var stage = $('stage'), sheet = $('sheet'), canvas = $('pageCanvas'), marksEl = $('marks'), note = $('previewNote');
  var prevBtn = $('prevPage'), nextBtn = $('nextPage'), pageLabel = $('pageLabel');
  var findForm = $('findForm'), query = $('query'), findBtn = $('findBtn'), findHint = $('findHint');
  var summary = $('summary'), undoBtn = $('undoBtn'), clearBtn = $('clearBtn');
  var applyBtn = $('applyBtn'), applyLabel = $('applyLabel');
  var downloadBtn = $('downloadBtn'), downloadLabel = $('downloadLabel');

  $('year').textContent = new Date().getFullYear();

  // src: { name, bytes, pages, doc (pdf-lib, read only), view (pdf.js) and its viewTask }
  var src = null;
  // The marked areas on each page, keyed by page index. Boxes are fractions
  // of the page (see redact-core.js), so they fit whatever size it's drawn.
  var marks = {};
  // Each step that marked something, for Undo: lists of { page, box }.
  var history = [];
  var busy = false;
  var resultUrl = null;
  var pageIndex = 0;
  var FIND_TIP = findHint.textContent;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function hint(text, isError){
    findHint.textContent = text;
    findHint.classList.toggle('error', !!isError);
  }

  function matches(n){ return n === 1 ? '1 match' : n + ' matches'; }

  function markedPages(){
    return Object.keys(marks).map(Number).filter(function(i){ return marks[i].length; }).sort(function(a, b){ return a - b; });
  }

  function areaCount(){
    return markedPages().reduce(function(n, i){ return n + marks[i].length; }, 0);
  }

  function syncUi(){
    var n = areaCount();
    summary.textContent = n ? T.plural(n, 'area') + ' on ' + T.plural(markedPages().length, 'page') : 'Nothing marked yet';
    undoBtn.disabled = busy || !history.length;
    clearBtn.disabled = busy || !n;
    findBtn.disabled = busy || !src || !src.view;
    applyBtn.disabled = busy || !src || !src.view || !n;
  }

  function clearResult(){
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    downloadBtn.hidden = true;
    downloadBtn.removeAttribute('href');
  }

  // Marks every box not marked already, as one step for Undo. Returns how
  // many were new.
  function mark(entries){
    var added = entries.filter(function(e){
      return R.addBoxes(marks[e.page] = marks[e.page] || [], [e.box]) === 1;
    });
    if (added.length) history.push(added);
    return added.length;
  }

  // Unmarks one box, and forgets it in the undo history too.
  function unmark(page, box){
    marks[page] = marks[page].filter(function(b){ return b !== box; });
    history = history.map(function(step){
      return step.filter(function(e){ return e.box !== box; });
    }).filter(function(step){ return step.length; });
  }

  function changed(){
    clearResult();
    drawMarks();
    syncUi();
  }

  // ---- The page and its marks ----
  function place(el, box){
    el.style.left = box.x * 100 + '%';
    el.style.top = box.y * 100 + '%';
    el.style.width = box.w * 100 + '%';
    el.style.height = box.h * 100 + '%';
  }

  function drawMarks(){
    Array.prototype.slice.call(marksEl.querySelectorAll('.mark:not(.drawing)')).forEach(function(el){ el.remove(); });
    (marks[pageIndex] || []).forEach(function(box, i){
      var el = document.createElement('div');
      el.className = 'mark';
      place(el, box);
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'mark-x';
      x.dataset.index = i;
      x.setAttribute('aria-label', 'Remove this box');
      x.textContent = '×';
      el.appendChild(x);
      marksEl.appendChild(el);
    });
  }

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
    drawMarks();
    if (!src.view) {
      sheet.hidden = true;
      setNote(src.viewFailed ? 'This file’s pages can’t be shown in this browser, so it can’t be redacted here.' : 'Loading the page…');
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
      setNote('Couldn’t draw this page: ' + (err && err.message ? err.message : err));
    });
  }

  function goTo(i){
    if (!src || i < 0 || i >= src.pages || i === pageIndex) return;
    pageIndex = i;
    showPage();
  }
  prevBtn.addEventListener('click', function(){ goTo(pageIndex - 1); });
  nextBtn.addEventListener('click', function(){ goTo(pageIndex + 1); });

  var lastFit = '';
  window.addEventListener('resize', function(){
    if (!src) return;
    var f = stageSize(), key = f.w + 'x' + f.h;
    if (key === lastFit) return;
    lastFit = key;
    showPage();
  });

  // ---- Drawing boxes: mouse, pen or finger ----
  var drawing = null;
  function dragBox(e){
    var r = drawing.rect;
    return R.boxFrom(drawing.x, drawing.y, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }

  marksEl.addEventListener('pointerdown', function(e){
    if (busy || drawing || e.button > 0 || e.target.closest('.mark-x')) return;
    var r = marksEl.getBoundingClientRect();
    drawing = {
      id: e.pointerId, rect: r, page: pageIndex, el: document.createElement('div'),
      x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height
    };
    drawing.el.className = 'mark drawing';
    place(drawing.el, R.boxFrom(drawing.x, drawing.y, drawing.x, drawing.y));
    marksEl.appendChild(drawing.el);
    try { marksEl.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  marksEl.addEventListener('pointermove', function(e){
    if (drawing && e.pointerId === drawing.id) place(drawing.el, dragBox(e));
  });
  marksEl.addEventListener('pointerup', function(e){
    if (!drawing || e.pointerId !== drawing.id) return;
    var box = dragBox(e), r = drawing.rect, page = drawing.page;
    drawing.el.remove();
    drawing = null;
    // A tap or a tiny wobble isn't a box.
    if (box.w * r.width < 4 || box.h * r.height < 4) return;
    mark([{ page: page, box: box }]);
    say('');
    changed();
  });
  marksEl.addEventListener('pointercancel', function(){
    if (!drawing) return;
    drawing.el.remove();
    drawing = null;
  });

  marksEl.addEventListener('click', function(e){
    var x = e.target.closest('.mark-x');
    if (!x || busy) return;
    unmark(pageIndex, marks[pageIndex][+x.dataset.index]);
    changed();
  });

  undoBtn.addEventListener('click', function(){
    if (busy || !history.length) return;
    var step = history.pop();
    step.forEach(function(e){
      marks[e.page] = marks[e.page].filter(function(b){ return b !== e.box; });
    });
    changed();
  });

  clearBtn.addEventListener('click', function(){
    if (busy) return;
    marks = {};
    history = [];
    hint(FIND_TIP);
    say('');
    changed();
  });

  // ---- Finding text ----
  var measureCtx = document.createElement('canvas').getContext('2d');
  function measure(text, piece){
    measureCtx.font = '100px ' + piece.font;
    return measureCtx.measureText(text).width;
  }

  // A page's text pieces, placed on the page as the reader sees it.
  var textCache = {};
  function pageText(lib, i){
    if (!textCache[i]) {
      textCache[i] = src.view.getPage(i + 1).then(function(page){
        var vp = page.getViewport({ scale: 1 });
        return Promise.all([page.getTextContent(), page.getOperatorList()]).then(function(got){
          var tc = got[0];
          var items = tc.items.filter(function(it){ return typeof it.str === 'string'; }).map(function(it){
            var style = tc.styles[it.fontName];
            return {
              str: it.str, hasEOL: it.hasEOL, width: it.width,
              tx: lib.Util.transform(vp.transform, it.transform),
              font: style && style.fontFamily || 'sans-serif'
            };
          });
          return { items: items, vw: vp.width, vh: vp.height, picture: R.hasPicture(got[1].fnArray, lib.OPS) };
        });
      });
    }
    return textCache[i];
  }

  findForm.addEventListener('submit', function(e){
    e.preventDefault();
    if (busy || !src || !src.view) return;
    var q = query.value.trim();
    if (!q) return hint('Type the text you want to black out.', true);
    busy = true;
    syncUi();
    hint('Searching…');
    var found = [], hits = 0, firstPage = -1, pictures = [];
    T.loadPdfjs().then(function(lib){
      var chain = Promise.resolve();
      for (var i = 0; i < src.pages; i++) {
        chain = chain.then(pageText.bind(null, lib, i)).then(function(i, t){
          if (t.picture) pictures.push(i);
          var m = R.findMatches(t.items, q);
          if (!m.length) return;
          hits += m.length;
          if (firstPage < 0) firstPage = i;
          R.matchBoxes(t.items, m, t.vw, t.vh, measure).forEach(function(box){ found.push({ page: i, box: box }); });
        }.bind(null, i));
      }
      return chain;
    }).then(function(){
      var added = mark(found);
      // Search only sees real text, so point out the pictures it can't read.
      var note = pictures.length ? ' Search can’t read words inside pictures, so drag boxes over any on ' + R.pageList(pictures) + '.' : '';
      if (!hits) hint('“' + q + '” isn’t in this file’s text.' + (note || ' Scanned pages are pictures with no text to search, so draw boxes over those instead.'), true);
      else if (!added) hint('Every “' + q + '” is already marked.' + note);
      else hint('Marked ' + matches(hits) + ' on ' + T.plural(found.reduce(function(pages, f){
        if (pages.indexOf(f.page) < 0) pages.push(f.page);
        return pages;
      }, []).length, 'page') + '. Check them before you redact.' + note);
      // Show the first one if there's none on this page.
      if (hits && !(marks[pageIndex] || []).length) goTo(firstPage);
    }).catch(function(err){
      hint('Couldn’t search this file: ' + (err && err.message ? err.message : err), true);
    }).then(function(){
      busy = false;
      changed();
    });
  });

  query.addEventListener('input', function(){ hint(FIND_TIP); });

  // ---- Choosing a file ----
  function openFile(file){
    if (!file || busy) return;
    if (!T.isPdf(file)) return say('That isn’t a PDF file. Choose a .pdf to redact.', true);
    busy = true;
    syncUi();
    say('Reading ' + file.name + '…');
    var bytes;
    T.readBytes(file).then(function(buf){
      bytes = buf;
      return L.PDFDocument.load(buf, { updateMetadata: false });
    }).then(function(doc){
      if (src && src.viewTask) src.viewTask.destroy();
      src = { name: file.name, bytes: bytes, pages: doc.getPageCount(), doc: doc, view: null, viewTask: null };
      marks = {};
      history = [];
      textCache = {};
      pageIndex = 0;
      clearResult();
      hint(FIND_TIP);
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
        if (src === current) src.view = view;
      }).catch(function(){
        if (src === current) src.viewFailed = true;
      }).then(function(){
        if (src === current) { showPage(); syncUi(); }
      });
    }).catch(function(err){
      var encrypted = err && /encrypt/i.test(err.message || String(err));
      say(file.name + (encrypted ? ' is password-protected, so it can’t be redacted.' : ' could not be read as a PDF.'), true);
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
  function jpegBytes(c){
    return new Promise(function(resolve, reject){
      c.toBlob(function(blob){
        blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error('Could not draw the page'));
      }, 'image/jpeg', 0.92);
    });
  }

  // Draws page i as an image, with its marked areas filled solid black.
  function flatten(lib, i){
    return src.view.getPage(i + 1).then(function(page){
      var vp1 = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: R.outputScale(vp1.width, vp1.height) });
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      var ctx = c.getContext('2d');
      // Draw form fields and comments into the image as well, since the
      // new page won't have any of its own.
      return page.render({ canvasContext: ctx, viewport: vp, annotationMode: lib.AnnotationMode.ENABLE }).promise.then(function(){
        ctx.fillStyle = '#000';
        marks[i].forEach(function(box){
          var p = R.pixelRect(box, c.width, c.height);
          ctx.fillRect(p.x, p.y, p.w, p.h);
        });
        return jpegBytes(c);
      }).then(function(bytes){
        return { bytes: bytes, width: vp1.width, height: vp1.height };
      });
    });
  }

  applyBtn.addEventListener('click', function(){
    if (busy || !src || !src.view || !areaCount()) return;
    busy = true;
    syncUi();
    clearResult();
    applyLabel.textContent = 'Redacting…';
    var lib, out, marked = markedPages(), areas = areaCount();
    var kept = [];
    for (var i = 0; i < src.pages; i++) if (marked.indexOf(i) < 0) kept.push(i);

    // A new file, so nothing from the original (its title, author, bookmarks
    // or attachments) comes along except the pages themselves.
    Promise.all([T.loadPdfjs(), L.PDFDocument.create()]).then(function(r){
      lib = r[0];
      out = r[1];
      return out.copyPages(src.doc, kept);
    }).then(function(copied){
      var chain = Promise.resolve();
      for (var i = 0; i < src.pages; i++) {
        chain = chain.then(function(i){
          var k = kept.indexOf(i);
          if (k >= 0) return out.addPage(copied[k]);
          return flatten(lib, i).then(function(img){
            return out.embedJpg(img.bytes).then(function(jpg){
              out.addPage([img.width, img.height]).drawImage(jpg, { x: 0, y: 0, width: img.width, height: img.height });
            });
          });
        }.bind(null, i));
      }
      return chain;
    }).then(function(){
      return out.save();
    }).then(function(bytes){
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var name = src.name.replace(/\.pdf$/i, '') + '-redacted.pdf';
      resultUrl = URL.createObjectURL(blob);
      downloadBtn.href = resultUrl;
      downloadBtn.download = name;
      downloadBtn.title = name;
      downloadLabel.textContent = 'Download (' + T.fmtSize(blob.size) + ')';
      downloadBtn.hidden = false;
      say('Done. Blacked out ' + T.plural(areas, 'area') + ' on ' + T.plural(marked.length, 'page') + '.');
      downloadBtn.focus();
    }).catch(function(err){
      say('Something went wrong: ' + (err && err.message ? err.message : err), true);
    }).then(function(){
      busy = false;
      applyLabel.textContent = 'Redact PDF';
      syncUi();
    });
  });

  syncUi();
})();
