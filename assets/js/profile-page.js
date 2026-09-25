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
    pacman: '<path d="M14 20 L24.4 14 A12 12 0 1 0 24.4 26 Z" fill="#facc15"/><circle cx="29" cy="20" r="2" fill="#eef1f8" opacity=".8"/><circle cx="36" cy="20" r="2" fill="#eef1f8" opacity=".8"/>'
  };

  function renderScores(){
    var box = $('scores');
    box.textContent = '';
    P.scores().forEach(function(g){
      var card = document.createElement('div');
      card.className = 'score panel';
      card.innerHTML =
        '<svg class="gc-icon" viewBox="0 0 40 40" aria-hidden="true">' + ICONS[g.id] + '</svg>' +
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

    var v = P.visits();
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

  // Scores can change in another tab (a game in progress), so keep them fresh.
  window.addEventListener('storage', renderScores);
  window.addEventListener('pageshow', renderScores);
  renderScores();
})();
