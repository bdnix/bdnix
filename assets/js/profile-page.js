// Profile page: edit the display name and show each game's best score.
(function(){
  var P = window.bdnixProfile;
  function $(id){ return document.getElementById(id); }
  var nameView = $('nameView'), nameForm = $('nameForm'), nameInput = $('nameInput');
  var msg = $('msg');

  // The page's words, in its language: English here, Bangla on its Bangla
  // copy (bn/profile/index.html), which also counts in Bangla digits.
  var BN = document.documentElement.lang === 'bn';
  function num(n){ return BN ? n.toLocaleString('bn-BD') : n.toLocaleString(); }
  var WORDS = BN ? {
    notPlayed: 'এখনো খেলা হয়নি', play: 'খেলুন', playAgain: 'আবার খেলুন',
    visits: function(n){ return n === 1 ? 'আপনি bdnix-এ একবার এসেছেন।' : 'আপনি bdnix-এ ' + num(n) + ' বার এসেছেন।'; },
    saved: function(name){ return 'সেভ হয়েছে। হ্যালো, ' + name + '!'; },
    on: 'চালু। Google Analytics কুকি দিয়ে আপনার ভিজিট গোনে। টুলে খোলা আপনার ফাইল কখনো আপনার ব্রাউজারের বাইরে যায় না।',
    off: 'বন্ধ। Google Analytics-কে কুকি দিয়ে আপনার ভিজিট গুনতে দিতে চাইলে চালু করুন। টুলে খোলা আপনার ফাইল কখনো আপনার ব্রাউজারের বাইরে যায় না।',
    turnOn: 'চালু করুন', turnOff: 'বন্ধ করুন',
    turnedOn: 'অ্যানালিটিক্স কুকি চালু হয়েছে। ধন্যবাদ!', turnedOff: 'অ্যানালিটিক্স কুকি বন্ধ হয়েছে।'
  } : {
    notPlayed: 'Not played yet', play: 'Play', playAgain: 'Play again',
    visits: function(n){ return 'You’ve visited bdnix ' + (n === 1 ? 'once' : num(n) + ' times') + '.'; },
    saved: function(name){ return 'Saved. Hi, ' + name + '!'; },
    on: 'On. Google Analytics counts your visits with cookies. Files you open in the tools never leave your browser.',
    off: 'Off. Turn it on to let Google Analytics count your visits with cookies. Files you open in the tools never leave your browser.',
    turnOn: 'Turn on', turnOff: 'Turn off',
    turnedOn: 'Analytics cookies turned on. Thanks!', turnedOff: 'Analytics cookies turned off.'
  };

  $('year').textContent = BN ? new Date().getFullYear().toLocaleString('bn-BD', { useGrouping: false }) : new Date().getFullYear();

  function read(key){
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  // Each game's row is in the page (written by scripts/build.mjs from
  // scripts/site.mjs), with the key its best score is kept under.
  function renderScores(){
    [].forEach.call(document.querySelectorAll('#scores [data-best]'), function(row){
      var best = parseInt(read(row.getAttribute('data-best')), 10);
      best = best > 0 ? best : 0;
      var b = row.querySelector('b');
      var label = row.getAttribute('data-best-label');
      b.textContent = best ? (label ? label + ' ' : '') + num(best) : WORDS.notPlayed;
      b.classList.toggle('none', !best);
      row.querySelector('a').textContent = best ? WORDS.playAgain : WORDS.play;
    });

    var v = parseInt(read('bdnix_visits'), 10) || 0;   // counted by the landing page (main.js)
    $('visits').textContent = v ? WORDS.visits(v) : '';
  }

  function openEditor(){
    var name = P.getName();
    nameInput.value = name === P.DEFAULT_NAME ? '' : name;
    nameInput.placeholder = P.DEFAULT_NAME;
    nameView.hidden = true;
    nameForm.hidden = false;
    msg.textContent = '';
    nameInput.focus();
  }
  function closeEditor(){
    nameForm.hidden = true;
    nameView.hidden = false;
    $('editBtn').focus();
  }

  $('editBtn').addEventListener('click', openEditor);
  $('cancelBtn').addEventListener('click', closeEditor);
  nameInput.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeEditor(); });
  nameForm.addEventListener('submit', function(e){
    e.preventDefault();
    var name = P.setName(nameInput.value);
    closeEditor();
    msg.textContent = WORDS.saved(name);
  });

  // Google Analytics consent: the same choice the banner asks for.
  var A = window.bdnixAnalytics;
  function renderAnalytics(){
    var on = A.consent() === 'granted';
    $('analyticsState').textContent = on ? WORDS.on : WORDS.off;
    $('analyticsBtn').textContent = on ? WORDS.turnOff : WORDS.turnOn;
  }
  $('analyticsBtn').addEventListener('click', function(){
    var on = A.setConsent(A.consent() === 'granted' ? 'denied' : 'granted') === 'granted';
    msg.textContent = on ? WORDS.turnedOn : WORDS.turnedOff;
  });
  window.addEventListener('bdnix:consent', renderAnalytics);
  renderAnalytics();

  // Scores can change in another tab (a game in progress), so keep them fresh.
  window.addEventListener('storage', renderScores);
  window.addEventListener('pageshow', renderScores);
  renderScores();
})();
