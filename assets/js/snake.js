(function(){
  // The rules live in snake-core.js; this file draws them and handles input.
  var F = window.bdnixSnake;
  var COLS = F.COLS, ROWS = F.ROWS;
  var CELL = 24;                // world units per cell
  var W = COLS * CELL, H = ROWS * CELL;
  var DEATH_TIME = 0.8;         // how long the crash plays before the score shows

  // A few ways to say how the round ended; one is picked at random.
  var ENDINGS = {
    wall: ['Bonk! Straight into the wall.', 'The wall didn’t budge.', 'Walls don’t taste good.'],
    self: ['Tied yourself in a knot.', 'That was your own tail.', 'A little too hungry.'],
    full: ['Not a single cell to spare.']
  };

  var board = document.getElementById('board');
  var ctx = board.getContext('2d');
  var gameEl = document.getElementById('game');
  var overlay = document.getElementById('overlay');
  var ovKicker = document.getElementById('ovKicker');
  var ovTitle = document.getElementById('ovTitle');
  var ovText = document.getElementById('ovText');
  var startBtn = document.getElementById('startBtn');
  var newBtn = document.getElementById('newBtn');
  var pauseBtn = document.getElementById('pauseBtn');
  var el = {
    score: document.getElementById('score'),
    best: document.getElementById('best')
  };
  var compactMQ = window.matchMedia('(max-width:700px),(pointer:coarse)');
  var landscapeMQ = window.matchMedia('(orientation:landscape) and (max-height:520px)');
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z"/></svg>';

  var SCALE = 1;                // CSS pixels per world unit
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var world = F.create(), carry = 0, clock = 0;
  var best = 0;
  var sound = window.bdnixSound;
  // This game's sounds, beside the ones every game shares (sound.js).
  var tone = sound.tone, notes = sound.notes;
  sound.add({
    eat: [tone(660, 990, 0.08, 'square', 0.16)],
    hit: [tone(0, 0, 0.18, 'noise', 0.3), tone(180, 50, 0.25, 'triangle', 0.45)],
    win: notes([523, 659, 784, 1047, 1319, 1568], 0.08, 0.16, 'square', 0.17)
  });

  try { best = parseInt(localStorage.getItem('bdnix_snake_best'), 10) || 0; } catch (e) {}

  // ---------- Game flow ----------
  function setState(s){ state = s; stateTime = 0; }
  function newGame(){
    world = F.create();
    carry = 0;
    setState('ready');
    pausedFrom = null;
    overlay.hidden = true;
    newBtn.hidden = true;
    startBtn.blur();
    pauseBtn.innerHTML = ICON_PAUSE; pauseBtn.setAttribute('aria-label', 'Pause');
    updateHud();
    sound.play('start');
    persist();
  }
  // The snake waits on "Get ready" until the first direction is pressed;
  // after that each press queues a turn.
  function go(dir){
    if (state === 'ready') {
      if (dir === F.OPPOSITE[world.dir]) return;
      F.turn(world, dir);
      // The first step is taken straight away: the snake is drawn gliding
      // from where it was into the cell it just took.
      F.step(world);
      carry = 0;
      setState('playing');
    } else if (state === 'playing') {
      F.turn(world, dir);
    }
  }

  function update(dt){
    if (state === 'paused') return;
    stateTime += dt;
    clock += dt;
    if (state === 'dying' && stateTime > DEATH_TIME) gameOver();
    if (state !== 'playing') return;
    var ate = world.score;
    var r = F.advance(world, dt, carry);
    carry = r.carry;
    if (r.steps) updateHud();
    if (world.score > ate) sound.play('eat');
    if (r.end) crash();
  }

  // The round ends the moment the snake crashes: the best score and the save
  // are settled straight away, and the score shows once the crash has played.
  function crash(){
    setState('dying');
    sound.play(world.dead === 'full' ? 'win' : 'hit');
    if (world.score > best) {
      best = world.score;
      try { localStorage.setItem('bdnix_snake_best', best); } catch (e) {}
    }
    updateHud();
    persist();
  }
  function gameOver(){
    setState('over');
    stale = true;                       // one last frame of the faded snake
    var score = world.score;
    var lines = ENDINGS[world.dead];
    sound.play(score >= best && score > 0 ? 'best' : 'over');
    ovKicker.textContent = lines[Math.min(lines.length - 1, Math.floor(Math.random() * lines.length))];
    ovTitle.textContent = world.dead === 'full' ? 'You win!' : 'Game over';
    ovText.textContent = 'Score ' + score + (score >= best && score > 0 ? ' — new best!' : ' · Best ' + best);
    startBtn.textContent = 'Play again';
    newBtn.hidden = true;
    overlay.hidden = false;
    startBtn.focus();
  }
  function togglePause(){
    if (state === 'paused') {
      state = pausedFrom; pausedFrom = null;
      overlay.hidden = true;
      pauseBtn.innerHTML = ICON_PAUSE; pauseBtn.setAttribute('aria-label', 'Pause');
      last = performance.now();
    } else if (state === 'ready' || state === 'playing') {
      pausedFrom = state; state = 'paused';
      ovKicker.textContent = 'bdnix arcade';
      ovTitle.textContent = 'Paused';
      ovText.textContent = 'Take a breather.';
      startBtn.textContent = 'Resume';
      newBtn.hidden = false;
      overlay.hidden = false;
      pauseBtn.innerHTML = ICON_PLAY; pauseBtn.setAttribute('aria-label', 'Resume');
      persist();
    }
  }
  function updateHud(){
    el.score.textContent = world.score;
    el.best.textContent = Math.max(best, world.score);
  }

  // ---------- Saving ----------
  // A round in progress is saved as the page goes away, and comes back
  // paused. Before the snake starts moving there's nothing worth keeping.
  function snapshot(){
    var s = state === 'paused' ? pausedFrom : state;
    if (s !== 'playing' || world.dead) return null;
    return { carry: carry, body: world.body, trail: world.trail, dir: world.dir, queue: world.queue, food: world.food, score: world.score };
  }
  var persist = window.bdnixSave.keep('snake', snapshot);

  function isCell(c){
    return !!c && c.x === Math.floor(c.x) && c.y === Math.floor(c.y) && c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS;
  }
  function restore(s){
    var num = window.bdnixSave.num, b = s.body;
    var ok = Array.isArray(b) && b.length >= F.START_LEN && b.length < COLS * ROWS && b.every(isCell) &&
      !!F.DIRS[s.dir] && Array.isArray(s.queue) && s.queue.length <= 2 &&
      s.queue.every(function(d){ return !!F.DIRS[d]; }) &&
      isCell(s.food) && num(s.score) && s.score === b.length - F.START_LEN &&
      num(s.carry) && s.carry >= 0 && s.carry < F.SLOW;
    if (!ok) return false;
    // Each piece of the body follows on from the one before, with no overlaps,
    // and the head is one step on from the neck in the way the snake is going.
    for (var i = 1; i < b.length; i++) {
      if (Math.abs(b[i].x - b[i - 1].x) + Math.abs(b[i].y - b[i - 1].y) !== 1) return false;
      if (F.onBody(b.slice(0, i), b[i].x, b[i].y)) return false;
    }
    if (b[0].x - b[1].x !== F.DIRS[s.dir].x || b[0].y - b[1].y !== F.DIRS[s.dir].y) return false;
    if (F.onBody(b, s.food.x, s.food.y)) return false;
    var w = F.create();
    w.body = b.map(function(c){ return { x: c.x, y: c.y }; });
    // Where the tail is gliding from; a save without one just starts it still.
    var tail = b[b.length - 1], tr = s.trail;
    if (isCell(tr) && Math.abs(tr.x - tail.x) + Math.abs(tr.y - tail.y) <= 1) w.trail = { x: tr.x, y: tr.y };
    w.dir = s.dir;
    s.queue.forEach(function(d){ F.turn(w, d); });
    w.food = { x: s.food.x, y: s.food.y };
    w.score = s.score;
    world = w; carry = s.carry;
    state = 'playing'; stateTime = 0;
    togglePause();
    ovText.textContent = 'Picked up where you left off.';
    updateHud();
    return true;
  }

  // ---------- Sizing ----------
  function sizeCanvas(c, cx, w, h){
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function resize(){
    var cs = getComputedStyle(gameEl);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var gap = parseFloat(cs.rowGap) || 0;
    var availW, availH;
    if (landscapeMQ.matches) {
      var bs = getComputedStyle(document.body);
      availH = document.body.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom);
      availW = window.innerWidth - 2 * 170;
    } else if (compactMQ.matches) {
      availW = gameEl.clientWidth - padX;
      availH = gameEl.clientHeight - padY - document.querySelector('.stats').offsetHeight - gap;
    } else {
      availW = gameEl.clientWidth - padX - 128 * 2 - (parseFloat(cs.columnGap) || 0) * 2;
      availH = gameEl.clientHeight - padY;
    }
    SCALE = Math.max(0.5, Math.min(1.6, Math.floor(Math.min((availW - 2) / W, (availH - 2) / H) * 100) / 100));
    sizeCanvas(board, ctx, Math.round(W * SCALE), Math.round(H * SCALE));
    board.parentNode.style.setProperty('--cell', Math.max(16, 32 * SCALE) + 'px');
    buildLayers();
    render();
  }

  // ---------- Drawing ----------
  // The board and the food never change shape, so they're drawn once per
  // size into offscreen canvases and copied in each frame. Glow (shadowBlur)
  // is slow to draw, so it's only ever drawn here.
  var grid = document.createElement('canvas'), berry = document.createElement('canvas');
  function buildLayers(){
    var k = (window.devicePixelRatio || 1) * SCALE;
    grid.width = board.width; grid.height = board.height;
    var g = grid.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    // A faint checkerboard, so it's easy to see where the snake will go.
    g.fillStyle = 'rgba(168,85,247,.05)';
    for (var y = 0; y < ROWS; y++) {
      for (var x = (y % 2); x < COLS; x += 2) g.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
    // A glowing berry with a leaf, two cells across to leave room for the glow.
    berry.width = berry.height = Math.ceil(CELL * 2 * k);
    var f = berry.getContext('2d'), c = CELL, r = CELL * 0.3;
    f.setTransform(k, 0, 0, k, 0, 0);
    f.fillStyle = '#f472b6';
    f.shadowColor = '#f472b6'; f.shadowBlur = 12 * k;
    f.beginPath(); f.arc(c, c + 1, r, 0, Math.PI * 2); f.fill();
    f.shadowBlur = 0;
    f.fillStyle = 'rgba(255,255,255,.55)';
    f.beginPath(); f.arc(c - r * 0.35, c - r * 0.2, r * 0.25, 0, Math.PI * 2); f.fill();
    f.fillStyle = '#4ade80';
    f.beginPath(); f.ellipse(c + 3, c - r - 1, 4, 2, -0.5, 0, Math.PI * 2); f.fill();
  }

  function render(){
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.drawImage(grid, 0, 0);
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);

    if (world.food) drawFood(world.food);
    drawSnake();

    if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
      var hint = compactMQ.matches ? 'Swipe or tap an arrow to go' : 'Press an arrow key to go';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 30px Inter, system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,10,18,.8)';
      ctx.strokeText('Get ready', W / 2, 110);
      ctx.fillStyle = '#eef1f8';
      ctx.fillText('Get ready', W / 2, 110);
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.strokeText(hint, W / 2, 140);
      ctx.fillStyle = '#c3c9d8';
      ctx.fillText(hint, W / 2, 140);
    }
  }

  // The berry pulses gently.
  function drawFood(f){
    var size = CELL * 2 * (1 + Math.sin(clock * 5) * 0.08);
    ctx.drawImage(berry, (f.x + 0.5) * CELL - size / 2, (f.y + 0.5) * CELL - size / 2, size, size);
  }

  // How far through the current step the snake is drawn, from 0 (just
  // stepped) to 1 (about to step again).
  function progress(){
    var s = state === 'paused' ? pausedFrom : state;
    return s === 'playing' ? Math.min(1, carry / F.interval(world.score)) : 1;
  }
  // The snake's colour, from cyan at the head (0) to purple at the tail (1).
  function shade(k){
    return 'rgb(' + Math.round(34 + 134 * k) + ',' + Math.round(211 - 126 * k) + ',' + Math.round(238 + 9 * k) + ')';
  }
  function lerp(a, b, t){ return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  // The snake glides between cells: the head moves from the neck into the
  // cell it has just taken while the tail leaves the cell it has just let go,
  // so it slides smoothly instead of jumping a cell at a time. It's drawn as
  // one thick line through the middle of its cells, fading from cyan at the
  // head to purple at the tail. After a crash it fades until the score shows.
  function drawSnake(){
    var b = world.body, n = b.length, t = progress();
    var head = lerp(b[1], b[0], t);
    var pts = [lerp(world.trail, b[n - 1], t)];
    for (var i = n - 1; i >= 1; i--) pts.push(b[i]);
    pts.push(head);

    ctx.save();
    if (state === 'dying' || state === 'over') ctx.globalAlpha = 1 - 0.55 * Math.min(1, state === 'over' ? 1 : stateTime / DEATH_TIME);
    var m = pts.length - 1, w = CELL * 0.74;
    // Round joints first (they show only at the corners and the tail end),
    // then flat-ended pieces over them, so the colours blend without seams.
    for (i = 0; i < m; i++) {
      ctx.fillStyle = shade(1 - i / m);
      ctx.beginPath(); ctx.arc((pts[i].x + 0.5) * CELL, (pts[i].y + 0.5) * CELL, w / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineCap = 'butt';
    ctx.lineWidth = w;
    for (i = 0; i < m; i++) {
      ctx.strokeStyle = shade(1 - (i + 0.5) / m);
      ctx.beginPath();
      ctx.moveTo((pts[i].x + 0.5) * CELL, (pts[i].y + 0.5) * CELL);
      ctx.lineTo((pts[i + 1].x + 0.5) * CELL, (pts[i + 1].y + 0.5) * CELL);
      ctx.stroke();
    }
    // The head, a little wider, with eyes looking the way it's going.
    var hx = (head.x + 0.5) * CELL, hy = (head.y + 0.5) * CELL;
    var dx = b[0].x - b[1].x, dy = b[0].y - b[1].y;
    ctx.fillStyle = 'rgb(34,211,238)';
    ctx.beginPath(); ctx.arc(hx, hy, CELL * 0.42, 0, Math.PI * 2); ctx.fill();
    var ex = dy * 5, ey = dx * 5;         // across the head
    var fx = dx * 4, fy = dy * 4;         // towards the front
    ctx.fillStyle = '#080a12';
    ctx.beginPath(); ctx.arc(hx + fx + ex, hy + fy + ey, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + fx - ex, hy + fy - ey, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  var last = performance.now(), stale = false;
  function loop(now){
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    // Nothing moves while the overlay is up, so the board isn't redrawn
    // under it (redrawing under its blur is costly on phones).
    if (state === 'ready' || state === 'playing' || state === 'dying' || stale) render();
    stale = false;
    requestAnimationFrame(loop);
  }

  // ---------- Input ----------
  var KEYMAP = {
    ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
    KeyA:'left', KeyD:'right', KeyW:'up', KeyS:'down'
  };
  function startOrResume(){
    if (state === 'paused') togglePause();
    else if (state === 'idle' || state === 'over') newGame();
  }

  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && (state === 'idle' || state === 'over' || state === 'paused')) {
      startOrResume(); e.preventDefault(); return;
    }
    var d = KEYMAP[e.code];
    if (d) { go(d); e.preventDefault(); }
  });
  window.addEventListener('blur', function(){ if (state === 'ready' || state === 'playing') togglePause(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && (state === 'ready' || state === 'playing')) togglePause();
  });

  document.querySelectorAll('.touch button').forEach(function(b){
    var d = b.getAttribute('data-dir');
    b.addEventListener('pointerdown', function(e){ e.preventDefault(); go(d); b.classList.add('on'); });
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){
      b.addEventListener(ev, function(){ b.classList.remove('on'); });
    });
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  });

  // Swipe anywhere on the game area to turn. One long stroke can make
  // several turns: each 18px in a new direction counts as a swipe.
  var press = null;
  gameEl.addEventListener('pointerdown', function(e){
    if (state !== 'ready' && state !== 'playing') return;
    if (e.button > 0) return;
    e.preventDefault();
    press = { x: e.clientX, y: e.clientY };
  });
  gameEl.addEventListener('pointermove', function(e){
    if (!press) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    press = { x: e.clientX, y: e.clientY };
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  gameEl.addEventListener('pointerup', function(){ press = null; });
  gameEl.addEventListener('pointercancel', function(){ press = null; });
  gameEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  gameEl.style.touchAction = 'none';

  startBtn.addEventListener('click', startOrResume);
  newBtn.addEventListener('click', newGame);
  pauseBtn.addEventListener('click', togglePause);

  window.addEventListener('resize', resize);
  if (compactMQ.addEventListener) {
    compactMQ.addEventListener('change', resize);
    landscapeMQ.addEventListener('change', resize);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  var saved = window.bdnixSave.load('snake');
  if (saved && !restore(saved)) window.bdnixSave.clear('snake');
  updateHud();
  resize();
  requestAnimationFrame(loop);
})();
