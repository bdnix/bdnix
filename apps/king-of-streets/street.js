// King of Streets: the game around the race. The start card, the garage
// (buying bikes with the career's points, picking a rider and a race) and
// a quick race on any bike; the race itself (street-core.js runs it,
// street-3d.js draws it, street-engine.js plays its engines and traffic);
// the controls, the heads-up display, pausing and saving.
(function(){
  var Lang = window.bdnixLang, F = window.bdnixStreet, S = window.bdnixStreetScene, G = window.bdnixStreet3d, A = window.bdnixStreetAudio;
  var sound = window.bdnixSound;
  var CAREER = 'bdnix_kingofstreets_career', BEST = 'bdnix_kingofstreets_best';
  var READY_TIME = 3;           // the countdown
  var FINISH_TIME = 3;          // riding on past the line before the result shows
  var DOWN_TIME = 2.2;          // the fall, knocked out, before the result shows
  var MSG_TIME = 1.6;           // how long a message shows

  var PLACES = ['1st place', '2nd place', '3rd place', '4th place', '5th place', '6th place', '7th place'];
  var WEAPON_NAMES = { stick: 'Stick', chain: 'Chain', nunchaku: 'Nunchaku' };
  var ROUTES = ['Mirpur Road at dawn', 'Old Dhaka after midnight', 'Hatirjheel at midday', 'Moghbazar flyover at dusk', 'The expressway in the morning rush'];
  var RIDERS = ['Black helmet', 'Red helmet', 'Gold helmet', 'White helmet', 'Teal helmet', 'Orange helmet'];
  var SWATCHES = ['#1a1a1c', '#9c1418', '#d9a514', '#e8e8ea', '#18a0a8', '#e0601a'];

  var $ = function(id){ return document.getElementById(id); };
  var board = $('board'), gameEl = $('game'), overlay = $('overlay'), garage = $('garage'), quick = $('quick');
  var ovKicker = $('ovKicker'), ovTitle = $('ovTitle'), ovText = $('ovText'), ovCareer = $('ovCareer');
  var startBtn = $('startBtn'), newBtn = $('newBtn'), garageBtn = $('garageBtn'), quickBtn = $('quickBtn');
  var hud = $('hud'), loadingEl = $('loading');
  var el = { place: $('place'), score: $('score'), togo: $('togo'), speed: $('speed'), health: $('health'), weapon: $('weapon'),
    foe: $('foe'), foeName: $('foeName'), foeHealth: $('foeHealth'), foeSide: $('foeSide'), count: $('count'), msg: $('msg'),
    punch: $('punchBtn'), kick: $('kickBtn'), brake: $('brakeBtn') };

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
    shove: [tone(0, 0, 0.2, 'noise', 0.4), tone(90, 50, 0.25, 'triangle', 0.45), tone(700, 500, 0.08, 'square', 0.12, 0.05)],
    clang: [tone(1200, 1150, 0.18, 'square', 0.12), tone(0, 0, 0.06, 'noise', 0.3)],
    scrape: [tone(0, 0, 0.3, 'noise', 0.22), tone(2400, 1800, 0.3, 'sawtooth', 0.05)],
    ko: [tone(0, 0, 0.3, 'noise', 0.35), tone(523, 523, 0.08, 'square', 0.16, 0.12), tone(784, 784, 0.16, 'square', 0.16, 0.2)],
    crash: [tone(0, 0, 0.5, 'noise', 0.5), tone(140, 40, 0.5, 'triangle', 0.5)],
    buy: notes([659, 784, 1047], 0.08, 0.12, 'square', 0.16),
    finish: notes([523, 659, 784, 1047, 784, 1047], 0.1, 0.18, 'square', 0.17)
  });

  // ---------- The career ----------
  // Points, bikes owned and races placed in (street-core.js), and the
  // player's choices: their rider, the bike they ride, the race they're on,
  // the camera, how they steer on a touchscreen and how much to draw.
  function careerFrom(s){
    var c = F.careerFrom(s), ok = function(n, lo, hi){ return typeof n === 'number' && n === Math.floor(n) && n >= lo && n <= hi; };
    s = s || {};
    c.rider = ok(s.rider, 0, 5) ? s.rider : 0;
    c.ride = ok(s.ride, 1, F.BIKES.length) && c.owned.indexOf(s.ride) >= 0 ? s.ride : F.best(c);
    c.race = ok(s.race, 1, F.LEVELS.length * F.RACES) && F.open(c, s.race) ? s.race : nextRace(c);
    c.view = s.view === 'rider' ? 'rider' : 'chase';
    c.steer = s.steer === 'tilt' ? 'tilt' : 'drag';
    c.quality = s.quality === 'low' || s.quality === 'high' ? s.quality : S.quality({ touch: matchMedia('(pointer:coarse)').matches, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory });
    return c;
  }
  // The career's next race: the first open one not yet placed in, or the
  // last open one.
  function nextRace(c){
    var last = 1;
    for (var r = 1; r <= F.LEVELS.length * F.RACES; r++) {
      if (!F.open(c, r)) break;
      last = r;
      if (c.done.indexOf(r) < 0) return r;
    }
    return last;
  }
  var career;
  try { career = careerFrom(JSON.parse(localStorage.getItem(CAREER))); } catch (e) { career = careerFrom(null); }
  function keepCareer(){
    try { localStorage.setItem(CAREER, JSON.stringify(career)); } catch (e) {}
  }
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST), 10) || 0; } catch (e) {}

  // ---------- The state of play ----------
  // idle (the start card), loading (the race's city on its way), ready
  // (the countdown), playing, finishing (past the line), down (knocked
  // out), result (how it went) and paused.
  var state = 'idle', pausedFrom = null, stateTime = 0;
  var mode = 'career', quickPick = { level: 1, bike: 1 };
  var world = null, carry = 0, msgTime = 0, stale = true, banked = false;
  var slow = 0, tips = null;     // slow motion after a knockout; the first race's tips still to show
  var touch = matchMedia('(pointer: coarse)').matches;
  var view = null, staged = null, failed = false;

  function setState(s){ state = s; stateTime = 0; stale = true; }
  function running(){ return state === 'loading' || state === 'ready' || state === 'playing' || state === 'finishing'; }

  // A race for the career, or a quick one.
  function careerWorld(){ return F.create(career.race, career.ride); }
  function quickWorld(){ return F.create((quickPick.level - 1) * F.RACES + 1, quickPick.bike); }

  // Builds the race's city, once the race is started (or picked up from a
  // save): the start card shows a picture instead, so it opens at once. A
  // race shows once it's staged.
  function stage(w){
    if (!view) return;
    staged = null;
    view.view(career.view);
    view.race(w, { character: career.rider }).then(function(){
      if (world === w) { staged = w; stale = true; }
    }, function(){ fail(); });
  }
  // Starts a race: the countdown once its city is ready.
  function go(w){
    world = w; carry = 0; banked = false; msgTime = 0; slow = 0;
    // The first race of a career shows how to steer and fight.
    tips = mode === 'career' && !career.done.length && !w.time ? { steer: true, fight: true } : null;
    // Nothing of the last race shows while this one's city loads.
    hud.hidden = true;
    el.count.textContent = '';
    el.msg.textContent = '';
    hideCards();
    setState('loading');
    if (staged !== w) stage(w);
    updateHud();
    persist();
  }
  function hideCards(){
    overlay.hidden = true; garage.hidden = true; quick.hidden = true;
    startBtn.blur();
  }
  function startGame(){
    mode = 'career';
    var w = world && staged === world && !world.time && mode === 'career' && world.race === career.race && world.bike === career.ride ? world : careerWorld();
    go(w);
  }

  function update(dt){
    if (state === 'paused' || state === 'idle' || state === 'result') return;
    stateTime += dt;
    if (msgTime > 0 && (msgTime -= dt) <= 0) el.msg.textContent = '';
    if (state === 'loading') {
      loadingEl.hidden = staged === world || failed;
      put('load', $('loadPct'), view && view.progress ? Lang.num(Math.floor(view.progress * 100)) + '%' : '');
      if (staged === world) {
        // A race picked up part way carries on; a new one counts down.
        setState(world.time ? 'playing' : 'ready');
        hud.hidden = false;
        level();
        if (!world.time) sound.play('start');
        A.start(F.BIKES[world.bike - 1].id, world.rivals.map(function(o){ return F.BIKES[o.bike - 1].id; }));
      }
      return;
    }
    if (state === 'ready') {
      // Three, two, one: a beep for each.
      var before = Math.ceil(READY_TIME - (stateTime - dt)), now = Math.ceil(READY_TIME - stateTime);
      if (stateTime - dt <= 0 || now < before) sound.play(now > 0 ? 'beep' : 'go');
      el.count.textContent = now > 0 ? Lang.num(now) : '';
      if (stateTime >= READY_TIME) {
        setState('playing'); say('Go!', 0.8);
        level();
      }
      audio();
      return;
    }
    if (tips && tips.steer && state === 'playing' && stateTime > 1) {
      tips.steer = false;
      say(!touch ? 'Steer with ← and →' : career.steer === 'tilt' ? 'Turn the phone to steer' : 'Drag anywhere to steer', 2.5);
    }
    world.input.steer = state === 'playing' ? steering() : 0;
    world.input.brake = state === 'playing' && braking();
    carry = F.advance(world, dt, carry);
    world.events.forEach(happen);
    world.events.length = 0;
    if (state === 'playing') {
      if (world.over) { setState('down'); bank(); }
      else if (world.place) { setState('finishing'); bank(); }
    } else if (state === 'finishing' && stateTime >= FINISH_TIME) result();
    else if (state === 'down' && stateTime >= DOWN_TIME) result();
    updateHud();
    audio();
  }

  // The race's points go to the career (not a quick race's), and the best
  // score is kept, as soon as the race is decided.
  function bank(){
    if (banked) return;
    banked = true;
    if (mode === 'career') {
      F.bank(career, world);
      career.race = nextRace(career);
      keepCareer();
    }
    if (world.score > best) {
      best = world.score;
      try { localStorage.setItem(BEST, best); } catch (e) {}
    }
    persist();
  }
  // How the race went, and what's next.
  function result(){
    setState('result');
    A.stop();
    hud.hidden = true;
    var w = world, ko = w.over === 'ko';
    sound.play(w.score > 0 && w.score >= best ? 'best' : 'over');
    ovKicker.textContent = Lang.t('Race {n}', { n: w.race }) + ' · ' + Lang.t(ROUTES[w.level - 1]);
    ovTitle.textContent = ko ? 'Knocked out' : PLACES[w.place - 1];
    ovText.textContent = mode === 'career'
      ? Lang.t(ko ? 'You keep {points} points from the race.' : 'You won {points} points.', { points: w.score })
      : Lang.t('Score {score} · Best {best}', { score: w.score, best: best });
    var buy = mode === 'career' && F.BIKES.filter(function(b, i){ return career.owned.indexOf(i + 1) < 0 && career.points >= b.price; })[0];
    ovCareer.textContent = buy ? Lang.t('You can buy the {bike} in the garage.', { bike: Lang.t(buy.name) }) : mode === 'career' ? summary() : '';
    startBtn.textContent = mode === 'career' ? (ko || w.place > 3 ? 'Try again' : 'Next race') : 'Race again';
    newBtn.hidden = true;
    overlay.hidden = false;
    startBtn.focus();
    persist();
  }
  function summary(){
    return Lang.t('Race {race} of {races} · {points} points · {bike}', { race: career.race, races: F.LEVELS.length * F.RACES, points: career.points, bike: Lang.t(F.BIKES[career.ride - 1].name) });
  }

  // ---------- What happened ----------
  function say(text, time){ el.msg.textContent = text; msgTime = time || MSG_TIME; }
  function happen(e){
    var o = e.rival === undefined ? null : world.rivals[e.rival];
    if (e.type === 'swing') sound.play('swing');
    if (e.type === 'hit') { sound.play(e.move === 'punch' ? 'punch' : e.move === 'kick' ? 'kick' : 'whack'); strike(0.35); }
    if (e.type === 'ko') {
      sound.play('ko');
      slow = 0.8;
      say(e.weapon ? Lang.t('{name} is down! You took the {weapon}.', { name: Lang.t(o.name), weapon: Lang.t(WEAPON_NAMES[e.weapon]) }) : Lang.t('{name} is down!', { name: Lang.t(o.name) }));
    }
    if (e.type === 'hurt') { sound.play('hurt'); flash(); if (view) view.jolt(0.6); }
    if (e.type === 'bump') sound.play('bump');
    if (e.type === 'shove') { sound.play('shove'); say('Out of the way!', 1); strike(0.3); }
    if (e.type === 'clang') { sound.play('clang'); say('Too big to move.', 1); }
    if (e.type === 'scrape') sound.play('scrape');
    if (e.type === 'crash') { sound.play('crash'); flash(); say('Crash!'); if (view) view.jolt(1); }
    if (e.type === 'out') say('Knocked out!');
    if (e.type === 'finish') { sound.play('finish'); say(PLACES[e.place - 1], FINISH_TIME); }
  }
  function flash(){
    gameEl.classList.remove('hurt');
    void gameEl.offsetWidth;
    gameEl.classList.add('hurt');
  }
  // A blow landed: a white flash, and the camera jolts.
  function strike(amount){
    gameEl.classList.remove('struck');
    void gameEl.offsetWidth;
    gameEl.classList.add('struck');
    if (view) view.jolt(amount);
  }

  // ---------- The heads-up display ----------
  var shown = {};
  function put(key, node, text){ if (shown[key] !== text) { shown[key] = text; node.textContent = text; } }
  function updateHud(){
    if (!world) return;
    var p = world.player, togo = Math.max(0, world.length - p.z);
    put('place', el.place, Lang.num(F.position(world)) + '/' + Lang.num(world.rivals.length + 1));
    put('score', el.score, Lang.num(world.score));
    put('togo', el.togo, togo >= 1000 ? Lang.t('{km} km', { km: Lang.num((Math.round(togo / 100) / 10).toFixed(1)) }) : Lang.t('{m} m', { m: Math.round(togo) }));
    put('speed', el.speed, Lang.num(Math.round(p.speed * 3.6)));
    el.health.style.width = p.health + '%';
    put('weapon', el.weapon, p.weapon ? Lang.t(WEAPON_NAMES[p.weapon]) : '');
    el.weapon.hidden = !p.weapon;
    // The rival in reach: their name, what they carry and their health.
    var foe = null, d = Infinity;
    world.rivals.forEach(function(o){
      var dz = o.z - p.z, dx = Math.abs(o.x - p.x);
      if (o.down || o.place || dz > F.AHEAD || dz < -F.BEHIND || dx > 4) return;
      if (dx + Math.abs(dz) / 10 < d) { d = dx + Math.abs(dz) / 10; foe = o; }
    });
    el.foe.hidden = !foe;
    // In reach of what the player's holding: the punch button calls for a press.
    var reach = foe && Math.abs(foe.x - p.x) <= F.MOVES[p.weapon || 'punch'].reach;
    el.punch.classList.toggle('ready', !!reach && state === 'playing');
    el.foeSide.className = 'side ' + (foe ? (foe.x > p.x ? 'right' : 'left') : '');
    if (reach && tips && tips.fight && state === 'playing') {
      tips.fight = false;
      say(touch ? 'A rival beside you: tap Punch!' : 'A rival beside you: press X to punch!', 2.5);
    }
    if (foe) {
      put('foe', el.foeName, foe.weapon ? Lang.t('{name} · {weapon}', { name: Lang.t(foe.name), weapon: Lang.t(WEAPON_NAMES[foe.weapon]) }) : Lang.t(foe.name));
      el.foeHealth.style.width = Math.round(foe.health / foe.max * 100) + '%';
    }
  }

  // ---------- Sound ----------
  function audio(){
    if (!world || !view || !view.P) return;
    var P = view.P, p = world.player, at = S.place(P, p.z, p.x);
    A.update({
      speed: p.speed, throttle: state === 'playing' && !world.input.brake ? 1 : 0, off: p.crash > 0 || !!world.over,
      fast: p.speed / F.BIKES[world.bike - 1].top, lean: p.lean,
      listener: { x: at.x, z: at.z, heading: at.heading, speed: p.speed },
      rivals: world.rivals.map(function(o){ var a = S.place(P, o.z, o.x); return { x: a.x, z: a.z, speed: o.speed, down: o.down > 0 }; }),
      cars: F.nearby(world, p.z, 60).map(function(c){ var a = S.place(P, c.z, c.x); return { kind: c.kind, x: a.x, z: a.z, speed: c.speed }; }),
      busy: world.level >= 4 ? 1 : F.level(world.race).traffic, night: F.level(world.race).time === 'night', time: world.time
    });
  }

  // ---------- Pausing ----------
  function togglePause(){
    if (state === 'paused') {
      state = pausedFrom; pausedFrom = null;
      if (staged !== world) state = 'loading';
      hideCards();
      hud.hidden = state === 'loading';
      last = performance.now();
      stale = true;
    } else if (running()) {
      pausedFrom = state; state = 'paused';
      held = {}; press = null; padBrake = null;
      A.stop();
      ovKicker.textContent = Lang.t('Race {n}', { n: world.race }) + ' · ' + Lang.t(ROUTES[world.level - 1]);
      ovTitle.textContent = 'Paused';
      ovText.textContent = 'Take a breather.';
      ovCareer.textContent = '';
      startBtn.textContent = 'Resume';
      newBtn.hidden = false;
      garage.hidden = true; quick.hidden = true;
      overlay.hidden = false;
      persist();
      stale = true;
    }
  }
  // Back on: the engines start again.
  function resumeSound(){
    level();
    if (state === 'ready' || state === 'playing' || state === 'finishing') A.start(F.BIKES[world.bike - 1].id, world.rivals.map(function(o){ return F.BIKES[o.bike - 1].id; }));
  }

  // ---------- Saving ----------
  // A race under way is saved as the page goes away and comes back paused.
  // One that's over, or not yet started, isn't.
  function snapshot(){
    var s = state === 'paused' ? pausedFrom : state;
    if ((s !== 'playing' && s !== 'ready') || !world || !world.time) return null;
    return { mode: mode, rider: career.rider, carry: carry, world: F.snapshot(world) };
  }
  var persist = window.bdnixSave.keep('kingofstreets', snapshot);
  function restore(s){
    if ((s.mode !== 'career' && s.mode !== 'quick') || !window.bdnixSave.num(s.carry) || s.carry < 0 || s.carry >= F.STEP || [0, 1, 2, 3, 4, 5].indexOf(s.rider) < 0) return false;
    var w = F.restore(s.world);
    if (!w || !w.time) return false;
    // A career race is one the career has opened, on a bike it owns.
    if (s.mode === 'career' && (!F.open(career, w.race) || career.owned.indexOf(w.bike) < 0)) return false;
    mode = s.mode; world = w; carry = s.carry; career.rider = s.rider;
    // Picked up in the first race of a career: how to fight is still to show.
    tips = mode === 'career' && !career.done.length ? { steer: false, fight: true } : null;
    state = 'playing'; stateTime = 0;
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
    if (career.steer === 'tilt' && phone.at !== null) s += S.tilt(phone.at, phone.from);
    return Math.max(-1, Math.min(1, s));
  }
  function braking(){
    for (var k in held) if (BRAKE_KEYS[k]) return true;
    return padBrake !== null;
  }
  function hit(move){
    if (state === 'playing') F.attack(world, move);
  }
  function startOrResume(){
    A.unlock();
    if (career.steer === 'tilt') askTilt();
    if (state === 'paused') { togglePause(); if (state !== 'loading') resumeSound(); }
    else if (state === 'idle' || state === 'result') { if (mode === 'quick' && state === 'result') go(quickWorld()); else startGame(); }
  }
  function toggleView(){
    career.view = career.view === 'rider' ? 'chase' : 'rider';
    if (view) view.view(career.view);
    keepCareer();
    showSettings();
    stale = true;
  }

  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && (state === 'idle' || state === 'result' || state === 'paused') && overlay.hidden === false && document.activeElement === document.body) {
      startOrResume(); e.preventDefault(); return;
    }
    if (e.code === 'KeyV' && !e.repeat) { toggleView(); return; }
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
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && running()) togglePause();
  });
  // Tap the score to pause: a phone has no P key.
  document.querySelector('.stats').addEventListener('click', function(){
    if (running()) togglePause();
  });

  // On a touchscreen: a finger anywhere but the buttons steers, dragged
  // sideways as far as it goes from where it touched down (another finger
  // can punch meanwhile); and the buttons punch, kick and, held, brake.
  var press = null, padBrake = null;
  gameEl.addEventListener('pointerdown', function(e){
    if (press || e.target.closest('.stats') || e.target.closest('.overlay') || e.target.closest('.pad') || !running() || e.button > 0) return;
    e.preventDefault();
    press = { id: e.pointerId, x: e.clientX, steer: 0 };
  });
  gameEl.addEventListener('pointermove', function(e){
    if (!press || e.pointerId !== press.id) return;
    var dx = e.clientX - press.x;
    press.steer = Math.abs(dx) < 8 ? 0 : Math.max(-1, Math.min(1, (dx - (dx > 0 ? 8 : -8)) / 50));
  });
  function lift(e){
    if (press && e.pointerId === press.id) press = null;
    if (padBrake === e.pointerId) { padBrake = null; el.brake.classList.remove('down'); }
  }
  document.addEventListener('pointerup', lift);
  document.addEventListener('pointercancel', lift);
  gameEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  function pad(button, down){
    button.addEventListener('pointerdown', function(e){
      e.preventDefault();
      A.unlock();
      if (running()) down(e);
    });
    // A press on a button is handled as it lands; its click would come late.
    button.addEventListener('click', function(e){ e.preventDefault(); });
  }
  pad(el.punch, function(){ hit('punch'); });
  pad(el.kick, function(){ hit('kick'); });
  pad(el.brake, function(e){ padBrake = e.pointerId; el.brake.classList.add('down'); });

  // Steering by turning the phone like a handlebar: how it's turned now, and
  // how it was held when the race started (or carried on), which counts as
  // straight ahead.
  var phone = { at: null, from: 0 };
  window.addEventListener('deviceorientation', function(e){
    if (e.beta === null || e.gamma === null) return;
    var angle = screen.orientation ? screen.orientation.angle : window.orientation || 0;
    phone.at = S.turned(e.beta, e.gamma, angle);
  });
  function level(){ if (phone.at !== null) phone.from = phone.at; }
  // iPhones only report how they're turned once the player allows it, asked
  // on a press. Refused, steering goes back to dragging (which works either
  // way: a finger on the screen steers too).
  function askTilt(){
    var D = window.DeviceOrientationEvent;
    if (!D || typeof D.requestPermission !== 'function') return;
    D.requestPermission().then(function(answer){ if (answer === 'denied') setSteer('drag'); }, function(){});
  }
  function setSteer(how){
    career.steer = how;
    keepCareer();
    showSteer();
  }
  function showSteer(){
    [].forEach.call($('steerPick').querySelectorAll('[role=radio]'), function(b){ b.setAttribute('aria-checked', b.getAttribute('data-steer') === career.steer ? 'true' : 'false'); });
    $('steerHow').textContent = career.steer === 'tilt' ? 'tilt' : 'drag';
    $('steerBtn').textContent = career.steer === 'tilt' ? 'Steering: tilt' : 'Steering: drag';
  }
  [].forEach.call($('steerPick').querySelectorAll('[role=radio]'), function(b){
    b.addEventListener('click', function(){
      setSteer(b.getAttribute('data-steer'));
      if (career.steer === 'tilt') askTilt();
    });
  });
  $('steerBtn').addEventListener('click', function(){
    setSteer(career.steer === 'tilt' ? 'drag' : 'tilt');
    if (career.steer === 'tilt') askTilt();
  });
  showSteer();

  startBtn.addEventListener('click', startOrResume);
  // From the pause screen: the race again from the grid.
  newBtn.addEventListener('click', function(){
    A.stop();
    var w = F.create(world.race, world.bike);
    pausedFrom = null;
    go(w);
  });

  // ---------- The garage ----------
  function radio(group, label, on, pick, disabled){
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', pick);
    group.appendChild(b);
    return b;
  }
  function showGarage(){
    $('garagePoints').textContent = Lang.t('{points} points', { points: career.points });
    var list = $('bikes');
    list.textContent = '';
    F.BIKES.forEach(function(B, i){
      var n = i + 1, li = document.createElement('li'), name = document.createElement('b'), info = document.createElement('span'), b = document.createElement('button');
      name.textContent = Lang.t(B.name);
      info.textContent = Lang.t('Top speed {speed} km/h', { speed: Math.round(B.top * 3.6) });
      b.type = 'button';
      b.className = 'btn ' + (career.ride === n ? 'btn-primary' : 'btn-ghost');
      if (career.owned.indexOf(n) >= 0) {
        b.textContent = career.ride === n ? 'Riding' : 'Ride';
        b.setAttribute('aria-pressed', career.ride === n ? 'true' : 'false');
        b.addEventListener('click', function(){ career.ride = n; keepCareer(); showGarage(); });
      } else {
        b.textContent = Lang.t('Buy for {price}', { price: B.price });
        b.disabled = career.points < B.price;
        b.addEventListener('click', function(){
          if (!F.buy(career, n)) return;
          sound.play('buy');
          career.ride = n;
          career.race = nextRace(career);
          keepCareer();
          showGarage();
        });
      }
      li.appendChild(name); li.appendChild(info); li.appendChild(b);
      list.appendChild(li);
    });
    var riders = $('riders');
    riders.textContent = '';
    RIDERS.forEach(function(r, i){
      var b = radio(riders, Lang.t(r), career.rider === i, function(){ career.rider = i; keepCareer(); showGarage(); });
      var sw = document.createElement('i');
      sw.style.background = SWATCHES[i];
      b.insertBefore(sw, b.firstChild);
    });
    var races = $('races');
    races.textContent = '';
    for (var r = 1; r <= F.LEVELS.length * F.RACES; r++) (function(r){
      var b = radio(races, Lang.num(r), career.race === r, function(){ career.race = r; keepCareer(); showGarage(); }, !F.open(career, r));
      if (career.done.indexOf(r) >= 0) b.classList.add('done');
      b.title = Lang.t(ROUTES[F.levelOf(r) - 1]);
    })(r);
    showSettings();
  }
  function showSettings(){
    $('viewBtn').textContent = career.view === 'rider' ? 'Camera: rider' : 'Camera: behind';
    $('qualityBtn').textContent = career.quality === 'low' ? 'Graphics: low' : 'Graphics: high';
  }
  garageBtn.addEventListener('click', function(){ overlay.hidden = true; garage.hidden = false; showGarage(); garage.scrollTop = 0; });
  $('garageDone').addEventListener('click', function(){
    garage.hidden = true;
    menu();
  });
  $('viewBtn').addEventListener('click', toggleView);
  // The graphics take effect from the next page load: the renderer is made once.
  $('qualityBtn').addEventListener('click', function(){
    career.quality = career.quality === 'low' ? 'high' : 'low';
    keepCareer();
    showSettings();
  });

  // ---------- A quick race ----------
  function showQuick(){
    var routes = $('routes'), bikes = $('quickBikes');
    routes.textContent = ''; bikes.textContent = '';
    ROUTES.forEach(function(r, i){ radio(routes, Lang.t(r), quickPick.level === i + 1, function(){ quickPick.level = i + 1; showQuick(); }); });
    F.BIKES.forEach(function(B, i){ radio(bikes, Lang.t(B.name), quickPick.bike === i + 1, function(){ quickPick.bike = i + 1; showQuick(); }); });
  }
  quickBtn.addEventListener('click', function(){ overlay.hidden = true; quick.hidden = false; showQuick(); quick.scrollTop = 0; });
  $('quickBack').addEventListener('click', function(){ quick.hidden = true; menu(); });
  $('quickGo').addEventListener('click', function(){ mode = 'quick'; go(quickWorld()); });

  // The start card, with the career's next race behind it.
  function menu(){
    state = 'idle'; pausedFrom = null;
    mode = 'career';
    ovKicker.textContent = 'bdnix arcade';
    ovTitle.textContent = 'King of Streets';
    ovText.textContent = 'Race motorbikes through Dhaka. Punch, kick and swing at your rivals, kick CNGs out of your way, and win points to buy faster bikes.';
    ovCareer.textContent = failed ? '' : summary();
    startBtn.textContent = 'Start game';
    newBtn.hidden = true;
    overlay.hidden = false;
    hud.hidden = true;
    var w = careerWorld();
    if (!world || world.race !== w.race || world.bike !== w.bike || world.time) world = w;
    updateHud();
    stale = true;
  }

  // ---------- Drawing ----------
  function size(){
    if (view) view.resize(board.clientWidth || window.innerWidth, board.clientHeight || window.innerHeight);
    stale = true;
  }
  // With ?fps in the address: frames a second, and how sharp the picture
  // is drawn, in the corner, for checking how smoothly a phone plays.
  var meter = /[?&]fps\b/.test(location.search) ? document.createElement('p') : null, ticks = 0, since = 0;
  if (meter) { meter.className = 'fps'; meter.setAttribute('translate', 'no'); gameEl.appendChild(meter); }
  function count(now){
    ticks++;
    if (now - since < 1000) return;
    var st = view && view.scene ? view.stats() : null;
    meter.textContent = Math.round(ticks * 1000 / (now - since)) + ' fps' + (st ? ' · ' + st.pixels + '× · ' + st.calls + ' calls · ' + Math.round(st.triangles / 1000) + 'k tris' : '');
    ticks = 0; since = now;
  }
  var last = performance.now();
  function loop(now){
    if (meter) count(now);
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    // A knockout plays out slowly for a moment.
    if (slow > 0) { slow -= dt; dt *= 0.35; }
    update(dt);
    // The scene is drawn while anything moves; under a card it's drawn once.
    var moving = state === 'ready' || state === 'playing' || state === 'finishing' || state === 'down';
    if (view && world && staged === world && (moving || stale)) {
      view.frame(world, moving ? dt : 0);
      stale = false;
    }
    requestAnimationFrame(loop);
  }
  // The browser can't draw the game: say so, and offer nothing to start.
  function fail(){
    failed = true;
    loadingEl.hidden = true;
    ovTitle.textContent = 'King of Streets';
    ovText.textContent = 'This game needs 3D graphics (WebGL 2), which this browser can’t show.';
    ovCareer.textContent = '';
    startBtn.disabled = true;
    garageBtn.disabled = true;
    quickBtn.disabled = true;
    overlay.hidden = false;
  }

  window.addEventListener('resize', size);
  var saved = window.bdnixSave.load('kingofstreets');
  if (!(saved && restore(saved))) {
    if (saved) window.bdnixSave.clear('kingofstreets');
    menu();
  }
  if (!G.supported()) fail();
  else G.start(board, { quality: career.quality }).then(function(v){
    view = v;
    size();
    // A race picked up from a save, or one started already: its city now.
    if (state !== 'idle') stage(world);
  }, fail);
  requestAnimationFrame(loop);
})();
