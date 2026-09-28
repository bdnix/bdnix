(function(){
  // The rules live in bricks-core.js; this file draws them and handles input.
  var F = window.bdnixBricks;
  var W = F.W, H = F.H;
  var PADDLE_SPEED = 420;       // units a second while a move key or button is held
  var DEATH_TIME = 0.8;         // how long the last ball falls before the score shows
  var FADE = 0.25;              // how long a broken brick takes to fade away

  // Bricks, top row pair to bottom, in the site's colours.
  var COLORS = ['#f472b6', '#f472b6', '#a855f7', '#a855f7', '#22d3ee', '#22d3ee', '#facc15', '#facc15'];
  // A few ways to say the game is over; one is picked at random.
  var ENDINGS = ['The last ball slipped by.', 'So close to the bottom row.', 'The wall wins this time.'];

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
    best: document.getElementById('best'),
    lives: document.getElementById('lives'),
    level: document.getElementById('level')
  };
  var compactMQ = window.matchMedia('(max-width:700px),(pointer:coarse)');
  var landscapeMQ = window.matchMedia('(orientation:landscape) and (max-height:520px)');
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z"/></svg>';

  var SCALE = 1;                // CSS pixels per world unit
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var world = F.create(), clock = 0;
  var fading = [];              // bricks just broken: { i, t }
  var held = { left: 0, right: 0 }; // move keys and buttons held down
  var best = 0;
  var sound = window.bdnixSound;

  try { best = parseInt(localStorage.getItem('bdnix_bricks_best'), 10) || 0; } catch (e) {}

  // ---------- Game flow ----------
  function setState(s){ state = s; stateTime = 0; }
  function newGame(){
    world = F.create();
    fading = [];
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
  // The ball waits on the paddle ("ready") until it's launched.
  function launch(){
    if (state !== 'ready') return;
    F.launch(world);
    setState('playing');
  }

  function update(dt){
    if (state === 'paused') return;
    stateTime += dt;
    clock += dt;
    fading = fading.filter(function(f){ return clock - f.t < FADE; });
    if (state === 'dying' && stateTime > DEATH_TIME) gameOver();
    if (state !== 'ready' && state !== 'playing') return;
    var dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (dir) F.movePaddle(world, world.paddle + dir * PADDLE_SPEED * dt);
    if (state !== 'playing') return;
    var ev = F.advance(world, dt);
    ev.bricks.forEach(function(i){ fading.push({ i: i, t: clock }); });
    if (ev.bricks.length) sound.play('brick');
    else if (ev.paddle) sound.play('paddle');
    else if (ev.wall) sound.play('wall');
    if (ev.bricks.length || ev.lost || ev.cleared) updateHud();
    if (ev.end) return crash();
    if (ev.cleared) { fading = []; setState('ready'); sound.play('level'); persist(); }
    else if (ev.lost) { setState('ready'); sound.play('fall'); persist(); }
  }

  // The game ends the moment the last ball is lost: the best score and the
  // save are settled straight away, and the score shows once the ball has
  // fallen away.
  function crash(){
    setState('dying');
    sound.play('fall');
    if (world.score > best) {
      best = world.score;
      try { localStorage.setItem('bdnix_bricks_best', best); } catch (e) {}
    }
    updateHud();
    persist();
  }
  function gameOver(){
    setState('over');
    stale = true;                       // one last frame of the faded board
    var score = world.score;
    sound.play(score >= best && score > 0 ? 'best' : 'over');
    ovKicker.textContent = ENDINGS[Math.min(ENDINGS.length - 1, Math.floor(Math.random() * ENDINGS.length))];
    ovTitle.textContent = 'Game over';
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
      held.left = held.right = 0;
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
    el.lives.textContent = world.lives;
    el.level.textContent = world.level;
  }

  // ---------- Saving ----------
  // A game in progress is saved as the page goes away, and comes back
  // paused. A new game whose first ball hasn't been launched isn't worth keeping.
  function snapshot(){
    var s = state === 'paused' ? pausedFrom : state;
    if ((s !== 'ready' && s !== 'playing') || world.dead) return null;
    var w = world;
    if (w.stuck && w.level === 1 && w.lives === F.LIVES && w.score === 0) return null;
    return { level: w.level, bricks: w.bricks, paddle: w.paddle, small: w.small, ball: w.ball, stuck: w.stuck, lives: w.lives, score: w.score };
  }
  var persist = window.bdnixSave.keep('bricks', snapshot);

  function restore(s){
    var num = window.bdnixSave.num, b = s.ball, k = s.bricks;
    var ok = num(s.level) && s.level === Math.floor(s.level) && s.level >= 1 &&
      Array.isArray(k) && k.length === F.ROWS * F.COLS && k.every(function(v){ return v === 0 || v === 1; }) && k.indexOf(1) >= 0 &&
      typeof s.small === 'boolean' && typeof s.stuck === 'boolean' &&
      num(s.lives) && s.lives === Math.floor(s.lives) && s.lives >= 1 && s.lives <= F.LIVES &&
      num(s.score) && s.score === Math.floor(s.score) &&
      !!b && num(b.x) && num(b.y) && num(b.dx) && num(b.dy) &&
      b.x >= F.R && b.x <= W - F.R && b.y >= F.R && b.y <= H + F.R &&
      Math.abs(b.dx * b.dx + b.dy * b.dy - 1) < 1e-6 && num(s.paddle);
    if (!ok) return false;
    // The score counts at least the bricks broken in this wall, and exactly
    // them on the first wall.
    var points = 0;
    k.forEach(function(v, i){ if (!v) points += F.POINTS[Math.floor(i / F.COLS)]; });
    if (s.level === 1 ? s.score !== points : s.score < points) return false;
    var w = F.create();
    w.level = s.level;
    w.bricks = k.slice();
    w.small = s.small;
    w.lives = s.lives;
    w.score = s.score;
    w.stuck = false;
    F.movePaddle(w, s.paddle);
    if (w.paddle !== s.paddle) return false;         // off the end of the board
    if (s.stuck) F.stick(w);
    else {
      if (F.brickAt(w, b.x, b.y) >= 0) return false; // inside a brick
      w.ball = { x: b.x, y: b.y, dx: b.dx, dy: b.dy };
    }
    world = w;
    fading = [];
    state = s.stuck ? 'ready' : 'playing'; stateTime = 0;
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
    board.parentNode.style.setProperty('--cell', Math.max(16, 24 * SCALE) + 'px');
    render();
  }

  // ---------- Drawing ----------
  function roundRect(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render(){
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);

    ctx.save();
    if (state === 'dying' || state === 'over') ctx.globalAlpha = 1 - 0.55 * Math.min(1, state === 'over' ? 1 : stateTime / DEATH_TIME);
    drawBricks();
    drawPaddle();
    if (state !== 'over') drawBall();
    ctx.restore();

    if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
      var hint = compactMQ.matches ? 'Tap to launch' : 'Press Space or click to launch';
      var title = world.level > 1 && world.lives === F.LIVES && !F.progress(world).broken ? 'Wall ' + world.level : 'Get ready';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 30px Inter, system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,10,18,.8)';
      ctx.strokeText(title, W / 2, 290);
      ctx.fillStyle = '#eef1f8';
      ctx.fillText(title, W / 2, 290);
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.strokeText(hint, W / 2, 322);
      ctx.fillStyle = '#c3c9d8';
      ctx.fillText(hint, W / 2, 322);
    }
  }

  // Each brick with a lighter top edge; broken ones fade and swell away.
  function drawBricks(){
    for (var i = 0; i < world.bricks.length; i++) {
      if (world.bricks[i]) drawBrick(i, 1, 0);
    }
    fading.forEach(function(f){
      var k = Math.min(1, (clock - f.t) / FADE);
      drawBrick(f.i, 1 - k, k * 3);
    });
  }
  function drawBrick(i, alpha, grow){
    var r = F.brickRect(i), row = Math.floor(i / F.COLS);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = COLORS[row];
    roundRect(r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(r.x + 3, r.y + 2, r.w - 6, 2);
    ctx.restore();
  }

  function drawPaddle(){
    var pw = F.paddleWidth(world);
    var g = ctx.createLinearGradient(world.paddle - pw / 2, 0, world.paddle + pw / 2, 0);
    g.addColorStop(0, '#22d3ee'); g.addColorStop(1, '#a855f7');
    ctx.fillStyle = g;
    roundRect(world.paddle - pw / 2, F.PADDLE_Y, pw, F.PADDLE_H, F.PADDLE_H / 2);
    ctx.fill();
  }

  function drawBall(){
    var b = world.ball;
    ctx.save();
    ctx.fillStyle = 'rgba(238,241,248,.18)';
    ctx.beginPath(); ctx.arc(b.x, b.y, F.R * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef1f8';
    ctx.beginPath(); ctx.arc(b.x, b.y, F.R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  var last = performance.now(), stale = false;
  function loop(now){
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    // Nothing moves while the overlay is up, so the board isn't redrawn
    // under it (redrawing under its blur is costly on phones).
    if (state === 'ready' || state === 'playing' || state === 'dying' || fading.length || stale) render();
    stale = false;
    requestAnimationFrame(loop);
  }

  // ---------- Input ----------
  var KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'left', KeyD: 'right' };
  function startOrResume(){
    if (state === 'paused') togglePause();
    else if (state === 'idle' || state === 'over') newGame();
  }

  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && (state === 'idle' || state === 'over' || state === 'paused')) {
      startOrResume(); e.preventDefault(); return;
    }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { launch(); e.preventDefault(); return; }
    var d = KEYMAP[e.code];
    if (d && (state === 'ready' || state === 'playing')) { held[d] = 1; e.preventDefault(); }
  });
  document.addEventListener('keyup', function(e){
    var d = KEYMAP[e.code];
    if (d) held[d] = 0;
  });
  window.addEventListener('blur', function(){ if (state === 'ready' || state === 'playing') togglePause(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && (state === 'ready' || state === 'playing')) togglePause();
  });

  // Held buttons move the paddle; the middle one launches the ball.
  document.querySelectorAll('.touch button').forEach(function(b){
    var d = b.getAttribute('data-dir');
    b.addEventListener('pointerdown', function(e){
      e.preventDefault(); e.stopPropagation();
      b.classList.add('on');
      if (d === 'launch') launch();
      else if (state === 'ready' || state === 'playing') held[d] = 1;
    });
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){
      b.addEventListener(ev, function(){ b.classList.remove('on'); if (d !== 'launch') held[d] = 0; });
    });
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  });

  // The mouse steers the paddle wherever it points across the board, and a
  // click launches. A finger drags the paddle along from wherever it
  // touches the game area (so it doesn't hide the paddle), and a tap launches.
  function boardX(clientX){ return (clientX - board.getBoundingClientRect().left) / SCALE; }
  var drag = null;
  gameEl.addEventListener('pointermove', function(e){
    if (state !== 'ready' && state !== 'playing') return;
    if (e.pointerType === 'mouse') { F.movePaddle(world, boardX(e.clientX)); return; }
    if (!drag) return;
    F.movePaddle(world, world.paddle + (e.clientX - drag.x) / SCALE);
    drag.moved += Math.abs(e.clientX - drag.x);
    drag.x = e.clientX;
  });
  gameEl.addEventListener('pointerdown', function(e){
    if (state !== 'ready' && state !== 'playing') return;
    if (e.button > 0) return;
    e.preventDefault();
    if (e.pointerType === 'mouse') { F.movePaddle(world, boardX(e.clientX)); launch(); }
    else drag = { x: e.clientX, moved: 0 };
  });
  gameEl.addEventListener('pointerup', function(){
    if (drag && drag.moved < 10) launch();
    drag = null;
  });
  gameEl.addEventListener('pointercancel', function(){ drag = null; });
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

  var saved = window.bdnixSave.load('bricks');
  if (saved && !restore(saved)) window.bdnixSave.clear('bricks');
  updateHud();
  resize();
  requestAnimationFrame(loop);
})();
