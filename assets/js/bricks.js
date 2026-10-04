(function(){
  // The rules live in bricks-core.js; this file draws them and handles input.
  var F = window.bdnixBricks;
  var W = F.W, H = F.H;
  var PADDLE_SPEED = 420;       // units a second while a move key or button is held
  var DEATH_TIME = 0.8;         // how long the last ball falls before the score shows
  var FADE = 0.25;              // how long a broken brick takes to fade away
  var SPARKS = 0.9;             // how long the sparks of a ball falling off the bottom last
  var SHAKE = 0.45;             // how long the board shakes when a ball is lost
  var MISS = 1.2;               // how long "Missed!" shows after a ball is lost
  var HURT = 0.7;               // how long the paddle blinks red after a miss
  var RING = 0.6;               // how long the shockwave of a miss spreads
  var CLEAR = 1.8;              // how long the celebration of a cleared wall lasts
  var BUILD = 0.35;             // how long each row of a new wall takes to drop in
  var CONFETTI = 36;            // pieces of confetti from each bottom corner

  // Bricks, top row pair to bottom, in the site's colours.
  var COLORS = ['#f472b6', '#f472b6', '#a855f7', '#a855f7', '#22d3ee', '#22d3ee', '#facc15', '#facc15'];
  // Each power's colour. Its icon (see icon()) is drawn on its brick, its
  // capsule and, while it lasts, under the paddle.
  var POWERS = {
    multi: { color: '#22d3ee' },
    fire: { color: '#fb923c' },
    laser: { color: '#f43f5e' },
    wide: { color: '#4ade80' },
    life: { color: '#facc15' }
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

  var SCALE = 1;                // CSS pixels per world unit
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var world = F.create(), clock = 0;
  var fading = [];              // bricks just broken: { i, t }
  var bursts = [];              // balls that fell off the bottom: { x, t, lost }
  var shaken = -1;              // when the board last shook (clock time)
  var missed = null;            // the last ball lost: { t, x, left } (when, where it fell, balls left)
  var cleared = null;           // the last wall cleared: { t, level } (when, which wall)
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
    // A ball lost: a sinking wah-wah over a thud. An extra ball draining away
    // is just a pop.
    lose: [tone(0, 0, 0.3, 'noise', 0.3), tone(150, 50, 0.35, 'triangle', 0.4)].concat(
      [[440, 415], [370, 349], [311, 294], [262, 196]].map(function(n, i){ return tone(n[0], n[1], i === 3 ? 0.5 : 0.16, 'square', 0.13, 0.12 + i * 0.17); })),
    drain: [tone(520, 180, 0.18, 'triangle', 0.35)]
  });

  try { best = parseInt(localStorage.getItem('bdnix_bricks_best'), 10) || 0; } catch (e) {}

  // ---------- Game flow ----------
  function setState(s){ state = s; stateTime = 0; }
  function newGame(){
    world = F.create();
    fading = [];
    bursts = [];
    missed = cleared = null;
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
    bursts = bursts.filter(function(b){ return clock - b.t < SPARKS; });
    if (state === 'dying' && stateTime > DEATH_TIME) gameOver();
    if (state !== 'ready' && state !== 'playing') return;
    var dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (dir) F.movePaddle(world, world.paddle + dir * PADDLE_SPEED * dt);
    if (state !== 'playing') return;
    var ev = F.advance(world, dt);
    ev.bricks.forEach(function(i){ fading.push({ i: i, t: clock }); });
    ev.gone.forEach(function(x){ bursts.push({ x: x, t: clock, lost: ev.lost }); });
    if (ev.lost) ballLost(ev.gone[ev.gone.length - 1]);
    else if (ev.gone.length) sound.play('drain');
    if (ev.powers.length) sound.play('powerup');
    else if (ev.bricks.length) sound.play('brick');
    else if (ev.shot) sound.play('shot');
    else if (ev.paddle) sound.play('paddle');
    else if (ev.wall) sound.play('wall');
    if (ev.bricks.length || ev.powers.length || ev.lost || ev.cleared) updateHud();
    if (ev.end) return crash();
    if (ev.cleared) { fading = []; wallCleared(); setState('ready'); sound.play('level'); persist(); }
    else if (ev.lost) { setState('ready'); persist(); }
  }

  // Missing the last ball in play: the board shakes, the bottom flashes red,
  // a shockwave spreads from where the ball fell and it bursts into sparks,
  // the paddle blinks red, "Missed!" pops up with the balls left, and the
  // ball count flashes.
  function ballLost(x){
    shaken = clock;
    missed = { t: clock, x: x, left: world.lives };
    sound.play('lose');
    flash(el.lives, 'hit');
  }
  // Clearing a wall: confetti bursts from the bottom corners, the board
  // flashes, "Wall cleared!" pops up, the next wall drops in row by row,
  // and the wall count flashes.
  function wallCleared(){
    cleared = { t: clock, level: world.level - 1 };
    flash(el.level, 'up');
  }
  // Starts the CSS flash `name` on a stat, over again if it's already running.
  function flash(b, name){
    var stat = b.parentNode;
    stat.classList.remove(name);
    void stat.offsetWidth;
    stat.classList.add(name);
  }

  // The game ends the moment the last ball is lost: the best score and the
  // save are settled straight away, and the score shows once the ball has
  // fallen away.
  function crash(){
    setState('dying');
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
      window.bdnixGamebar.setPaused(false);
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
      window.bdnixGamebar.setPaused(true);
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
    // The bricks are what's left of this wall's shape, and the score counts
    // at least the bricks broken from it, exactly them on the first wall.
    var shape = F.wall(s.level), points = 0;
    if (k.some(function(v, i){ return v && !shape[i]; })) return false;
    shape.forEach(function(v, i){ if (v && !k[i]) points += F.POINTS[Math.floor(i / F.COLS)]; });
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
    bursts = [];
    missed = cleared = null;
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
    // A lost ball shakes the board, less and less.
    var k = (clock - shaken) / SHAKE;
    if (shaken >= 0 && k < 1) ctx.translate(Math.sin(k * 40) * 6 * (1 - k), Math.cos(k * 33) * 3 * (1 - k));
    if (state === 'dying' || state === 'over') ctx.globalAlpha = 1 - 0.55 * Math.min(1, state === 'over' ? 1 : stateTime / DEATH_TIME);
    drawBricks();
    drawShots();
    drawDrops();
    drawPaddle();
    if (state !== 'over') world.balls.forEach(drawBall);
    drawRing();
    drawBursts();
    drawTimers();
    ctx.restore();
    drawCelebration();

    if (state === 'over') return;       // the overlay says it now
    if (since(missed) < MISS) drawMissed();
    else if (since(cleared) < CLEAR) drawCleared();
    else if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
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

  // Seconds since `e` (a miss or a cleared wall) happened; forever if it hasn't.
  function since(e){ return e ? clock - e.t : Infinity; }
  // Eases 0 to 1 in, overshooting a little before it settles.
  function popIn(k){ k = Math.min(1, k) - 1; return Math.max(0, 1 + k * k * (2.7 * k + 1.7)); }

  // Each brick with a lighter top edge; broken ones fade and swell away. A
  // new wall drops in from above, row by row from the top.
  function drawBricks(){
    var t = cleared && cleared.level === world.level - 1 ? since(cleared) - 0.3 : Infinity;
    for (var i = 0; i < world.bricks.length; i++) {
      if (!world.bricks[i]) continue;
      var k = (t - Math.floor(i / F.COLS) * 0.06) / BUILD;
      if (k <= 0) continue;
      if (k >= 1) drawBrick(i, 1, 0, 0);
      else drawBrick(i, Math.min(1, k * 2), 0, -(1 - popIn(k)) * (F.brickRect(i).y + 20));
    }
    fading.forEach(function(f){
      var k = Math.min(1, (clock - f.t) / FADE);
      drawBrick(f.i, 1 - k, k * 3, 0);
    });
  }
  function drawBrick(i, alpha, grow, drop){
    var r = F.brickRect(i), row = Math.floor(i / F.COLS);
    var p = world.bricks[i] && POWERS[world.loot[i]];
    ctx.save();
    ctx.translate(0, drop);
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = COLORS[row];
    roundRect(r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2, 3);
    if (p) {
      // A power brick glows in its power's colour, pulsing.
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5 + 4 * pulse(3, i);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(r.x + 3, r.y + 2, r.w - 6, 2);
    if (p) powerBrick(i, r, p);
    ctx.restore();
  }
  // A power brick: a rim in the power's colour, a shine sweeping across it
  // now and then, and its icon on a dark plate in the middle.
  function powerBrick(i, r, p){
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.color;
    roundRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, 3);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    var sweep = ((clock * 0.6 + i * 0.137) % 1.6) - 0.3;   // across, then a rest
    var sx = r.x + sweep * r.w;
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath();
    ctx.moveTo(sx, r.y); ctx.lineTo(sx + 5, r.y); ctx.lineTo(sx - 1, r.y + r.h); ctx.lineTo(sx - 6, r.y + r.h);
    ctx.fill();
    ctx.restore();
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.fillStyle = 'rgba(8,10,18,.8)';
    roundRect(cx - 8, cy - 5, 16, 10, 3);
    ctx.fill();
    ctx.fillStyle = ctx.strokeStyle = p.color;
    icon(world.loot[i], cx, cy, 8);
  }
  // 0 to 1 and back, `per` times a second; `seed` sets things apart.
  function pulse(per, seed){ return 0.5 + 0.5 * Math.sin(clock * per + (seed || 0)); }

  // A power's icon, `s` across, centred on (x, y), in the current fill and
  // stroke colours: three balls, a flame, a lightning bolt, a double arrow
  // or a heart.
  function icon(kind, x, y, s){
    var h = s / 2;
    ctx.beginPath();
    if (kind === 'multi') {
      [[-0.55, 0.35], [0.55, 0.35], [0, -0.45]].forEach(function(c){
        ctx.moveTo(x + c[0] * h + s * 0.2, y + c[1] * h);
        ctx.arc(x + c[0] * h, y + c[1] * h, s * 0.2, 0, Math.PI * 2);
      });
      ctx.fill();
    } else if (kind === 'fire') {
      ctx.moveTo(x, y - h);
      ctx.bezierCurveTo(x + h * 0.4, y - h * 0.3, x + h * 1.1, y + h * 0.1, x + h * 0.7, y + h * 0.7);
      ctx.quadraticCurveTo(x, y + h * 1.2, x - h * 0.7, y + h * 0.7);
      ctx.bezierCurveTo(x - h, y + h * 0.2, x - h * 0.4, y, x - h * 0.2, y - h * 0.4);
      ctx.quadraticCurveTo(x - h * 0.1, y - h * 0.1, x, y - h);
      ctx.fill();
    } else if (kind === 'laser') {
      ctx.moveTo(x + h * 0.3, y - h);
      ctx.lineTo(x - h * 0.6, y + h * 0.15);
      ctx.lineTo(x - h * 0.05, y + h * 0.15);
      ctx.lineTo(x - h * 0.3, y + h);
      ctx.lineTo(x + h * 0.6, y - h * 0.15);
      ctx.lineTo(x + h * 0.05, y - h * 0.15);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'wide') {
      ctx.lineWidth = s * 0.16;
      ctx.moveTo(x - h * 0.7, y); ctx.lineTo(x + h * 0.7, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - h * 1.1, y); ctx.lineTo(x - h * 0.45, y - h * 0.55); ctx.lineTo(x - h * 0.45, y + h * 0.55); ctx.closePath();
      ctx.moveTo(x + h * 1.1, y); ctx.lineTo(x + h * 0.45, y - h * 0.55); ctx.lineTo(x + h * 0.45, y + h * 0.55); ctx.closePath();
      ctx.fill();
    } else {
      // An extra ball: a heart.
      ctx.moveTo(x, y + h * 0.9);
      ctx.bezierCurveTo(x - h * 1.3, y, x - h * 0.7, y - h * 1.1, x, y - h * 0.4);
      ctx.bezierCurveTo(x + h * 0.7, y - h * 1.1, x + h * 1.3, y, x, y + h * 0.9);
      ctx.fill();
    }
  }

  // Falling capsules: a glowing pill in the power's colour, bobbing a
  // little, with its icon in dark.
  function drawDrops(){
    world.drops.forEach(function(d, n){
      var p = POWERS[d.kind], grow = 1 + 0.08 * pulse(8, n);
      var w = F.DROP_W * grow, h = F.DROP_H * grow;
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      var g = ctx.createLinearGradient(0, d.y - h / 2, 0, d.y + h / 2);
      g.addColorStop(0, '#fff'); g.addColorStop(0.45, p.color); g.addColorStop(1, p.color);
      ctx.fillStyle = g;
      roundRect(d.x - w / 2, d.y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = ctx.strokeStyle = '#080a12';
      icon(d.kind, d.x, d.y + 0.5, 8);
    });
  }

  function drawShots(){
    ctx.fillStyle = POWERS.laser.color;
    world.shots.forEach(function(s){ ctx.fillRect(s.x - 1.5, s.y, 3, F.SHOT_H); });
  }

  // How long each power has left, under the paddle: its icon and the seconds.
  function drawTimers(){
    var on = ['fire', 'laser', 'wide'].filter(function(k){ return world[k] > 0; });
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    on.forEach(function(k, i){
      var x = W / 2 + (i - (on.length - 1) / 2) * 56;
      ctx.fillStyle = ctx.strokeStyle = POWERS[k].color;
      icon(k, x - 8, 466, 10);
      ctx.fillText(String(Math.ceil(world[k])), x + 1, 466.5);
    });
  }

  // A ball that fell off the bottom: sparks flying up from where it went,
  // and when that lost the ball, a red flash rising from the bottom.
  function drawBursts(){
    bursts.forEach(function(b){
      var t = clock - b.t, k = t / SPARKS;
      ctx.save();
      if (b.lost) {
        var g = ctx.createLinearGradient(0, H, 0, H - 140);
        g.addColorStop(0, 'rgba(244,63,94,' + (0.55 * (1 - k)) + ')');
        g.addColorStop(1, 'rgba(244,63,94,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, H - 140, W, 140);
      }
      ctx.globalAlpha *= 1 - k;
      ctx.fillStyle = b.lost ? '#f472b6' : '#eef1f8';
      var n = b.lost ? 16 : 8, speed = b.lost ? 220 : 140;
      for (var i = 0; i < n; i++) {
        var a = Math.PI * (0.1 + 0.8 * i / (n - 1));          // fanned out upwards
        var v = speed * (0.6 + 0.4 * ((i * 7) % n) / n);
        var px = b.x + Math.cos(a) * v * t, py = H - Math.sin(a) * v * t + 260 * t * t;
        ctx.beginPath(); ctx.arc(px, py, b.lost ? 2.4 : 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  // A shockwave spreading from where a lost ball fell.
  function drawRing(){
    var t = since(missed);
    if (t >= RING) return;
    var k = t / RING;
    ctx.save();
    ctx.strokeStyle = 'rgba(244,63,94,' + (0.9 * (1 - k)) + ')';
    [1, 0.6].forEach(function(f){
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(missed.x, H, 150 * popIn(k) * f, Math.PI, Math.PI * 2); ctx.stroke();
    });
    ctx.restore();
  }

  // Big words in the middle of the board, popping in and fading out over
  // `long` seconds, `t` seconds in.
  function banner(title, sub, color, t, long, tilt){
    var s = popIn(t / 0.35), a = Math.min(1, (long - t) / 0.3);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(W / 2, 290);
    ctx.rotate(tilt);
    ctx.scale(s, s);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 34px Inter, system-ui, sans-serif';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(8,10,18,.85)';
    ctx.strokeText(title, 0, 0);
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(title, 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.lineWidth = 5;
    ctx.strokeText(sub, 0, 34);
    ctx.fillStyle = '#eef1f8';
    ctx.fillText(sub, 0, 34);
    ctx.restore();
  }
  // "Missed!", wobbling, with the balls left.
  function drawMissed(){
    var t = since(missed), left = missed.left;
    var tilt = Math.sin(t * 30) * 0.12 * Math.max(0, 1 - t / 0.5);
    banner(left ? 'Missed!' : 'Out of balls', left === 1 ? 'Last ball!' : left ? left + ' balls left' : 'Game over', '#f43f5e', t, MISS, tilt);
  }
  function drawCleared(){
    banner('Wall ' + cleared.level + ' cleared!', 'Here comes wall ' + (cleared.level + 1), '#facc15', since(cleared), CLEAR, 0);
  }

  // A cleared wall: a bright flash, then confetti in the bricks' colours
  // shooting up from both bottom corners, fluttering and falling away.
  function drawCelebration(){
    var t = since(cleared);
    if (t >= CLEAR) return;
    ctx.save();
    if (t < 0.25) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.45 * (1 - t / 0.25)) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = Math.min(1, 3 * (1 - t / CLEAR));
    for (var i = 0; i < CONFETTI * 2; i++) {
      var side = i % 2 ? -1 : 1, n = i >> 1;
      var a = (0.12 + 0.6 * ((n * 7) % CONFETTI) / CONFETTI) * side;  // off upright, towards the middle
      var v = 380 + 240 * ((n * 13) % CONFETTI) / CONFETTI;
      var x = (side > 0 ? 0 : W) + Math.sin(a) * v * t + Math.sin(t * 6 + n) * 10;
      var y = H - Math.cos(Math.abs(a)) * v * t + 210 * t * t;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (4 + n % 5) * side + n);
      ctx.fillStyle = n % 9 === 0 ? '#ffffff' : COLORS[n % COLORS.length];
      ctx.fillRect(-3, -1.5 - Math.abs(Math.sin(t * 9 + n)) * 1.5, 6, 3 + Math.abs(Math.sin(t * 9 + n)) * 3);
      ctx.restore();
    }
    ctx.restore();
  }

  // The paddle blinks red just after a miss.
  function drawPaddle(){
    var pw = F.paddleWidth(world), t = since(missed);
    var g = ctx.createLinearGradient(world.paddle - pw / 2, 0, world.paddle + pw / 2, 0);
    g.addColorStop(0, '#22d3ee'); g.addColorStop(1, '#a855f7');
    ctx.fillStyle = t < HURT && Math.floor(t * 10) % 2 === 0 ? '#f43f5e' : g;
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
    if (state === 'ready' || state === 'playing' || state === 'dying' || fading.length || bursts.length || stale) render();
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
  window.bdnixUpright.onTurn(function(){ if (state === 'ready' || state === 'playing') togglePause(); });
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
