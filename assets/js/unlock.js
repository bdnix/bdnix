// PDF unlocker: takes the password off a PDF the visitor can open. Runs
// entirely in the browser with pdf-lib and unlock-core.js; neither the file
// nor the password goes anywhere.
(function(){
  var T = window.bdnixFiles, P = window.bdnixPdf, U = window.bdnixUnlock;
  var fmtSize = T.fmtSize, plural = T.plural;
  function $(id){ return document.getElementById(id); }

  var drop = $('drop'), picker = $('picker'), msg = $('msg');
  var fileBar = $('fileBar'), fileName = $('fileName'), fileMeta = $('fileMeta'), changeBtn = $('changeBtn');
  var form = $('unlockForm'), password = $('password'), showBtn = $('showBtn');
  var unlockBtn = $('unlockBtn'), unlockLabel = $('unlockLabel');
  var done = $('done'), downloadBtn = $('downloadBtn'), downloadLabel = $('downloadLabel');

  document.getElementById('year').textContent = new Date().getFullYear();

  // The open file: { name, size, file } where file is what U.open() gives.
  var current = null;
  var busy = false;
  var resultUrl = null;

  function say(text, isError){
    msg.textContent = text || '';
    msg.classList.toggle('error', !!isError);
  }

  function clearResult(){
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    done.hidden = true;
    downloadBtn.removeAttribute('href');
  }

  function update(){
    picker.disabled = busy;
    changeBtn.disabled = busy;
    password.disabled = busy;
    unlockBtn.disabled = busy || !password.value;
  }

  function setInvalid(bad){
    password.classList.toggle('invalid', bad);
    password.setAttribute('aria-invalid', bad ? 'true' : 'false');
  }

  function showFile(name, meta){
    drop.hidden = true;
    fileBar.hidden = false;
    fileName.textContent = name;
    fileName.title = name;
    fileMeta.textContent = meta;
  }

  function openFile(fileList){
    if (busy) return;
    var file = Array.prototype.filter.call(fileList, P.isPdf)[0];
    if (!file) {
      if (fileList.length) say('Choose a PDF file to unlock.', true);
      return;
    }
    busy = true;
    current = null;
    clearResult();
    form.hidden = true;
    password.value = '';
    setInvalid(false);
    update();
    say('Reading ' + file.name + '…');

    var lib;
    P.loadPdfLib().then(function(l){
      lib = l;
      return T.readBytes(file);
    }).then(function(buf){
      return U.open(lib, buf);
    }).then(function(opened){
      current = { name: file.name, size: file.size, file: opened };
      if (!opened.encrypted) {
        showFile(file.name, fmtSize(file.size));
        say(file.name + ' isn’t password-protected, so there’s no password to remove.', true);
        return;
      }
      showFile(file.name, 'Password-protected · ' + U.describe(opened.enc) + ' · ' + fmtSize(file.size));
      form.hidden = false;
      say(opened.needsPassword ?
        'Type the password you open this PDF with.' :
        'This PDF opens without a password but limits printing, copying or editing. Type its owner password to lift the limits.');
      return true;
    }).catch(function(err){
      if (err && err.library) say(err.message, true);
      else if (err && err.unsupported) say(file.name + ': ' + err.message, true);
      else say(file.name + ' could not be read as a PDF.', true);
    }).then(function(ready){
      busy = false;
      update();
      if (ready) password.focus();
    });
  }

  function unlock(){
    if (busy || !current || !current.file.encrypted || !password.value) return;
    busy = true;
    update();
    clearResult();
    unlockLabel.textContent = 'Unlocking…';
    say('');
    var f = current.file, lib = f.lib, pages = 0;

    U.unlock(f, password.value).then(function(result){
      if (!result) return null;
      var doc = new lib.PDFDocument(f.context, false, false);
      pages = doc.getPageCount();
      return doc.save();
    }).then(function(bytes){
      if (!bytes) {
        setInvalid(true);
        say('That password doesn’t open this PDF. Check it and try again.', true);
        return;
      }
      setInvalid(false);
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var name = current.name.replace(/\.pdf$/i, '') + '-unlocked.pdf';
      resultUrl = URL.createObjectURL(blob);
      T.offer(downloadBtn, resultUrl, name);
      downloadLabel.textContent = 'Download ' + name + ' (' + fmtSize(blob.size) + ')';
      form.hidden = true;
      password.value = '';
      done.hidden = false;
      fileMeta.textContent = 'Unlocked · ' + plural(pages, 'page') + ' · ' + fmtSize(blob.size);
      say('Done. The new copy opens without a password.');
      downloadBtn.focus();
    }).catch(function(err){
      say('Something went wrong while unlocking: ' + (err && err.message ? err.message : err), true);
    }).then(function(){
      busy = false;
      unlockLabel.textContent = 'Unlock PDF';
      update();
      if (!form.hidden) password.select();
    });
  }

  picker.addEventListener('change', function(){
    openFile(picker.files);
    picker.value = '';
  });
  T.onFileDrop(drop, openFile);
  changeBtn.addEventListener('click', function(){ picker.click(); });

  password.addEventListener('input', function(){
    setInvalid(false);
    update();
  });
  showBtn.addEventListener('click', function(){
    var show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    showBtn.textContent = show ? 'Hide' : 'Show';
    showBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
  });
  form.addEventListener('submit', function(e){
    e.preventDefault();
    unlock();
  });

  update();
})();
