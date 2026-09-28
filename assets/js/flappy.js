(function(){
  // The rules live in flappy-core.js; this file draws them and handles input.
  var F = window.bdnixFlappy;
  var W = F.W, H = F.H, GROUND = F.GROUND;

  var BIRD_COLOR = '#facc15';
  var WING_COLOR = '#f59e0b';
  var BEAK_COLOR = '#fb923c';

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
  var MEDALS = { bronze: 'Bronze medal', silver: 'Silver medal', gold: 'Gold medal', platinum: 'Platinum medal' };

  var SCALE = 1;                // CSS pixels per world unit
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var world = F.create(), carry = 0, wingTime = 0, hitFlash = 0, groundTime = 0;
  var best = 0;
  var sound = window.bdnixSound;

  try { best = parseInt(localStorage.getItem('bdnix_flappy_best'), 10) || 0; } catch (e) {}

  // ---------- Game flow ----------
  function setState(s){ state = s; stateTime = 0; }
  function newGame(){
    world = F.create();
    carry = 0; hitFlash = 0;
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
  function flap(){
    if (state === 'ready') setState('playing');
    if (state !== 'playing') return;
    F.flap(world);
    wingTime = 0;
    sound.play('flap');
  }

  function update(dt){
    if (state === 'paused') return;
    stateTime += dt;
    wingTime += dt;
    hitFlash = Math.max(0, hitFlash - dt);
    if (state === 'over') return;
    if (state === 'idle' || state === 'ready') {
      // Hover in place while the ground keeps scrolling.
      world.bird.y = 220 + Math.sin(stateTime * 5) * 6;
      world.distance += F.SPEED * dt;
      return;
    }
    if (state === 'dying') {
      // Falls to the ground, then lies there a moment before the score shows.
      if (!world.landed) carry = F.advance(world, dt, carry).carry;
      else if ((groundTime += dt) > 0.6) gameOver();
      return;
    }

    var r = F.advance(world, dt, carry);
    carry = r.carry;
    for (var i = 0; i < r.events.length; i++) {
      if (r.events[i] === 'score') { updateHud(); sound.play('point'); }
      if (r.events[i] === 'hit') { hitFlash = 0.18; groundTime = 0; setState('dying'); sound.play('hit'); }
    }
  }

  function gameOver(){
    setState('over');
    var score = world.score;
    if (score > best) {
      best = score;
      try { localStorage.setItem('bdnix_flappy_best', best); } catch (e) {}
    }
    updateHud();
    sound.play(score >= best && score > 0 ? 'best' : 'over');
    var medal = F.medal(score);
    ovKicker.textContent = medal ? MEDALS[medal] : 'bdnix arcade';
    ovTitle.textContent = 'Game over';
    ovText.textContent = 'Score ' + score + (score >= best && score > 0 ? ' — new best!' : ' · Best ' + best);
    startBtn.textContent = 'Play again';
    newBtn.hidden = true;
    overlay.hidden = false;
    startBtn.focus();
    persist();
  }
  function togglePause(){
    if (state === 'paused') {
      state = pausedFrom; pausedFrom = null;
      overlay.hidden = true;
      pauseBtn.innerHTML = ICON_PAUSE; pauseBtn.setAttribute('aria-label', 'Pause');
      last = performance.now();
    } else if (state === 'ready' || state === 'playing' || state === 'dying') {
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
  // paused. Before the first flap there's nothing worth keeping.
  function snapshot(){
    var s = state === 'paused' ? pausedFrom : state;
    if (s !== 'playing' && s !== 'dying') return null;
    return {
      state: s, stateTime: stateTime, carry: carry, groundTime: groundTime, wingTime: wingTime,
      bird: world.bird, pipes: world.pipes, nextPipe: world.nextPipe, score: world.score,
      dead: world.dead, landed: world.landed, distance: world.distance
    };
  }
  var persist = window.bdnixSave.keep('flappy', snapshot);

  function restore(s){
    var num = window.bdnixSave.num, b = s.bird;
    var ok = (s.state === 'playing' || s.state === 'dying') &&
      !!b && num(b.y) && num(b.vy) &&
      Array.isArray(s.pipes) && s.pipes.every(function(p){ return p && num(p.x) && num(p.top); }) &&
      [s.stateTime, s.carry, s.groundTime, s.wingTime, s.nextPipe, s.score, s.distance].every(num);
    if (!ok) return false;
    world = F.create();
    world.bird = { y: b.y, vy: b.vy };
    world.pipes = s.pipes.map(function(p){ return { x: p.x, top: p.top, scored: !!p.scored }; });
    world.nextPipe = s.nextPipe; world.score = s.score; world.distance = s.distance;
    world.dead = !!s.dead; world.landed = !!s.landed;
    carry = s.carry; groundTime = s.groundTime; wingTime = s.wingTime;
    state = s.state; stateTime = s.stateTime;
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
  function render(){
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W * SCALE, H * SCALE);
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);

    drawSkyline();
    world.pipes.forEach(drawPipe);
    drawGround();
    drawBird();

    if (state !== 'idle' && state !== 'over' && !(state === 'paused' && pausedFrom === 'ready')) drawScore();
    if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
      ctx.fillStyle = '#eef1f8';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 30px Inter, system-ui, sans-serif';
      ctx.fillText('Get ready', W / 2, 130);
      ctx.fillStyle = '#8e97ab';
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.fillText(compactMQ.matches ? 'Tap to flap' : 'Space, ↑ or click to flap', W / 2, 300);
    }
    if (hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (hitFlash / 0.18 * 0.6).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Faint towers in the distance, scrolling slower than the pipes.
  var TOWERS = [34, 58, 26, 72, 44, 30, 64, 40, 52, 28, 60, 36];
  function drawSkyline(){
    var shift = (world.distance * 0.25) % (TOWERS.length * 24);
    ctx.fillStyle = 'rgba(168,85,247,.10)';
    for (var i = 0; i < TOWERS.length * 2; i++) {
      var x = i * 24 - shift, h = TOWERS[i % TOWERS.length];
      if (x > W || x < -24) continue;
      ctx.fillRect(x, GROUND - h, 20, h);
    }
  }
  function drawPipe(p){
    var lip = 4, capH = 22, bottom = p.top + F.GAP;
    var g = ctx.createLinearGradient(p.x, 0, p.x + F.PIPE_W, 0);
    g.addColorStop(0, '#0e7490');
    g.addColorStop(0.45, '#22d3ee');
    g.addColorStop(1, '#155e75');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, 0, F.PIPE_W, p.top - capH);
    ctx.fillRect(p.x, bottom + capH, F.PIPE_W, GROUND - bottom - capH);
    // Caps, a little wider than the pipe
    ctx.fillRect(p.x - lip, p.top - capH, F.PIPE_W + lip * 2, capH);
    ctx.fillRect(p.x - lip, bottom, F.PIPE_W + lip * 2, capH);
    ctx.strokeStyle = 'rgba(8,10,18,.55)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - lip, p.top - capH, F.PIPE_W + lip * 2, capH);
    ctx.strokeRect(p.x - lip, bottom, F.PIPE_W + lip * 2, capH);
  }
  function drawGround(){
    ctx.fillStyle = '#141934';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, GROUND + 3, W, 14); ctx.clip();
    ctx.fillStyle = 'rgba(168,85,247,.35)';
    var shift = world.distance % 16;
    for (var x = -16 - shift; x < W + 16; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND + 17); ctx.lineTo(x + 8, GROUND + 3); ctx.lineTo(x + 16, GROUND + 3); ctx.lineTo(x + 8, GROUND + 17);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(0, GROUND, W, 3);
  }
  function drawBird(){
    var b = world.bird, r = F.BIRD_R;
    var flying = state !== 'dying' && state !== 'over' && !(state === 'paused' && pausedFrom === 'dying');
    var angle = state === 'ready' || state === 'idle' || (state === 'paused' && pausedFrom === 'ready') ? 0 :
      Math.max(-0.45, Math.min(1.35, b.vy / 450));
    ctx.save();
    ctx.translate(F.BIRD_X, b.y);
    ctx.rotate(angle);
    ctx.fillStyle = BIRD_COLOR;
    ctx.shadowColor = 'rgba(250,204,21,.45)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Wing flaps quickly just after a flap, then glides
    var wing = flying ? Math.sin(wingTime * (wingTime < 0.3 ? 40 : 12)) : 0;
    ctx.fillStyle = WING_COLOR;
    ctx.beginPath(); ctx.ellipse(-4, 2 + wing * 2, 7, 4 - Math.abs(wing) * 1.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(5, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#080a12';
    ctx.beginPath(); ctx.arc(6.5, -4, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BEAK_COLOR;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(17, 3); ctx.lineTo(9, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawScore(){
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 40px Inter, system-ui, sans-serif';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,10,18,.8)';
    ctx.strokeText(world.score, W / 2, 56);
    ctx.fillStyle = '#eef1f8';
    ctx.fillText(world.score, W / 2, 56);
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
  function startOrResume(){
    if (state === 'paused') togglePause();
    else if (state === 'idle' || state === 'over') newGame();
  }

  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && (state === 'idle' || state === 'over' || state === 'paused')) {
      startOrResume(); e.preventDefault(); return;
    }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (!e.repeat) flap();
      e.preventDefault();
    }
  });
  window.addEventListener('blur', function(){ if (state === 'ready' || state === 'playing' || state === 'dying') togglePause(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && (state === 'ready' || state === 'playing' || state === 'dying')) togglePause();
  });

  // Click or tap anywhere on the game area to flap.
  gameEl.addEventListener('pointerdown', function(e){
    if (state !== 'ready' && state !== 'playing') return;
    if (e.button > 0) return;
    e.preventDefault();
    flap();
  });
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

  var saved = window.bdnixSave.load('flappy');
  if (saved && !restore(saved)) window.bdnixSave.clear('flappy');
  updateHud();
  resize();
  requestAnimationFrame(loop);
})();
