// Helpers for the PDF tools (merge-pdf, watermark-pdf, redact-pdf): page
// ranges, spotting a PDF, and loading pdf.js. Needs files.js first.
(function(){
  var plural = window.bdnixFiles.plural;

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

  // pdf.js reads a page's text with `for await` over a ReadableStream, which
  // Safari (so every iOS browser) can't do. This adds that to streams that
  // lack it, reading them with a plain reader instead.
  function streamIterable(Stream){
    if (typeof Stream !== 'function' || typeof Symbol === 'undefined' || !Symbol.asyncIterator) return false;
    var proto = Stream.prototype;
    if (proto[Symbol.asyncIterator]) return false;
    proto[Symbol.asyncIterator] = function(){
      var reader = this.getReader();
      var it = {
        next: function(){
          return reader.read().then(function(r){
            if (r.done) reader.releaseLock();
            return r;
          });
        },
        'return': function(value){
          return reader.cancel().then(function(){
            reader.releaseLock();
            return { done: true, value: value };
          });
        }
      };
      it[Symbol.asyncIterator] = function(){ return it; };
      return it;
    };
    return true;
  }

  // pdf.js is big, so it's only fetched once a page needs it. Resolves to
  // null if it can't load.
  var pdfjsPromise = null;
  function loadPdfjs(){
    if (!pdfjsPromise) {
      streamIterable(window.ReadableStream);
      pdfjsPromise = import('/assets/vendor/pdfjs/pdf.min.mjs').then(function(lib){
        lib.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs/pdf.worker.min.mjs';
        return lib;
      }).catch(function(){ return null; });
    }
    return pdfjsPromise;
  }

  window.bdnixPdf = {
    parseRange: parseRange, isPdf: isPdf, loadPdfjs: loadPdfjs, streamIterable: streamIterable
  };
})();
