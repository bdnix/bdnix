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

  // Typewriter
  if (reduce) return;
  var lines = [
    'play a round of tetris.',
    'chase ghosts in pac-man.',
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
