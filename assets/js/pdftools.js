// Helpers shared by the bdnix PDF tools (merge-pdf, watermark-pdf, redact-pdf).
(function(){
  function fmtSize(n){
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function plural(n, word){ return n + ' ' + word + (n === 1 ? '' : 's'); }

  // Parses "1-3, 5, 8-" into 0-based page indices, in the order written.
  // Empty means every page. "8-" runs to the last page, "-3" from the first,
  // and "5-3" runs backwards.
  function parseRange(text, max){
    var t = text.replace(/[\u2012-\u2015]/g, '-').replace(/\s*-\s*/g, '-').trim();
    if (!t) return { pages: all(max) };
    var parts = t.split(/[\s,;]+/).filter(Boolean);
    var pages = [];
    for (var i = 0; i < parts.length; i++) {
      var m = /^(\d*)-(\d*)$/.exec(parts[i]) || /^(\d+)$/.exec(parts[i]);
      if (!m || (m[1] === '' && m[2] === '')) return { error: '“' + parts[i] + '” isn’t a page or range' };
      var a = m[1] === '' ? 1 : +m[1];
      var b = m[2] === undefined ? a : m[2] === '' ? max : +m[2];
      var bad = [a, b].filter(function(n){ return n < 1 || n > max; })[0];
      if (bad !== undefined) return { error: 'No page ' + bad + ' (this file has ' + plural(max, 'page') + ')' };
      var step = a <= b ? 1 : -1;
      for (var n = a; n !== b + step; n += step) pages.push(n - 1);
    }
    return { pages: pages };
  }
  function all(max){
    var out = [];
    for (var i = 0; i < max; i++) out.push(i);
    return out;
  }

  function isPdf(file){
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }

  function readBytes(file){
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = function(){ reject(r.error); };
      r.readAsArrayBuffer(file);
    });
  }

  // Files dropped anywhere on the page go to onFiles(fileList). The drop
  // zone lights up while files are dragged over the window.
  function onFileDrop(zone, onFiles){
    function hasFiles(e){
      var types = e.dataTransfer && e.dataTransfer.types;
      return !!types && Array.prototype.indexOf.call(types, 'Files') >= 0;
    }
    var depth = 0;
    document.addEventListener('dragenter', function(e){
      if (!hasFiles(e)) return;
      depth++;
      zone.classList.add('over');
    });
    document.addEventListener('dragleave', function(e){
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) zone.classList.remove('over');
    });
    document.addEventListener('dragover', function(e){
      if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    });
    document.addEventListener('drop', function(e){
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      zone.classList.remove('over');
      onFiles(e.dataTransfer.files);
    });
  }

  // pdf.js is big, so it's only fetched once a page needs it. Resolves to
  // null if it can't load.
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

  window.bdnixPdf = {
    fmtSize: fmtSize, plural: plural, parseRange: parseRange,
    isPdf: isPdf, readBytes: readBytes, onFileDrop: onFileDrop, loadPdfjs: loadPdfjs
  };
})();
