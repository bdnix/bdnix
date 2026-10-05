// PDF merger. Runs entirely in the browser with pdf-lib; nothing is uploaded.
(function(){
  var T = window.bdnixFiles, P = window.bdnixPdf;
  var fmtSize = T.fmtSize, plural = T.plural, parseRange = P.parseRange, isPdf = P.isPdf, readBytes = T.readBytes;

  var drop = document.getElementById('drop');
  var picker = document.getElementById('picker');
  var msg = document.getElementById('msg');
  var wrap = document.getElementById('filesWrap');
  var list = document.getElementById('list');
  var summary = document.getElementById('summary');
  var clearBtn = document.getElementById('clearBtn');
  var mergeBtn = document.getElementById('mergeBtn');
  var mergeLabel = document.getElementById('mergeLabel');
  var preview = document.getElementById('preview');
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('pageCanvas');
  var previewNote = document.getElementById('previewNote');
  var prevBtn = document.getElementById('prevPage');
  var nextBtn = document.getElementById('nextPage');
  var pageLabel = document.getElementById('pageLabel');

  document.getElementById('year').textContent = new Date().getFullYear();

  // Each entry: { id, name, size, pages, doc, range, sel }
  // range is what the user typed; sel is the parsed 0-based page list, or an error.
  var files = [];
  var nextId = 1;
  var busy = false;
  var saved = null;   // the object URL of the last file saved
  // The preview: the merged file as pdf.js sees it ({ task, doc, pages }),
  // the page showing, and counters that tell slower work it's out of date.
  var view = null;
  var pageIndex = 0;
  var viewSeq = 0, showSeq = 0, viewTimer = null;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  // Copies the chosen pages of every file, in order, into one new PDF.
  // progress(i) is told before each file.
  function build(progress){
    return P.loadPdfLib().then(function(lib){ return lib.PDFDocument.create(); }).then(function(out){
      return files.slice().reduce(function(chain, f, i){
        return chain.then(function(){
          if (progress) progress(i);
          return out.copyPages(f.doc, f.sel.pages).then(function(pages){
            pages.forEach(function(p){ out.addPage(p); });
          });
        });
      }, Promise.resolve()).then(function(){ return out; });
    });
  }

  // ---- Preview ----
  // The merged file, shown one page at a time. Any change to the list
  // rebuilds it, after a short pause so typing a range doesn't rebuild it
  // on every key.
  function setNote(text){
    previewNote.textContent = text;
    previewNote.hidden = !text;
  }

  function dropView(){
    if (view) view.task.destroy();
    view = null;
  }

  function changed(){
    clearTimeout(viewTimer);
    var seq = ++viewSeq;
    preview.hidden = files.length === 0;
    if (!files.length) {
      dropView();
      pageIndex = 0;
      return;
    }
    if (files.some(function(f){ return f.sel.error; })) {
      dropView();
      showPage();
      setNote('Fix the page ranges marked in red to see the preview.');
      return;
    }
    setNote(view ? 'Updating the preview…' : 'Loading the preview…');
    viewTimer = setTimeout(function(){
      var lib;
      P.loadPdfjs().then(function(l){
        lib = l;
        if (!lib) throw new Error('pdf.js is unavailable');
        return build();
      }).then(function(out){
        return out.save();
      }).then(function(bytes){
        if (seq !== viewSeq) return;
        var task = lib.getDocument({ data: bytes, isEvalSupported: false });
        return task.promise.then(function(doc){
          if (seq !== viewSeq) { task.destroy(); return; }
          dropView();
          view = { task: task, doc: doc, pages: doc.numPages };
          pageIndex = Math.min(pageIndex, view.pages - 1);
          showPage();
        });
      }).catch(function(){
        if (seq !== viewSeq) return;
        dropView();
        showPage();
        setNote('The preview can’t be shown in this browser, but you can still merge your files.');
      });
    }, 250);
  }

  function showPage(){
    var seq = ++showSeq;
    if (!view) {
      canvas.hidden = true;
      pageLabel.textContent = '';
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }
    var i = pageIndex, n = view.pages;
    pageLabel.textContent = 'Page ' + (i + 1) + ' of ' + n;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i >= n - 1;
    var cs = getComputedStyle(stage);
    var fit = {
      w: Math.max(120, stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
      h: Math.max(240, Math.floor(window.innerHeight * 0.7))
    };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.doc.getPage(i + 1).then(function(page){
      var vp1 = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: Math.min(fit.w / vp1.width, fit.h / vp1.height) * dpr });
      // Drawn off screen first, so the page showing never goes blank.
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function(){ return c; });
    }).then(function(c){
      if (seq !== showSeq) return;
      canvas.width = c.width;
      canvas.height = c.height;
      canvas.style.width = Math.round(c.width / dpr) + 'px';
      canvas.getContext('2d').drawImage(c, 0, 0);
      canvas.setAttribute('aria-label', 'Page ' + (i + 1) + ' of ' + n + ' of the merged PDF');
      canvas.hidden = false;
      setNote('');
    }, function(){
      // The file was replaced while this page was drawing; the new one shows itself.
    });
  }

  // The buttons are disabled at either end, and while there's no preview.
  function turn(by){
    pageIndex += by;
    showPage();
  }
  prevBtn.addEventListener('click', function(){ turn(-1); });
  nextBtn.addEventListener('click', function(){ turn(1); });

  function addFiles(fileList){
    if (busy) return;
    var incoming = Array.prototype.slice.call(fileList);
    var skipped = incoming.filter(function(f){ return !isPdf(f); });
    var pdfs = incoming.filter(isPdf);
    if (!pdfs.length) {
      if (skipped.length) say('Only PDF files can be merged.', true);
      return;
    }
    busy = true;
    render();
    say('Reading ' + plural(pdfs.length, 'file') + '…');

    var problems = skipped.map(function(f){ return f.name + ' is not a PDF'; });
    var PDFDocument;
    // Read in order so the list matches the order the files were picked in.
    pdfs.reduce(function(chain, file){
      return chain.then(function(){
        return readBytes(file)
          .then(function(buf){ return PDFDocument.load(buf, { updateMetadata: false }); })
          .then(function(doc){
            var n = doc.getPageCount();
            files.push({ id: nextId++, name: file.name, size: file.size, pages: n, doc: doc, range: '', sel: parseRange('', n) });
          })
          .catch(function(err){
            var encrypted = err && /encrypt/i.test(err.message || String(err));
            problems.push(file.name + (encrypted ? ' is password-protected' : ' could not be read'));
          });
      });
    }, P.loadPdfLib().then(function(lib){ PDFDocument = lib.PDFDocument; })).then(function(){
      busy = false;
      render();
      changed();
      say(problems.length ? 'Skipped: ' + problems.join('; ') + '.' : '', problems.length > 0);
    }, function(err){
      busy = false;
      render();
      say(err.message, true);
    });
  }

  function move(from, to){
    if (to < 0 || to >= files.length || from === to) return;
    var item = files.splice(from, 1)[0];
    files.splice(to, 0, item);
    render();
    changed();
  }

  function iconBtn(cls, label, path, onClick, disabled){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn ' + cls;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.disabled = disabled;
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
    b.addEventListener('click', onClick);
    return b;
  }

  function render(){
    wrap.hidden = files.length === 0;
    list.textContent = '';

    files.forEach(function(f, i){
      var li = document.createElement('li');
      li.className = 'file panel';
      li.draggable = !busy;
      li.dataset.index = i;

      var info = document.createElement('div');
      info.className = 'file-info';
      var name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = f.name;
      name.title = f.name;
      var meta = document.createElement('span');
      meta.className = 'file-meta';
      info.appendChild(name);
      info.appendChild(meta);

      var field = document.createElement('label');
      field.className = 'file-range';
      var cap = document.createElement('span');
      cap.textContent = 'Pages';
      var input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.value = f.range;
      input.placeholder = f.pages === 1 ? 'all' : 'all, or e.g. 1-' + Math.min(3, f.pages) + (f.pages > 4 ? ', ' + f.pages : '');
      input.disabled = busy;
      input.setAttribute('aria-label', 'Pages to include from ' + f.name);
      // Typing only updates this row and the totals, so the input keeps focus.
      input.addEventListener('input', function(){
        f.range = input.value;
        f.sel = parseRange(f.range, f.pages);
        showMeta(f, meta, input);
        updateTotals();
        changed();
      });
      // A draggable row stops the mouse from selecting text in the input.
      input.addEventListener('focus', function(){ li.draggable = false; });
      input.addEventListener('blur', function(){ li.draggable = !busy; });
      field.appendChild(cap);
      field.appendChild(input);
      info.appendChild(field);
      showMeta(f, meta, input);

      var btns = document.createElement('div');
      btns.className = 'file-btns';
      btns.appendChild(iconBtn('up', 'Move ' + f.name + ' up', 'M4 10l4-4 4 4', function(){ move(i, i - 1); }, busy || i === 0));
      btns.appendChild(iconBtn('down', 'Move ' + f.name + ' down', 'M4 6l4 4 4-4', function(){ move(i, i + 1); }, busy || i === files.length - 1));
      btns.appendChild(iconBtn('rm', 'Remove ' + f.name, 'M4 4l8 8M12 4l-8 8', function(){
        files.splice(i, 1);
        render();
        changed();
        say('');
      }, busy));

      li.appendChild(info);
      li.appendChild(btns);
      list.appendChild(li);
    });

    clearBtn.disabled = busy;
    picker.disabled = busy;
    updateTotals();
  }

  function showMeta(f, meta, input){
    var err = f.sel.error;
    meta.classList.toggle('error', !!err);
    input.classList.toggle('invalid', !!err);
    input.setAttribute('aria-invalid', err ? 'true' : 'false');
    if (err) meta.textContent = err;
    else if (f.range.trim()) meta.textContent = f.sel.pages.length + ' of ' + plural(f.pages, 'page') + ' · ' + fmtSize(f.size);
    else meta.textContent = plural(f.pages, 'page') + ' · ' + fmtSize(f.size);
  }

  function updateTotals(){
    var total = 0, errors = 0;
    files.forEach(function(f){
      if (f.sel.error) errors++;
      else total += f.sel.pages.length;
    });
    summary.textContent = plural(files.length, 'file') + ' · ' + plural(total, 'page') + ' selected';
    mergeBtn.disabled = busy || files.length === 0 || errors > 0;
    mergeBtn.title = errors ? 'Fix the page ranges marked in red first' : '';
  }

  // Drag to reorder (mouse). The arrow buttons cover touch and keyboard.
  var dragFrom = -1;
  function clearMarks(){
    Array.prototype.forEach.call(list.children, function(el){
      el.classList.remove('drop-before', 'drop-after', 'dragging');
    });
  }
  function dropTarget(e){
    var li = e.target.closest && e.target.closest('.file');
    if (!li) return null;
    var r = li.getBoundingClientRect();
    return { li: li, index: +li.dataset.index, after: e.clientY > r.top + r.height / 2 };
  }
  list.addEventListener('dragstart', function(e){
    var li = e.target.closest && e.target.closest('.file');
    if (!li) return;
    dragFrom = +li.dataset.index;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (err) {}
  });
  list.addEventListener('dragover', function(e){
    if (dragFrom < 0) return;
    var t = dropTarget(e);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    Array.prototype.forEach.call(list.children, function(el){ el.classList.remove('drop-before', 'drop-after'); });
    t.li.classList.add(t.after ? 'drop-after' : 'drop-before');
  });
  list.addEventListener('drop', function(e){
    if (dragFrom < 0) return;
    e.preventDefault();
    e.stopPropagation();
    var t = dropTarget(e);
    var from = dragFrom;
    dragFrom = -1;
    clearMarks();
    if (!t) return;
    var to = t.index + (t.after ? 1 : 0);
    if (from < to) to--;
    move(from, to);
  });
  list.addEventListener('dragend', function(){ dragFrom = -1; clearMarks(); });

  // Adding files: picker, drop zone, or dropping anywhere on the page.
  picker.addEventListener('change', function(){
    addFiles(picker.files);
    picker.value = '';
  });
  T.onFileDrop(drop, addFiles);

  clearBtn.addEventListener('click', function(){
    files = [];
    render();
    changed();
    say('');
  });

  // Merging saves the file straight away; the preview above shows what it holds.
  mergeBtn.addEventListener('click', function(){
    if (busy || !files.length || files.some(function(f){ return f.sel.error; })) return;
    busy = true;
    render();
    say('');
    var total = files.length;
    var out;
    // The file downloads in a new window, opened now while the click counts.
    var win = T.fileWindow();

    build(function(i){ mergeLabel.textContent = 'Merging ' + (i + 1) + ' of ' + total + '…'; }).then(function(doc){
      out = doc;
      mergeLabel.textContent = 'Saving…';
      return out.save();
    }).then(function(bytes){
      var blob = new Blob([bytes], { type: 'application/pdf' });
      if (saved) URL.revokeObjectURL(saved);
      saved = URL.createObjectURL(blob);
      win.save(saved, 'merged.pdf');
      say('Saved merged.pdf: ' + plural(out.getPageCount(), 'page') + ' from ' + plural(total, 'file') + ', ' + fmtSize(blob.size) + '.');
    }).catch(function(err){
      win.close();
      say('Something went wrong while merging: ' + (err && err.message ? err.message : err), true);
    }).then(function(){
      busy = false;
      mergeLabel.textContent = 'Merge PDFs';
      render();
    });
  });

  render();
})();
