(function(){
  // The visitor's language (lang.js): words drawn on the board, and numbers.
  var Lang = window.bdnixLang;
  // The rules live in street-core.js; this file draws them and handles input.
  var F = window.bdnixStreet;
  var ROAD = F.ROAD, SEG = F.SEG;
  var H = 600;                  // the board's height in world units; its width follows the screen's shape
  var MIN_W = 340, MAX_W = 900;
  var CAM_BACK = 6;             // metres the camera rides behind the player
  var DRAW = 170;               // segments of road drawn ahead
  var CURVE = 0.04;             // how far a bend carries the road sideways on screen
  var READY_TIME = 3;           // the countdown
  var GO_TIME = 0.9;            // how long "Go!" shows
  var FINISH_TIME = 4;          // how long the result of a race shows before the next
  var DEATH_TIME = 2.2;         // how long the fall plays before the score shows

  // A few ways to say you were knocked out; one is picked at random.
  var ENDINGS = ['Knocked out cold.', 'Lights out on the tarmac.', 'That one hurt.'];
  var PLACES = ['1st place', '2nd place', '3rd place', '4th place', '5th place', '6th place', '7th place'];
  var WEAPON_NAMES = { stick: 'Stick', chain: 'Chain', nunchaku: 'Nunchaku' };
  // Each rival's colours: jacket, helmet and bike.
  var LOOKS = [
    { jacket: '#22d3ee', helmet: '#0e7490', bike: '#1e293b' },
    { jacket: '#f472b6', helmet: '#111827', bike: '#7c2d5b' },
    { jacket: '#facc15', helmet: '#b45309', bike: '#374151' },
    { jacket: '#4ade80', helmet: '#166534', bike: '#1f2937' },
    { jacket: '#fb923c', helmet: '#7c2d12', bike: '#3f1d0b' },
    { jacket: '#c084fc', helmet: '#eef1f8', bike: '#3b0764' }
  ];
  var ME = { jacket: '#e11d48', helmet: '#eef1f8', bike: '#0f172a', stripe: '#22d3ee' };

  var board = document.getElementById('board');
  var ctx = board.getContext('2d');
  var gameEl = document.getElementById('game');
  var overlay = document.getElementById('overlay');
  var ovKicker = document.getElementById('ovKicker');
  var ovTitle = document.getElementById('ovTitle');
  var ovText = document.getElementById('ovText');
  var startBtn = document.getElementById('startBtn');
  var newBtn = document.getElementById('newBtn');
  var el = {
    score: document.getElementById('score'),
    best: document.getElementById('best')
  };
  var compactMQ = window.matchMedia('(max-width:700px),(pointer:coarse)');
  var landscapeMQ = window.matchMedia('(orientation:landscape) and (max-height:520px)');

  var W = 400, SCALE = 1;       // the board's width in world units; CSS pixels per world unit
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var world = F.create(1), carry = 0, clock = 0;
  var fx = [];                  // hits, falls and words drawn over the race, each for a moment
  var shake = 0, hurtFlash = 0, sky = 0;
  var best = 0;
  var sound = window.bdnixSound;
  // This game's sounds, beside the ones every game shares (sound.js).
  var tone = sound.tone, notes = sound.notes;
  sound.add({
    beep: [tone(440, 440, 0.14, 'square', 0.2)],
    go: [tone(880, 880, 0.35, 'square', 0.22)],
    swing: [tone(0, 0, 0.12, 'noise', 0.14), tone(900, 300, 0.12, 'sine', 0.25)],
    punch: [tone(0, 0, 0.08, 'noise', 0.4), tone(160, 70, 0.12, 'triangle', 0.55)],
    kick: [tone(0, 0, 0.12, 'noise', 0.38), tone(120, 45, 0.18, 'triangle', 0.58)],
    whack: [tone(0, 0, 0.1, 'noise', 0.4), tone(600, 140, 0.14, 'square', 0.22)],
    hurt: [tone(220, 110, 0.18, 'sawtooth', 0.32), tone(0, 0, 0.08, 'noise', 0.3)],
    bump: [tone(110, 80, 0.08, 'triangle', 0.4)],
    ko: [tone(0, 0, 0.3, 'noise', 0.35), tone(523, 523, 0.08, 'square', 0.16, 0.12), tone(784, 784, 0.16, 'square', 0.16, 0.2)],
    crash: [tone(0, 0, 0.5, 'noise', 0.5), tone(140, 40, 0.5, 'triangle', 0.5)],
    finish: notes([523, 659, 784, 1047, 784, 1047], 0.1, 0.18, 'square', 0.17)
  });

  try { best = parseInt(localStorage.getItem('bdnix_kingofstreets_best'), 10) || 0; } catch (e) {}

  // ---------- Game flow ----------
  function setState(s){ state = s; stateTime = 0; }
  function newGame(){
    world = F.create(1);
    carry = 0; fx = []; shake = 0; hurtFlash = 0;
    setState('ready');
    pausedFrom = null;
    overlay.hidden = true;
    newBtn.hidden = true;
    startBtn.blur();
    updateHud();
    sound.play('start');
    persist();
  }

  function update(dt){
    if (state === 'paused') return;
    stateTime += dt;
    clock += dt;
    shake = Math.max(0, shake - dt);
    hurtFlash = Math.max(0, hurtFlash - dt);
    fx = fx.filter(function(f){ return (f.t += dt) < f.life; });
    if (state === 'ready') {
      // Three, two, one: a beep for each.
      var before = Math.ceil(READY_TIME - (stateTime - dt)), now = Math.ceil(READY_TIME - stateTime);
      if (stateTime - dt <= 0 || now < before) sound.play(now > 0 ? 'beep' : 'go');
      if (stateTime >= READY_TIME) setState('playing');
      return;
    }
    if (state !== 'playing' && state !== 'finishing' && state !== 'dying') return;
    world.input.steer = state === 'playing' ? steering() : 0;
    world.input.brake = state === 'playing' && braking();
    var p = world.player, z = p.z;
    carry = F.advance(world, dt, carry);
    // The sky turns as the road bends.
    var T = F.track(world.race);
    sky += T.curve[F.segIndex(T, z)] * (p.z - z) * 0.0035;
    world.events.forEach(happen);
    world.events.length = 0;
    if (state === 'playing') {
      if (world.over) crashOut();
      else if (world.place) { setState('finishing'); updateHud(); persist(); }
    } else if (state === 'finishing' && stateTime >= FINISH_TIME) {
      world = F.nextRace(world);
      carry = 0; fx = [];
      setState('ready');
      persist();
    } else if (state === 'dying' && stateTime >= DEATH_TIME) {
      gameOver();
    }
  }

  // What the rules say happened: its sound, and what's drawn for it.
  function happen(e){
    var p = world.player, o = e.rival === undefined ? null : world.rivals[e.rival];
    if (e.type === 'swing') sound.play('swing');
    if (e.type === 'hit') {
      sound.play(e.move === 'punch' ? 'punch' : e.move === 'kick' ? 'kick' : 'whack');
      fx.push({ kind: 'spark', z: o.z, x: (o.x + p.x) / 2, t: 0, life: 0.3 });
    }
    if (e.type === 'ko') {
      sound.play('ko');
      fx.push({ kind: 'word', text: Lang.t('{name} is down!', { name: Lang.t(o.name) }), t: 0, life: 1.6 });
      fx.push({ kind: 'points', text: '+' + Lang.num(F.KO_POINTS), t: 0, life: 1.2 });
      if (e.weapon) fx.push({ kind: 'word', text: Lang.t('You took the {weapon}!', { weapon: Lang.t(WEAPON_NAMES[e.weapon]) }), t: -0.8, life: 1.6, low: true });
      updateHud();
    }
    if (e.type === 'hurt') {
      sound.play('hurt');
      hurtFlash = 0.25; shake = Math.max(shake, 0.18);
      fx.push({ kind: 'spark', z: p.z, x: p.x + (o.x < p.x ? -0.12 : 0.12), t: 0, life: 0.3 });
    }
    if (e.type === 'bump') sound.play('bump');
    if (e.type === 'crash') {
      sound.play('crash');
      shake = 0.5; hurtFlash = 0.35;
      fx.push({ kind: 'word', text: Lang.t('Crash!'), t: 0, life: 1.2 });
    }
    if (e.type === 'finish' && e.place <= F.QUALIFY) {
      sound.play('finish');
    }
  }

  // The player is out of the game, knocked out or beaten to the line: the
  // best score and the save are settled straight away, and the score shows
  // once the fall has played.
  function crashOut(){
    setState('dying');
    if (world.score > best) {
      best = world.score;
      try { localStorage.setItem('bdnix_kingofstreets_best', best); } catch (e) {}
    }
    updateHud();
    persist();
  }
  function gameOver(){
    setState('over');
    stale = true;
    var score = world.score;
    sound.play(score >= best && score > 0 ? 'best' : 'over');
    ovKicker.textContent = world.over === 'lost' ? Lang.t('{place}: not in the top three.', { place: Lang.t(PLACES[world.place - 1]) }) : ENDINGS[Math.min(ENDINGS.length - 1, Math.floor(Math.random() * ENDINGS.length))];
    ovTitle.textContent = 'Game over';
    ovText.textContent = score >= best && score > 0 ? Lang.t('Score {score} — new best!', { score: score }) : Lang.t('Score {score} · Best {best}', { score: score, best: best });
    startBtn.textContent = 'Play again';
    newBtn.hidden = true;
    overlay.hidden = false;
    startBtn.focus();
  }
  function running(){ return state === 'ready' || state === 'playing' || state === 'finishing'; }
  function togglePause(){
    if (state === 'paused') {
      state = pausedFrom; pausedFrom = null;
      overlay.hidden = true;
      last = performance.now();
    } else if (running()) {
      pausedFrom = state; state = 'paused';
      held = {}; press = null;
      ovKicker.textContent = Lang.t('Race {n}', { n: world.race });
      ovTitle.textContent = 'Paused';
      ovText.textContent = 'Take a breather.';
      startBtn.textContent = 'Resume';
      newBtn.hidden = false;
      overlay.hidden = false;
      persist();
      stale = true;
    }
  }
  function updateHud(){
    el.score.textContent = world.score;
    el.best.textContent = Math.max(best, world.score);
  }

  // ---------- Saving ----------
  // A race in progress is saved as the page goes away, and comes back
  // paused. Before the first race starts there's nothing worth keeping; a
  // race just won saves as the start of the next.
  function snapshot(){
    var s = state === 'paused' ? pausedFrom : state;
    if (s === 'finishing') return { state: 'ready', carry: 0, world: F.snapshot(F.nextRace(world)) };
    if (s === 'ready' && world.race === 1) return null;
    if (s !== 'ready' && s !== 'playing') return null;
    return { state: s, carry: s === 'ready' ? 0 : carry, world: F.snapshot(world) };
  }
  var persist = window.bdnixSave.keep('kingofstreets', snapshot);

  function restore(s){
    if ((s.state !== 'ready' && s.state !== 'playing') || !window.bdnixSave.num(s.carry) || s.carry < 0 || s.carry >= F.STEP) return false;
    var w = F.restore(s.world);
    if (!w) return false;
    // A race saved before its start is still on the grid.
    if (s.state === 'ready' && (w.time || w.player.z || w.race === 1)) return false;
    world = w; carry = s.carry;
    state = s.state; stateTime = 0;
    togglePause();
    ovText.textContent = 'Picked up where you left off.';
    updateHud();
    return true;
  }

  // ---------- Input ----------
  // Held keys steer and brake; a punch or a kick is one press.
  var held = {};
  var STEER_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  var BRAKE_KEYS = { ArrowDown: true, KeyS: true };
  var MOVE_KEYS = { KeyX: 'punch', KeyJ: 'punch', KeyZ: 'kick', KeyK: 'kick' };
  function steering(){
    var s = 0;
    for (var k in held) if (STEER_KEYS[k]) s += STEER_KEYS[k];
    if (press && press.steer) s += press.steer;
    return Math.max(-1, Math.min(1, s));
  }
  function braking(){
    for (var k in held) if (BRAKE_KEYS[k]) return true;
    return !!(press && press.brake);
  }
  function hit(move){
    if (state === 'playing') F.attack(world, move);
  }
  function startOrResume(){
    if (state === 'paused') togglePause();
    else if (state === 'idle' || state === 'over') newGame();
  }

  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && (state === 'idle' || state === 'over' || state === 'paused')) {
      startOrResume(); e.preventDefault(); return;
    }
    if (STEER_KEYS[e.code] || BRAKE_KEYS[e.code]) {
      if (running()) held[e.code] = true;
      e.preventDefault();
    }
    if (MOVE_KEYS[e.code]) {
      if (!e.repeat) hit(MOVE_KEYS[e.code]);
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', function(e){ delete held[e.code]; });
  window.addEventListener('blur', function(){ held = {}; if (running()) togglePause(); });
  window.bdnixUpright.onTurn(function(){ if (running()) togglePause(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && running()) togglePause();
  });

  // Tap the score to pause: a phone has no P key.
  document.querySelector('.stats').addEventListener('click', function(){
    if (running()) togglePause();
  });

  // A finger anywhere on the game area plays. Dragging sideways steers, as
  // far as the finger goes from where it touched down; a tap punches, a
  // flick up kicks, and a flick down brakes until the finger lifts. Only
  // the first finger down plays; a new first touch always does.
  var press = null;
  gameEl.addEventListener('pointerdown', function(e){
    if ((press && !e.isPrimary) || e.target.closest('.stats')) return;
    if (!running()) return;
    if (e.button > 0) return;
    e.preventDefault();
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), moved: false, steer: 0, brake: false, kicked: false };
  });
  gameEl.addEventListener('pointermove', function(e){
    if (!press || e.pointerId !== press.id) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 12) press.moved = true;
    if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      if (dy < 0 && !press.kicked) { press.kicked = true; hit('kick'); }
      if (dy > 0) press.brake = true;
    }
    press.steer = Math.abs(dx) < 8 ? 0 : Math.max(-1, Math.min(1, (dx - (dx > 0 ? 8 : -8)) / 50));
  });
  function lift(e){
    if (!press || e.pointerId !== press.id) return;
    if (!press.moved && performance.now() - press.at < 350) hit('punch');
    press = null;
  }
  document.addEventListener('pointerup', lift);
  document.addEventListener('pointercancel', function(e){ if (press && e.pointerId === press.id) press = null; });
  gameEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  gameEl.style.touchAction = 'none';

  startBtn.addEventListener('click', startOrResume);
  newBtn.addEventListener('click', newGame);

  // ---------- Sizing ----------
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
    // As tall as fits, and as wide as the screen leaves room for: upright
    // on a phone, wide on a computer.
    SCALE = Math.max(0.4, Math.min(1.6, Math.floor(Math.min((availH - 2) / H, (availW - 2) / MIN_W) * 100) / 100));
    W = Math.max(MIN_W, Math.min(MAX_W, Math.floor((availW - 2) / SCALE)));
    var dpr = window.devicePixelRatio || 1;
    board.width = Math.round(W * SCALE * dpr); board.height = Math.round(H * SCALE * dpr);
    board.style.width = Math.round(W * SCALE) + 'px'; board.style.height = Math.round(H * SCALE) + 'px';
    board.parentNode.style.setProperty('--cell', Math.max(16, 24 * SCALE) + 'px');
    buildSky();
    render();
  }

  // ---------- Colours ----------
  // Far things fade into the haze at the horizon.
  var HAZE = [150, 70, 130];
  function rgb(hex){ return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  var FOG = 16, fogged = {};
  // `hex` mixed with the haze at level k (0 clear, FOG - 1 almost gone).
  function fog(hex, k){
    var list = fogged[hex];
    if (!list) {
      var c = rgb(hex);
      list = fogged[hex] = [];
      for (var i = 0; i < FOG; i++) {
        var t = Math.pow(i / FOG, 1.4) * 0.9;
        list.push('rgb(' + Math.round(c[0] + (HAZE[0] - c[0]) * t) + ',' + Math.round(c[1] + (HAZE[1] - c[1]) * t) + ',' + Math.round(c[2] + (HAZE[2] - c[2]) * t) + ')');
      }
    }
    return list[Math.max(0, Math.min(FOG - 1, k))];
  }
  var GROUND = ['#14263a', '#11202f'], KERB = ['#3a3552', '#332f48'];
  var TARMAC = ['#2c2f42', '#282b3c'], RUMBLE = ['#f472b6', '#eef1f8'];

  // ---------- The sky ----------
  // The sky, the setting sun and the city's skyline change only with the
  // board's size, so they're drawn once into an offscreen canvas, twice as
  // wide as the board, and slid sideways as the road bends.
  var skyCanvas = document.createElement('canvas');
  var HORIZON = 0.4;            // the horizon's height, as a share of the board's
  function hash(a, b){
    var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function buildSky(){
    var k = (window.devicePixelRatio || 1) * SCALE, w = W * 2, hz = H * HORIZON + 20;
    skyCanvas.width = Math.ceil(w * k); skyCanvas.height = Math.ceil(hz * k);
    var g = skyCanvas.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    var grad = g.createLinearGradient(0, 0, 0, hz);
    grad.addColorStop(0, '#0b0d22');
    grad.addColorStop(0.45, '#2a1450');
    grad.addColorStop(0.78, '#a3326f');
    grad.addColorStop(1, '#f59e52');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, hz);
    // Stars in the dark top of the sky.
    for (var i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(238,241,248,' + (0.25 + hash(i, 1) * 0.6).toFixed(2) + ')';
      g.fillRect(hash(i, 2) * w, hash(i, 3) * hz * 0.45, 1.2, 1.2);
    }
    // The sun, low and striped, in both halves so the sky wraps round.
    for (var half = 0; half < 2; half++) {
      var sx = W * (half + 0.62), sy = hz - 20, r = Math.min(110, W * 0.2);
      var sun = g.createLinearGradient(0, sy - r, 0, sy + r * 0.2);
      sun.addColorStop(0, '#fde68a');
      sun.addColorStop(0.6, '#fb923c');
      sun.addColorStop(1, '#f43f5e');
      g.save();
      g.shadowColor = 'rgba(251,146,60,.7)'; g.shadowBlur = 40 * k;
      g.fillStyle = sun;
      g.beginPath(); g.arc(sx, sy, r, Math.PI, 0); g.fill();
      g.restore();
      g.fillStyle = grad;
      for (var b = 0; b < 6; b++) g.fillRect(sx - r - 2, sy - r * 0.55 + b * r * 0.11, r * 2 + 4, 1.5 + b * 1.1);
    }
    // Two rows of the city: tall towers far off, then roofs, domes and
    // minarets nearer, with their lights coming on.
    skyline(g, w, hz, '#3d1f5c', 'rgba(250,204,21,.45)', 34, 50, 140, 1);
    skyline(g, w, hz, '#1d1233', 'rgba(250,204,21,.7)', 22, 20, 80, 2);
  }
  function skyline(g, w, base, color, light, step, lo, hi, seed){
    for (var x = 0; x < w; x += step) {
        // It wraps round: the skyline at W is the same as at 0.
      var key = x % W;
      var bw = step * (0.6 + hash(key, seed) * 0.5), bh = lo + hash(key, seed + 9) * (hi - lo);
      g.fillStyle = color;
      var kind = hash(key, seed + 4);
      if (seed === 2 && kind < 0.12) {
        // A mosque: a dome between two minarets.
        g.beginPath(); g.arc(x + bw / 2, base - bh * 0.45, bw * 0.45, Math.PI, 0); g.fill();
        g.fillRect(x, base - bh * 0.45, bw, bh * 0.45);
        g.fillRect(x - 4, base - bh * 1.1, 4, bh * 1.1);
        g.fillRect(x + bw, base - bh * 1.1, 4, bh * 1.1);
        g.beginPath(); g.arc(x - 2, base - bh * 1.1, 3, Math.PI, 0); g.arc(x + bw + 2, base - bh * 1.1, 3, Math.PI, 0); g.fill();
        continue;
      }
      g.fillRect(x, base - bh, bw, bh);
      if (kind > 0.8) g.fillRect(x + bw * 0.45, base - bh - 14, 2, 14);   // an aerial
      g.fillStyle = light;
      for (var wy = base - bh + 6; wy < base - 6; wy += 7) {
        for (var wx = x + 3; wx < x + bw - 3; wx += 5) {
          if (hash(wx + seed, wy) < 0.22) g.fillRect(wx, wy, 2, 2.5);
        }
      }
    }
  }

  // ---------- Drawing ----------
  // A glow, drawn once and scaled: for lamps and tail lights.
  var glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  (function(){
    var g = glow.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  })();
  var glows = {};
  function tinted(color){
    if (glows[color]) return glows[color];
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    g.drawImage(glow, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 64);
    return (glows[color] = c);
  }
  function drawGlow(color, x, y, r, alpha){
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(tinted(color), x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  // The camera, and where a point of the road is on screen.
  var cam = { x: 0, y: 0, z: 0, f: 400, hor: 240 };
  function setCamera(){
    var T = F.track(world.race), p = world.player;
    cam.z = p.z - CAM_BACK;
    cam.f = Math.min(H * 0.8, W * 0.62);
    cam.hor = H * HORIZON;
    // High enough that the player's bike sits near the bottom of the board.
    cam.h = (H * 0.86 - cam.hor) * CAM_BACK / cam.f;
    cam.y = F.heightAt(T, Math.max(0, p.z)) + cam.h;
    cam.x = p.x * ROAD;
  }

  var segs = [];                // the segments on screen this frame, near to far
  function render(){
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);
    setCamera();
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(clock * 80) * 7 * shake, Math.cos(clock * 65) * 5 * shake);
    drawSky();
    drawRoad();
    drawSprites();
    drawPlayer();
    drawFx();
    ctx.restore();
    if (hurtFlash > 0) drawHurt();
    drawHud();
  }

  function drawSky(){
    var k = (window.devicePixelRatio || 1) * SCALE;
    var off = ((sky * W) % W + W) % W;
    ctx.fillStyle = '#0b0d22';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.drawImage(skyCanvas, off * k, 0, W * k, skyCanvas.height, 0, 0, W, skyCanvas.height / k);
    ctx.fillStyle = fog(GROUND[0], FOG - 1);
    ctx.fillRect(-20, H * HORIZON + 19, W + 40, H);
  }

  // The road, segment by segment from the camera out, each a band of
  // ground, kerb, rumble strip and tarmac. A segment behind a hill nearer
  // the camera is hidden, so drawing stops at the top of what's drawn.
  function drawRoad(){
    var T = F.track(world.race), base = F.segIndex(T, Math.max(0, cam.z));
    var frac = (cam.z - base * SEG) / SEG;
    var x = 0, dx = -T.curve[base] * frac * CURVE;
    var maxY = H, prev = null;
    segs.length = 0;
    for (var n = 0; n < DRAW && base + n < T.n - 1; n++) {
      var i = base + n, z1 = i * SEG, z2 = z1 + SEG;
      // The nearest segment starts behind the camera: it's drawn from
      // just in front of it.
      var a = project(x, T.y[i], Math.max(z1, cam.z + 0.6)), b = project(x + dx, T.y[i + 1], z2);
      x += dx; dx += T.curve[i] * CURVE;
      var s = { i: i, a: a, b: b, clip: maxY };
      segs.push(s);
      if (!a || !b || b.y >= maxY || b.y >= a.y) continue;
      var k = Math.floor(n / DRAW * FOG), alt = Math.floor(i / 3) % 2;
      // Ground across the whole board.
      ctx.fillStyle = fog(GROUND[alt], k);
      ctx.fillRect(-20, b.y, W + 40, Math.min(a.y, maxY) - b.y + 1);
      quad(a, b, 1.55, fog(KERB[alt], k));
      quad(a, b, 1.08, fog(RUMBLE[alt], k));
      quad(a, b, 1, fog(TARMAC[alt], k));
      // Dashes between the lanes, and the lines across at the start and
      // the finish.
      if (alt) {
        ctx.fillStyle = fog('#c3c9d8', k);
        [-0.5, 0, 0.5].forEach(function(l){ lane(a, b, l, 0.025); });
      }
      if (i === Math.floor(world.length / SEG) || i === 0) chequer(a, b, k);
      maxY = b.y;
      prev = s;
    }
    return prev;
  }
  function project(x, y, z){
    var d = z - cam.z;
    if (d < 0.5) return null;
    var s = cam.f / d;
    return { x: W / 2 + (x - cam.x) * s, y: cam.hor - (y - cam.y) * s, s: s, w: ROAD * s };
  }
  // A band of road `wide` half-widths across between two projected ends.
  function quad(a, b, wide, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x - a.w * wide, a.y); ctx.lineTo(a.x + a.w * wide, a.y);
    ctx.lineTo(b.x + b.w * wide, b.y); ctx.lineTo(b.x - b.w * wide, b.y);
    ctx.closePath(); ctx.fill();
  }
  function lane(a, b, at, wide){
    ctx.beginPath();
    ctx.moveTo(a.x + a.w * (at - wide), a.y); ctx.lineTo(a.x + a.w * (at + wide), a.y);
    ctx.lineTo(b.x + b.w * (at + wide), b.y); ctx.lineTo(b.x + b.w * (at - wide), b.y);
    ctx.closePath(); ctx.fill();
  }
  // Black and white squares right across the road.
  function chequer(a, b, k){
    for (var row = 0; row < 2; row++) {
      for (var c = 0; c < 10; c++) {
        ctx.fillStyle = fog((c + row) % 2 ? '#eef1f8' : '#0b0d12', k);
        var l = -1 + c * 0.2, r = l + 0.2, t0 = row / 2, t1 = (row + 1) / 2;
        var y0 = a.y + (b.y - a.y) * t0, y1 = a.y + (b.y - a.y) * t1;
        var x0 = a.x + (b.x - a.x) * t0, x1 = a.x + (b.x - a.x) * t1;
        var w0 = a.w + (b.w - a.w) * t0, w1 = a.w + (b.w - a.w) * t1;
        ctx.beginPath();
        ctx.moveTo(x0 + w0 * l, y0); ctx.lineTo(x0 + w0 * r, y0);
        ctx.lineTo(x1 + w1 * r, y1); ctx.lineTo(x1 + w1 * l, y1);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // Where a thing at (x half-widths, z metres) stands on screen: between
  // its segment's projected ends.
  function place(x, z){
    var T = F.track(world.race), i = F.segIndex(T, z), s = segs[i - (segs.length ? segs[0].i : 0)];
    if (!s || !s.a || !s.b) return null;
    var t = Math.max(0, Math.min(1, (z - i * SEG) / SEG));
    var sx = s.a.x + (s.b.x - s.a.x) * t, sy = s.a.y + (s.b.y - s.a.y) * t, sc = s.a.s + (s.b.s - s.a.s) * t;
    return { x: sx + x * ROAD * sc, y: sy, s: sc, clip: s.clip, fog: Math.floor((i - segs[0].i) / DRAW * FOG) };
  }

  // Everything beside and on the road, far to near, so nearer things are
  // drawn over further ones, each cut off where a hill hides it.
  function drawSprites(){
    if (!segs.length) return;
    var T = F.track(world.race), first = segs[0].i, last = segs[segs.length - 1].i;
    var buckets = {};
    function put(i, item){ (buckets[i] = buckets[i] || []).push(item); }
    var cars = F.traffic(world.race);
    for (var c = 0; c < cars.length; c++) {
      var cz = F.at(cars[c], world.time);
      if (cz > cam.z + 1 && cz < last * SEG) put(Math.floor(cz / SEG), { car: cars[c], z: cz, x: cars[c].x });
    }
    world.rivals.forEach(function(o, k){
      if (o.z > cam.z + 1 && o.z < last * SEG) put(Math.floor(o.z / SEG), { rider: o, look: LOOKS[k], z: o.z, x: o.x });
    });
    for (var i = last; i >= first; i--) {
      var list = T.scenery[i] || [];
      // Far scenery first: buildings stand behind the posts.
      for (var j = 0; j < list.length; j++) if (Math.abs(list[j].x) > 2) sprite(list[j], i * SEG, list[j].x);
      for (j = 0; j < list.length; j++) if (Math.abs(list[j].x) <= 2) sprite(list[j], i * SEG, list[j].x);
      if (i === Math.floor(world.length / SEG)) arch(i * SEG);
      var here = buckets[i];
      if (here) {
        here.sort(function(a, b){ return b.z - a.z; });
        here.forEach(function(t){ sprite(t, t.z, t.x); });
      }
    }
  }
  function sprite(item, z, x){
    var at = place(x, z);
    if (!at || at.s < 0.02 || at.s > cam.f / 2) return;
    if (at.x < -at.s * 25 || at.x > W + at.s * 25) return;
    ctx.save();
    if (at.clip < at.y + 1) { ctx.beginPath(); ctx.rect(-20, -20, W + 40, at.clip + 20); ctx.clip(); }
    ctx.translate(at.x, at.y);
    ctx.scale(at.s, at.s);
    var k = at.fog;
    if (item.car) drawVehicle(item.car, k);
    else if (item.rider) drawRival(item.rider, item.look, k);
    else SCENERY[item.kind](item, k, z);
    ctx.restore();
    if (item.rider && near(item.rider)) tag(item.rider, at);
  }
  // A rival close enough to fight shows their name and health above them.
  function near(o){
    var p = world.player;
    return !o.down && !o.place && Math.abs(o.z - p.z) < 14 && state !== 'ready';
  }
  function tag(o, at){
    var x = at.x, y = at.y - 2.3 * at.s, w = 70;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,18,.85)';
    var name = Lang.t(o.name);
    ctx.strokeText(name, x, y - 7);
    ctx.fillStyle = '#eef1f8';
    ctx.fillText(name, x, y - 7);
    ctx.fillStyle = 'rgba(8,10,18,.75)';
    ctx.fillRect(x - w / 2 - 1, y - 6, w + 2, 6);
    var left = o.health / o.max;
    ctx.fillStyle = left > 0.5 ? '#4ade80' : left > 0.25 ? '#facc15' : '#f43f5e';
    ctx.fillRect(x - w / 2, y - 5, w * left, 4);
    ctx.restore();
  }

  // ---------- Scenery ----------
  // Each is drawn in metres, standing on the ground at (0, 0), y up the
  // board (negative). `k` is how far it has faded into the haze.
  function rect(x, y, w, h, color){ ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  var HOUSES = ['#3a2a55', '#2a3a5c', '#4a2a48', '#2f4049'];
  var LIT = ['#fde68a', '#fbbf24', '#67e8f9', '#f9a8d4'];
  var SCENERY = {
    lamp: function(o, k){
      var side = o.x < 0 ? 1 : -1;          // the arm reaches over the road
      rect(-0.12, -8, 0.24, 8, fog('#4b5268', k));
      rect(side < 0 ? -2.2 : 0, -8.1, 2.2, 0.18, fog('#4b5268', k));
      rect(side * 2.2 - 0.45, -8.05, 0.9, 0.3, fog('#e5e7eb', k));
      if (k < FOG - 3) {
        drawGlow('#fde68a', side * 2.2, -7.8, 3, 0.55);
        // A pool of light on the road beneath.
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.ellipse(side * 2.2, 0, 2.6, 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },
    palm: function(o, k){
      ctx.strokeStyle = fog('#6b4a2e', k); ctx.lineWidth = 0.45; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.8, -4, 0.4, -9); ctx.stroke();
      ctx.fillStyle = fog('#1f7a4a', k);
      for (var i = 0; i < 7; i++) {
        var a = -Math.PI / 2 + (i - 3) * 0.5;
        ctx.save();
        ctx.translate(0.4, -9);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(1.8, -1.2, 3.8, 0.9); ctx.quadraticCurveTo(1.8, -0.2, 0, 0); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = fog('#5b3a1e', k);
      ctx.beginPath(); ctx.arc(0.4, -8.9, 0.35, 0, Math.PI * 2); ctx.fill();
    },
    tree: function(o, k){
      rect(-0.22, -3.2, 0.44, 3.2, fog('#5b3a1e', k));
      ctx.fillStyle = fog('#14532d', k);
      ctx.beginPath(); ctx.arc(0, -4.6, 2, 0, Math.PI * 2); ctx.arc(-1.3, -3.8, 1.4, 0, Math.PI * 2); ctx.arc(1.3, -3.8, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = fog('#166534', k);
      ctx.beginPath(); ctx.arc(-0.5, -5.2, 1.1, 0, Math.PI * 2); ctx.fill();
    },
    house: function(o, k, z){
      var w = 9, h = 9 + (o.tint * 3);
      rect(-w / 2, -h, w, h, fog(HOUSES[o.tint], k));
      rect(-w / 2 - 0.3, -h - 0.5, w + 0.6, 0.5, fog('#1d1530', k));
      windows(-w / 2 + 0.8, -h + 1.2, w - 1.6, h - 3.2, 1.3, 1.7, z, k);
      rect(-1, -2.4, 2, 2.4, fog('#120c20', k));
    },
    shop: function(o, k, z){
      var w = 8;
      rect(-w / 2, -5.5, w, 5.5, fog(HOUSES[(o.tint + 1) % 4], k));
      // A striped awning over a lit shop front.
      rect(-w / 2 + 0.5, -2.8, w - 1, 2.8, fog('#fde68a', Math.max(k, 3)));
      for (var i = 0; i < 8; i++) rect(-w / 2 + i, -3.6, 1, 0.9, fog(i % 2 ? '#eef1f8' : ['#e11d48', '#0891b2', '#16a34a', '#9333ea'][o.tint], k));
      rect(-w / 2 + 1, -5.2, w - 2, 1, fog(['#f472b6', '#22d3ee', '#facc15', '#4ade80'][o.tint], k));
      if (k < FOG - 4) drawGlow(['#f472b6', '#22d3ee', '#facc15', '#4ade80'][o.tint], 0, -4.7, 4.5, 0.35);
      windows(-w / 2 + 0.8, -2.4, w - 1.6, 1.4, 1, 1, z + 1, k);
    },
    tower: function(o, k, z){
      var w = 12, h = 30 + o.tint * 6;
      rect(-w / 2, -h, w, h, fog('#251b40', k));
      rect(-0.1, -h - 4, 0.2, 4, fog('#251b40', k));
      if (k < FOG - 2) drawGlow('#f43f5e', 0, -h - 4, 1.2, 0.8);
      windows(-w / 2 + 0.8, -h + 1, w - 1.6, h - 2, 1.5, 1.8, z, k);
    },
    mosque: function(o, k){
      var c = fog('#e9e3d0', k), d = fog('#2f855a', k);
      rect(-5, -6, 10, 6, c);
      ctx.fillStyle = d;
      ctx.beginPath(); ctx.arc(0, -6, 3.2, Math.PI, 0); ctx.fill();
      rect(-0.08, -11, 0.16, 1.8, d);
      [-6, 6].forEach(function(x){
        rect(x - 0.5, -13, 1, 13, c);
        ctx.fillStyle = d;
        ctx.beginPath(); ctx.arc(x, -13, 0.7, Math.PI, 0); ctx.fill();
      });
      for (var i = -3; i <= 3; i += 2) {
        ctx.fillStyle = fog('#1e3a2f', k);
        ctx.beginPath(); ctx.arc(i, -3, 0.6, Math.PI, 0); ctx.fill();
        rect(i - 0.6, -3, 1.2, 1.6, fog('#1e3a2f', k));
      }
    },
    billboard: function(o, k){
      rect(-2.6, -6, 0.3, 6, fog('#4b5268', k));
      rect(2.3, -6, 0.3, 6, fog('#4b5268', k));
      var colors = [['#a855f7', '#22d3ee'], ['#f472b6', '#facc15'], ['#22d3ee', '#4ade80']][o.tint];
      var g = ctx.createLinearGradient(-4.5, 0, 4.5, 0);
      g.addColorStop(0, fog(colors[0], k)); g.addColorStop(1, fog(colors[1], k));
      ctx.fillStyle = g;
      ctx.fillRect(-4.5, -10, 9, 4);
      rect(-4.5, -10.2, 9, 0.2, fog('#eef1f8', k));
      ctx.fillStyle = fog('#080a12', k);
      ctx.font = '800 2px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('bdnix', 0, -8);
    }
  };
  // A grid of windows, some lit, the same ones every time.
  function windows(x, y, w, h, ww, wh, seed, k){
    if (k > FOG - 3) return;
    var cols = Math.floor(w / (ww * 1.7)), rows = Math.floor(h / (wh * 1.6));
    var gx = w / cols, gy = h / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var lit = hash(seed + c, r * 7.3);
        ctx.fillStyle = lit < 0.55 ? fog(LIT[Math.floor(lit * 7) % 4], k + 1) : fog('#151026', k);
        ctx.fillRect(x + c * gx + (gx - ww) / 2, y + r * gy + (gy - wh) / 2, ww, wh);
      }
    }
  }
  // The arch over the finish line.
  function arch(z){
    var a = place(0, z);
    if (!a) return;
    ctx.save();
    if (a.clip < a.y + 1) { ctx.beginPath(); ctx.rect(-20, -20, W + 40, a.clip + 20); ctx.clip(); }
    ctx.translate(a.x, a.y);
    ctx.scale(a.s, a.s);
    var k = a.fog, half = ROAD * 1.2;
    rect(-half - 0.4, -7, 0.8, 7, fog('#eef1f8', k));
    rect(half - 0.4, -7, 0.8, 7, fog('#eef1f8', k));
    for (var c = 0; c < 24; c++) {
      for (var r = 0; r < 2; r++) rect(-half + c * half / 12, -7.4 + r * 0.6, half / 12, 0.6, fog((c + r) % 2 ? '#eef1f8' : '#0b0d12', k));
    }
    rect(-half, -9.4, half * 2, 2, fog('#a855f7', k));
    ctx.fillStyle = fog('#eef1f8', k);
    ctx.font = '800 1.5px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Lang.t('Finish'), 0, -8.35);
    ctx.restore();
  }

  // ---------- Traffic ----------
  // Seen from behind, in metres: rickshaws with painted hoods, green CNG
  // auto-rickshaws, painted trucks, buses and cars.
  var PAINT = ['#e11d48', '#0891b2', '#ca8a04', '#16a34a'];
  function tailLights(x, y, k){
    rect(x, y, 0.35, 0.22, fog('#ff3b5c', k));
    rect(-x - 0.35, y, 0.35, 0.22, fog('#ff3b5c', k));
    if (k < FOG - 3) {
      drawGlow('#ff3b5c', x + 0.17, y + 0.1, 0.9, 0.6);
      drawGlow('#ff3b5c', -x - 0.17, y + 0.1, 0.9, 0.6);
    }
  }
  function shadow(w){
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, w, 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }
  function drawVehicle(v, k){
    var paint = PAINT[v.tint];
    if (v.kind === 'rickshaw') {
      shadow(0.8);
      rect(-0.62, -0.7, 0.1, 0.7, fog('#111827', k));
      rect(0.52, -0.7, 0.1, 0.7, fog('#111827', k));
      rect(-0.55, -1.05, 1.1, 0.5, fog('#eef1f8', k));
      // The painted back panel and the hood above it.
      rect(-0.5, -1, 1, 0.4, fog(paint, k));
      ctx.fillStyle = fog('#facc15', k);
      ctx.beginPath(); ctx.arc(0, -0.8, 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = fog(['#9d174d', '#1e3a8a', '#065f46', '#7c2d12'][v.tint], k);
      ctx.beginPath(); ctx.moveTo(-0.62, -1.05); ctx.quadraticCurveTo(-0.65, -2.05, 0, -2.05); ctx.quadraticCurveTo(0.65, -2.05, 0.62, -1.05); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = fog('#facc15', k); ctx.lineWidth = 0.06;
      for (var i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(-0.6 + i * 0.05, -1.05 - i * 0.08); ctx.quadraticCurveTo(0, -2.05 + i * 0.12, 0.6 - i * 0.05, -1.05 - i * 0.08); ctx.stroke();
      }
      rect(-0.08, -0.6, 0.16, 0.12, fog('#ff3b5c', k));
      return;
    }
    if (v.kind === 'cng') {
      shadow(0.9);
      rect(-0.7, -0.35, 0.18, 0.35, fog('#111827', k));
      rect(0.52, -0.35, 0.18, 0.35, fog('#111827', k));
      ctx.fillStyle = fog('#15803d', k);
      ctx.beginPath(); ctx.moveTo(-0.72, -0.25); ctx.lineTo(0.72, -0.25); ctx.lineTo(0.68, -1.1); ctx.lineTo(-0.68, -1.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fog('#1f2937', k);
      ctx.beginPath(); ctx.moveTo(-0.68, -1.1); ctx.quadraticCurveTo(-0.7, -1.75, 0, -1.75); ctx.quadraticCurveTo(0.7, -1.75, 0.68, -1.1); ctx.closePath(); ctx.fill();
      rect(-0.35, -1.5, 0.7, 0.3, fog('#0f172a', k));
      rect(-0.3, -0.6, 0.6, 0.18, fog('#facc15', k));
      tailLights(0.4, -0.5, k);
      return;
    }
    var wide = v.half * ROAD, tall = v.kind === 'bus' ? 3.2 : v.kind === 'truck' ? 3 : 1.45;
    shadow(wide + 0.1);
    rect(-wide + 0.1, -0.4, 0.4, 0.4, fog('#0b0c12', k));
    rect(wide - 0.5, -0.4, 0.4, 0.4, fog('#0b0c12', k));
    if (v.kind === 'car') {
      ctx.fillStyle = fog(paint, k);
      ctx.beginPath(); ctx.moveTo(-wide, -0.3); ctx.lineTo(wide, -0.3); ctx.lineTo(wide - 0.05, -0.95); ctx.lineTo(-wide + 0.05, -0.95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fog('#1f2937', k);
      ctx.beginPath(); ctx.moveTo(-wide + 0.15, -0.95); ctx.lineTo(wide - 0.15, -0.95); ctx.lineTo(wide - 0.35, -1.45); ctx.lineTo(-wide + 0.35, -1.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fog('#64748b', k);
      ctx.beginPath(); ctx.moveTo(-wide + 0.28, -1.0); ctx.lineTo(wide - 0.28, -1.0); ctx.lineTo(wide - 0.42, -1.38); ctx.lineTo(-wide + 0.42, -1.38); ctx.closePath(); ctx.fill();
      rect(-0.3, -0.55, 0.6, 0.18, fog('#eef1f8', k));
      tailLights(wide - 0.45, -0.85, k);
      return;
    }
    if (v.kind === 'bus') {
      rect(-wide, -tall, wide * 2, tall - 0.25, fog(paint, k));
      rect(-wide, -tall + 0.9, wide * 2, 0.25, fog('#eef1f8', k));
      rect(-wide, -1.2, wide * 2, 0.18, fog('#facc15', k));
      rect(-wide + 0.25, -tall + 0.2, wide * 2 - 0.5, 0.6, fog('#1e293b', k));
      rect(-0.35, -0.8, 0.7, 0.2, fog('#eef1f8', k));
      tailLights(wide - 0.5, -0.75, k);
      return;
    }
    // A truck's tailgate, painted with flowers, as trucks here are.
    rect(-wide, -tall, wide * 2, tall - 0.3, fog('#b45309', k));
    rect(-wide + 0.15, -tall + 0.15, wide * 2 - 0.3, tall - 0.9, fog(paint, k));
    for (var f = 0; f < 3; f++) {
      var fx0 = -wide * 0.6 + f * wide * 0.6;
      ctx.fillStyle = fog(['#facc15', '#f472b6', '#eef1f8'][f], k);
      for (var p = 0; p < 5; p++) {
        ctx.beginPath(); ctx.arc(fx0 + Math.cos(p * 1.26) * 0.22, -tall / 2 - 0.2 + Math.sin(p * 1.26) * 0.22, 0.14, 0, Math.PI * 2); ctx.fill();
      }
    }
    rect(-wide - 0.05, -0.75, 0.5, 0.45, fog('#111827', k));
    rect(wide - 0.45, -0.75, 0.5, 0.45, fog('#111827', k));
    tailLights(wide - 0.5, -0.95, k);
  }

  // ---------- Riders ----------
  // A bike and its rider from behind, in metres, the rear tyre on the
  // ground at (0, 0). `look` has its colours; `pose` its lean, the move
  // it's making and how far through it is.
  function drawRider(look, pose, k){
    var lean = pose.lean || 0, a = pose.attack, e = 0, side = 1;
    if (a) {
      var m = F.MOVES[a.move];
      e = Math.sin(Math.PI * Math.min(1, a.t / m.time));
      side = a.side;
    }
    ctx.save();
    ctx.rotate(lean * 0.22);
    shadow(0.55);
    // Exhausts, rear tyre, tail.
    ctx.fillStyle = fog('#b8c0cc', k);
    roundRect(-0.46, -0.5, 0.14, 0.34, 0.06); roundRect(0.32, -0.5, 0.14, 0.34, 0.06);
    ctx.fillStyle = fog('#0b0c12', k);
    roundRect(-0.14, -0.7, 0.28, 0.7, 0.12);
    ctx.fillStyle = fog(look.bike, k);
    ctx.beginPath(); ctx.moveTo(-0.32, -0.95); ctx.lineTo(0.32, -0.95); ctx.lineTo(0.22, -0.62); ctx.lineTo(-0.22, -0.62); ctx.closePath(); ctx.fill();
    rect(-0.13, -0.9, 0.26, 0.08, fog('#ff3b5c', k));
    ctx.fillStyle = fog(look.bike, k);
    roundRect(-0.4, -1.12, 0.8, 0.22, 0.1);
    if (look.stripe) rect(-0.4, -1.04, 0.8, 0.05, fog(look.stripe, k));
    // Legs, one kicking out when it kicks.
    var kick = a && a.move === 'kick' ? e : 0;
    ctx.strokeStyle = fog('#1e1b2e', k); ctx.lineWidth = 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [-1, 1].forEach(function(s){
      ctx.beginPath(); ctx.moveTo(s * 0.16, -1.2);
      if (kick && s === side) { ctx.lineTo(s * (0.5 + 0.35 * kick), -1.05 - 0.05 * kick); ctx.lineTo(s * (0.6 + 0.6 * kick), -0.95 + 0.1 * (1 - kick)); }
      else { ctx.lineTo(s * 0.42, -0.95); ctx.lineTo(s * 0.34, -0.62); }
      ctx.stroke();
    });
    if (kick) {
      ctx.fillStyle = fog('#0b0c12', k);
      ctx.beginPath(); ctx.arc(side * (0.62 + 0.6 * kick), -0.93 + 0.1 * (1 - kick), 0.1, 0, Math.PI * 2); ctx.fill();
    }
    // The jacket, then the arms: on the bars, or one swinging out.
    ctx.fillStyle = fog(look.jacket, k);
    ctx.beginPath(); ctx.moveTo(-0.24, -1.15); ctx.lineTo(0.24, -1.15); ctx.lineTo(0.31, -1.68); ctx.quadraticCurveTo(0, -1.78, -0.31, -1.68); ctx.closePath(); ctx.fill();
    rect(-0.24, -1.22, 0.48, 0.08, fog('#0b0c12', k));
    var swing = a && a.move !== 'kick' ? e : 0;
    ctx.strokeStyle = fog(look.jacket, k); ctx.lineWidth = 0.13;
    [-1, 1].forEach(function(s){
      ctx.beginPath(); ctx.moveTo(s * 0.27, -1.62);
      if (swing && s === side) ctx.lineTo(s * (0.45 + 0.7 * swing), -1.62 + 0.12 * (1 - swing));
      else ctx.lineTo(s * 0.44, -1.28);
      ctx.stroke();
    });
    if (swing) weapon(a.move, side, swing, k);
    else {
      ctx.fillStyle = fog('#0b0c12', k);
      rect(-0.52, -1.32, 0.12, 0.08, fog('#0b0c12', k)); rect(0.4, -1.32, 0.12, 0.08, fog('#0b0c12', k));
    }
    // The helmet, with a stripe.
    ctx.fillStyle = fog(look.helmet, k);
    ctx.beginPath(); ctx.arc(0, -1.9, 0.19, 0, Math.PI * 2); ctx.fill();
    rect(-0.035, -2.09, 0.07, 0.36, fog(look.jacket, k));
    ctx.restore();
  }
  // A fist at the end of a swung arm, or what's held in it.
  function weapon(move, side, e, k){
    var hx = side * (0.45 + 0.7 * e), hy = -1.62 + 0.12 * (1 - e);
    ctx.fillStyle = fog('#f2c9a0', k);
    ctx.beginPath(); ctx.arc(hx, hy, 0.08, 0, Math.PI * 2); ctx.fill();
    if (move === 'punch') return;
    var ang = side * (-1.2 + 2 * e);      // swung down across
    var dx = Math.sin(ang) * side, dy = -Math.cos(ang);
    if (move === 'stick') {
      ctx.strokeStyle = fog('#a16207', k); ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dx * 0.95, hy + dy * 0.95); ctx.stroke();
    } else if (move === 'chain') {
      ctx.fillStyle = fog('#cbd5e1', k);
      for (var i = 1; i <= 8; i++) {
        var t = i / 8;
        ctx.beginPath(); ctx.arc(hx + dx * t * 1.05 + Math.sin(t * 3) * 0.08 * side, hy + dy * t * 1.05 + t * t * 0.2, 0.045, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.strokeStyle = fog('#1e1b2e', k); ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dx * 0.4, hy + dy * 0.4); ctx.stroke();
      ctx.strokeStyle = fog('#cbd5e1', k); ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.moveTo(hx + dx * 0.4, hy + dy * 0.4); ctx.lineTo(hx + dx * 0.55 + side * 0.08, hy + dy * 0.55); ctx.stroke();
      ctx.strokeStyle = fog('#1e1b2e', k); ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(hx + dx * 0.55 + side * 0.08, hy + dy * 0.55); ctx.lineTo(hx + dx * 0.95 + side * 0.2, hy + dy * 0.9); ctx.stroke();
    }
  }
  function roundRect(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath(); ctx.fill();
  }
  // A bike on its side and its rider sprawled beside it, `t` seconds after
  // the fall: tumbling at first, then still.
  function drawFallen(look, t, side, k){
    var roll = Math.min(1, t / 0.8);
    ctx.save();
    shadow(0.9);
    ctx.save();
    ctx.translate(-side * 0.5, 0);
    ctx.rotate(side * Math.PI / 2 * roll);
    ctx.fillStyle = fog('#0b0c12', k); roundRect(-0.14, -0.7, 0.28, 0.7, 0.12);
    ctx.fillStyle = fog(look.bike, k); roundRect(-0.4, -1.12, 0.8, 0.5, 0.12);
    ctx.restore();
    ctx.translate(side * (0.6 + 1.2 * roll), -0.3 - Math.sin(Math.PI * roll) * 1.2);
    ctx.rotate(side * t * (t < 0.8 ? 9 : 0) + side * 1.4);
    ctx.fillStyle = fog(look.jacket, k);
    roundRect(-0.25, -0.5, 0.5, 0.6, 0.12);
    ctx.fillStyle = fog(look.helmet, k);
    ctx.beginPath(); ctx.arc(0, -0.7, 0.19, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawRival(o, look, k){
    if (o.down) drawFallen(look, o.down, o.id % 2 ? 1 : -1, k);
    else drawRider(look, { lean: Math.max(-1, Math.min(1, o.push * 0.5)), attack: o.attack }, k);
  }
  // The player, at the bottom of the board.
  function drawPlayer(){
    var p = world.player, T = F.track(world.race);
    var a = project(p.x * ROAD, F.heightAt(T, p.z), p.z);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(a.s, a.s);
    if (world.over === 'ko') drawFallen(ME, state === 'dying' ? stateTime : DEATH_TIME, p.x > 0 ? -1 : 1, 0);
    else if (p.crash) drawFallen(ME, F.CRASH_TIME - p.crash, p.x > 0 ? -1 : 1, 0);
    else {
      // Blinking while nothing can hit it, just back on the bike.
      if (!(p.safe && Math.floor(clock * 12) % 2)) drawRider(ME, { lean: p.lean + p.push * 0.3, attack: p.attack }, 0);
      // Dust thrown up off the road.
      if (Math.abs(p.x) > 1 && p.speed > 5) {
        for (var i = 0; i < 6; i++) {
          var t = (clock * 3 + i / 6) % 1;
          ctx.fillStyle = 'rgba(194,170,140,' + (0.3 * (1 - t)).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc((hash(i, Math.floor(clock * 3 + i / 6)) - 0.5) * 1.4, -0.1 - t * 0.5, 0.06 + t * 0.18, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
    // Speed lines at the sides at full tilt.
    var fast = Math.max(0, (p.speed - 45) / 20);
    if (fast > 0 && state === 'playing') {
      ctx.strokeStyle = 'rgba(238,241,248,' + (0.25 * fast).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var j = 0; j < 10; j++) {
        var y = (hash(j, 5) * H * 0.55 + H * 0.4 + clock * 900 * (0.6 + hash(j, 6))) % (H * 0.6) + H * 0.4;
        var x = j % 2 ? W - 8 - hash(j, 7) * 40 : 8 + hash(j, 7) * 40;
        ctx.moveTo(x, y); ctx.lineTo(x, y + 30);
      }
      ctx.stroke();
    }
  }

  // ---------- Effects and the HUD ----------
  function drawFx(){
    fx.forEach(function(f){
      if (f.t < 0) return;
      var k = f.t / f.life;
      if (f.kind === 'spark') {
        var at = place(f.x, f.z) || project(f.x * ROAD, cam.y - cam.h, f.z);
        if (!at) return;
        var x = at.x, y = at.y - 1.5 * at.s, r = at.s * (0.3 + k * 0.6);
        ctx.save();
        ctx.strokeStyle = 'rgba(250,204,21,' + (1 - k).toFixed(3) + ')';
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (var i = 0; i < 8; i++) {
          var a = i * Math.PI / 4 + 0.3;
          ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 3);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var big = f.kind === 'points';
      ctx.font = big ? '800 30px Inter, system-ui, sans-serif' : '800 22px Inter, system-ui, sans-serif';
      var ty = big ? H * 0.5 - k * 30 : H * (f.low ? 0.36 : 0.3);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,10,18,.8)';
      ctx.strokeText(f.text, W / 2, ty);
      ctx.fillStyle = big ? '#facc15' : '#eef1f8';
      ctx.fillText(f.text, W / 2, ty);
      ctx.restore();
    });
  }
  function drawHurt(){
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(244,63,94,0)');
    g.addColorStop(1, 'rgba(244,63,94,' + (hurtFlash * 1.6).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function text(s, x, y, font, color, align){
    ctx.font = font;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,10,18,.75)';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  function drawHud(){
    var p = world.player, total = world.rivals.length + 1;
    // How far along the race everyone is.
    var bar = W - 32;
    ctx.fillStyle = 'rgba(8,10,18,.55)';
    ctx.fillRect(16, 12, bar, 4);
    world.rivals.forEach(function(o, k){
      if (o.down) return;
      ctx.fillStyle = LOOKS[k].jacket;
      ctx.beginPath(); ctx.arc(16 + bar * Math.min(1, o.z / world.length), 14, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#eef1f8';
    ctx.beginPath(); ctx.arc(16 + bar * Math.min(1, Math.max(0, p.z) / world.length), 14, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ME.jacket;
    ctx.beginPath(); ctx.arc(16 + bar * Math.min(1, Math.max(0, p.z) / world.length), 14, 2.5, 0, Math.PI * 2); ctx.fill();

    // Where you are in the race, and which race it is.
    var pos = F.position(world);
    text(Lang.num(pos), 16, 64, '800 40px Inter, system-ui, sans-serif', '#eef1f8');
    var pw = ctx.measureText(Lang.num(pos)).width;
    text('/' + Lang.num(total), 20 + pw, 64, '800 18px Inter, system-ui, sans-serif', '#c3c9d8');
    text(Lang.t('Race {n}', { n: world.race }), 16, 84, '600 12px "JetBrains Mono", monospace', '#c3c9d8');

    // Your health, and what you're holding.
    ctx.fillStyle = 'rgba(8,10,18,.6)';
    ctx.fillRect(15, 93, 102, 9);
    var left = p.health / F.HEALTH;
    ctx.fillStyle = left > 0.5 ? '#4ade80' : left > 0.25 ? '#facc15' : '#f43f5e';
    ctx.fillRect(16, 94, 100 * left, 7);
    if (p.weapon) text(Lang.t(WEAPON_NAMES[p.weapon]), 16, 120, '700 12px Inter, system-ui, sans-serif', '#facc15');

    // How fast you're going.
    text(Lang.num(Math.round(p.speed * 3.6)), W - 16, 58, '800 32px Inter, system-ui, sans-serif', '#eef1f8', 'right');
    text(Lang.t('km/h'), W - 16, 76, '600 12px "JetBrains Mono", monospace', '#c3c9d8', 'right');

    if (state === 'ready' || (state === 'paused' && pausedFrom === 'ready')) {
      var n = Math.max(1, Math.ceil(READY_TIME - stateTime));
      ctx.fillStyle = 'rgba(8,10,18,.35)';
      ctx.fillRect(0, H * 0.22, W, 150);
      text(Lang.t('Race {n}', { n: world.race }), W / 2, H * 0.22 + 36, '800 22px Inter, system-ui, sans-serif', '#c3c9d8', 'center');
      text(state === 'paused' ? Lang.t('Get ready') : Lang.num(n), W / 2, H * 0.22 + 100, '800 60px Inter, system-ui, sans-serif', '#facc15', 'center');
      text(Lang.t(compactMQ.matches ? 'Drag to steer, tap to punch' : '← → steer · X punch · Z kick'), W / 2, H * 0.22 + 134, '600 13px "JetBrains Mono", monospace', '#eef1f8', 'center');
    }
    if (state === 'playing' && world.time < GO_TIME) {
      text(Lang.t('Go!'), W / 2, H * 0.36, '800 64px Inter, system-ui, sans-serif', '#4ade80', 'center');
    }
    if (state === 'finishing') {
      ctx.fillStyle = 'rgba(8,10,18,.45)';
      ctx.fillRect(0, H * 0.24, W, 130);
      text(Lang.t(PLACES[world.place - 1]), W / 2, H * 0.24 + 52, '800 44px Inter, system-ui, sans-serif', '#facc15', 'center');
      text('+' + Lang.num(F.PLACE_POINTS[world.place - 1] * world.race), W / 2, H * 0.24 + 84, '800 22px Inter, system-ui, sans-serif', '#eef1f8', 'center');
      text(Lang.t('Next: race {n}', { n: world.race + 1 }), W / 2, H * 0.24 + 112, '600 13px "JetBrains Mono", monospace', '#c3c9d8', 'center');
    }
  }

  var last = performance.now(), stale = false;
  function loop(now){
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    // Nothing moves while the overlay is up, so the board isn't redrawn
    // under it (redrawing under its blur is costly on phones).
    if (state === 'ready' || state === 'playing' || state === 'finishing' || state === 'dying' || stale) render();
    stale = false;
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  if (compactMQ.addEventListener) {
    compactMQ.addEventListener('change', resize);
    landscapeMQ.addEventListener('change', resize);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  var saved = window.bdnixSave.load('kingofstreets');
  if (saved && !restore(saved)) window.bdnixSave.clear('kingofstreets');
  updateHud();
  resize();
  requestAnimationFrame(loop);
})();
