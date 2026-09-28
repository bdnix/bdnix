(function(){
  // The rules live in bricks-core.js; this file draws them and handles input.
  var F = window.bdnixBricks;
  var W = F.W, H = F.H;
  var PADDLE_SPEED = 420;       // units a second while a move key or button is held
  var DEATH_TIME = 0.8;         // how long the last ball falls before the score shows
  var FADE = 0.25;              // how long a broken brick takes to fade away

  // Bricks, top row pair to bottom, in the site's colours.
  var COLORS = ['#f472b6', '#f472b6', '#a855f7', '#a855f7', '#22d3ee', '#22d3ee', '#facc15', '#facc15'];
  // Each power's colour, the letter on its capsule and brick, and its name
  // under the paddle while it lasts.
  var POWERS = {
    multi: { color: '#22d3ee', mark: 'M' },
    fire: { color: '#fb923c', mark: 'F', name: 'Fire' },
    laser: { color: '#f43f5e', mark: 'L', name: 'Laser' },
    wide: { color: '#4ade80', mark: 'W', name: 'Wide' },
    life: { color: '#facc15', mark: '+' }
  };
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
  // This game's sounds, beside the ones every game shares (sound.js).
  var tone = sound.tone, notes = sound.notes;
  sound.add({
    paddle: [tone(330, 330, 0.05, 'square', 0.14)],
    wall: [tone(220, 220, 0.04, 'square', 0.1)],
    brick: [tone(784, 1175, 0.06, 'square', 0.14)],
    powerup: notes([523, 784, 1047], 0.05, 0.08, 'triangle', 0.35),
    shot: [tone(1400, 700, 0.05, 'square', 0.1)],
    level: notes([659, 784, 988, 1319], 0.08, 0.12, 'square', 0.16),
    fall: [tone(700, 120, 0.5, 'triangle', 0.4)]
  });

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
    if (ev.powers.length) sound.play('powerup');
    else if (ev.bricks.length) sound.play('brick');
    else if (ev.shot) sound.play('shot');
    else if (ev.paddle) sound.play('paddle');
    else if (ev.wall) sound.play('wall');
    if (ev.bricks.length || ev.powers.length || ev.lost || ev.cleared) updateHud();
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
    return {
      level: w.level, bricks: w.bricks, loot: w.loot, paddle: w.paddle, small: w.small, balls: w.balls, stuck: w.stuck,
      lives: w.lives, score: w.score, drops: w.drops, shots: w.shots, fire: w.fire, laser: w.laser, wide: w.wide, reload: w.reload
    };
  }
  var persist = window.bdnixSave.keep('bricks', snapshot);

  function restore(s){
    var num = window.bdnixSave.num, k = s.bricks;
    // Games saved before there were powers have one ball and none of the rest.
    var balls = s.balls || (s.ball ? [s.ball] : null);
    var loot = s.loot || (Array.isArray(k) ? k.map(function(){ return ''; }) : null);
    var drops = s.drops || [], shots = s.shots || [];
    var time = function(t, most){ return t === undefined || (num(t) && t >= 0 && t <= most); };
    var ball = function(b){
      return !!b && num(b.x) && num(b.y) && num(b.dx) && num(b.dy) &&
        b.x >= F.R && b.x <= W - F.R && b.y >= F.R && b.y <= H + F.R &&
        Math.abs(b.dx * b.dx + b.dy * b.dy - 1) < 1e-6;
    };
    var ok = num(s.level) && s.level === Math.floor(s.level) && s.level >= 1 &&
      Array.isArray(k) && k.length === F.ROWS * F.COLS && k.every(function(v){ return v === 0 || v === 1; }) && k.indexOf(1) >= 0 &&
      Array.isArray(loot) && loot.length === k.length && loot.every(function(v, i){ return v === '' || (k[i] === 1 && F.KINDS.indexOf(v) >= 0); }) &&
      typeof s.small === 'boolean' && typeof s.stuck === 'boolean' &&
      num(s.lives) && s.lives === Math.floor(s.lives) && s.lives >= 1 && s.lives <= F.MAX_LIVES &&
      num(s.score) && s.score === Math.floor(s.score) &&
      Array.isArray(balls) && balls.length >= 1 && balls.length <= F.MAX_BALLS && balls.every(ball) && num(s.paddle) &&
      Array.isArray(drops) && drops.length <= F.LOOT.length && drops.every(function(p){
        return !!p && num(p.x) && num(p.y) && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H + F.DROP_H && F.KINDS.indexOf(p.kind) >= 0;
      }) &&
      Array.isArray(shots) && shots.length <= 100 && shots.every(function(p){
        return !!p && num(p.x) && num(p.y) && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= F.PADDLE_Y;
      }) &&
      time(s.fire, F.FIRE_TIME) && time(s.laser, F.LASER_TIME) && time(s.wide, F.WIDE_TIME) && time(s.reload, F.SHOT_EVERY);
    if (!ok) return false;
    // The score counts at least the bricks broken in this wall, and exactly
    // them on the first wall.
    var points = 0;
    k.forEach(function(v, i){ if (!v) points += F.POINTS[Math.floor(i / F.COLS)]; });
    if (s.level === 1 ? s.score !== points : s.score < points) return false;
    var w = F.create();
    w.level = s.level;
    w.bricks = k.slice();
    w.loot = loot.slice();
    w.small = s.small;
    w.lives = s.lives;
    w.score = s.score;
    w.fire = s.fire || 0;
    w.laser = s.laser || 0;
    w.wide = s.wide || 0;
    w.reload = s.reload || 0;
    w.stuck = false;
    F.movePaddle(w, s.paddle);
    if (w.paddle !== s.paddle) return false;         // off the end of the board
    if (s.stuck) F.stick(w);
    else {
      if (balls.some(function(b){ return F.brickAt(w, b.x, b.y) >= 0; })) return false; // inside a brick
      w.balls = balls.map(function(b){ return { x: b.x, y: b.y, dx: b.dx, dy: b.dy }; });
      w.drops = drops.map(function(p){ return { x: p.x, y: p.y, kind: p.kind }; });
      w.shots = shots.map(function(p){ return { x: p.x, y: p.y }; });
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
    drawShots();
    drawDrops();
    drawPaddle();
    if (state !== 'over') world.balls.forEach(drawBall);
    drawTimers();
    ctx.restore();

    if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
      var hint = compactMQ.matches ? 'Tap to launch' : 'Press Space or click to launch';
      var title = world.level > 1 && world.lives >= F.LIVES && !F.progress(world).broken ? 'Wall ' + world.level : 'Get ready';
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

  // Each brick with a lighter top edge, and the letter of the power it
  // hides; broken ones fade and swell away.
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
    var p = world.bricks[i] && POWERS[world.loot[i]];
    if (p) {
      ctx.fillStyle = 'rgba(8,10,18,.72)';
      ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 5.5, 0, Math.PI * 2); ctx.fill();
      mark(p, r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.restore();
  }
  function mark(p, x, y){
    ctx.fillStyle = p.color;
    ctx.font = '800 8px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.mark, x, y + 0.5);
  }

  // Falling capsules, dark with a rim and letter in the power's colour.
  function drawDrops(){
    world.drops.forEach(function(d){
      var p = POWERS[d.kind];
      ctx.fillStyle = 'rgba(8,10,18,.85)';
      roundRect(d.x - F.DROP_W / 2, d.y - F.DROP_H / 2, F.DROP_W, F.DROP_H, F.DROP_H / 2);
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = p.color;
      ctx.stroke();
      mark(p, d.x, d.y);
    });
  }

  function drawShots(){
    ctx.fillStyle = POWERS.laser.color;
    world.shots.forEach(function(s){ ctx.fillRect(s.x - 1.5, s.y, 3, F.SHOT_H); });
  }

  // How long each power has left, under the paddle.
  function drawTimers(){
    var on = ['fire', 'laser', 'wide'].filter(function(k){ return world[k] > 0; });
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    on.forEach(function(k, i){
      ctx.fillStyle = POWERS[k].color;
      ctx.fillText(POWERS[k].name + ' ' + Math.ceil(world[k]), W / 2 + (i - (on.length - 1) / 2) * 80, 466);
    });
  }

  function drawPaddle(){
    var pw = F.paddleWidth(world);
    var g = ctx.createLinearGradient(world.paddle - pw / 2, 0, world.paddle + pw / 2, 0);
    g.addColorStop(0, '#22d3ee'); g.addColorStop(1, '#a855f7');
    ctx.fillStyle = g;
    roundRect(world.paddle - pw / 2, F.PADDLE_Y, pw, F.PADDLE_H, F.PADDLE_H / 2);
    ctx.fill();
    // The laser's two guns, one at each end.
    if (world.laser > 0) {
      ctx.fillStyle = POWERS.laser.color;
      ctx.fillRect(world.paddle - pw / 2 + 2, F.PADDLE_Y - 4, 4, 6);
      ctx.fillRect(world.paddle + pw / 2 - 6, F.PADDLE_Y - 4, 4, 6);
    }
  }

  // A fireball glows orange.
  function drawBall(b){
    var fire = world.fire > 0;
    ctx.save();
    ctx.fillStyle = fire ? 'rgba(251,146,60,.35)' : 'rgba(238,241,248,.18)';
    ctx.beginPath(); ctx.arc(b.x, b.y, F.R * (fire ? 2.6 : 2.2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fire ? '#fdba74' : '#eef1f8';
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
