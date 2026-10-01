// Profile page: edit the display name and show each game's best score.
(function(){
  var P = window.bdnixProfile;
  function $(id){ return document.getElementById(id); }
  var nameView = $('nameView'), nameForm = $('nameForm'), nameInput = $('nameInput');
  var msg = $('msg');

  $('year').textContent = new Date().getFullYear();

  // Same icons as the game cards on the landing page.
  var ICONS = {
    tetris: '<rect x="4" y="18" width="10" height="10" rx="2" fill="#a855f7"/><rect x="15" y="18" width="10" height="10" rx="2" fill="#a855f7"/><rect x="26" y="18" width="10" height="10" rx="2" fill="#a855f7"/><rect x="15" y="7" width="10" height="10" rx="2" fill="#a855f7"/><rect x="4" y="29" width="10" height="10" rx="2" fill="#22d3ee" opacity=".55"/><rect x="15" y="29" width="10" height="10" rx="2" fill="#22d3ee" opacity=".55"/><rect x="26" y="29" width="10" height="10" rx="2" fill="#22d3ee" opacity=".55"/>',
    pacman: '<path d="M14 20 L24.4 14 A12 12 0 1 0 24.4 26 Z" fill="#facc15"/><circle cx="29" cy="20" r="2" fill="#eef1f8" opacity=".8"/><circle cx="36" cy="20" r="2" fill="#eef1f8" opacity=".8"/>',
    flappy: '<rect x="27" y="2" width="9" height="11" rx="1.5" fill="#22d3ee" opacity=".55"/><rect x="27" y="27" width="9" height="11" rx="1.5" fill="#22d3ee" opacity=".55"/><circle cx="14" cy="20" r="9" fill="#facc15"/><ellipse cx="11" cy="22" rx="4.5" ry="2.6" fill="#f59e0b"/><circle cx="17.5" cy="17" r="2.6" fill="#fff"/><path d="M21 20l6 2-6 2z" fill="#fb923c"/>',
    hop: '<rect x="0" y="4" width="40" height="10" rx="2" fill="#22d3ee" opacity=".3"/><rect x="24" y="5.5" width="12" height="7" rx="2.5" fill="#f472b6"/><rect x="0" y="26" width="40" height="10" rx="2" fill="#22d3ee" opacity=".3"/><rect x="3" y="27.5" width="12" height="7" rx="2.5" fill="#a855f7"/><ellipse cx="20" cy="21" rx="7" ry="7.5" fill="#f8fafc"/><ellipse cx="20" cy="15" rx="2" ry="2.6" fill="#ef4444"/><path d="M18 14l2-3.5 2 3.5z" fill="#fb923c"/>',
    snake: '<path d="M6 32h14V20h12V9" fill="none" stroke="#a855f7" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20h12V9" fill="none" stroke="#22d3ee" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30.5" cy="8" r="1.3" fill="#080a12"/><circle cx="33.5" cy="8" r="1.3" fill="#080a12"/><circle cx="10" cy="11" r="4" fill="#f472b6"/>',
    bricks: '<rect x="3" y="5" width="10" height="6" rx="1.5" fill="#f472b6"/><rect x="15" y="5" width="10" height="6" rx="1.5" fill="#f472b6"/><rect x="27" y="5" width="10" height="6" rx="1.5" fill="#f472b6"/><rect x="3" y="13" width="10" height="6" rx="1.5" fill="#a855f7"/><rect x="27" y="13" width="10" height="6" rx="1.5" fill="#a855f7"/><circle cx="20" cy="26" r="3" fill="#eef1f8"/><rect x="11" y="32" width="18" height="4" rx="2" fill="#22d3ee"/>'
  };

  // Each game's best score, from the key the game writes (see tetris.js,
  // pacman.js, flappy.js, hop.js, snake.js and bricks.js).
  var GAMES = [
    { id: 'tetris', name: 'Falling Blocks', key: 'bdnix_tetris_best', href: '/falling-blocks/' },
    { id: 'pacman', name: 'Maze Chase', key: 'bdnix_pacman_best', href: '/maze-chase/' },
    { id: 'flappy', name: 'Flap', key: 'bdnix_flappy_best', href: '/flap/' },
    { id: 'hop', name: 'Road Hop', key: 'bdnix_hop_best', href: '/road-hop/' },
    { id: 'snake', name: 'Snake', key: 'bdnix_snake_best', href: '/snake/' },
    { id: 'bricks', name: 'Brick Bounce', key: 'bdnix_bricks_best', href: '/brick-bounce/' }
  ];
  function read(key){
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function renderScores(){
    var box = $('scores');
    box.textContent = '';
    GAMES.forEach(function(g){
      var best = parseInt(read(g.key), 10);
      g = { id: g.id, name: g.name, href: g.href, best: best > 0 ? best : 0 };
      var card = document.createElement('div');
      card.className = 'score panel';
      card.innerHTML =
        '<svg class="score-icon" viewBox="0 0 40 40" aria-hidden="true">' + ICONS[g.id] + '</svg>' +
        '<div class="score-text"><span></span><b></b></div>' +
        '<a class="btn btn-ghost"></a>';
      card.querySelector('span').textContent = g.name;
      var b = card.querySelector('b');
      b.textContent = g.best ? g.best.toLocaleString() : 'Not played yet';
      b.classList.toggle('none', !g.best);
      var play = card.querySelector('a');
      play.href = g.href;
      play.textContent = g.best ? 'Play again' : 'Play';
      box.appendChild(card);
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
