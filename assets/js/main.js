(function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

  // --- Visit counter (per browser, just for fun) ---
  var visits = 1;
  try {
    visits = (parseInt(localStorage.getItem('bdnix_visits'), 10) || 0) + 1;
    localStorage.setItem('bdnix_visits', visits);
  } catch (e) {}
  var visitEl = document.getElementById('visit');
  if (visits === 1) {
    visitEl.textContent = 'First time here? Bookmark us and come back soon.';
  } else if (visits < 5) {
    visitEl.textContent = 'Welcome back! Visit #' + visits + ' — still building. Thanks for checking in.';
  } else {
    visitEl.textContent = 'Visit #' + visits + '. You’re a regular now. We appreciate the patience.';
  }

  // --- Typewriter ---
  var lines = [
    'something is being built here...',
    'come back again to check.',
    'compiling ideas... 42% done',
    'good things take time.',
    'check back soon.'
  ];
  var typed = document.getElementById('typed');
  if (reduceMotion) {
    typed.textContent = lines[1];
  } else {
    var li = 0, ci = 0, deleting = false;
    (function tick(){
      var line = lines[li];
      if (!deleting) {
        ci++;
        typed.textContent = line.slice(0, ci);
        if (ci === line.length) { deleting = true; return setTimeout(tick, 1800); }
        return setTimeout(tick, 45 + Math.random() * 60);
      }
      ci--;
      typed.textContent = line.slice(0, ci);
      if (ci === 0) { deleting = false; li = (li + 1) % lines.length; return setTimeout(tick, 350); }
      setTimeout(tick, 22);
    })();
  }

  // --- Falling tetromino background ---
  var canvas = document.getElementById('bg');
  var ctx = canvas.getContext('2d');
  var SHAPES = [
    [[1,1,1,1]],
    [[1,1],[1,1]],
    [[0,1,0],[1,1,1]],
    [[1,0,0],[1,1,1]],
    [[0,0,1],[1,1,1]],
    [[1,1,0],[0,1,1]],
    [[0,1,1],[1,1,0]]
  ];
  var COLORS = ['#22d3ee','#facc15','#a855f7','#3b82f6','#f97316','#22c55e','#ef4444'];
  var CELL = 22, pieces = [], w, h;

  function resize(){
    var dpr = window.devicePixelRatio || 1;
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(randomY){
    var i = Math.floor(Math.random() * SHAPES.length);
    return {
      shape: SHAPES[i], color: COLORS[i],
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -CELL * 4,
      speed: 0.3 + Math.random() * 0.8,
      rot: Math.floor(Math.random() * 4) * Math.PI / 2
    };
  }
  function draw(p){
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    p.shape.forEach(function(row, r){
      row.forEach(function(v, c){
        if (!v) return;
        ctx.fillRect(c * CELL, r * CELL, CELL - 2, CELL - 2);
      });
    });
    ctx.restore();
  }
  function frame(){
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      p.y += p.speed;
      if (p.y > h + CELL * 4) pieces[i] = spawn(false);
      draw(p);
    }
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  resize();
  var count = Math.min(28, Math.round(w * h / 45000));
  for (var i = 0; i < count; i++) pieces.push(spawn(true));
  window.addEventListener('resize', resize);
  frame();
})();
