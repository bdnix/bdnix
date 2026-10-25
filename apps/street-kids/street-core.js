// Street Kids rules: the track, the bikes, the fighting and the race. No
// DOM, so it can be unit tested; street.js draws the race and handles input.
// Distances along the road (z) are in metres from the start line; across it
// (x), in half the road's width: 0 is its middle, -1 and 1 its edges, and
// beyond them the kerb, up to EDGE. Times are in seconds, speeds in metres a
// second. Everything about a race (its road, its traffic and who rides in it)
// follows from its number, so a race in progress saves as a few numbers.
(function(){
  var SEG = 5;                          // metres of road per segment
  var STEP = 1 / 60;                    // the rules run in steps of this many seconds
  var EDGE = 1.5;                       // how far out a bike can go, kerb included
  var TOP = 60;                         // the player's top speed (216 km/h)
  var KERB_TOP = 22;                    // top speed off the road
  var ACCEL = 0.35;                     // how quickly a bike closes on its top speed, per second
  var BRAKE = 28;                       // metres a second lost per second of braking
  var STEER = 1.7;                      // half-widths a second at full lock
  var DRIFT = 0.9;                      // how hard a bend pushes a bike outwards at top speed
  var HEALTH = 100;
  var CRASH_TIME = 2.2, CRASH_HURT = 20; // how long a crash keeps you off the bike, and what it costs
  var SAFE_TIME = 1.5;                  // after a crash nothing can hit you for this long
  var PLACE_POINTS = [1000, 600, 300];  // for finishing first, second and third
  var KO_POINTS = 100;                  // for knocking a rival off their bike
  var QUALIFY = 3;                      // finish in the top three to ride on
  var RUN_OUT = 1200;                   // metres of road drawn past the finish line

  // What each move does: how far it reaches across (half-widths) and ahead
  // or behind (metres), the damage, the shove it gives, how long it takes
  // and when in it the blow lands. A weapon taken from a rival replaces
  // the punch.
  var MOVES = {
    punch:    { reach: 0.36, dmg: 10, push: 0.6, time: 0.32, at: 0.12 },
    kick:     { reach: 0.5,  dmg: 15, push: 1.8, time: 0.55, at: 0.22 },
    stick:    { reach: 0.55, dmg: 20, push: 0.9, time: 0.45, at: 0.18 },
    chain:    { reach: 0.6,  dmg: 24, push: 0.9, time: 0.5,  at: 0.2 },
    nunchaku: { reach: 0.5,  dmg: 28, push: 1.1, time: 0.42, at: 0.16 }
  };
  var AHEAD = 3, BEHIND = 2.5;          // a blow reaches a bike this far ahead or behind
  var WEAPONS = ['stick', 'chain', 'nunchaku'];
  var RIVAL_HURT = 0.5;                 // rivals' blows do this much of the damage yours do

  // The six rivals. Their speed differs from race to race; how keen they
  // are to fight doesn't.
  var RIVALS = [
    { name: 'Kalu',  aggro: 0.3 },
    { name: 'Bablu', aggro: 0.8 },
    { name: 'Mintu', aggro: 0.5 },
    { name: 'Rocky', aggro: 0.6 },
    { name: 'Tinku', aggro: 0.9 },
    { name: 'Pinky', aggro: 0.4 }
  ];
  var SKILL = [0, 1.5, 3, 4.5, 6, 7.5]; // metres a second over the slowest
  // Who carries what, in turn from race to race.
  var ARMS = [
    [null, 'stick', null, null, 'chain', null],
    [null, null, 'nunchaku', 'stick', null, 'chain'],
    ['chain', null, 'stick', null, 'nunchaku', null]
  ];

  // The road's traffic, slowest first: how long and wide each is (metres)
  // and how fast it goes.
  var VEHICLES = {
    rickshaw: { len: 2.6, wide: 1.2, speed: 6 },
    cng:      { len: 2.8, wide: 1.4, speed: 11 },
    truck:    { len: 7,   wide: 2.4, speed: 13 },
    bus:      { len: 10,  wide: 2.5, speed: 15 },
    car:      { len: 4.4, wide: 1.8, speed: 17 }
  };
  var KINDS = ['rickshaw', 'cng', 'truck', 'bus', 'car'];
  var LANES = [-0.62, -0.2, 0.22, 0.6];
  var ROAD = 5;                         // metres from the middle of the road to its edge

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

  // How long each race is: longer as they go on.
  function raceLength(race){ return Math.min(4000, 2400 + (race - 1) * 300); }

  // ---------- The road ----------
  // A race's road, made once: for each segment its bend (curve, negative
  // to the left), the height of its start (y, metres) and what stands
  // beside it (scenery: { kind, x }, x beyond the kerb). Solid things (lamp
  // posts, palms, trees) stand on the kerb, where a bike can hit them.
  var tracks = {};
  function track(race){
    if (tracks[race]) return tracks[race];
    var r = seeded(race * 7919 + 13);
    var length = raceLength(race);
    var n = Math.ceil((length + RUN_OUT) / SEG);
    var curve = [], y = [], scenery = [];
    var i, k, h = 0;
    // A straight start, then bends and hills in turn.
    for (i = 0; i < 30 && i < n; i++) { curve.push(0); y.push(0); }
    while (curve.length < n) {
      var len = 25 + Math.floor(r() * 40);
      var bend = r() < 0.25 ? 0 : (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.7);
      var rise = r() < 0.45 ? 0 : (r() * 2 - 1) * 30;
      var from = h;
      for (k = 0; k < len && curve.length < n; k++) {
        var t = k / len;
        curve.push(bend * Math.sin(Math.PI * t));
        y.push(from + rise * (1 - Math.cos(Math.PI * t)) / 2);
      }
      h = from + rise;
    }
    y.push(h);
    for (i = 0; i < n; i++) {
      var things = [];
      // Lamp posts every 40 metres, on alternate sides.
      if (i % 8 === 0) things.push({ kind: 'lamp', x: (i % 16 ? -1 : 1) * 1.32 });
      // Palms and trees here and there on the kerb, buildings and shops
      // further back.
      if (i % 8 === 4 && r() < 0.55) things.push({ kind: r() < 0.6 ? 'palm' : 'tree', x: (r() < 0.5 ? -1 : 1) * (1.3 + r() * 0.12) });
      if (i % 3 === 0) {
        var side = r() < 0.5 ? -1 : 1, pick = r();
        things.push({ kind: pick < 0.45 ? 'house' : pick < 0.7 ? 'shop' : pick < 0.88 ? 'tower' : 'mosque', x: side * (2.4 + r() * 1.6), tint: Math.floor(r() * 4) });
      }
      if (i % 40 === 20) things.push({ kind: 'billboard', x: (r() < 0.5 ? -1 : 1) * 2.1, tint: Math.floor(r() * 3) });
      scenery.push(things);
    }
    tracks[race] = { race: race, length: length, n: n, curve: curve, y: y, scenery: scenery };
    return tracks[race];
  }
  function segIndex(T, z){ return clamp(Math.floor(z / SEG), 0, T.n - 1); }
  // The road's height at z, between its segments' ends.
  function heightAt(T, z){
    var i = segIndex(T, z), t = clamp(z / SEG - i, 0, 1);
    return T.y[i] + (T.y[i + 1] - T.y[i]) * t;
  }

  // ---------- Traffic ----------
  // A race's traffic, made once: each vehicle starts at z0 in its lane and
  // drives on at its own speed, so where it is follows from the race's
  // time alone (at(v, time)). Nothing moves it out of the way.
  var traffics = {};
  function traffic(race){
    if (traffics[race]) return traffics[race];
    var r = seeded(race * 104729 + 7), list = [], T = track(race);
    var gap = Math.max(70, 150 - race * 12);
    for (var z = 220; z < T.length + 400; z += gap * (0.6 + r() * 0.8)) {
      var kind = KINDS[Math.floor(r() * KINDS.length)], v = VEHICLES[kind];
      list.push({ kind: kind, x: LANES[Math.floor(r() * LANES.length)], z0: z, speed: v.speed * (0.85 + r() * 0.3), len: v.len, half: v.wide / 2 / ROAD, tint: Math.floor(r() * 4) });
    }
    traffics[race] = list;
    return list;
  }
  function at(v, time){ return v.z0 + v.speed * time; }

  // ---------- A race ----------
  // The rivals of a race, on the grid ahead of the player, who starts last.
  function rivals(race){
    var r = seeded(race * 31 + 3), tops = SKILL.slice(), arms = ARMS[(race - 1) % ARMS.length];
    for (var i = tops.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), s = tops[i];
      tops[i] = tops[j]; tops[j] = s;
    }
    var max = 40 + (race - 1) * 8;
    return RIVALS.map(function(d, i){
      return {
        id: i, name: d.name, aggro: d.aggro,
        top: 50 + tops[i] + Math.min(8, (race - 1) * 1.2),
        max: max, health: max, weapon: arms[i],
        z: 8 + i * 6, x: i % 2 ? 0.4 : -0.4, speed: 0, push: 0,
        attack: null, cool: 1.5, down: 0, place: 0
      };
    });
  }

  // A new race. A game starts at race 1 with no score; each race after
  // carries the score on.
  function create(race, score){
    race = race || 1;
    return {
      race: race, length: raceLength(race),
      time: 0,                  // seconds since the start
      score: score || 0,
      player: { z: 0, x: 0, speed: 0, health: HEALTH, weapon: null, push: 0, attack: null, crash: 0, safe: 0, lean: 0 },
      rivals: rivals(race),
      finished: 0,              // how many have crossed the line
      place: 0,                 // where the player finished, once they have
      over: null,               // how the game ended: 'ko' (knocked out) or 'lost' (not in the top three)
      input: { steer: 0, brake: false },
      events: []                // what happened since the last look, for sounds and effects
    };
  }
  // The race after one the player finished in the top three.
  function nextRace(w){ return create(w.race + 1, w.score); }

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

  // Starts one of the player's moves ('punch' or 'kick'). Returns whether
  // it started: it doesn't while another is under way, off the bike or
  // after the finish.
  function attack(w, move){
    var p = w.player;
    if (w.over || w.place || p.crash || p.attack || (move !== 'punch' && move !== 'kick')) return false;
    var m = moveFor(p, move), aim = target(w.rivals, p.z, p.x, MOVES[m].reach + 0.3);
    p.attack = { move: m, t: 0, side: aim ? (aim.x < p.x ? -1 : 1) : (p.lean < 0 ? -1 : 1), done: false };
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

  // The player's blow lands, on whoever is in reach as it does.
  function land(w){
    var p = w.player, a = p.attack, m = MOVES[a.move];
    var o = target(w.rivals, p.z, p.x, m.reach);
    a.done = true;
    if (!o) return;
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

  // A rival's turn: keep up, keep clear of traffic, pick fights.
  function rival(w, o, T, cars){
    var p = w.player, dz = p.z - o.z, dx = p.x - o.x;
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
    if (dz > 120) aim += 6;
    else if (dz < -150) aim -= 4;
    var fighting = !w.place && !o.place && !p.crash && Math.abs(dz) < 8 && o.aggro >= 0.5;
    if (fighting) aim = Math.min(aim, p.speed + (dz > 0 ? 3 : -1));
    // Each rival keeps to a line of their own, changing it every 150 metres
    // or so, and moves over for the player when they want a fight.
    var line = Math.sin(o.id * 12.9898 + Math.floor(o.z / 150) * 78.233) * 0.6;
    if (fighting) line = p.x + (o.x < p.x ? -0.3 : 0.3);
    // Out of the way of traffic ahead.
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i], ahead = c.z - o.z;
      if (ahead > 0 && ahead < 40 && Math.abs(c.x - o.x) < c.half + 0.2) {
        line = c.x + (c.x > 0 ? -1 : 1) * (c.half + 0.3);
        if (ahead < 12) aim = Math.min(aim, c.speed + 4);
        break;
      }
    }
    o.speed += (aim - o.speed) * ACCEL * STEP * (aim < o.speed ? 3 : 1);
    o.x += clamp(line - o.x, -1, 1) * 1.2 * STEP + o.push * STEP;
    o.push *= Math.max(0, 1 - 4 * STEP);
    o.x = clamp(o.x, -0.95, 0.95);
    o.z += o.speed * STEP;
    // Into a vehicle anyway: thrown back, not out.
    for (i = 0; i < cars.length; i++) {
      c = cars[i];
      if (Math.abs(c.z - o.z) < c.len / 2 + 0.8 && Math.abs(c.x - o.x) < c.half + 0.07 && o.speed > c.speed) {
        o.speed = c.speed * 0.5;
        o.push += c.x > o.x ? -1.5 : 1.5;
      }
    }
    if (!o.place && o.z >= w.length) o.place = ++w.finished;

    // Fighting the player.
    if (o.attack) {
      o.attack.t += STEP;
      var m = MOVES[o.attack.move];
      if (!o.attack.done && o.attack.t >= m.at) {
        o.attack.done = true;
        dz = p.z - o.z; dx = p.x - o.x;
        if (!p.crash && !p.safe && !w.over && dz < BEHIND && dz > -AHEAD && Math.abs(dx) < m.reach) {
          p.push += (dx < 0 ? -1 : 1) * m.push;
          w.events.push({ type: 'hurt', move: o.attack.move, rival: o.id });
          hurtPlayer(w, Math.round(m.dmg * RIVAL_HURT));
        }
      }
      if (o.attack.t >= m.time) o.attack = null;
    } else if (!o.cool && !w.place && !o.place && !w.over && !p.crash && !p.safe && dz < BEHIND && dz > -AHEAD) {
      // A keen rival kicks from further off than a fist reaches.
      var move = o.weapon || (o.aggro > 0.5 && Math.abs(dx) > 0.3 ? 'kick' : 'punch');
      if (Math.abs(dx) < MOVES[move].reach) o.attack = { move: move, t: 0, side: dx < 0 ? -1 : 1, done: false };
      if (o.attack) o.cool = 2.8 - o.aggro * 1.2 - Math.min(0.5, (w.race - 1) * 0.08);
    }
  }

  // One step of the race.
  function step(w){
    var T = track(w.race), p = w.player, input = w.input;
    w.time += STEP;
    var cars = traffic(w.race).filter(function(v){ return Math.abs(at(v, w.time) - p.z) < 300; }).map(function(v){
      return { z: at(v, w.time), x: v.x, half: v.half, len: v.len, speed: v.speed };
    });
    var seg = segIndex(T, p.z);
    p.safe = down(p.safe);
    if (p.crash || w.over === 'ko') {
      // Off the bike, sliding to a stop, then back on in the road.
      p.speed = Math.max(0, p.speed - 30 * STEP);
      p.crash = down(p.crash);
      if (!p.crash && !w.over) {
        p.x = clamp(p.x, -0.8, 0.8);
        p.speed = 0;
        p.push = 0;
        p.safe = SAFE_TIME;
      }
      p.lean = 0;
    } else {
      var off = Math.abs(p.x) > 1;
      var top = w.place ? 25 : off ? KERB_TOP : TOP + Math.min(6, (w.race - 1) * 0.8);
      if (input.brake && !w.place) p.speed = Math.max(0, p.speed - BRAKE * STEP);
      else p.speed += (top - p.speed) * ACCEL * STEP * (top < p.speed ? 4 : 1);
      var steer = w.place ? 0 : clamp(+input.steer || 0, -1, 1);
      var grip = Math.min(1, p.speed / 15);
      p.x += steer * STEER * STEP * grip;
      // Past the line the bike keeps to the road on its own.
      if (!w.place) p.x -= T.curve[seg] * DRIFT * (p.speed / TOP) * (p.speed / TOP) * STEP;
      p.lean += (steer - p.lean) * Math.min(1, 10 * STEP);
    }
    p.x += p.push * STEP;
    p.push *= Math.max(0, 1 - 4 * STEP);
    p.x = clamp(p.x, -EDGE, EDGE);
    p.z += p.speed * STEP;

    if (p.attack) {
      p.attack.t += STEP;
      if (!p.attack.done && p.attack.t >= MOVES[p.attack.move].at) land(w);
      if (p.attack && p.attack.t >= MOVES[p.attack.move].time) p.attack = null;
    }

    for (var i = 0; i < w.rivals.length; i++) rival(w, w.rivals[i], T, cars);

    if (!p.crash && !w.over) {
      // Bikes side by side bump each other apart.
      w.rivals.forEach(function(o){
        if (o.down || Math.abs(o.z - p.z) > 1.6 || Math.abs(o.x - p.x) > 0.16) return;
        var side = o.x < p.x ? 1 : -1;
        p.push += side * 0.8; o.push -= side * 0.8;
        w.events.push({ type: 'bump' });
      });
      if (!p.safe) {
        // Into the back of a vehicle, or a post on the kerb.
        for (i = 0; i < cars.length; i++) {
          var c = cars[i];
          if (p.speed > c.speed && Math.abs(c.z - p.z) < c.len / 2 + 0.8 && Math.abs(c.x - p.x) < c.half + 0.07) { crash(w, 'traffic'); break; }
        }
        if (!p.crash && Math.abs(p.x) > 1.15) {
          for (var s = seg; s <= seg + 1 && s < T.n; s++) {
            T.scenery[s].forEach(function(o){
              if (p.crash || (o.kind !== 'lamp' && o.kind !== 'palm' && o.kind !== 'tree')) return;
              if (Math.abs(s * SEG - p.z) < 1 && Math.abs(o.x - p.x) < 0.12) crash(w, o.kind);
            });
          }
        }
      }
    }

    // The finish line.
    if (!w.place && !w.over && p.z >= w.length) {
      w.place = ++w.finished;
      w.events.push({ type: 'finish', place: w.place });
      if (w.place <= QUALIFY) w.score += PLACE_POINTS[w.place - 1] * w.race;
      else w.over = 'lost';
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

  // ---------- Saving ----------
  // A race in progress as plain JSON, and back.
  function snapshot(w){
    function attackOf(a){ return a && { move: a.move, t: a.t, side: a.side, done: a.done }; }
    var p = w.player;
    return {
      race: w.race, time: w.time, score: w.score, finished: w.finished,
      player: { z: p.z, x: p.x, speed: p.speed, health: p.health, weapon: p.weapon, push: p.push, attack: attackOf(p.attack), crash: p.crash, safe: p.safe },
      rivals: w.rivals.map(function(o){
        return { z: o.z, x: o.x, speed: o.speed, health: o.health, weapon: o.weapon, push: o.push, attack: attackOf(o.attack), cool: o.cool, down: o.down, place: o.place };
      })
    };
  }
  function num(n){ return typeof n === 'number' && isFinite(n); }
  function between(n, lo, hi){ return num(n) && n >= lo && n <= hi; }
  function whole(n, lo, hi){ return between(n, lo, hi) && n === Math.floor(n); }
  function okAttack(a, moves){
    return a === null || (!!a && moves.indexOf(a.move) >= 0 && between(a.t, 0, MOVES[a.move].time) && (a.side === -1 || a.side === 1) && typeof a.done === 'boolean');
  }
  function okWeapon(x){ return x === null || WEAPONS.indexOf(x) >= 0; }
  // A world from a snapshot, or null if any of it doesn't make sense: every
  // field checked, and the race still under way (nobody's finished it but
  // rivals, who come in in order).
  function restore(s){
    if (!s || typeof s !== 'object' || !whole(s.race, 1, 999) || !between(s.time, 0, 3600) || !whole(s.score, 0, 1e9)) return null;
    var w = create(s.race, s.score), p = s.player, len = w.length;
    if (!p || !between(p.z, 0, len) || !between(p.x, -EDGE, EDGE) || !between(p.speed, 0, 80) ||
        !between(p.health, 1, HEALTH) || !okWeapon(p.weapon) || !between(p.push, -10, 10) ||
        !okAttack(p.attack, ['punch', 'kick'].concat(WEAPONS)) || (p.attack && p.attack.move === 'punch' && p.weapon) ||
        !between(p.crash, 0, CRASH_TIME) || !between(p.safe, 0, SAFE_TIME)) return null;
    if (!Array.isArray(s.rivals) || s.rivals.length !== w.rivals.length || !whole(s.finished, 0, w.rivals.length)) return null;
    var places = [];
    for (var i = 0; i < s.rivals.length; i++) {
      var o = s.rivals[i];
      if (!o || !between(o.z, 0, len + RUN_OUT) || !between(o.x, -1, 1) || !between(o.speed, 0, 80) ||
          !between(o.health, 0, w.rivals[i].max) || !okWeapon(o.weapon) || !between(o.push, -10, 10) ||
          !okAttack(o.attack, ['punch', 'kick'].concat(WEAPONS)) || !between(o.cool, 0, 5) ||
          !between(o.down, 0, 3600) || !whole(o.place, 0, w.rivals.length)) return null;
      if ((o.health === 0) !== (o.down > 0) || (o.place && (o.z < len || o.down)) || (!o.place && !o.down && o.z >= len)) return null;
      if (o.place) places.push(o.place);
    }
    // Those who've finished came in first, second, and so on.
    places.sort(function(a, b){ return a - b; });
    if (places.length !== s.finished || places.some(function(n, k){ return n !== k + 1; })) return null;
    w.time = s.time;
    w.finished = s.finished;
    w.player = { z: p.z, x: p.x, speed: p.speed, health: p.health, weapon: p.weapon, push: p.push, attack: p.attack && { move: p.attack.move, t: p.attack.t, side: p.attack.side, done: p.attack.done }, crash: p.crash, safe: p.safe, lean: 0 };
    s.rivals.forEach(function(o, k){
      var r = w.rivals[k];
      r.z = o.z; r.x = o.x; r.speed = o.speed; r.health = o.health; r.weapon = o.weapon; r.push = o.push;
      r.attack = o.attack && { move: o.attack.move, t: o.attack.t, side: o.attack.side, done: o.attack.done };
      r.cool = o.cool; r.down = o.down; r.place = o.place;
    });
    return w;
  }

  window.bdnixStreet = {
    SEG: SEG, STEP: STEP, EDGE: EDGE, TOP: TOP, KERB_TOP: KERB_TOP, HEALTH: HEALTH, ROAD: ROAD,
    CRASH_TIME: CRASH_TIME, CRASH_HURT: CRASH_HURT, SAFE_TIME: SAFE_TIME, PLACE_POINTS: PLACE_POINTS,
    KO_POINTS: KO_POINTS, QUALIFY: QUALIFY, RUN_OUT: RUN_OUT, MOVES: MOVES, AHEAD: AHEAD, BEHIND: BEHIND,
    WEAPONS: WEAPONS, RIVALS: RIVALS, VEHICLES: VEHICLES, RIVAL_HURT: RIVAL_HURT,
    seeded: seeded, raceLength: raceLength, track: track, segIndex: segIndex, heightAt: heightAt,
    traffic: traffic, at: at, create: create, nextRace: nextRace, attack: attack, step: step,
    advance: advance, position: position, snapshot: snapshot, restore: restore
  };
})();
