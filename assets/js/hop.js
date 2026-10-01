(function(){
  // The rules live in hop-core.js; this file draws them and handles input.
  var F = window.bdnixHop;
  var COLS = F.COLS, ROWS = F.ROWS;
  var CELL = 32;                // world units per cell
  var W = COLS * CELL, H = ROWS * CELL;
  var HOP_TIME = 0.1;           // how long a hop takes to draw
  var DEATH_TIME = 0.9;         // how long the crash plays before the score shows

  var CAR_COLORS = ['#f472b6', '#a855f7', '#22d3ee', '#facc15'];
  // A few ways to say how the round ended; one is picked at random.
  var ENDINGS = {
    car: ['Fowl play on the road!', 'Scrambled by traffic.', 'Flat as a pancake.', 'Beep beep. Splat.'],
    water: ['Splash! Chickens can’t swim.', 'Chicken soup, anyone?', 'Should have been a duck.'],
    swept: ['Gone with the current.', 'Off on a river cruise.', 'Swept off downstream.'],
    behind: ['Too slow: the road moved on without you.', 'Dawdled a little too long.', 'Why did the chicken stop crossing?']
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

  var SCALE = 1;                // CSS pixels per world unit
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var world = F.create(), carry = 0, clock = 0;
  var view = world.camera;      // the camera as drawn, easing after the real one
  var hopT = 0, from = null;    // the hop being drawn, and where it started
  var best = 0;
  var sound = window.bdnixSound;
  // This game's sounds, beside the ones every game shares (sound.js).
  var tone = sound.tone;
  sound.add({
    hop: [tone(520, 820, 0.06, 'square', 0.12)],
    crash: [tone(0, 0, 0.3, 'noise', 0.35), tone(120, 40, 0.3, 'sawtooth', 0.25)],
    splash: [tone(0, 0, 0.45, 'noise', 0.3), tone(600, 150, 0.35, 'sine', 0.3)],
    fall: [tone(700, 120, 0.5, 'triangle', 0.4)]
  });
  // The sound for each way a round can end.
  var CRASH_SOUNDS = { car: 'crash', water: 'splash', swept: 'fall', behind: 'fall' };

  try { best = parseInt(localStorage.getItem('bdnix_hop_best'), 10) || 0; } catch (e) {}

  // ---------- Game flow ----------
  function setState(s){ state = s; stateTime = 0; }
  function newGame(){
    world = F.create();
    carry = 0; hopT = 0; view = world.camera;
    setState('ready');
    pausedFrom = null;
    overlay.hidden = true;
    newBtn.hidden = true;
    startBtn.blur();
    window.bdnixGamebar.setPaused(false);
    updateHud();
    sound.play('start');
    persist();
  }
  function hop(dir){
    if (state !== 'ready' && state !== 'playing') return;
    var c = world.chicken, before = { x: c.x, row: c.row };
    if (!F.hop(world, dir)) return;
    if (state === 'ready') setState('playing');
    from = before; hopT = HOP_TIME;
    sound.play('hop');
    updateHud();
    if (world.dead) crash();
  }

  function update(dt){
    if (state === 'paused') return;
    stateTime += dt;
    clock += dt;
    hopT = Math.max(0, hopT - dt);
    view += (world.camera - view) * Math.min(1, dt * 6);
    if (state === 'over') return;
    if (state === 'dying') {
      if (stateTime > DEATH_TIME) gameOver();
      return;
    }
    // Traffic runs behind the start screen too; the chicken is safe on the
    // grass until its first hop.
    var r = F.advance(world, dt, carry);
    carry = r.carry;
    if (r.end) crash();
  }

  // The round ends the moment the chicken is caught: the best score and the
  // save are settled straight away, and the score shows once the crash has played.
  function crash(){
    setState('dying');
    sound.play(CRASH_SOUNDS[world.dead]);
    if (world.score > best) {
      best = world.score;
      try { localStorage.setItem('bdnix_hop_best', best); } catch (e) {}
    }
    updateHud();
    persist();
  }
  function gameOver(){
    setState('over');
    var score = world.score;
    var lines = ENDINGS[world.dead];
    sound.play(score >= best && score > 0 ? 'best' : 'over');
    ovKicker.textContent = lines[Math.min(lines.length - 1, Math.floor(Math.random() * lines.length))];
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
      window.bdnixGamebar.setPaused(false);
      last = performance.now();
    } else if (state === 'ready' || state === 'playing') {
      pausedFrom = state; state = 'paused';
      ovKicker.textContent = 'bdnix arcade';
      ovTitle.textContent = 'Paused';
      ovText.textContent = 'Take a breather.';
      startBtn.textContent = 'Resume';
      newBtn.hidden = false;
      overlay.hidden = false;
      window.bdnixGamebar.setPaused(true);
      persist();
    }
  }
  function updateHud(){
    el.score.textContent = world.score;
    el.best.textContent = Math.max(best, world.score);
  }

  // ---------- Saving ----------
  // A round in progress is saved as the page goes away, and comes back
  // paused. Before the first hop there's nothing worth keeping.
  function snapshot(){
    var s = state === 'paused' ? pausedFrom : state;
    if (s !== 'playing' || world.dead) return null;
    return {
      carry: carry, chicken: world.chicken, lanes: world.lanes, base: world.base,
      gen: world.gen, camera: world.camera, score: world.score
    };
  }
  var persist = window.bdnixSave.keep('hop', snapshot);

  var TYPES = ['grass', 'road', 'river'], FACES = ['up', 'down', 'left', 'right'];
  function validLane(l){
    var num = window.bdnixSave.num;
    return !!l && TYPES.indexOf(l.type) >= 0 && num(l.speed) &&
      Array.isArray(l.trees) && l.trees.every(function(t){ return t === Math.floor(t) && t >= 0 && t < COLS; }) &&
      Array.isArray(l.items) && l.items.every(function(i){
        return i && num(i.pos) && i.pos >= 0 && i.pos < F.PERIOD && (i.len === 1 || i.len === 2 || i.len === 3) &&
          i.color === Math.floor(i.color) && i.color >= 0 && i.color < CAR_COLORS.length;
      });
  }
  function restore(s){
    var num = window.bdnixSave.num, c = s.chicken, g = s.gen;
    var ok = !!c && num(c.x) && num(c.row) && c.row === Math.floor(c.row) && FACES.indexOf(c.face) >= 0 &&
      Array.isArray(s.lanes) && s.lanes.length > 0 && s.lanes.every(validLane) &&
      num(s.base) && s.base === Math.floor(s.base) && s.base >= 0 &&
      !!g && num(g.row) && g.row === s.base + s.lanes.length && TYPES.indexOf(g.kind) >= 0 &&
      num(g.left) && g.left >= 0 && (g.last === null || g.last === 'road' || g.last === 'river') &&
      [s.carry, s.camera, s.score].every(num) && c.row >= s.base && c.row < g.row;
    if (!ok) return false;
    var w = F.create();
    w.chicken = { x: c.x, row: c.row, face: c.face };
    w.lanes = s.lanes; w.base = s.base;
    w.gen = { row: g.row, kind: g.kind, left: g.left, last: g.last };
    w.camera = s.camera; w.score = s.score; w.started = true;
    if (F.danger(w)) return false;          // a save the chicken couldn't have survived
    F.fill(w);
    world = w; carry = s.carry; view = w.camera;
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
    board.parentNode.style.setProperty('--cell', Math.max(16, 24 * SCALE) + 'px');
    render();
  }

  // ---------- Drawing ----------
  // Screen y of the top of a row.
  function rowY(row){ return H - (row - view + 1) * CELL; }

  function render(){
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W * SCALE, H * SCALE);
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);

    // A car hit shakes the board for a moment.
    var pose = hitPose();
    ctx.save();
    if (pose) ctx.translate(pose.shakeX, pose.shakeY);
    var lo = Math.floor(view) - 1, hi = Math.ceil(view) + ROWS;
    for (var r = lo; r <= hi; r++) drawGround(r);
    for (r = lo; r <= hi; r++) drawThings(r);
    drawChicken(pose);
    for (r = lo; r <= hi; r++) drawTrees(r);
    if (pose) drawHit(pose);
    ctx.restore();

    if (state !== 'idle' && state !== 'over') drawScore();
    if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 30px Inter, system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,10,18,.8)';
      ctx.strokeText('Get ready', W / 2, 110);
      ctx.fillStyle = '#eef1f8';
      ctx.fillText('Get ready', W / 2, 110);
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.strokeText(compactMQ.matches ? 'Tap or swipe to hop' : 'Arrow keys to hop', W / 2, 140);
      ctx.fillStyle = '#c3c9d8';
      ctx.fillText(compactMQ.matches ? 'Tap or swipe to hop' : 'Arrow keys to hop', W / 2, 140);
    }
  }

  // A little past the edges, so the board's shake after a car hit shows no gap.
  function drawGround(row){
    var lane = F.laneAt(world, row), y = rowY(row);
    if (lane.type === 'grass') {
      ctx.fillStyle = row % 2 ? '#0f2a24' : '#12302a';
      ctx.fillRect(-8, y, W + 16, CELL);
    } else if (lane.type === 'road') {
      ctx.fillStyle = '#161a2e';
      ctx.fillRect(-8, y, W + 16, CELL);
      // Dashes between two roads side by side
      if (F.laneAt(world, row + 1).type === 'road') {
        ctx.fillStyle = 'rgba(238,241,248,.35)';
        for (var x = 6; x < W; x += 32) ctx.fillRect(x, y - 1, 18, 2);
      }
    } else {
      ctx.fillStyle = '#0b2d4a';
      ctx.fillRect(-8, y, W + 16, CELL);
      // Ripples drift with the current
      ctx.fillStyle = 'rgba(34,211,238,.18)';
      var shift = ((clock * lane.speed * CELL * 0.5) % 48 + 48) % 48;
      for (var rx = -48 + shift; rx < W; rx += 48) {
        ctx.fillRect(rx, y + 9, 14, 2);
        ctx.fillRect(rx + 24, y + 22, 10, 2);
      }
    }
  }

  function drawThings(row){
    var lane = F.laneAt(world, row), y = rowY(row);
    for (var i = 0; i < lane.items.length; i++) {
      var it = lane.items[i], x = F.left(it) * CELL, w = it.len * CELL;
      if (x > W || x + w < 0) continue;
      if (lane.type === 'road') drawCar(x, y, w, it, lane.speed > 0);
      else drawLog(x, y, w);
    }
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
  function drawCar(x, y, w, it, right){
    var color = CAR_COLORS[it.color];
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    roundRect(x + 2, y + 5, w - 4, CELL - 10, 6); ctx.fill();
    ctx.shadowBlur = 0;
    // Windscreen at the front, headlights beyond it
    var front = right ? x + w - 2 : x + 2, dir = right ? -1 : 1;
    ctx.fillStyle = 'rgba(8,10,18,.7)';
    var ws = it.len > 1 ? 7 : 6;
    ctx.fillRect(right ? front - 6 - ws : front + 6, y + 9, ws, CELL - 18);
    if (it.len > 1) {
      ctx.fillStyle = 'rgba(8,10,18,.25)';
      ctx.fillRect(right ? x + 6 : x + 18, y + 8, w - 30, CELL - 16);
    }
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(front + dir * 2 - (right ? 3 : 0), y + 8, 3, 4);
    ctx.fillRect(front + dir * 2 - (right ? 3 : 0), y + CELL - 12, 3, 4);
  }
  function drawLog(x, y, w){
    ctx.fillStyle = '#7c4a24';
    roundRect(x + 1, y + 4, w - 2, CELL - 8, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(8,10,18,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 12); ctx.lineTo(x + w - 14, y + 12);
    ctx.moveTo(x + 16, y + 20); ctx.lineTo(x + w - 8, y + 20);
    ctx.stroke();
    ctx.fillStyle = '#b07a45';
    ctx.beginPath(); ctx.ellipse(x + w - 5, y + CELL / 2, 4, 11, 0, 0, Math.PI * 2); ctx.fill();
  }
  function drawTrees(row){
    var lane = F.laneAt(world, row), y = rowY(row);
    for (var i = 0; i < lane.trees.length; i++) {
      var cx = (lane.trees[i] + 0.5) * CELL, cy = y + CELL / 2;
      ctx.fillStyle = '#14532d';
      ctx.beginPath(); ctx.arc(cx, cy + 2, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(134,239,172,.35)';
      ctx.beginPath(); ctx.arc(cx - 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // How the car hit looks now, or null if the chicken wasn't hit by a car.
  function hitPose(){
    if ((state !== 'dying' && state !== 'over') || world.dead !== 'car') return null;
    var lane = F.laneAt(world, world.chicken.row);
    return F.hitPose(state === 'over' ? DEATH_TIME : stateTime, lane.speed);
  }
  // The ring flashing where the car struck, and the feathers flying off.
  function drawHit(pose){
    var c = world.chicken, cx = (c.x + pose.dx + 0.5) * CELL, cy = rowY(c.row) + CELL / 2;
    if (pose.flash > 0) {
      ctx.strokeStyle = 'rgba(254,249,195,' + (0.9 * pose.flash).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 8 + (1 - pose.flash) * 16, 0, Math.PI * 2); ctx.stroke();
    }
    for (var i = 0; i < pose.feathers.length; i++) {
      var f = pose.feathers[i];
      if (f.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.translate(cx + f.x * CELL, cy + f.y * CELL);
      ctx.rotate(f.spin);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,.8)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
      ctx.restore();
    }
  }

  // The chicken, seen from above: a round white body, wings at the sides,
  // a red comb and an orange beak pointing the way it faces.
  var ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  function drawChicken(pose){
    var c = world.chicken, t = hopT > 0 && from ? 1 - hopT / HOP_TIME : 1;
    var x = from && t < 1 ? from.x + (c.x - from.x) * t : c.x;
    var row = from && t < 1 ? from.row + (c.row - from.row) * t : c.row;
    if (pose) x += pose.dx;
    var cx = (x + 0.5) * CELL, cy = rowY(row) + CELL / 2;
    var dying = state === 'dying' || state === 'over' ? world.dead : null;
    var lift = 1 + Math.sin(t * Math.PI) * 0.18;

    if (dying === 'water' || dying === 'swept') {
      // Rings spreading where it went under
      var p = Math.min(1, (state === 'over' ? DEATH_TIME : stateTime) / DEATH_TIME);
      ctx.strokeStyle = 'rgba(238,241,248,' + (0.8 * (1 - p)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      for (var k = 0; k < 2; k++) {
        ctx.beginPath(); ctx.arc(cx, cy, 6 + p * 14 + k * 6, 0, Math.PI * 2); ctx.stroke();
      }
      return;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ANGLES[c.face]);
    if (pose) ctx.scale(pose.sx, pose.sy);
    else ctx.scale(lift, lift);
    ctx.fillStyle = 'rgba(8,10,18,.35)';
    ctx.beginPath(); ctx.ellipse(0, 3, 11, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.ellipse(-10, 2, 4, 7, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 2, 4, 7, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.ellipse(0, 1, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.ellipse(0, -8, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fb923c';
    ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(0, -15); ctx.lineTo(3, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#080a12';
    ctx.beginPath(); ctx.arc(-4, -5, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -5, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawScore(){
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 34px Inter, system-ui, sans-serif';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,10,18,.8)';
    ctx.strokeText(world.score, W / 2, 34);
    ctx.fillStyle = '#eef1f8';
    ctx.fillText(world.score, W / 2, 34);
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
    KeyA:'left', KeyD:'right', KeyW:'up', KeyS:'down', Space:'up'
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
    if (d) {
      if (!e.repeat) hop(d);            // one hop per press; holding a key doesn't run
      e.preventDefault();
    }
  });
  window.addEventListener('blur', function(){ if (state === 'ready' || state === 'playing') togglePause(); });
  window.bdnixUpright.onTurn(function(){ if (state === 'ready' || state === 'playing') togglePause(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && (state === 'ready' || state === 'playing')) togglePause();
  });

  document.querySelectorAll('.touch button').forEach(function(b){
    var d = b.getAttribute('data-dir');
    b.addEventListener('pointerdown', function(e){ e.preventDefault(); hop(d); b.classList.add('on'); });
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){
      b.addEventListener(ev, function(){ b.classList.remove('on'); });
    });
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  });

  // Tap or click the game area to hop forward, or swipe to hop that way.
  var press = null;
  gameEl.addEventListener('pointerdown', function(e){
    if (state !== 'ready' && state !== 'playing') return;
    if (e.button > 0) return;
    e.preventDefault();
    press = { x: e.clientX, y: e.clientY, swiped: false };
  });
  gameEl.addEventListener('pointermove', function(e){
    if (!press || press.swiped) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    press.swiped = true;
    hop(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  gameEl.addEventListener('pointerup', function(){
    if (press && !press.swiped) hop('up');
    press = null;
  });
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

  var saved = window.bdnixSave.load('hop');
  if (saved && !restore(saved)) window.bdnixSave.clear('hop');
  updateHud();
  resize();
  requestAnimationFrame(loop);
})();
