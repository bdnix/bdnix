// Profile page: edit the display name and show each game's best score.
(function(){
  var P = window.bdnixProfile;
  function $(id){ return document.getElementById(id); }
  var nameView = $('nameView'), nameForm = $('nameForm'), nameInput = $('nameInput');
  var msg = $('msg');

  $('year').textContent = new Date().getFullYear();

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
      b.textContent = best ? best.toLocaleString() : 'Not played yet';
      b.classList.toggle('none', !best);
      row.querySelector('a').textContent = best ? 'Play again' : 'Play';
    });

    var v = parseInt(read('bdnix_visits'), 10) || 0;   // counted by the landing page (main.js)
    $('visits').textContent = v ? 'You’ve visited bdnix ' + (v === 1 ? 'once' : v.toLocaleString() + ' times') + '.' : '';
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
    msg.textContent = 'Saved. Hi, ' + name + '!';
  });

  // Google Analytics consent: the same choice the banner asks for.
  var A = window.bdnixAnalytics;
  function renderAnalytics(){
    var on = A.consent() === 'granted';
    $('analyticsState').textContent = on
      ? 'On. Google Analytics counts your visits with cookies. Files you open in the tools never leave your browser.'
      : 'Off. Turn it on to let Google Analytics count your visits with cookies. Files you open in the tools never leave your browser.';
    $('analyticsBtn').textContent = on ? 'Turn off' : 'Turn on';
  }
  $('analyticsBtn').addEventListener('click', function(){
    var on = A.setConsent(A.consent() === 'granted' ? 'denied' : 'granted') === 'granted';
    msg.textContent = on ? 'Analytics cookies turned on. Thanks!' : 'Analytics cookies turned off.';
  });
  window.addEventListener('bdnix:consent', renderAnalytics);
  renderAnalytics();

  // Scores can change in another tab (a game in progress), so keep them fresh.
  window.addEventListener('storage', renderScores);
  window.addEventListener('pageshow', renderScores);
  renderScores();
})();
