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
    persist();
  }
  // The snake waits on "Get ready" until the first direction is pressed;
  // after that each press queues a turn.
  function go(dir){
    if (state === 'ready') {
      if (dir === F.OPPOSITE[world.dir]) return;
      F.turn(world, dir);
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
    var r = F.advance(world, dt, carry);
    carry = r.carry;
    if (r.steps) updateHud();
    if (r.end) crash();
  }

  // The round ends the moment the snake crashes: the best score and the save
  // are settled straight away, and the score shows once the crash has played.
  function crash(){
    setState('dying');
    if (world.score > best) {
      best = world.score;
      try { localStorage.setItem('bdnix_snake_best', best); } catch (e) {}
    }
    updateHud();
    persist();
  }
  function gameOver(){
    setState('over');
    var score = world.score;
    var lines = ENDINGS[world.dead];
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
    return { carry: carry, body: world.body, dir: world.dir, queue: world.queue, food: world.food, score: world.score };
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
    render();
  }

  // ---------- Drawing ----------
  function render(){
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W * SCALE, H * SCALE);
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);

    // A faint checkerboard, so it's easy to see where the snake will go.
    ctx.fillStyle = 'rgba(168,85,247,.05)';
    for (var y = 0; y < ROWS; y++) {
      for (var x = (y % 2); x < COLS; x += 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
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

  // A glowing berry with a leaf, pulsing gently.
  function drawFood(f){
    var cx = (f.x + 0.5) * CELL, cy = (f.y + 0.5) * CELL;
    var r = CELL * 0.3 * (1 + Math.sin(clock * 5) * 0.08);
    ctx.fillStyle = '#f472b6';
    ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy + 1, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath(); ctx.ellipse(cx + 3, cy - r - 1, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();
  }

  function roundRect(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // The snake fades from cyan at the head to purple at the tail. After a
  // crash it blinks until the score shows.
  function drawSnake(){
    var b = world.body, n = b.length;
    if (state === 'dying' && Math.floor(stateTime * 8) % 2) return;
    for (var i = n - 1; i >= 0; i--) {
      var t = n > 1 ? i / (n - 1) : 0;
      var r = Math.round(34 + (168 - 34) * t), g = Math.round(211 + (85 - 211) * t), bl = Math.round(238 + (247 - 238) * t);
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
      var s = b[i], x = s.x * CELL, y = s.y * CELL, pad = i === 0 ? 1 : 2;
      roundRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, i === 0 ? 8 : 6); ctx.fill();
      // Fill the gap to the next piece, so the body reads as one.
      if (i > 0) {
        var p = b[i - 1];
        ctx.fillRect(Math.min(x, p.x * CELL) + (s.x === p.x ? pad : CELL / 2), Math.min(y, p.y * CELL) + (s.y === p.y ? pad : CELL / 2),
          s.x === p.x ? CELL - pad * 2 : CELL, s.y === p.y ? CELL - pad * 2 : CELL);
      }
    }
    // Eyes on the head, looking the way it's going.
    var h = b[0], d = F.DIRS[world.dir], hx = (h.x + 0.5) * CELL, hy = (h.y + 0.5) * CELL;
    var ex = d.y * 5, ey = d.x * 5;       // across the head
    var fx = d.x * 4, fy = d.y * 4;       // towards the front
    ctx.fillStyle = '#080a12';
    ctx.beginPath(); ctx.arc(hx + fx + ex, hy + fy + ey, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + fx - ex, hy + fy - ey, 2.4, 0, Math.PI * 2); ctx.fill();
  }

  var last = performance.now();
  function loop(now){
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
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
