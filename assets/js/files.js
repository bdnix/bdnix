// Reading the files a visitor opens in a tool, and the words for them:
// every tool page uses these. Nothing is uploaded; files are read here in
// the browser.
(function(){
  function fmtSize(n){
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function plural(n, word){ return n + ' ' + word + (n === 1 ? '' : 's'); }

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

  // Big libraries are fetched the first time they're needed, not with the
  // page. Resolves to window[name] once src has run; a load that fails is
  // forgotten, so the next call tries again.
  var scripts = {};
  function loadScript(src, name){
    if (window[name]) return Promise.resolve(window[name]);
    if (!scripts[src]) {
      scripts[src] = new Promise(function(resolve, reject){
        var tag = document.createElement('script');
        function fail(){
          delete scripts[src];
          if (tag.parentNode) tag.parentNode.removeChild(tag);
          reject(new Error(src + ' did not load'));
        }
        tag.src = src;
        tag.onload = function(){ window[name] ? resolve(window[name]) : fail(); };
        tag.onerror = fail;
        document.head.appendChild(tag);
      });
    }
    return scripts[src];
  }

  // Points a link at a file the visitor can download. It opens in a new
  // window: a browser that shows the file rather than saving it (Safari on
  // a phone shows PDFs and images) then leaves the tool, and the visitor's
  // work in it, where it was.
  function offer(a, url, name){
    a.href = url;
    a.download = name;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  window.bdnixFiles = { fmtSize: fmtSize, plural: plural, readBytes: readBytes, onFileDrop: onFileDrop, loadScript: loadScript, offer: offer };
})();
