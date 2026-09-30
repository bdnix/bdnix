(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

  // Visit counter (per browser, just for fun)
  var visits = 1;
  try {
    visits = (parseInt(localStorage.getItem('bdnix_visits'), 10) || 0) + 1;
    localStorage.setItem('bdnix_visits', visits);
  } catch (e) {}
  // Greet returning visitors by the name they set on their profile, if any.
  var P = window.bdnixProfile;
  var name = P && P.getName() !== P.DEFAULT_NAME ? P.getName() : '';
  var hello = 'Welcome back' + (name ? ', ' + name : '') + '.';
  document.getElementById('visit').textContent =
    visits === 1 ? 'Welcome! Pick a game or a tool to get started.' :
    visits < 5   ? hello :
                   hello + ' Visit #' + visits + ', you’re a regular now.';

  // Search: hide the cards that don't match, and a section with none left.
  var S = window.bdnixSearch;
  var search = document.getElementById('search');
  var status = document.getElementById('search-status');
  var empty = document.getElementById('search-empty');
  var sections = document.querySelectorAll('.catalog');
  function filter(){
    var query = search.value, shown = 0;
    for (var i = 0; i < sections.length; i++) {
      var cards = sections[i].querySelectorAll('.card'), left = 0;
      for (var j = 0; j < cards.length; j++) {
        var card = cards[j];
        var ok = S.matches(card.textContent + ' ' + (card.getAttribute('data-keywords') || ''), query);
        card.hidden = !ok;
        if (ok) left++;
      }
      sections[i].hidden = !left;
      shown += left;
    }
    var searching = S.terms(query).length > 0;
    status.textContent = !searching ? '' :
      shown === 1 ? '1 match' : shown + ' matches';
    empty.hidden = !searching || shown > 0;
  }
  search.addEventListener('input', filter);
  search.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && search.value) { search.value = ''; filter(); e.preventDefault(); }
  });
  // "/" jumps to the search box from anywhere that isn't a text field.
  document.addEventListener('keydown', function(e){
    var t = e.target, tag = t && t.tagName;
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    e.preventDefault();
    search.focus();
  });
  // The browser may bring back what was typed when going back to the page.
  filter();

  // Typewriter
  if (reduce) return;
  var lines = [
    'play a round of falling blocks.',
    'dodge ghosts in maze chase.',
    'flap past a few pipes.',
    'help a chicken cross the road.',
    'grow the longest snake.',
    'smash a wall of bricks.',
    'merge a stack of pdfs.',
    'watermark a report.',
    'turn a video into an mp3.',
    'shrink a photo to send.',
    'nothing to install. nothing uploaded.'
  ];
  var typed = document.getElementById('typed');
  var li = 0, ci = lines[0].length, deleting = false;
  function tick(){
    var line = lines[li];
    if (deleting) {
      ci--;
      typed.textContent = line.slice(0, ci);
      if (ci === 0) { deleting = false; li = (li + 1) % lines.length; return setTimeout(tick, 400); }
      return setTimeout(tick, 24);
    }
    ci++;
    typed.textContent = line.slice(0, ci);
    if (ci >= line.length) { deleting = true; return setTimeout(tick, 2200); }
    setTimeout(tick, 50 + Math.random() * 50);
  }
  deleting = true;
  setTimeout(tick, 2600);
})();
