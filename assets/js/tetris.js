(function(){
  var COLS = 10, ROWS = 20;
  var COLORS = window.bdnix.PALETTE;
  var SHAPES = window.bdnix.SHAPES;
  var LINE_SCORES = [0, 100, 300, 500, 800];
  var LOCK_DELAY = 500, MAX_LOCK_RESETS = 15;
  var DAS = 160, ARR = 45;
  var sound = window.bdnixSound;
  // This game's sounds, beside the ones every game shares (sound.js).
  var tone = sound.tone, notes = sound.notes;
  sound.add({
    move: [tone(260, 260, 0.03, 'square', 0.1)],
    rotate: [tone(440, 660, 0.05, 'square', 0.1)],
    drop: [tone(0, 0, 0.07, 'noise', 0.2), tone(320, 90, 0.1, 'triangle', 0.4)],
    lock: [tone(150, 90, 0.07, 'triangle', 0.35)],
    hold: [tone(520, 390, 0.08, 'sine', 0.35)],
    clear: notes([523, 659, 784], 0.05, 0.1, 'square', 0.16),
    bigclear: notes([523, 659, 784, 1047, 1319], 0.05, 0.12, 'square', 0.17),
    level: notes([659, 784, 988, 1319], 0.08, 0.12, 'square', 0.16)
  });

  var board = document.getElementById('board');
  var ctx = board.getContext('2d');
  var nextCanvas = document.getElementById('next');
  var holdCanvas = document.getElementById('hold');
  var nextCtx = nextCanvas.getContext('2d');
  var holdCtx = holdCanvas.getContext('2d');
  var gameEl = document.getElementById('game');
  var compactMQ = window.matchMedia('(max-width:700px),(pointer:coarse)');
  var landscapeMQ = window.matchMedia('(orientation:landscape) and (max-height:520px)');
  var PREVIEW = { cell: 16, slot: 64, count: 3 };
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ovTitle');
  var ovText = document.getElementById('ovText');
  var startBtn = document.getElementById('startBtn');
  var newBtn = document.getElementById('newBtn');
  var pauseBtn = document.getElementById('pauseBtn');
  var el = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    level: document.getElementById('level'),
    lines: document.getElementById('lines')
  };

  var CELL = 28;
  var grid, bag, queue, piece, held, canHold;
  var score, lines, level, best = 0;
  var dropAcc, lockAcc, lockResets, lastTime;
  var clearing = null; // {rows:[], t:0}
  var state = 'idle'; // idle | playing | paused | over

  try { best = parseInt(localStorage.getItem('bdnix_tetris_best'), 10) || 0; } catch (e) {}
  el.best.textContent = best;

  // ---------- Sizing ----------
  function sizeCanvas(c, cx, w, h){
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function resize(){
    var compact = compactMQ.matches;
    var cs = getComputedStyle(gameEl);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var gap = parseFloat(cs.columnGap) || 0;
    var availW, availH;

    if (landscapeMQ.matches) {
      PREVIEW = { cell: 11, slot: 30, count: 1 };
      sizeCanvas(holdCanvas, holdCtx, 48, 30);
      sizeCanvas(nextCanvas, nextCtx, 48, 30);
      var bs = getComputedStyle(document.body);
      availH = document.body.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom);
      availW = window.innerWidth - 2 * 190;
    } else if (compact) {
      PREVIEW = { cell: 11, slot: 30, count: 1 };
      sizeCanvas(holdCanvas, holdCtx, 48, 30);
      sizeCanvas(nextCanvas, nextCtx, 48, 30);
      var strip = document.querySelector('.stats').offsetHeight;
      strip = Math.max(strip, holdCanvas.parentNode.offsetHeight);
      availW = gameEl.clientWidth - padX;
      availH = gameEl.clientHeight - padY - strip - gap;
    } else {
      PREVIEW = { cell: 18, slot: 72, count: 3 };
      sizeCanvas(holdCanvas, holdCtx, 96, 72);
      sizeCanvas(nextCanvas, nextCtx, 96, 72 * 3);
      availW = gameEl.clientWidth - padX - 128 * 2 - gap * 2;
      availH = gameEl.clientHeight - padY;
    }
    CELL = Math.max(12, Math.min(40, Math.floor(Math.min((availW - 2) / COLS, (availH - 2) / ROWS))));
    sizeCanvas(board, ctx, COLS * CELL, ROWS * CELL);
    board.parentNode.style.setProperty('--cell', CELL + 'px');
    render();
  }

  // ---------- Pieces ----------
  function refillBag(){
    var b = Object.keys(SHAPES);
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    bag = bag.concat(b);
  }
  function nextType(){
    if (bag.length < 7) refillBag();
    return bag.shift();
  }
  function makePiece(type){
    var m = SHAPES[type].map(function(r){ return r.slice(); });
    return { type:type, m:m, x:Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
  }
  function rotateMatrix(m, dir){
    var n = m.length, out = [];
    for (var r = 0; r < n; r++) {
      out.push([]);
      for (var c = 0; c < n; c++) {
        out[r][c] = dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r];
      }
    }
    return out;
  }
  function collides(m, x, y){
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var gx = x + c, gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  }
  function onGround(){ return collides(piece.m, piece.x, piece.y + 1); }

  function touchedMove(){
    if (onGround() && lockResets < MAX_LOCK_RESETS) { lockAcc = 0; lockResets++; }
  }

  function move(dx){
    if (!collides(piece.m, piece.x + dx, piece.y)) {
      piece.x += dx; touchedMove(); sound.play('move'); return true;
    }
    return false;
  }
  function rotate(dir){
    if (piece.type === 'O') return;
    var m = rotateMatrix(piece.m, dir);
    var kicks = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[-1,-1],[1,-1]];
    for (var i = 0; i < kicks.length; i++) {
      var nx = piece.x + kicks[i][0], ny = piece.y + kicks[i][1];
      if (!collides(m, nx, ny)) {
        piece.m = m; piece.x = nx; piece.y = ny; touchedMove(); sound.play('rotate'); return;
      }
    }
  }
  function softDrop(){
    if (!collides(piece.m, piece.x, piece.y + 1)) {
      piece.y++; score += 1; dropAcc = 0; return true;
    }
    return false;
  }
  function hardDrop(){
    var d = 0;
    while (!collides(piece.m, piece.x, piece.y + 1)) { piece.y++; d++; }
    score += d * 2;
    sound.play('drop');
    lock();
  }
  function hold(){
    if (!canHold) return;
    var t = piece.type;
    if (held) { piece = makePiece(held); } else { piece = makePiece(queue.shift()); queue.push(nextType()); }
    held = t;
    canHold = false;
    resetTimers();
    sound.play('hold');
  }
  function ghostY(){
    var y = piece.y;
    while (!collides(piece.m, piece.x, y + 1)) y++;
    return y;
  }

  function resetTimers(){ dropAcc = 0; lockAcc = 0; lockResets = 0; }

  function spawn(){
    piece = makePiece(queue.shift());
    queue.push(nextType());
    canHold = true;
    resetTimers();
    if (collides(piece.m, piece.x, piece.y)) gameOver();
  }

  function lock(){
    var m = piece.m, above = false;
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var gy = piece.y + r;
        if (gy < 0) { above = true; continue; }
        grid[gy][piece.x + c] = piece.type;
      }
    }
    if (above) { gameOver(); return; }

    var full = [];
    for (var y = 0; y < ROWS; y++) {
      if (grid[y].every(Boolean)) full.push(y);
    }
    sound.play(full.length === 4 ? 'bigclear' : full.length ? 'clear' : 'lock');
    if (full.length) {
      clearing = { rows: full, t: 0 };
      piece = null;
    } else {
      spawn();
    }
    updateHud();
  }

  function finishClear(){
    var n = clearing.rows.length;
    clearing.rows.forEach(function(y){
      grid.splice(y, 1);
      grid.unshift(new Array(COLS).fill(null));
    });
    clearing = null;
    lines += n;
    score += LINE_SCORES[n] * level;
    var was = level;
    level = Math.floor(lines / 10) + 1;
    if (level > was) sound.play('level');
    updateHud();
    spawn();
  }

  function dropInterval(){
    // Roughly follows the guideline gravity curve, in ms per row.
    return Math.max(30, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000);
  }

  // ---------- Game state ----------
  function newGame(){
    grid = [];
    for (var i = 0; i < ROWS; i++) grid.push(new Array(COLS).fill(null));
    bag = []; queue = [];
    for (var q = 0; q < 5; q++) queue.push(nextType());
    held = null; score = 0; lines = 0; level = 1; clearing = null;
    spawn();
    updateHud();
    state = 'playing';
    overlay.hidden = true;
    newBtn.hidden = true;
    startBtn.blur();
    window.bdnixGamebar.setPaused(false);
    lastTime = performance.now();
    sound.play('start');
    persist();
  }
  function gameOver(){
    state = 'over';
    piece = null;
    if (score > best) {
      best = score;
      try { localStorage.setItem('bdnix_tetris_best', best); } catch (e) {}
    }
    updateHud();
    sound.play(score >= best && score > 0 ? 'best' : 'over');
    ovTitle.textContent = 'Game over';
    ovText.textContent = 'Score ' + score + (score >= best && score > 0 ? ' — new best!' : ' · Best ' + best);
    startBtn.textContent = 'Play again';
    startBtn.blur();
    newBtn.hidden = true;
    overlay.hidden = false;
    startBtn.focus();
    persist();
  }
  function togglePause(){
    if (state === 'playing') {
      state = 'paused';
      ovTitle.textContent = 'Paused';
      ovText.textContent = 'Take a breather.';
      startBtn.textContent = 'Resume';
      newBtn.hidden = false;
      overlay.hidden = false;
      window.bdnixGamebar.setPaused(true);
      persist();
    } else if (state === 'paused') {
      state = 'playing';
      overlay.hidden = true;
      window.bdnixGamebar.setPaused(false);
      lastTime = performance.now();
    }
  }
  function updateHud(){
    el.score.textContent = score;
    el.lines.textContent = lines;
    el.level.textContent = level;
    el.best.textContent = Math.max(best, score);
  }

  // ---------- Saving ----------
  // A game in progress is saved as the page goes away, and comes back paused.
  function snapshot(){
    if (state !== 'playing' && state !== 'paused') return null;
    return {
      grid: grid, bag: bag, queue: queue, piece: piece, held: held, canHold: canHold,
      score: score, lines: lines, level: level, clearing: clearing,
      dropAcc: dropAcc, lockAcc: lockAcc, lockResets: lockResets
    };
  }
  var persist = window.bdnixSave.keep('tetris', snapshot);

  function isType(t){ return typeof t === 'string' && Object.prototype.hasOwnProperty.call(SHAPES, t); }
  function isRow(r){ return Array.isArray(r) && r.length === COLS && r.every(function(c){ return c === null || isType(c); }); }
  function isMatrix(m){ return Array.isArray(m) && m.length > 0 && m.every(function(r){ return Array.isArray(r) && r.length === m.length; }); }
  function restore(s){
    var num = window.bdnixSave.num;
    var p = s.piece, c = s.clearing;
    var ok = Array.isArray(s.grid) && s.grid.length === ROWS && s.grid.every(isRow) &&
      Array.isArray(s.queue) && s.queue.length >= 3 && s.queue.every(isType) &&
      Array.isArray(s.bag) && s.bag.every(isType) &&
      (s.held === null || isType(s.held)) &&
      (p ? isType(p.type) && isMatrix(p.m) && num(p.x) && num(p.y) :
        c && num(c.t) && Array.isArray(c.rows) && c.rows.every(function(y){ return num(y) && y >= 0 && y < ROWS; })) &&
      [s.score, s.lines, s.level, s.dropAcc, s.lockAcc, s.lockResets].every(num);
    if (!ok) return false;
    grid = s.grid; bag = s.bag; queue = s.queue; piece = p || null; held = s.held; canHold = !!s.canHold;
    score = s.score; lines = s.lines; level = s.level; clearing = c || null;
    dropAcc = s.dropAcc; lockAcc = s.lockAcc; lockResets = s.lockResets;
    state = 'playing';
    togglePause();
    ovText.textContent = 'Picked up where you left off.';
    updateHud();
    return true;
  }

  // ---------- Loop ----------
  function loop(now){
    var dt = now - lastTime;
    lastTime = now;
    if (state === 'playing') {
      handleRepeat(now);
      if (clearing) {
        clearing.t += dt;
        if (clearing.t > 180) finishClear();
      } else if (piece) {
        if (onGround()) {
          lockAcc += dt;
          if (lockAcc >= LOCK_DELAY) lock();
        } else {
          dropAcc += dt;
          var iv = dropInterval();
          while (dropAcc >= iv && !onGround()) { piece.y++; dropAcc -= iv; }
          if (onGround()) dropAcc = 0;
        }
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  // ---------- Rendering ----------
  function cell(c, x, y, size, color, alpha){ window.bdnix.block(c, x, y, size, color, alpha); }
  function render(){
    var W = COLS * CELL, H = ROWS * CELL;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,.035)';
    ctx.lineWidth = 1;
    for (var gx = 1; gx < COLS; gx++) { ctx.beginPath(); ctx.moveTo(gx * CELL + .5, 0); ctx.lineTo(gx * CELL + .5, H); ctx.stroke(); }
    for (var gy = 1; gy < ROWS; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * CELL + .5); ctx.lineTo(W, gy * CELL + .5); ctx.stroke(); }

    if (!grid) return;

    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (grid[y][x]) cell(ctx, x * CELL, y * CELL, CELL, COLORS[grid[y][x]]);
      }
    }

    if (clearing) {
      var a = 1 - clearing.t / 180;
      ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, a) + ')';
      clearing.rows.forEach(function(r){ ctx.fillRect(0, r * CELL, W, CELL); });
    }

    if (piece) {
      var gyy = ghostY();
      drawMatrix(ctx, piece.m, piece.x, gyy, CELL, COLORS[piece.type], 0.2);
      drawMatrix(ctx, piece.m, piece.x, piece.y, CELL, COLORS[piece.type], 1);
    }

    renderPreview(nextCtx, queue ? queue.slice(0, PREVIEW.count) : [], false);
    renderPreview(holdCtx, held ? [held] : [], state === 'playing' && !canHold);
  }
  function drawMatrix(c, m, px, py, size, color, alpha){
    for (var r = 0; r < m.length; r++) {
      for (var k = 0; k < m[r].length; k++) {
        if (m[r][k] && py + r >= 0) cell(c, (px + k) * size, (py + r) * size, size, color, alpha);
      }
    }
  }
  function renderPreview(c, types, dim){
    var cw = parseFloat(c.canvas.style.width), ch = parseFloat(c.canvas.style.height);
    var slot = PREVIEW.slot;
    c.clearRect(0, 0, cw, ch);
    types.forEach(function(t, i){
      var m = SHAPES[t];
      // trim empty rows/cols
      var rows = m.map(function(r, ri){ return r.some(Boolean) ? ri : -1; }).filter(function(v){ return v >= 0; });
      var cols = m[0].map(function(_, ci){ return m.some(function(r){ return r[ci]; }) ? ci : -1; }).filter(function(v){ return v >= 0; });
      var size = PREVIEW.cell;
      var w = cols.length * size, h = rows.length * size;
      var ox = (cw - w) / 2, oy = i * slot + (slot - h) / 2;
      rows.forEach(function(r, ri){
        cols.forEach(function(col, ci){
          if (m[r][col]) cell(c, ox + ci * size, oy + ri * size, size, COLORS[t], dim ? 0.35 : 1);
        });
      });
    });
  }

  // ---------- Input ----------
  var held_keys = {}; // action -> {next: timestamp}
  function act(a){
    if (state !== 'playing' || !piece || clearing) return;
    switch (a) {
      case 'left': move(-1); break;
      case 'right': move(1); break;
      case 'down': softDrop(); updateHud(); break;
      case 'rotate': rotate(1); break;
      case 'rotateCCW': rotate(-1); break;
      case 'drop': hardDrop(); break;
      case 'hold': hold(); break;
    }
  }
  var REPEATABLE = { left:1, right:1, down:1 };
  function press(a){
    if (held_keys[a]) return;
    act(a);
    if (REPEATABLE[a]) held_keys[a] = { next: performance.now() + (a === 'down' ? ARR : DAS) };
    else held_keys[a] = { next: Infinity };
  }
  function release(a){ delete held_keys[a]; }
  function handleRepeat(now){
    for (var a in held_keys) {
      var h = held_keys[a];
      while (now >= h.next) { act(a); h.next += ARR; }
    }
  }

  var KEYMAP = {
    ArrowLeft:'left', ArrowRight:'right', ArrowDown:'down', ArrowUp:'rotate',
    KeyX:'rotate', KeyZ:'rotateCCW', Space:'drop', KeyC:'hold', ShiftLeft:'hold', ShiftRight:'hold',
    KeyA:'left', KeyD:'right', KeyS:'down', KeyW:'rotate'
  };
  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && state !== 'playing') {
      startOrResume(); e.preventDefault(); return;
    }
    var a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    press(a);
  });
  document.addEventListener('keyup', function(e){
    var a = KEYMAP[e.code];
    if (a) release(a);
  });
  window.addEventListener('blur', function(){
    held_keys = {};
    if (state === 'playing') togglePause();
  });
  window.bdnixUpright.onTurn(function(){ if (state === 'playing') togglePause(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && state === 'playing') togglePause();
  });

  document.querySelectorAll('.touch button').forEach(function(b){
    var a = b.getAttribute('data-act');
    b.addEventListener('pointerdown', function(e){ e.preventDefault(); press(a); });
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){
      b.addEventListener(ev, function(){ release(a); });
    });
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  });

  // Tap the board to rotate on touch devices.
  board.addEventListener('pointerdown', function(e){
    if (e.pointerType === 'touch') act('rotate');
  });

  function startOrResume(){
    if (state === 'paused') togglePause();
    else newGame();
  }
  startBtn.addEventListener('click', startOrResume);
  newBtn.addEventListener('click', newGame);
  pauseBtn.addEventListener('click', function(){
    if (state === 'playing' || state === 'paused') togglePause();
  });

  window.addEventListener('resize', resize);
  if (compactMQ.addEventListener) {
    compactMQ.addEventListener('change', resize);
    landscapeMQ.addEventListener('change', resize);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  var saved = window.bdnixSave.load('tetris');
  if (saved && !restore(saved)) window.bdnixSave.clear('tetris');
  resize();
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();
