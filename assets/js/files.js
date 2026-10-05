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

  // Every file a tool makes downloads in a new window, so a browser that
  // shows the file rather than saving it (Safari on a phone shows PDFs and
  // images) leaves the tool, and the visitor's work in it, where it was.
  // A link's own target can't do it: browsers save a link that names a
  // download in the page it's on. So the window is opened by script, and
  // the file downloads from a link inside it.

  // The window's page: the file's name and a link to it, which is clicked
  // once. With no url yet, it says the file is on its way.
  function fill(w, url, name){
    var d = w.document;
    // A new window starts as an empty page: give it a real one first, with
    // this page's stylesheets.
    if (!d.querySelector('main')) {
      var links = Array.prototype.map.call(document.querySelectorAll('link[rel="stylesheet"]'), function(l){
        return '<link rel="stylesheet" href="' + l.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">';
      }).join('');
      d.open();
      d.write('<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' + links + '</head><body></body></html>');
      d.close();
    }
    d.title = name ? name + ' · bdnix' : 'Preparing your file · bdnix';
    var main = d.createElement('main');
    main.className = 'tool';
    var h1 = d.createElement('h1');
    h1.textContent = name || 'Preparing your file…';
    var lede = d.createElement('p');
    lede.className = 'lede';
    main.appendChild(h1);
    main.appendChild(lede);
    d.body.textContent = '';
    d.body.appendChild(main);
    if (!url) {
      lede.textContent = 'It downloads here as soon as it’s ready. Keep the other tab open until then.';
      return;
    }
    lede.textContent = 'Your download has started. If it didn’t, use the button below. You can close this tab once the file is saved.';
    var actions = d.createElement('p');
    actions.className = 'actions';
    var a = d.createElement('a');
    a.className = 'btn btn-primary';
    a.href = url;
    a.download = name;
    a.textContent = 'Download ' + name;
    actions.appendChild(a);
    main.appendChild(actions);
    a.click();
  }

  function openWindow(){
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) {}
    if (w) w.opener = null;
    return w;
  }

  // Downloads the file from this page, for when no window could be opened.
  function saveHere(url, name){
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openOffer(e){
    var a = e.currentTarget, url = a.getAttribute('href');
    if (!url) return;
    var w = openWindow();
    // Blocked: the link saves the file itself.
    if (!w) return;
    e.preventDefault();
    fill(w, url, a.download);
  }

  // Points a link at a file the visitor can download; clicking it opens the
  // new window. Pointing it at another file later is fine.
  function offer(a, url, name){
    a.href = url;
    a.download = name;
    a.target = '_blank';
    a.rel = 'noopener';
    if (!a.bdnixOffer && a.addEventListener) a.addEventListener('click', openOffer);
    a.bdnixOffer = true;
    return a;
  }

  // For a file that's made after the visitor clicks (it takes a moment, and
  // browsers block windows opened that late): call this in the click, then
  // save(url, name) once the file is ready, or close() if it can't be made.
  function fileWindow(){
    var w = openWindow();
    if (w) fill(w, null, null);
    return {
      save: function(url, name){
        if (w && !w.closed) fill(w, url, name);
        else saveHere(url, name);
      },
      close: function(){
        if (w && !w.closed) w.close();
      }
    };
  }

  window.bdnixFiles = { fmtSize: fmtSize, plural: plural, readBytes: readBytes, onFileDrop: onFileDrop, loadScript: loadScript, offer: offer, fileWindow: fileWindow };
})();
