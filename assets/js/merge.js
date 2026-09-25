// PDF merger. Runs entirely in the browser with pdf-lib; nothing is uploaded.
(function(){
  var PDFDocument = PDFLib.PDFDocument;
  var T = window.bdnixPdf;
  var fmtSize = T.fmtSize, plural = T.plural, parseRange = T.parseRange, isPdf = T.isPdf, readBytes = T.readBytes;

  var drop = document.getElementById('drop');
  var picker = document.getElementById('picker');
  var msg = document.getElementById('msg');
  var wrap = document.getElementById('filesWrap');
  var list = document.getElementById('list');
  var summary = document.getElementById('summary');
  var clearBtn = document.getElementById('clearBtn');
  var mergeBtn = document.getElementById('mergeBtn');
  var mergeLabel = document.getElementById('mergeLabel');
  var downloadBtn = document.getElementById('downloadBtn');
  var downloadLabel = document.getElementById('downloadLabel');

  document.getElementById('year').textContent = new Date().getFullYear();

  // Each entry: { id, name, size, pages, doc, range, sel }
  // range is what the user typed; sel is the parsed 0-based page list, or an error.
  var files = [];
  var nextId = 1;
  var busy = false;
  var resultUrl = null;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  // Any change to the list makes an earlier merged file stale.
  function clearResult(){
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    downloadBtn.hidden = true;
    downloadBtn.removeAttribute('href');
  }

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
    }, Promise.resolve()).then(function(){
      busy = false;
      clearResult();
      render();
      say(problems.length ? 'Skipped: ' + problems.join('; ') + '.' : '', problems.length > 0);
    });
  }

  function move(from, to){
    if (to < 0 || to >= files.length || from === to) return;
    var item = files.splice(from, 1)[0];
    files.splice(to, 0, item);
    clearResult();
    render();
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
        clearResult();
        showMeta(f, meta, input);
        updateTotals();
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
        clearResult();
        render();
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
    addFiles(e.dataTransfer.files);
  });

  clearBtn.addEventListener('click', function(){
    files = [];
    clearResult();
    render();
    say('');
  });

  mergeBtn.addEventListener('click', function(){
    if (busy || !files.length || files.some(function(f){ return f.sel.error; })) return;
    busy = true;
    clearResult();
    render();
    var total = files.length;
    var out;

    PDFDocument.create().then(function(doc){
      out = doc;
      return files.reduce(function(chain, f, i){
        return chain.then(function(){
          mergeLabel.textContent = 'Merging ' + (i + 1) + ' of ' + total + '…';
          return out.copyPages(f.doc, f.sel.pages).then(function(pages){
            pages.forEach(function(p){ out.addPage(p); });
          });
        });
      }, Promise.resolve());
    }).then(function(){
      mergeLabel.textContent = 'Saving…';
      return out.save();
    }).then(function(bytes){
      var blob = new Blob([bytes], { type: 'application/pdf' });
      resultUrl = URL.createObjectURL(blob);
      downloadBtn.href = resultUrl;
      downloadLabel.textContent = 'Download merged.pdf (' + fmtSize(blob.size) + ')';
      downloadBtn.hidden = false;
      say('Done. ' + plural(out.getPageCount(), 'page') + ' from ' + plural(total, 'file') + '.');
      downloadBtn.focus();
    }).catch(function(err){
      say('Something went wrong while merging: ' + (err && err.message ? err.message : err), true);
    }).then(function(){
      busy = false;
      mergeLabel.textContent = 'Merge PDFs';
      render();
    });
  });

  render();
})();
