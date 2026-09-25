(function(){
  // Classic 28x31 maze. # wall, - ghost-house door, . dot, o power pellet.
  var MAP = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '     #.##### ## #####.#     ',
    '     #.##          ##.#     ',
    '     #.## ###--### ##.#     ',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '     #.## ######## ##.#     ',
    '     #.##          ##.#     ',
    '     #.## ######## ##.#     ',
    '######.## ######## ##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################'
  ];
  var COLS = 28, ROWS = 31, TUNNEL_ROW = 14;
  var DOOR = { x: 13.5, y: 11 }, HOUSE_Y = 14;
  var UP = {x:0,y:-1}, LEFT = {x:-1,y:0}, DOWN = {x:0,y:1}, RIGHT = {x:1,y:0};
  var DIRS = [UP, LEFT, DOWN, RIGHT]; // tie-break order, as in the arcade
  var DIR_BY_NAME = { up: UP, left: LEFT, down: DOWN, right: RIGHT };
  var MODES = [7, 20, 7, 20, 5, 20, 5, Infinity]; // scatter, chase, scatter, ...

  var PAC_COLOR = '#facc15';
  var FRIGHT_COLOR = '#4338ca';
  var GHOSTS = [
    { name:'blinky', color:'#fb7185', corner:{x:25,y:-3}, start:{x:13.5,y:11},    inHouse:false },
    { name:'pinky',  color:'#e879f9', corner:{x:2, y:-3}, start:{x:13.5,y:HOUSE_Y}, inHouse:true, wait:1,  dots:0 },
    { name:'inky',   color:'#22d3ee', corner:{x:27,y:32}, start:{x:11.5,y:HOUSE_Y}, inHouse:true, wait:5,  dots:30 },
    { name:'clyde',  color:'#818cf8', corner:{x:0, y:32}, start:{x:15.5,y:HOUSE_Y}, inHouse:true, wait:9,  dots:60 }
  ];

  var board = document.getElementById('board');
  var ctx = board.getContext('2d');
  var livesCanvas = document.getElementById('lives');
  var livesCtx = livesCanvas.getContext('2d');
  var gameEl = document.getElementById('game');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ovTitle');
  var ovText = document.getElementById('ovText');
  var startBtn = document.getElementById('startBtn');
  var pauseBtn = document.getElementById('pauseBtn');
  var el = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    level: document.getElementById('level')
  };
  var compactMQ = window.matchMedia('(max-width:700px),(pointer:coarse)');
  var landscapeMQ = window.matchMedia('(orientation:landscape) and (max-height:520px)');
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z"/></svg>';

  var CELL = 16, wallLayer = null;
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var dots, dotsLeft, dotsEaten, totalDots;
  var pac, ghosts, wanted;
  var score = 0, best = 0, level = 1, lives = 3, extraLifeGiven = false;
  var modeIndex, modeTime, frightTime, frightCombo, lifeTime, freeze;
  var fruit, popups;

  try { best = parseInt(localStorage.getItem('bdnix_pacman_best'), 10) || 0; } catch (e) {}

  // ---------- Maze ----------
  function isWall(x, y){
    if (y === TUNNEL_ROW && (x < 0 || x >= COLS)) return false;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    var c = MAP[y][x];
    return c === '#' || c === '-';
  }
  function resetDots(){
    dots = []; dotsLeft = 0;
    for (var y = 0; y < ROWS; y++) {
      dots.push([]);
      for (var x = 0; x < COLS; x++) {
        var c = MAP[y][x];
        var v = c === '.' ? 1 : c === 'o' ? 2 : 0;
        dots[y].push(v);
        if (v) dotsLeft++;
      }
    }
    totalDots = dotsLeft;
    dotsEaten = 0;
  }

  // ---------- Speeds (tiles per second) ----------
  function pacSpeed(){ return Math.min(9.5, 7.6 + (level - 1) * 0.3); }
  function ghostSpeed(g){
    if (g.state === 'eaten') return 15;
    var base = Math.min(9.2, 7.1 + (level - 1) * 0.35);
    if (g.state !== 'active') return 4;
    var ty = Math.round(g.y), tx = Math.round(g.x);
    if (ty === TUNNEL_ROW && (tx <= 5 || tx >= 22)) return base * 0.45;
    if (g.fright) return base * 0.55;
    return base;
  }
  function frightDuration(){ return Math.max(1.5, 7 - level); }

  // ---------- Setup ----------
  function resetActors(){
    pac = { x: 13.5, y: 23, dir: LEFT, face: LEFT, moving: true, chomp: 0 };
    wanted = LEFT;
    ghosts = GHOSTS.map(function(d){
      return {
        def: d, x: d.start.x, y: d.start.y,
        dir: d.inHouse ? UP : LEFT,
        state: d.inHouse ? 'house' : 'active',
        fright: false, bob: 0
      };
    });
    modeIndex = 0; modeTime = 0; frightTime = 0; lifeTime = 0; freeze = 0;
    fruit = null; popups = [];
  }
  function newGame(){
    score = 0; level = 1; lives = 3; extraLifeGiven = false;
    resetDots();
    resetActors();
    setState('ready');
    overlay.hidden = true;
    startBtn.blur();
    pauseBtn.innerHTML = ICON_PAUSE; pauseBtn.setAttribute('aria-label', 'Pause');
    updateHud();
  }
  function setState(s){ state = s; stateTime = 0; }

  // ---------- Movement ----------
  function wrap(e){
    if (e.x < -1) e.x = COLS;
    else if (e.x > COLS) e.x = -1;
  }
  // Move an entity along the grid. At each tile centre, choose(e) may change e.dir.
  function advance(e, dist, choose){
    var guard = 0;
    while (dist > 1e-6 && guard++ < 8) {
      var rx = Math.round(e.x), ry = Math.round(e.y);
      if (Math.abs(e.x - rx) < 1e-6 && Math.abs(e.y - ry) < 1e-6) {
        e.x = rx; e.y = ry;
        wrap(e);
        choose(e);
        if (!e.dir) return;
      }
      var nx = e.dir.x > 0 ? Math.floor(e.x) + 1 : e.dir.x < 0 ? Math.ceil(e.x) - 1 : e.x;
      var ny = e.dir.y > 0 ? Math.floor(e.y) + 1 : e.dir.y < 0 ? Math.ceil(e.y) - 1 : e.y;
      var step = Math.min(Math.abs(nx - e.x) + Math.abs(ny - e.y), dist);
      e.x += e.dir.x * step; e.y += e.dir.y * step;
      dist -= step;
      if (e === pac) pac.chomp += step;
    }
  }
  // Straight-line scripted move (used in and around the ghost house).
  function moveToward(e, tx, ty, dist){
    var dx = tx - e.x, dy = ty - e.y;
    if (Math.abs(dx) > 1e-6) {
      var sx = Math.sign(dx) * Math.min(Math.abs(dx), dist);
      e.x += sx; dist -= Math.abs(sx);
      e.dir = dx > 0 ? RIGHT : LEFT;
    }
    if (dist > 0 && Math.abs(dy) > 1e-6) {
      var sy = Math.sign(dy) * Math.min(Math.abs(dy), dist);
      e.y += sy; dist -= Math.abs(sy);
      e.dir = dy > 0 ? DOWN : UP;
    }
    return Math.abs(tx - e.x) < 1e-6 && Math.abs(ty - e.y) < 1e-6;
  }

  function pacChoose(p){
    var x = Math.round(p.x), y = Math.round(p.y);
    if (wanted && !isWall(x + wanted.x, y + wanted.y)) p.dir = wanted;
    else if (p.dir && isWall(x + p.dir.x, y + p.dir.y)) p.dir = null;
    if (p.dir) p.face = p.dir;
  }

  function ghostTarget(g){
    if (g.state === 'eaten') return { x: 13, y: 11 };
    var chase = modeIndex % 2 === 1;
    if (!chase) return g.def.corner;
    var px = Math.round(pac.x), py = Math.round(pac.y), f = pac.face;
    switch (g.def.name) {
      case 'blinky': return { x: px, y: py };
      case 'pinky': return { x: px + f.x * 4, y: py + f.y * 4 };
      case 'inky':
        var b = ghosts[0], vx = px + f.x * 2, vy = py + f.y * 2;
        return { x: vx * 2 - Math.round(b.x), y: vy * 2 - Math.round(b.y) };
      default:
        var dx = px - g.x, dy = py - g.y;
        return dx * dx + dy * dy > 64 ? { x: px, y: py } : g.def.corner;
    }
  }
  function ghostChoose(g){
    var x = Math.round(g.x), y = Math.round(g.y);
    if (g.state === 'eaten' && y === 11 && (x === 13 || x === 14)) {
      g.state = 'entering'; g.dir = null; return;
    }
    var opts = [];
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i];
      if (g.dir && d.x === -g.dir.x && d.y === -g.dir.y) continue;
      if (!isWall(x + d.x, y + d.y)) opts.push(d);
    }
    if (!opts.length) { g.dir = { x: -g.dir.x, y: -g.dir.y }; return; }
    if (g.fright) { g.dir = opts[Math.floor(Math.random() * opts.length)]; return; }
    var t = ghostTarget(g), bestD = Infinity;
    opts.forEach(function(d){
      var ex = x + d.x - t.x, ey = y + d.y - t.y, dd = ex * ex + ey * ey;
      if (dd < bestD) { bestD = dd; g.dir = d; }
    });
  }
  function reverse(g){ if (g.dir) g.dir = { x: -g.dir.x, y: -g.dir.y }; }

  function updateGhost(g, dt){
    var dist = ghostSpeed(g) * dt;
    switch (g.state) {
      case 'house':
        g.bob += dt * 4;
        g.y = HOUSE_Y + Math.sin(g.bob) * 0.35;
        g.dir = Math.cos(g.bob) > 0 ? DOWN : UP;
        if (lifeTime >= g.def.wait || (g.def.dots && dotsEaten >= g.def.dots)) g.state = 'leaving';
        break;
      case 'leaving':
        if (Math.abs(g.x - DOOR.x) > 1e-6) moveToward(g, DOOR.x, HOUSE_Y, dist);
        else if (moveToward(g, DOOR.x, DOOR.y, dist)) { g.state = 'active'; g.dir = LEFT; }
        break;
      case 'entering':
        if (Math.abs(g.x - DOOR.x) > 1e-6 && g.y <= DOOR.y + 1e-6) moveToward(g, DOOR.x, DOOR.y, dist);
        else if (moveToward(g, DOOR.x, HOUSE_Y, dist)) g.state = 'leaving';
        break;
      default:
        advance(g, dist, ghostChoose);
    }
  }

  // ---------- Game loop ----------
  function update(dt){
    stateTime += dt;
    popups.forEach(function(p){ p.t += dt; });
    popups = popups.filter(function(p){ return p.t < 1; });

    if (state === 'ready') { if (stateTime > (level === 1 && score === 0 ? 2.2 : 1.6)) setState('playing'); return; }
    if (state === 'dying') { if (stateTime > 1.8) afterDeath(); return; }
    if (state === 'cleared') { if (stateTime > 2) nextLevel(); return; }
    if (state !== 'playing') return;

    if (freeze > 0) { freeze -= dt; return; }

    lifeTime += dt;
    if (frightTime > 0) {
      frightTime -= dt;
      if (frightTime <= 0) ghosts.forEach(function(g){ g.fright = false; });
    } else {
      modeTime += dt;
      if (modeTime >= MODES[modeIndex]) {
        modeTime = 0; modeIndex++;
        ghosts.forEach(function(g){ if (g.state === 'active') reverse(g); });
      }
    }
    if (fruit) { fruit.t -= dt; if (fruit.t <= 0) fruit = null; }

    // Small sub-steps so fast actors never skip over each other.
    var steps = Math.ceil(dt / (1 / 120));
    var h = dt / steps;
    for (var s = 0; s < steps && state === 'playing' && freeze <= 0; s++) {
      // Pac-Man may reverse at any time, not only at tile centres.
      if (wanted && pac.dir && wanted.x === -pac.dir.x && wanted.y === -pac.dir.y) { pac.dir = wanted; pac.face = wanted; }
      if (!pac.dir) pacChoose(pac);
      advance(pac, pacSpeed() * h, pacChoose);
      pac.moving = !!pac.dir;
      eat();
      ghosts.forEach(function(g){ updateGhost(g, h); });
      collide();
    }
  }

  function eat(){
    var x = Math.round(pac.x), y = Math.round(pac.y);
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return;
    if (Math.abs(pac.x - x) + Math.abs(pac.y - y) > 0.35) return;
    var v = dots[y][x];
    if (v) {
      dots[y][x] = 0; dotsLeft--; dotsEaten++;
      addScore(v === 2 ? 50 : 10);
      if (v === 2) {
        frightTime = frightDuration(); frightCombo = 0;
        ghosts.forEach(function(g){ if (g.state === 'active') { g.fright = true; reverse(g); } });
      }
      if (dotsEaten === 70 || dotsEaten === 170) fruit = { x: 13.5, y: 17, t: 9.5 };
      if (dotsLeft === 0) { setState('cleared'); return; }
    }
    if (fruit && Math.abs(pac.x - fruit.x) < 0.8 && Math.abs(pac.y - fruit.y) < 0.6) {
      var pts = Math.min(5000, 100 * level);
      addScore(pts);
      popups.push({ x: fruit.x, y: fruit.y, text: pts, t: 0, color: '#f472b6' });
      fruit = null;
    }
  }

  function collide(){
    for (var i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      if (g.state !== 'active') continue;
      var dx = g.x - pac.x, dy = g.y - pac.y;
      if (dx * dx + dy * dy > 0.42) continue;
      if (g.fright) {
        var pts = 200 << frightCombo;
        frightCombo = Math.min(frightCombo + 1, 3);
        addScore(pts);
        popups.push({ x: g.x, y: g.y, text: pts, t: 0, color: '#22d3ee' });
        g.fright = false; g.state = 'eaten';
        freeze = 0.45;
      } else {
        setState('dying');
        return;
      }
    }
  }

  function afterDeath(){
    lives--;
    updateHud();
    if (lives <= 0) { gameOver(); return; }
    resetActors();
    // After a death, ghosts leave on timers only.
    setState('ready');
  }
  function nextLevel(){
    level++;
    resetDots();
    resetActors();
    setState('ready');
    updateHud();
  }
  function addScore(n){
    score += n;
    if (!extraLifeGiven && score >= 10000) { extraLifeGiven = true; lives++; }
    updateHud();
  }
  function gameOver(){
    setState('over');
    if (score > best) {
      best = score;
      try { localStorage.setItem('bdnix_pacman_best', best); } catch (e) {}
    }
    updateHud();
    ovTitle.textContent = 'Game over';
    ovText.textContent = 'Score ' + score + (score >= best && score > 0 ? ' — new best!' : ' · Best ' + best);
    startBtn.textContent = 'Play again';
    overlay.hidden = false;
    startBtn.focus();
  }
  function togglePause(){
    if (state === 'paused') {
      state = pausedFrom; pausedFrom = null;
      overlay.hidden = true;
      pauseBtn.innerHTML = ICON_PAUSE; pauseBtn.setAttribute('aria-label', 'Pause');
      last = performance.now();
    } else if (state === 'ready' || state === 'playing' || state === 'dying' || state === 'cleared') {
      pausedFrom = state; state = 'paused';
      ovTitle.textContent = 'Paused';
      ovText.textContent = 'Take a breather.';
      startBtn.textContent = 'Resume';
      overlay.hidden = false;
      pauseBtn.innerHTML = ICON_PLAY; pauseBtn.setAttribute('aria-label', 'Resume');
    }
  }
  function updateHud(){
    el.score.textContent = score;
    el.best.textContent = Math.max(best, score);
    el.level.textContent = level;
    drawLives();
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
    sizeCanvas(livesCanvas, livesCtx, 60, 16);
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
    CELL = Math.max(8, Math.min(26, Math.floor(Math.min((availW - 2) / COLS, (availH - 2) / ROWS) * 2) / 2));
    sizeCanvas(board, ctx, COLS * CELL, ROWS * CELL);
    board.parentNode.style.setProperty('--cell', Math.max(16, CELL * 1.2) + 'px');
    buildWalls();
    drawLives();
    render();
  }

  // ---------- Rendering ----------
  // Walls are drawn once into an offscreen layer: a glowing outline made by
  // painting thick "pipes" in the brand gradient, then thinner dark pipes on top.
  function buildWalls(){
    var dpr = window.devicePixelRatio || 1;
    var W = COLS * CELL, H = ROWS * CELL;
    wallLayer = document.createElement('canvas');
    wallLayer.width = Math.round(W * dpr); wallLayer.height = Math.round(H * dpr);
    var c = wallLayer.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var grad = c.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#22d3ee'); grad.addColorStop(.55, '#a855f7'); grad.addColorStop(1, '#f472b6');
    var line = Math.max(1.5, CELL * 0.11);
    c.shadowColor = 'rgba(168,85,247,.7)'; c.shadowBlur = CELL * 0.5;
    pipes(c, CELL * 0.3 + line / 2, grad);
    c.shadowBlur = 0;
    pipes(c, CELL * 0.3 - line / 2, '#0b0d1a');
  }
  function wallAt(x, y){ return y >= 0 && y < ROWS && x >= 0 && x < COLS && MAP[y][x] === '#'; }
  function pipes(c, half, fill){
    c.fillStyle = fill;
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      if (!wallAt(x, y)) continue;
      var cx = (x + .5) * CELL, cy = (y + .5) * CELL;
      c.fillRect(cx - half, cy - half, half * 2, half * 2);
      var r = wallAt(x + 1, y), d = wallAt(x, y + 1);
      if (r) c.fillRect(cx, cy - half, CELL, half * 2);
      if (d) c.fillRect(cx - half, cy, half * 2, CELL);
      if (r && d && wallAt(x + 1, y + 1)) c.fillRect(cx, cy, CELL, CELL);
    }
  }

  function render(){
    var W = COLS * CELL, H = ROWS * CELL, t = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);
    if (!wallLayer) return;

    var flash = state === 'cleared' && Math.floor(stateTime * 5) % 2 === 1;
    ctx.globalAlpha = flash ? 0.25 : 1;
    ctx.drawImage(wallLayer, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // Ghost-house door
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(13 * CELL, 12.45 * CELL, 2 * CELL, Math.max(2, CELL * 0.14));

    if (!dots) return;

    // Dots and power pellets
    var pulse = 0.6 + 0.4 * Math.sin(t * 6);
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var v = dots[y][x];
      if (!v) continue;
      var cx = (x + .5) * CELL, cy = (y + .5) * CELL;
      if (v === 1) {
        ctx.fillStyle = 'rgba(238,241,248,.75)';
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.2, CELL * 0.1), 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#f9a8d4';
        ctx.globalAlpha = state === 'playing' ? pulse : 1;
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (fruit) drawFruit((fruit.x + .5) * CELL, (fruit.y + .5) * CELL);

    if (pac) {
      if (state === 'dying') drawPacDeath(Math.min(1, stateTime / 1.4));
      else drawPac();
    }
    if (ghosts && state !== 'dying' && state !== 'cleared' && state !== 'over') {
      ghosts.forEach(function(g){ drawGhost(g, t); });
    }

    popups.forEach(function(p){
      ctx.globalAlpha = 1 - p.t;
      ctx.fillStyle = p.color;
      ctx.font = '600 ' + Math.round(CELL * 0.75) + 'px "JetBrains Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.text, (p.x + .5) * CELL, (p.y + .5 - p.t * 0.8) * CELL);
      ctx.globalAlpha = 1;
    });

    if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
      ctx.fillStyle = PAC_COLOR;
      ctx.font = '800 ' + Math.round(CELL * 0.95) + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('READY!', 14 * CELL, 17.5 * CELL);
    }
  }

  function faceAngle(f){ return Math.atan2(f.y, f.x); }
  function drawPac(){
    var cx = (pac.x + .5) * CELL, cy = (pac.y + .5) * CELL, r = CELL * 0.72;
    var open = state === 'playing' && pac.moving ? 0.04 + 0.26 * Math.abs(Math.sin(pac.chomp * Math.PI * 1.2)) : 0.18;
    var a = faceAngle(pac.face);
    ctx.fillStyle = PAC_COLOR;
    ctx.shadowColor = 'rgba(250,204,21,.45)'; ctx.shadowBlur = CELL * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a + open * Math.PI, a + (2 - open) * Math.PI);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  }
  function drawPacDeath(p){
    var cx = (pac.x + .5) * CELL, cy = (pac.y + .5) * CELL, r = CELL * 0.72;
    if (p >= 1) return;
    var open = 0.05 + p * 0.95;
    ctx.fillStyle = PAC_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2 + open * Math.PI, -Math.PI / 2 + (2 - open) * Math.PI);
    ctx.closePath(); ctx.fill();
  }
  function drawGhost(g, t){
    var cx = (g.x + .5) * CELL, cy = (g.y + .5) * CELL, r = CELL * 0.72;
    if (g.state !== 'eaten' && g.state !== 'entering') {
      var color = g.def.color;
      if (g.fright) {
        var blink = frightTime < 2 && Math.floor(frightTime * 5) % 2 === 0;
        color = blink ? '#eef1f8' : FRIGHT_COLOR;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      var bottom = cy + r * 0.92;
      ctx.moveTo(cx - r, bottom);
      ctx.lineTo(cx - r, cy);
      ctx.arc(cx, cy, r, Math.PI, 0);
      ctx.lineTo(cx + r, bottom);
      var phase = Math.floor(t * 8) % 2;
      for (var i = 1; i <= 6; i++) {
        var px = cx + r - (2 * r) * i / 6;
        var py = (i + phase) % 2 === 0 ? bottom : bottom - r * 0.28;
        ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      if (g.fright) {
        ctx.fillStyle = color === FRIGHT_COLOR ? '#fde68a' : '#be123c';
        ctx.fillRect(cx - r * 0.42, cy - r * 0.25, r * 0.22, r * 0.22);
        ctx.fillRect(cx + r * 0.2, cy - r * 0.25, r * 0.22, r * 0.22);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, r * 0.1);
        ctx.beginPath();
        for (var k = 0; k <= 6; k++) {
          var mx = cx - r * 0.55 + (r * 1.1) * k / 6, my = cy + r * (k % 2 ? 0.28 : 0.44);
          if (k === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
        }
        ctx.stroke();
        return;
      }
    }
    // Eyes look where the ghost is heading
    var d = g.dir || LEFT;
    [-1, 1].forEach(function(side){
      var ex = cx + side * r * 0.36, ey = cy - r * 0.12;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.26, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath(); ctx.arc(ex + d.x * r * 0.12, ey + d.y * r * 0.14, r * 0.14, 0, Math.PI * 2); ctx.fill();
    });
  }
  function drawFruit(cx, cy){
    var r = CELL * 0.28;
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = Math.max(1, CELL * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.9, cy + r * 0.2); ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 1.6, cx + r * 0.6, cy - r * 1.8);
    ctx.moveTo(cx + r * 0.9, cy + r * 0.4); ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 0.8, cx + r * 0.6, cy - r * 1.8);
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath(); ctx.arc(cx - r * 0.9, cy + r * 0.7, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.9, cy + r * 0.9, r, 0, Math.PI * 2); ctx.fill();
  }
  function drawLives(){
    var w = 60, h = 16;
    livesCtx.clearRect(0, 0, w, h);
    var spare = Math.max(0, lives - (state === 'idle' || state === 'over' ? 0 : 1));
    livesCtx.fillStyle = PAC_COLOR;
    for (var i = 0; i < Math.min(spare, 4); i++) {
      var cx = 8 + i * 15, cy = h / 2;
      livesCtx.beginPath(); livesCtx.moveTo(cx, cy);
      livesCtx.arc(cx, cy, 6, Math.PI * 1.2, Math.PI * 2.8);
      livesCtx.closePath(); livesCtx.fill();
    }
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
  function steer(name){ if (DIR_BY_NAME[name]) wanted = DIR_BY_NAME[name]; }
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
    if (d) { steer(d); e.preventDefault(); }
  });
  window.addEventListener('blur', function(){ if (state !== 'paused' && state !== 'idle' && state !== 'over') togglePause(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && state !== 'paused' && state !== 'idle' && state !== 'over') togglePause();
  });

  document.querySelectorAll('.touch button').forEach(function(b){
    var d = b.getAttribute('data-dir');
    b.addEventListener('pointerdown', function(e){ e.preventDefault(); steer(d); b.classList.add('on'); });
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){
      b.addEventListener(ev, function(){ b.classList.remove('on'); });
    });
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  });

  // Swipe anywhere on the game area to steer.
  var swipe = null;
  gameEl.addEventListener('pointerdown', function(e){
    if (e.pointerType === 'mouse') return;
    swipe = { x: e.clientX, y: e.clientY };
  });
  gameEl.addEventListener('pointermove', function(e){
    if (!swipe) return;
    var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    swipe = { x: e.clientX, y: e.clientY };
  });
  ['pointerup','pointercancel'].forEach(function(ev){ gameEl.addEventListener(ev, function(){ swipe = null; }); });
  gameEl.style.touchAction = 'none';

  startBtn.addEventListener('click', startOrResume);
  pauseBtn.addEventListener('click', togglePause);

  window.addEventListener('resize', resize);
  if (compactMQ.addEventListener) {
    compactMQ.addEventListener('change', resize);
    landscapeMQ.addEventListener('change', resize);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  resetDots();
  resetActors();
  updateHud();
  resize();
  requestAnimationFrame(loop);
})();
