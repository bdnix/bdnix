(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

  // Visit counter (per browser, just for fun)
  var visits = 1;
  try {
    visits = (parseInt(localStorage.getItem('bdnix_visits'), 10) || 0) + 1;
    localStorage.setItem('bdnix_visits', visits);
  } catch (e) {}
  document.getElementById('visit').textContent =
    visits === 1 ? 'First time here? Bookmark this page and check back soon.' :
    visits < 5   ? 'Welcome back. Visit #' + visits + ', still building. Thanks for checking in.' :
                   'Visit #' + visits + '. You’re a regular now. Thanks for the patience.';

  // Typewriter
  if (reduce) return;
  var lines = [
    'come back again to check.',
    'compiling ideas... 42%',
    'good things take time.',
    'check back soon.'
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
