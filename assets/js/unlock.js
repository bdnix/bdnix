// PDF unlocker: takes the password off a PDF the visitor can open. Runs
// entirely in the browser with pdf-lib and unlock-core.js; neither the file
// nor the password goes anywhere.
(function(){
  var T = window.bdnixFiles, P = window.bdnixPdf, U = window.bdnixUnlock;
  var fmtSize = T.fmtSize, fillIn = T.fillIn;
  function $(id){ return document.getElementById(id); }

  // Its words, in the page's language (bn/unlock-pdf/ is the Bangla copy).
  var W = T.words({
    en: {
      pages: ['{n} page', '{n} pages'],
      choose: 'Choose a PDF file to unlock.', reading: 'Reading {name}…',
      notLocked: '{name} isn’t password-protected, so there’s no password to remove.',
      locked: 'Password-protected · {how} · {size}',
      userPassword: 'Type the password you open this PDF with.',
      ownerPassword: 'This PDF opens without a password but limits printing, copying or editing. Type its owner password to lift the limits.',
      unsupported: '{name}: This PDF uses a kind of encryption this tool can’t remove.',
      unreadable: '{name} could not be read as a PDF.',
      unlocking: 'Unlocking…', unlock: 'Unlock PDF',
      wrong: 'That password doesn’t open this PDF. Check it and try again.',
      download: 'Download {name} ({size})', unlocked: 'Unlocked · {pages} · {size}',
      done: 'Done. The new copy opens without a password.',
      failed: 'Something went wrong while unlocking: {error}',
      show: 'Show', hide: 'Hide'
    },
    bn: {
      pages: ['{n} পৃষ্ঠা', '{n} পৃষ্ঠা'],
      choose: 'আনলক করতে একটি PDF ফাইল বেছে নিন।', reading: '{name} পড়া হচ্ছে…',
      notLocked: '{name} পাসওয়ার্ড দিয়ে সুরক্ষিত নয়, তাই সরানোর মতো কোনো পাসওয়ার্ড নেই।',
      locked: 'পাসওয়ার্ড দিয়ে সুরক্ষিত · {how} · {size}',
      userPassword: 'যে পাসওয়ার্ড দিয়ে এই PDF খোলেন, সেটি লিখুন।',
      ownerPassword: 'এই PDF পাসওয়ার্ড ছাড়াই খোলে, কিন্তু প্রিন্ট, কপি বা এডিট করতে দেয় না। এই বাধাগুলো তুলতে এর ওনার পাসওয়ার্ড লিখুন।',
      unsupported: '{name}: এই PDF এমন ধরনের এনক্রিপশন ব্যবহার করে যা এই টুল সরাতে পারে না।',
      unreadable: '{name} PDF হিসেবে পড়া যায়নি।',
      unlocking: 'আনলক হচ্ছে…', unlock: 'PDF আনলক করুন',
      wrong: 'এই পাসওয়ার্ড দিয়ে PDF-টি খোলে না। দেখে নিয়ে আবার চেষ্টা করুন।',
      download: '{name} ডাউনলোড করুন ({size})', unlocked: 'আনলক হয়েছে · {pages} · {size}',
      done: 'হয়ে গেছে। নতুন কপিটি পাসওয়ার্ড ছাড়াই খোলে।',
      failed: 'আনলক করার সময় একটা সমস্যা হয়েছে: {error}',
      show: 'দেখান', hide: 'লুকান'
    }
  });

  var drop = $('drop'), picker = $('picker'), msg = $('msg');
  var fileBar = $('fileBar'), fileName = $('fileName'), fileMeta = $('fileMeta'), changeBtn = $('changeBtn');
  var form = $('unlockForm'), password = $('password'), showBtn = $('showBtn');
  var unlockBtn = $('unlockBtn'), unlockLabel = $('unlockLabel');
  var done = $('done'), downloadBtn = $('downloadBtn'), downloadLabel = $('downloadLabel');

  document.getElementById('year').textContent = T.num(new Date().getFullYear());

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
      if (fileList.length) say(W.choose, true);
      return;
    }
    busy = true;
    current = null;
    clearResult();
    form.hidden = true;
    password.value = '';
    setInvalid(false);
    update();
    say(fillIn(W.reading, { name: file.name }));

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
        say(fillIn(W.notLocked, { name: file.name }), true);
        return;
      }
      // "AES 256-bit": only the key length is a number to show in the page's digits.
      showFile(file.name, fillIn(W.locked, { how: U.describe(opened.enc).replace(/\d+(?=-bit)/, T.num), size: fmtSize(file.size) }));
      form.hidden = false;
      say(opened.needsPassword ? W.userPassword : W.ownerPassword);
      return true;
    }).catch(function(err){
      if (err && err.library) say(err.message, true);
      else if (err && err.unsupported) say(fillIn(W.unsupported, { name: file.name }), true);
      else say(fillIn(W.unreadable, { name: file.name }), true);
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
    unlockLabel.textContent = W.unlocking;
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
        say(W.wrong, true);
        return;
      }
      setInvalid(false);
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var name = current.name.replace(/\.pdf$/i, '') + '-unlocked.pdf';
      resultUrl = URL.createObjectURL(blob);
      T.offer(downloadBtn, resultUrl, name);
      downloadLabel.textContent = fillIn(W.download, { name: name, size: fmtSize(blob.size) });
      form.hidden = true;
      password.value = '';
      done.hidden = false;
      fileMeta.textContent = fillIn(W.unlocked, { pages: T.count(pages, W.pages), size: fmtSize(blob.size) });
      say(W.done);
      downloadBtn.focus();
    }).catch(function(err){
      say(fillIn(W.failed, { error: err && err.message ? err.message : err }), true);
    }).then(function(){
      busy = false;
      unlockLabel.textContent = W.unlock;
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
    showBtn.textContent = show ? W.hide : W.show;
    showBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
  });
  form.addEventListener('submit', function(e){
    e.preventDefault();
    unlock();
  });

  update();
})();
