// King of Streets rules: the routes, the bikes, the traffic, the fighting, the
// race and the career. No DOM, so it can be unit tested; street.js runs the
// game and street-3d.js draws it. Distances along the road (z) are in metres
// from the start line; across it (x), in metres from its middle, the road
// reaching ROAD to either side and the footpath beyond it, up to EDGE. Times
// are in seconds, speeds in metres a second. Everything about a race (its
// road, its traffic and who rides in it) follows from its number, so a race in
// progress saves as a few numbers.
(function(){
  var SEG = 5;                          // metres of road per segment
  var STEP = 1 / 60;                    // the rules run in steps of this many seconds
  var ROAD = 7;                         // metres from the middle of the road to its kerb
  var EDGE = 10.5;                      // how far out a bike can go, footpath included
  var WALL = 6.6;                       // how far out a bike can go between barriers (a flyover, a railing)
  var LANES = [-5.25, -1.75, 1.75, 5.25];
  var KERB_TOP = 14;                    // top speed on the footpath
  var BRAKE = 24;                       // metres a second lost per second of braking
  var DRIFT = 4.5;                      // how hard a bend pushes a bike outwards at top speed, metres a second
  var HEALTH = 100;
  var CRASH_TIME = 2.2, CRASH_HURT = 20; // how long a crash keeps you off the bike, and what it costs
  var SAFE_TIME = 1.5;                  // after a crash nothing can hit you for this long
  var PLACE_POINTS = [1000, 600, 300];  // for finishing first, second and third
  var KO_POINTS = 100;                  // for knocking a rival off their bike
  var UNDERDOG = 1000;                  // for winning on a bike below the race's level
  var RACES = 3;                        // races at each level
  var RUN_OUT = 600;                    // metres of road past the finish line

  // The five bikes, from the scooter a career starts on to the fastest:
  // top speed, how quickly they close on it (a share of the gap a second),
  // how fast they steer (metres a second at full lock), how well they hold
  // a bend (1 doesn't drift at all) and their price.
  var BIKES = [
    { id: 'k1_vino',   name: 'Scooter',   top: 25,   accel: 0.32, steer: 6.5, grip: 0.55, price: 0 },
    { id: 'k2_125',    name: '125',       top: 32,   accel: 0.36, steer: 7,   grip: 0.62, price: 1500 },
    { id: 'k3_pulsar', name: 'Street 135', top: 37.5, accel: 0.42, steer: 7.5, grip: 0.7,  price: 4000 },
    { id: 'k4_zx6r',   name: 'Sport 600', top: 50,   accel: 0.5,  steer: 8,   grip: 0.8,  price: 10000 },
    { id: 'k5_h2',     name: 'Hyper 1000', top: 64,  accel: 0.55, steer: 8,   grip: 0.78, price: 22500 }
  ];

  // The five levels: where they're raced, at what time of day, how busy the
  // road is (0 to 1) and what of it is raised (a flyover, an expressway or
  // bridges over a lake).
  var LEVELS = [
    { route: 'mirpur',     time: 'dawn',  traffic: 0.15, people: 0.15, raised: null },
    { route: 'old',        time: 'night', traffic: 0.35, people: 0.45, raised: null },
    { route: 'lake',       time: 'day',   traffic: 0.55, people: 1,    raised: 'bridge' },
    { route: 'flyover',    time: 'dusk',  traffic: 0.85, people: 1.6,  raised: 'flyover' },
    { route: 'expressway', time: 'rush',  traffic: 1,    people: 1.8,  raised: 'expressway' }
  ];
  // How high each kind of raised road goes, and how long its ramps are.
  var RAISED = { bridge: { h: 3, ramp: 40 }, flyover: { h: 7.5, ramp: 80 }, expressway: { h: 14, ramp: 140 } };

  // What each move does: how far it reaches across and ahead or behind
  // (metres), the damage, the shove it gives (metres a second), how long it
  // takes and when in it the blow lands. A weapon taken from a rival
  // replaces the punch.
  var MOVES = {
    punch:    { reach: 1.8, dmg: 10, push: 3,   time: 0.32, at: 0.12 },
    kick:     { reach: 2.5, dmg: 15, push: 9,   time: 0.55, at: 0.22 },
    stick:    { reach: 2.7, dmg: 20, push: 4.5, time: 0.45, at: 0.18 },
    chain:    { reach: 3,   dmg: 24, push: 4.5, time: 0.5,  at: 0.2 },
    nunchaku: { reach: 2.5, dmg: 28, push: 5.5, time: 0.42, at: 0.16 }
  };
  var AHEAD = 3, BEHIND = 2.5;          // a blow reaches a bike this far ahead or behind
  var WEAPONS = ['stick', 'chain', 'nunchaku'];
  var RIVAL_HURT = 0.5;                 // rivals' blows do this much of the damage yours do
  var BIKE_WIDE = 0.8;                  // two bikes closer than this across bump

  // The six rivals. How fast they are differs from race to race; how keen
  // they are to fight doesn't.
  var RIVALS = [
    { name: 'Kalu',  aggro: 0.3 },
    { name: 'Bablu', aggro: 0.8 },
    { name: 'Mintu', aggro: 0.5 },
    { name: 'Rocky', aggro: 0.6 },
    { name: 'Tinku', aggro: 0.9 },
    { name: 'Pinky', aggro: 0.4 }
  ];
  var SKILL = [0, 0.9, 1.8, 2.7, 3.6, 4.5]; // metres a second over the slowest
  var SPREAD = [0, 0, 1, -1, 0, 0];         // rivals' bikes, levels above or below the race's
  // Who carries what, in turn from race to race.
  var ARMS = [
    [null, 'stick', null, null, 'chain', null],
    [null, null, 'nunchaku', 'stick', null, 'chain'],
    ['chain', null, 'stick', null, 'nunchaku', null]
  ];

  // The road's traffic: how long and wide each is (metres) and how fast it
  // goes. Only a CNG can be kicked aside.
  var VEHICLES = {
    cng:   { len: 2.6, wide: 1.4, speed: 11 },
    car:   { len: 4.4, wide: 1.8, speed: 16 },
    bus:   { len: 11,  wide: 2.6, speed: 12 },
    truck: { len: 8,   wide: 2.5, speed: 10 }
  };
  var KINDS = ['cng', 'cng', 'cng', 'car', 'car', 'bus', 'truck'];
  var SHOVE = 6;                        // metres a second a kick sends a CNG sideways
  var PARKED_X = 6.25;                  // where CNGs wait at the kerb

  // A small seeded random number generator, so a race is the same every
  // time it's ridden.
  function seeded(seed){
    var s = seed >>> 0;
    return function(){
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }
  // A time left, a step later: exactly 0 once it's run out.
  function down(t){ return t - STEP > 1e-9 ? t - STEP : 0; }

  // Races are numbered 1 to 15: three at each level.
  function levelOf(race){ return clamp(Math.ceil(race / RACES), 1, LEVELS.length); }
  function level(race){ return LEVELS[levelOf(race) - 1]; }
  // How long each race is: longer as they go on.
  function raceLength(race){
    var n = (race - 1) % RACES;
    return 2000 + n * 400 + (levelOf(race) - 1) * 300;
  }

  // ---------- The road ----------
  // A race's road, made once: for each segment its bend (curve, negative to
  // the left) and what stands beside it (scenery: { kind, x }); the raised
  // stretches (raised: { z0, z1, h, ramp, kind }); and where barriers, not
  // kerbs, edge the road (a lake's railing on the left of the lake route).
  // Poles and trees stand on the footpath, where a bike can hit them.
  var tracks = {};
  function track(race){
    if (tracks[race]) return tracks[race];
    var r = seeded(race * 7919 + 13), L = level(race);
    var length = raceLength(race);
    var n = Math.ceil((length + RUN_OUT) / SEG);
    var curve = [], scenery = [], raised = [];
    var i, k;
    // A straight start, then bends and straights in turn: Dhaka's roads bend
    // gently.
    for (i = 0; i < 30 && i < n; i++) curve.push(0);
    while (curve.length < n) {
      var len = 30 + Math.floor(r() * 40);
      var bend = r() < 0.4 ? 0 : (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.5);
      for (k = 0; k < len && curve.length < n; k++) curve.push(bend * Math.sin(Math.PI * k / len));
    }
    // The raised stretches: two bridges over the lake, a flyover in the
    // middle of the race, or the expressway nearly all the way.
    var R = L.raised && RAISED[L.raised];
    if (L.raised === 'bridge') {
      raised.push({ z0: length * 0.25, z1: length * 0.25 + 160, h: R.h, ramp: R.ramp, kind: 'bridge' });
      raised.push({ z0: length * 0.65, z1: length * 0.65 + 200, h: R.h, ramp: R.ramp, kind: 'bridge' });
    } else if (L.raised === 'flyover') {
      raised.push({ z0: length * 0.3, z1: length * 0.3 + 900, h: R.h, ramp: R.ramp, kind: 'flyover' });
    } else if (L.raised === 'expressway') {
      raised.push({ z0: 250, z1: length + RUN_OUT, h: R.h, ramp: R.ramp, kind: 'expressway' });
    }
    var T = { race: race, length: length, n: n, curve: curve, raised: raised, scenery: scenery, lake: L.route === 'lake' };
    for (i = 0; i < n; i++) {
      var things = [], z = i * SEG, up = heightAt(T, z) > 0.5 || heightAt(T, z + SEG) > 0.5;
      // Concrete poles every 30 metres, on alternate sides, and shade trees
      // here and there, on the footpath, but not up on a raised road.
      if (!up && i % 6 === 0 && !(T.lake && i % 12 === 0)) things.push({ kind: 'pole', x: (i % 12 ? 1 : -1) * 7.6 });
      if (!up && i % 8 === 4 && r() < 0.5) {
        var side = T.lake ? 1 : r() < 0.5 ? -1 : 1;
        things.push({ kind: 'tree', x: side * (9 + r() * 0.8) });
      }
      // A mosque every few hundred metres, set back from the road.
      if (i % 60 === 30 && r() < 0.7) things.push({ kind: 'mosque', x: (T.lake ? 1 : r() < 0.5 ? -1 : 1) * 12 });
      scenery.push(things);
    }
    tracks[race] = T;
    return T;
  }
  function segIndex(T, z){ return clamp(Math.floor(z / SEG), 0, T.n - 1); }
  // How high the road is at z: 0 on the ground, up a ramp onto a raised
  // stretch and down again at its end.
  function heightAt(T, z){
    for (var i = 0; i < T.raised.length; i++) {
      var s = T.raised[i];
      if (z <= s.z0 - s.ramp || z >= s.z1 + s.ramp) continue;
      var t = z < s.z0 ? (z - (s.z0 - s.ramp)) / s.ramp : z > s.z1 ? ((s.z1 + s.ramp) - z) / s.ramp : 1;
      return s.h * (1 - Math.cos(Math.PI * t)) / 2;
    }
    return 0;
  }
  // How far out a bike can go at z on each side ([left, right], left as a
  // negative x): to the footpath's edge, or to a barrier.
  function limits(T, z){
    if (heightAt(T, z) > 0.5) return [-WALL, WALL];
    return [T.lake ? -WALL : -EDGE, EDGE];
  }
  // Whether x at z is off the road: on the footpath.
  function offRoad(x){ return Math.abs(x) > ROAD; }

  // ---------- Traffic ----------
  // A race's traffic, made once: each vehicle starts at z0 in its lane and
  // drives on at its own speed, so where it is follows from the race's time
  // alone (at(v, time)), until a kick shoves a CNG aside (see shoved). CNGs
  // wait at the kerb too (speed 0, parked), on the ground but not on a raised
  // road.
  var traffics = {};
  function traffic(race){
    if (traffics[race]) return traffics[race];
    var r = seeded(race * 104729 + 7), list = [], T = track(race), L = level(race);
    var gap = 22 / Math.max(0.1, L.traffic), z, v, kind;
    for (z = 160; z < T.length + 400; z += gap * (0.55 + r() * 0.9)) {
      kind = KINDS[Math.floor(r() * KINDS.length)];
      v = VEHICLES[kind];
      // Slower at rush hour.
      var slow = L.traffic >= 0.8 ? 0.75 : 1;
      list.push({ id: list.length, kind: kind, x: LANES[Math.floor(r() * LANES.length)], z0: z, speed: v.speed * slow * (0.85 + r() * 0.3), len: v.len, half: v.wide / 2, parked: false, tint: Math.floor(r() * 4) });
    }
    for (z = 120; z < T.length; z += 140 + r() * 260) {
      if (heightAt(T, z) > 0 || heightAt(T, z + 12) > 0) continue;
      var side = T.lake ? 1 : r() < 0.5 ? -1 : 1, count = 1 + Math.floor(r() * 3);
      for (var k = 0; k < count; k++) list.push({ id: list.length, kind: 'cng', x: side * PARKED_X, z0: z + k * 2.9, speed: 0, len: VEHICLES.cng.len, half: VEHICLES.cng.wide / 2, parked: true, tint: Math.floor(r() * 4) });
    }
    traffics[race] = list;
    return list;
  }
  function at(v, time){ return v.z0 + v.speed * time; }
  // Where vehicle v is now, shoved or not: { z, x }.
  function where(w, v){
    var s = w.shoved[v.id];
    return s ? { z: s.z, x: s.x } : { z: at(v, w.time), x: v.x };
  }
  // The vehicles near z (within `range` metres), where they are now.
  function nearby(w, z, range){
    var out = [], list = traffic(w.race);
    for (var i = 0; i < list.length; i++) {
      var v = list[i], o = where(w, v);
      if (Math.abs(o.z - z) < range) out.push({ id: v.id, kind: v.kind, z: o.z, x: o.x, half: v.half, len: v.len, speed: w.shoved[v.id] ? w.shoved[v.id].speed : v.speed });
    }
    return out;
  }
  // A kick sends a CNG sideways, away from the kicker (side: -1 or 1); it
  // slows to a stop, at the kerb if it gets there, and stays.
  function shove(w, v, side){
    var o = where(w, v), s = w.shoved[v.id];
    if (!s) s = w.shoved[v.id] = { z: o.z, x: o.x, vx: 0, speed: v.speed };
    s.vx = side * SHOVE;
    s.speed = Math.min(s.speed, 6);
    w.events.push({ type: 'shove', car: v.id });
  }
  function moveShoved(w){
    var T = track(w.race);
    for (var id in w.shoved) {
      var s = w.shoved[id], lim = limits(T, s.z), half = VEHICLES.cng.wide / 2;
      s.speed = Math.max(0, s.speed - 4 * STEP);
      s.z += s.speed * STEP;
      s.x += s.vx * STEP;
      s.vx *= Math.max(0, 1 - 0.8 * STEP);
      // Up against the kerb (or a barrier): it stops there.
      var edge = Math.min(Math.abs(lim[s.x < 0 ? 0 : 1]), ROAD + 0.6) - half;
      if (Math.abs(s.x) > edge) { s.x = (s.x < 0 ? -1 : 1) * edge; s.vx = 0; }
    }
  }

  // ---------- A race ----------
  // The rivals of a race, on the grid ahead of the player, who starts last,
  // on bikes of about the race's level.
  function rivals(race){
    var r = seeded(race * 31 + 3), tops = SKILL.slice(), arms = ARMS[(race - 1) % ARMS.length], lv = levelOf(race);
    for (var i = tops.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), s = tops[i];
      tops[i] = tops[j]; tops[j] = s;
    }
    var max = 40 + (lv - 1) * 8 + ((race - 1) % RACES) * 3;
    return RIVALS.map(function(d, i){
      var b = clamp(lv + SPREAD[i], 1, BIKES.length);
      return {
        id: i, name: d.name, aggro: d.aggro, bike: b,
        top: BIKES[b - 1].top * 0.9 + tops[i] + ((race - 1) % RACES) * 0.6,
        max: max, health: max, weapon: arms[i],
        z: 8 + i * 6, x: i % 2 ? 2 : -2, speed: 0, push: 0,
        attack: null, cool: 1.5, down: 0, place: 0
      };
    });
  }

  // A new race: its number (1 to 15) and the level of the bike the player
  // rides (that of the race's level if none).
  function create(race, bike){
    race = clamp(Math.floor(race) || 1, 1, LEVELS.length * RACES);
    bike = clamp(Math.floor(bike) || levelOf(race), 1, BIKES.length);
    return {
      race: race, bike: bike, level: levelOf(race), length: raceLength(race),
      time: 0,                  // seconds since the start
      score: 0,                 // points won this race
      player: { z: 0, x: 0, speed: 0, health: HEALTH, weapon: null, push: 0, attack: null, crash: 0, safe: 0, lean: 0 },
      rivals: rivals(race),
      shoved: {},               // CNGs kicked aside: { id: { z, x, vx, speed } }
      finished: 0,              // how many have crossed the line
      place: 0,                 // where the player finished, once they have
      over: null,               // how the race ended early: 'ko' (knocked out)
      input: { steer: 0, brake: false },
      events: []                // what happened since the last look, for sounds and effects
    };
  }

  // The player's move with whatever they hold: a weapon replaces the punch.
  function moveFor(p, move){ return move === 'punch' && p.weapon ? p.weapon : move; }

  // Whom a blow from a bike at (z, x) with `reach` would land on: the
  // closest one in reach, or null.
  function target(list, z, x, reach){
    var best = null, d = Infinity;
    for (var i = 0; i < list.length; i++) {
      var o = list[i], dz = o.z - z, dx = Math.abs(o.x - x);
      if (o.down || o.place || dz > AHEAD || dz < -BEHIND || dx > reach) continue;
      var dist = dx + Math.abs(dz) / 10;
      if (dist < d) { d = dist; best = o; }
    }
    return best;
  }
  // The vehicle beside a bike at (z, x) that a kick with `reach` would land
  // on: the closest, or null.
  function vehicleBeside(w, z, x, reach){
    var best = null, d = Infinity, list = nearby(w, z, 20);
    for (var i = 0; i < list.length; i++) {
      var c = list[i], dx = Math.abs(c.x - x) - c.half;
      if (Math.abs(c.z - z) > c.len / 2 + 0.5 || dx > reach || dx < 0) continue;
      if (dx < d) { d = dx; best = c; }
    }
    return best;
  }

  // Starts one of the player's moves ('punch' or 'kick'). Returns whether
  // it started: it doesn't while another is under way, off the bike or
  // after the finish.
  function attack(w, move){
    var p = w.player;
    if (w.over || w.place || p.crash || p.attack || (move !== 'punch' && move !== 'kick')) return false;
    var m = moveFor(p, move), aim = target(w.rivals, p.z, p.x, MOVES[m].reach + 1.5);
    var car = !aim && move === 'kick' ? vehicleBeside(w, p.z, p.x, MOVES.kick.reach) : null;
    p.attack = { move: m, t: 0, side: aim ? (aim.x < p.x ? -1 : 1) : car ? (car.x < p.x ? -1 : 1) : (p.lean < 0 ? -1 : 1), done: false };
    w.events.push({ type: 'swing', move: m });
    return true;
  }

  function hurtPlayer(w, dmg){
    var p = w.player;
    p.health = Math.max(0, p.health - dmg);
    if (p.health > 0) return;
    // Out cold: off the bike for good.
    w.over = 'ko';
    p.crash = CRASH_TIME;
    p.attack = null;
    w.events.push({ type: 'out' });
  }
  function crash(w, what){
    var p = w.player;
    p.crash = CRASH_TIME;
    p.attack = null;
    p.weapon = null;              // dropped in the fall
    w.events.push({ type: 'crash', what: what });
    hurtPlayer(w, CRASH_HURT);
  }

  // The player's blow lands, on whoever is in reach as it does; a kick with
  // no rival in reach lands on a vehicle beside: a CNG goes flying, anything
  // bigger doesn't budge.
  function land(w){
    var p = w.player, a = p.attack, m = MOVES[a.move];
    var o = target(w.rivals, p.z, p.x, m.reach);
    a.done = true;
    if (!o) {
      var c = a.move === 'kick' ? vehicleBeside(w, p.z, p.x, m.reach) : null;
      if (!c) return;
      a.side = c.x < p.x ? -1 : 1;
      if (c.kind === 'cng') shove(w, traffic(w.race)[c.id], a.side);
      else w.events.push({ type: 'clang', car: c.id });
      return;
    }
    var side = o.x < p.x ? -1 : 1;
    a.side = side;
    o.health = Math.max(0, o.health - m.dmg);
    o.push += side * m.push;
    o.speed *= a.move === 'kick' ? 0.85 : 0.93;
    w.events.push({ type: 'hit', move: a.move, rival: o.id });
    if (o.health > 0) return;
    // Knocked off: the rival is out of the race, and their weapon is yours.
    o.down = STEP;
    o.attack = null;
    w.score += KO_POINTS;
    w.events.push({ type: 'ko', rival: o.id, weapon: o.weapon });
    if (o.weapon) { p.weapon = o.weapon; o.weapon = null; }
  }

  // A rival's turn: keep up, keep clear of traffic, kick CNGs out of the
  // way, pick fights.
  function rival(w, o, T, cars){
    var p = w.player, dz = p.z - o.z, dx = p.x - o.x, i, c;
    o.cool = down(o.cool);
    if (o.down) {
      // Sliding to a stop where they fell.
      o.down += STEP;
      o.speed = Math.max(0, o.speed - 25 * STEP);
      o.z += o.speed * STEP;
      o.push = 0;
      return;
    }
    var aim = o.top;
    // Those far behind catch up a little, those far ahead ease off.
    if (dz > 120) aim += 4;
    else if (dz < -150) aim -= 3;
    var fighting = !w.place && !o.place && !p.crash && Math.abs(dz) < 8 && o.aggro >= 0.5;
    if (fighting) aim = Math.min(aim, p.speed + (dz > 0 ? 3 : -1));
    // Each rival keeps to a line of their own, changing it every 150 metres
    // or so, and moves over for the player when they want a fight.
    var line = Math.sin(o.id * 12.9898 + Math.floor(o.z / 150) * 78.233) * 4;
    if (fighting) line = p.x + (o.x < p.x ? -1.4 : 1.4);
    // Out of the way of traffic ahead, or a CNG kicked out of the way.
    for (i = 0; i < cars.length; i++) {
      c = cars[i];
      var ahead = c.z - o.z;
      if (ahead > 0 && ahead < 40 && Math.abs(c.x - o.x) < c.half + 1) {
        line = c.x + (c.x > 0 ? -1 : 1) * (c.half + 1.4);
        if (ahead < 12) aim = Math.min(aim, c.speed + 4);
        break;
      }
    }
    o.speed += (aim - o.speed) * 0.4 * STEP * (aim < o.speed ? 3 : 1);
    o.x += clamp(line - o.x, -6, 6) * 1.2 * STEP + o.push * STEP;
    o.push *= Math.max(0, 1 - 4 * STEP);
    o.x = clamp(o.x, -ROAD + 0.6, ROAD - 0.6);
    o.z += o.speed * STEP;
    // Into a vehicle anyway: thrown back, not out.
    for (i = 0; i < cars.length; i++) {
      c = cars[i];
      if (Math.abs(c.z - o.z) < c.len / 2 + 0.8 && Math.abs(c.x - o.x) < c.half + 0.35 && o.speed > c.speed) {
        o.speed = c.speed * 0.5;
        o.push += c.x > o.x ? -7 : 7;
      }
    }
    if (!o.place && o.z >= w.length) o.place = ++w.finished;

    // Fighting: the player, or a CNG in the way.
    if (o.attack) {
      o.attack.t += STEP;
      var m = MOVES[o.attack.move];
      if (!o.attack.done && o.attack.t >= m.at) {
        o.attack.done = true;
        if (o.attack.car != null) {
          var cng = traffic(w.race)[o.attack.car], at2 = where(w, cng);
          if (Math.abs(at2.z - o.z) < cng.len / 2 + 1 && Math.abs(at2.x - o.x) - cng.half < MOVES.kick.reach) shove(w, cng, at2.x < o.x ? -1 : 1);
        } else {
          dz = p.z - o.z; dx = p.x - o.x;
          if (!p.crash && !p.safe && !w.over && dz < BEHIND && dz > -AHEAD && Math.abs(dx) < m.reach) {
            p.push += (dx < 0 ? -1 : 1) * m.push;
            w.events.push({ type: 'hurt', move: o.attack.move, rival: o.id });
            hurtPlayer(w, Math.round(m.dmg * RIVAL_HURT));
          }
        }
      }
      if (o.attack.t >= m.time) o.attack = null;
    } else if (!o.cool && !o.place && o.aggro >= 0.5) {
      // A CNG right beside a keen rival gets a kick.
      for (i = 0; i < cars.length; i++) {
        c = cars[i];
        if (c.kind !== 'cng' || w.shoved[c.id] || Math.abs(c.z - o.z) > c.len / 2 + 0.5) continue;
        var gap = Math.abs(c.x - o.x) - c.half;
        if (gap > 0 && gap < MOVES.kick.reach) {
          o.attack = { move: 'kick', t: 0, side: c.x < o.x ? -1 : 1, done: false, car: c.id };
          o.cool = 2;
          break;
        }
      }
    }
    if (!o.attack && !o.cool && !w.place && !o.place && !w.over && !p.crash && !p.safe && dz < BEHIND && dz > -AHEAD) {
      // A keen rival kicks from further off than a fist reaches.
      var move = o.weapon || (o.aggro > 0.5 && Math.abs(dx) > 1.5 ? 'kick' : 'punch');
      if (Math.abs(dx) < MOVES[move].reach) o.attack = { move: move, t: 0, side: dx < 0 ? -1 : 1, done: false };
      if (o.attack) o.cool = 2.8 - o.aggro * 1.2 - Math.min(0.5, (w.race - 1) * 0.03);
    }
  }

  // One step of the race.
  function step(w){
    var T = track(w.race), p = w.player, input = w.input, B = BIKES[w.bike - 1], i;
    w.time += STEP;
    moveShoved(w);
    var cars = nearby(w, p.z, 300);
    var seg = segIndex(T, p.z), lim = limits(T, p.z);
    p.safe = down(p.safe);
    if (p.crash || w.over === 'ko') {
      // Off the bike, sliding to a stop, then back on in the road.
      p.speed = Math.max(0, p.speed - 30 * STEP);
      p.crash = down(p.crash);
      if (!p.crash && !w.over) {
        p.x = clamp(p.x, -ROAD + 1, ROAD - 1);
        p.speed = 0;
        p.push = 0;
        p.safe = SAFE_TIME;
      }
      p.lean = 0;
    } else {
      var top = w.place ? Math.min(B.top, 20) : offRoad(p.x) ? KERB_TOP : B.top;
      if (input.brake && !w.place) p.speed = Math.max(0, p.speed - BRAKE * STEP);
      else p.speed += (top - p.speed) * B.accel * STEP * (top < p.speed ? 4 : 1);
      var steer = w.place ? 0 : clamp(+input.steer || 0, -1, 1);
      var hold = Math.min(1, p.speed / 8);
      p.x += steer * B.steer * STEP * hold;
      // A bend pushes the bike outwards, more at speed and on a bike that
      // holds the road less well. Past the line it keeps to the road.
      if (!w.place) p.x -= T.curve[seg] * DRIFT * (1 - B.grip) * 2 * (p.speed / B.top) * (p.speed / B.top) * STEP;
      p.lean += (steer - p.lean) * Math.min(1, 10 * STEP);
    }
    p.x += p.push * STEP;
    p.push *= Math.max(0, 1 - 4 * STEP);
    // A barrier stops the bike and scrapes some speed off.
    if (p.x < lim[0] || p.x > lim[1]) {
      p.x = clamp(p.x, lim[0], lim[1]);
      if (lim[1] === WALL || lim[0] === -WALL) {
        p.push = 0;
        if (!p.crash && p.speed > 8) { p.speed *= 1 - 1.5 * STEP; if (!w.events.some(function(e){ return e.type === 'scrape'; })) w.events.push({ type: 'scrape' }); }
      }
    }
    p.z += p.speed * STEP;

    if (p.attack) {
      p.attack.t += STEP;
      if (!p.attack.done && p.attack.t >= MOVES[p.attack.move].at) land(w);
      if (p.attack && p.attack.t >= MOVES[p.attack.move].time) p.attack = null;
    }

    // Each rival sees the traffic around them.
    for (i = 0; i < w.rivals.length; i++) rival(w, w.rivals[i], T, w.rivals[i].down ? [] : nearby(w, w.rivals[i].z, 60));

    if (!p.crash && !w.over) {
      // Bikes side by side bump each other apart.
      w.rivals.forEach(function(o){
        if (o.down || o.place || Math.abs(o.z - p.z) > 1.6 || Math.abs(o.x - p.x) > BIKE_WIDE) return;
        var side = o.x < p.x ? 1 : -1;
        p.push += side * 4; o.push -= side * 4;
        w.events.push({ type: 'bump' });
      });
      if (!p.safe) {
        // Into a vehicle (moving, parked or kicked aside), or a pole or a
        // tree on the footpath.
        for (i = 0; i < cars.length; i++) {
          var c = cars[i];
          if (p.speed > c.speed + 1 && Math.abs(c.z - p.z) < c.len / 2 + 0.8 && Math.abs(c.x - p.x) < c.half + 0.35) { crash(w, c.kind); break; }
        }
        if (!p.crash && offRoad(p.x)) {
          for (var s = seg; s <= seg + 1 && s < T.n; s++) {
            T.scenery[s].forEach(function(o){
              if (p.crash || (o.kind !== 'pole' && o.kind !== 'tree')) return;
              if (Math.abs(s * SEG - p.z) < 1 && Math.abs(o.x - p.x) < 0.6) crash(w, o.kind);
            });
          }
        }
      }
    }

    // The finish line.
    if (!w.place && !w.over && p.z >= w.length) {
      w.place = ++w.finished;
      w.events.push({ type: 'finish', place: w.place });
      if (w.place <= PLACE_POINTS.length) w.score += PLACE_POINTS[w.place - 1];
      if (w.place === 1 && w.bike < w.level) w.score += UNDERDOG;
    }
  }

  // Runs whole steps for `dt` seconds. `carry` is the time left over from
  // the last call; returns the new carry.
  function advance(w, dt, carry){
    var t = (carry || 0) + dt;
    // A hair's leeway, so time adding up to a whole step in pieces makes one.
    while (t >= STEP - 1e-9) { t -= STEP; step(w); }
    return Math.max(0, t);
  }

  // Where the player is in the race right now: 1 for first.
  function position(w){
    if (w.place) return w.place;
    var ahead = 0;
    w.rivals.forEach(function(o){ if (o.place || (!o.down && o.z > w.player.z)) ahead++; });
    return ahead + 1;
  }

  // ---------- The career ----------
  // A new career: no points, the scooter, and only the first level's races
  // open. Bikes are kept once bought.
  function career(){ return { points: 0, owned: [1], done: [] }; }
  // The best bike owned opens its level's races and those below.
  function best(c){ return Math.max.apply(null, c.owned); }
  function open(c, race){ return levelOf(race) <= best(c); }
  // Buys bike `b` if it isn't owned and there are the points for it.
  function buy(c, b){
    if (c.owned.indexOf(b) >= 0 || !BIKES[b - 1] || c.points < BIKES[b - 1].price) return false;
    c.points -= BIKES[b - 1].price;
    c.owned.push(b);
    c.owned.sort(function(a, x){ return a - x; });
    return true;
  }
  // A finished race's points go to the career; a race finished in the top
  // three is marked done.
  function bank(c, w){
    c.points += w.score;
    if (w.place && w.place <= PLACE_POINTS.length && c.done.indexOf(w.race) < 0) { c.done.push(w.race); c.done.sort(function(a, x){ return a - x; }); }
  }
  // A career from storage, or a new one if it doesn't make sense.
  function careerFrom(s){
    var max = LEVELS.length * RACES;
    if (!s || typeof s !== 'object' || !whole(s.points, 0, 1e9) || !Array.isArray(s.owned) || !Array.isArray(s.done)) return career();
    var owned = s.owned.filter(function(b, i){ return whole(b, 1, BIKES.length) && s.owned.indexOf(b) === i; });
    var done = s.done.filter(function(r, i){ return whole(r, 1, max) && s.done.indexOf(r) === i; });
    if (owned.indexOf(1) < 0 || owned.length !== s.owned.length || done.length !== s.done.length) return career();
    return { points: s.points, owned: owned.sort(function(a, x){ return a - x; }), done: done.sort(function(a, x){ return a - x; }) };
  }

  // ---------- Saving ----------
  // A race in progress as plain JSON, and back.
  function snapshot(w){
    function attackOf(a){ return a && { move: a.move, t: a.t, side: a.side, done: a.done, car: a.car == null ? null : a.car }; }
    var p = w.player, shoved = {};
    for (var id in w.shoved) { var s = w.shoved[id]; shoved[id] = { z: s.z, x: s.x, vx: s.vx, speed: s.speed }; }
    return {
      race: w.race, bike: w.bike, time: w.time, score: w.score, finished: w.finished,
      player: { z: p.z, x: p.x, speed: p.speed, health: p.health, weapon: p.weapon, push: p.push, attack: attackOf(p.attack), crash: p.crash, safe: p.safe },
      rivals: w.rivals.map(function(o){
        return { z: o.z, x: o.x, speed: o.speed, health: o.health, weapon: o.weapon, push: o.push, attack: attackOf(o.attack), cool: o.cool, down: o.down, place: o.place };
      }),
      shoved: shoved
    };
  }
  function num(n){ return typeof n === 'number' && isFinite(n); }
  function between(n, lo, hi){ return num(n) && n >= lo && n <= hi; }
  function whole(n, lo, hi){ return between(n, lo, hi) && n === Math.floor(n); }
  function okAttack(a, moves, cars){
    return a === null || (!!a && moves.indexOf(a.move) >= 0 && between(a.t, 0, MOVES[a.move].time) && (a.side === -1 || a.side === 1) && typeof a.done === 'boolean' &&
      (a.car == null || (a.move === 'kick' && whole(a.car, 0, cars - 1))));
  }
  function okWeapon(x){ return x === null || WEAPONS.indexOf(x) >= 0; }
  // A world from a snapshot, or null if any of it doesn't make sense: every
  // field checked, and the race still under way (nobody's finished it but
  // rivals, who come in in order).
  function restore(s){
    if (!s || typeof s !== 'object' || !whole(s.race, 1, LEVELS.length * RACES) || !whole(s.bike, 1, BIKES.length) || !between(s.time, 0, 3600) || !whole(s.score, 0, 1e6)) return null;
    var w = create(s.race, s.bike), p = s.player, len = w.length, moves = ['punch', 'kick'].concat(WEAPONS), cars = traffic(s.race);
    if (!p || !between(p.z, 0, len) || !between(p.x, -EDGE, EDGE) || !between(p.speed, 0, 80) ||
        !between(p.health, 1, HEALTH) || !okWeapon(p.weapon) || !between(p.push, -40, 40) ||
        !okAttack(p.attack, moves, 0) || (p.attack && p.attack.move === 'punch' && p.weapon) ||
        !between(p.crash, 0, CRASH_TIME) || !between(p.safe, 0, SAFE_TIME)) return null;
    if (!Array.isArray(s.rivals) || s.rivals.length !== w.rivals.length || !whole(s.finished, 0, w.rivals.length)) return null;
    var places = [], i;
    for (i = 0; i < s.rivals.length; i++) {
      var o = s.rivals[i];
      if (!o || !between(o.z, 0, len + RUN_OUT) || !between(o.x, -ROAD, ROAD) || !between(o.speed, 0, 80) ||
          !between(o.health, 0, w.rivals[i].max) || !okWeapon(o.weapon) || !between(o.push, -40, 40) ||
          !okAttack(o.attack, moves, cars.length) || !between(o.cool, 0, 5) ||
          !between(o.down, 0, 3600) || !whole(o.place, 0, w.rivals.length)) return null;
      if ((o.health === 0) !== (o.down > 0) || (o.place && (o.z < len || o.down)) || (!o.place && !o.down && o.z >= len)) return null;
      if (o.place) places.push(o.place);
    }
    // Those who've finished came in first, second, and so on.
    places.sort(function(a, b){ return a - b; });
    if (places.length !== s.finished || places.some(function(n, k){ return n !== k + 1; })) return null;
    // Only CNGs get kicked aside, and they stay on the road or its kerb.
    if (!s.shoved || typeof s.shoved !== 'object' || Array.isArray(s.shoved)) return null;
    var shoved = {};
    for (var id in s.shoved) {
      var c = s.shoved[id], k = +id;
      if (!whole(k, 0, cars.length - 1) || String(k) !== id || cars[k].kind !== 'cng' || !c || !between(c.z, 0, len + RUN_OUT + 2000) ||
          !between(c.x, -EDGE, EDGE) || !between(c.vx, -SHOVE, SHOVE) || !between(c.speed, 0, 20)) return null;
      shoved[k] = { z: c.z, x: c.x, vx: c.vx, speed: c.speed };
    }
    w.time = s.time;
    w.score = s.score;
    w.finished = s.finished;
    w.shoved = shoved;
    w.player = { z: p.z, x: p.x, speed: p.speed, health: p.health, weapon: p.weapon, push: p.push, attack: p.attack && { move: p.attack.move, t: p.attack.t, side: p.attack.side, done: p.attack.done }, crash: p.crash, safe: p.safe, lean: 0 };
    s.rivals.forEach(function(o, k){
      var r = w.rivals[k];
      r.z = o.z; r.x = o.x; r.speed = o.speed; r.health = o.health; r.weapon = o.weapon; r.push = o.push;
      r.attack = o.attack && { move: o.attack.move, t: o.attack.t, side: o.attack.side, done: o.attack.done };
      if (o.attack && o.attack.car != null) r.attack.car = o.attack.car;
      r.cool = o.cool; r.down = o.down; r.place = o.place;
    });
    return w;
  }

  window.bdnixStreet = {
    SEG: SEG, STEP: STEP, ROAD: ROAD, EDGE: EDGE, WALL: WALL, LANES: LANES, KERB_TOP: KERB_TOP, HEALTH: HEALTH,
    CRASH_TIME: CRASH_TIME, CRASH_HURT: CRASH_HURT, SAFE_TIME: SAFE_TIME, PLACE_POINTS: PLACE_POINTS,
    KO_POINTS: KO_POINTS, UNDERDOG: UNDERDOG, RACES: RACES, RUN_OUT: RUN_OUT, MOVES: MOVES, AHEAD: AHEAD, BEHIND: BEHIND,
    WEAPONS: WEAPONS, RIVALS: RIVALS, VEHICLES: VEHICLES, RIVAL_HURT: RIVAL_HURT, BIKES: BIKES, LEVELS: LEVELS,
    RAISED: RAISED, PARKED_X: PARKED_X, SHOVE: SHOVE,
    seeded: seeded, levelOf: levelOf, level: level, raceLength: raceLength, track: track, segIndex: segIndex,
    heightAt: heightAt, limits: limits, offRoad: offRoad, traffic: traffic, at: at, where: where, nearby: nearby,
    create: create, attack: attack, step: step, advance: advance, position: position,
    career: career, best: best, open: open, buy: buy, bank: bank, careerFrom: careerFrom,
    snapshot: snapshot, restore: restore
  };
})();
