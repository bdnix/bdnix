// King of Streets: the arithmetic behind the 3D view and the engine's sound,
// with no DOM or three.js, so it can be unit tested. street-3d.js draws with
// it and street-engine.js plays with it.
//
// The rules (street-core.js) measure the road straight: z along it, x across
// it. Here that road is laid out on the ground. Its bends turn it as it goes,
// so z and x become a point on the map; up a ramp it rises. The map is
// three.js's: y up, the start line at the origin, the road setting off
// along +z, a rider's left towards +x.
(function(){
  var F = window.bdnixStreet;
  var SEG = F.SEG;
  var TURN = 0.035;      // radians the road turns per segment at a bend of 1
  var MAX_TURN = 1.15;   // how far the road ever turns from the way it set off
  var CHUNK = 60;        // metres of road built at a time

  // ---------- The road on the map ----------
  // A race's road laid out: at the start of each segment, where it is
  // (x, z) and which way it's heading (radians, 0 along +z, growing to the
  // left). A bend that would turn the road past MAX_TURN eases off, so a
  // road never doubles back across itself.
  var paths = {};
  function path(race){
    if (paths[race]) return paths[race];
    var T = F.track(race), n = T.n;
    var X = new Float64Array(n + 1), Z = new Float64Array(n + 1), H = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) {
      var h = H[i], d = -T.curve[i] * TURN;
      if (d * h > 0) d *= Math.max(0, 1 - Math.abs(h) / MAX_TURN);
      X[i + 1] = X[i] + Math.sin(h + d / 2) * SEG;
      Z[i + 1] = Z[i] + Math.cos(h + d / 2) * SEG;
      H[i + 1] = h + d;
    }
    paths[race] = { race: race, n: n, x: X, z: Z, heading: H, track: T };
    return paths[race];
  }

  // Where the road's (z, x) is on the map: { x, y, z, heading }. Within a
  // segment the road turns evenly, so a point in it follows the arc. Past
  // the end it carries straight on.
  function place(P, z, x){
    var i = Math.floor(z / SEG), t;
    if (i < 0) i = 0;
    if (i >= P.n) i = P.n - 1;
    t = z / SEG - i;
    var h0 = P.heading[i], d = P.heading[i + 1] - h0;
    var h = h0 + d * t, mid = h0 + d * t / 2;
    var px = P.x[i] + Math.sin(mid) * t * SEG, pz = P.z[i] + Math.cos(mid) * t * SEG;
    x = x || 0;
    // Before the start line the road comes straight. The rider's right is
    // the map's -x when the road heads along +z.
    return { x: px - Math.cos(h) * x, y: F.heightAt(P.track, z), z: pz + Math.sin(h) * x, heading: h };
  }

  // ---------- Building the road a piece at a time ----------
  // The chunks of road (each CHUNK metres from c * CHUNK) to have built for
  // a camera at z that sees `ahead` metres on and `behind` back, within the
  // road's length and the one chunk before the start line.
  function chunks(P, z, ahead, behind){
    var last = Math.floor((P.n * SEG - 1) / CHUNK), out = [];
    var from = Math.max(-1, Math.floor((z - behind) / CHUNK)), to = Math.min(last, Math.floor((z + ahead) / CHUNK));
    for (var c = from; c <= to; c++) out.push(c);
    return out;
  }

  // ---------- The camera ----------
  // Where the chase camera sits for a rider at (z, x) and what it looks at,
  // and how wide it sees (degrees, up and down): low behind them and close,
  // looking along the road so it follows the bends. `fast` (0 standing to 1
  // flat out) draws it back a little and widens the view, so speed shows. A
  // tall screen sits it closer and higher, so the rider fills the narrow view;
  // a very wide one (`aspect`, width over height: a phone on its side) sees
  // no more than 96 degrees across (106 flat out), so the bike isn't lost
  // in the middle of it.
  function chase(P, z, x, tall, fast, aspect){
    fast = Math.max(0, Math.min(1, fast || 0));
    var back = (tall ? 2.9 : 3.3) + fast * 0.5, up = tall ? 1.55 : 1.4, ahead = 12;
    var from = place(P, z - back, x * 0.9), to = place(P, z + ahead, x * 0.7);
    var fov = (tall ? 70 : 56) + fast * (tall ? 10 : 16), across = (96 + 10 * fast) * Math.PI / 360;
    if (aspect) fov = Math.min(fov, Math.atan(Math.tan(across) / aspect) * 360 / Math.PI);
    return { from: { x: from.x, y: from.y + up, z: from.z }, to: { x: to.x, y: to.y + 0.7, z: to.z }, fov: fov };
  }

  // The rider's own view, from inside the helmet: in the bike's frame (x to
  // the rider's left, y up, z ahead), where the eye goes, a point it looks
  // at and the field of view (degrees, up and down), given where the head
  // and both hands are and the screen's shape (width over height). The eye
  // sits just above the head, looking down the road; if the hands don't fit
  // in view (low, close bars seen on a narrow screen), the view widens, and
  // then the eye rises and draws back, as little as it takes.
  function cockpit(head, hands, aspect){
    var tall = aspect < 1, base = tall ? 88 : 75, max = tall ? 100 : 86, rad = Math.PI / 180, best = null;
    for (var k = 0; k <= 10; k++) {
      var eye = { x: head.x, y: head.y + (tall ? 0.24 : 0.08) + 0.025 * k, z: head.z - 0.02 - 0.022 * k };
      for (var fov = base; fov <= max; fov = fov === max ? max + 1 : Math.min(max, fov + 2)) {
        var half = fov / 2 * rad, halfW = Math.atan(Math.tan(half) * aspect), fit = true, low = 0;
        // Pitched down so the lower hand sits near the bottom of the view, but no more than 26 degrees.
        hands.forEach(function(h){ low = Math.max(low, Math.atan2(eye.y - h.y + 0.04, Math.max(0.05, h.z - eye.z))); });
        var pitch = Math.max(0.08, Math.min(26 * rad, low - half * 0.78));
        hands.forEach(function(h){
          var ahead = Math.max(0.05, h.z - eye.z), down = Math.atan2(eye.y - h.y + 0.04, ahead);
          if (Math.atan2(Math.abs(h.x - eye.x) + 0.07, ahead) > halfW * 0.94 || down - pitch > half * 0.94) fit = false;
        });
        best = { eye: eye, look: { x: eye.x, y: eye.y - Math.sin(pitch) * 10, z: eye.z + Math.cos(pitch) * 10 }, fov: fov };
        if (fit) return best;
      }
    }
    return best;
  }

  // ---------- The engine ----------
  // Each bike's engine: its gears (each the speed, metres a second, at the
  // top of its revs; a scooter's belt has none), the revs it idles at and
  // tops out at (a share of the top), how many times it fires a turn of the
  // crank (cylinders over 2 for a four-stroke) and the voice it's played in.
  var ENGINES = {
    k1_vino:   { gears: null, idle: 0.22, fires: 0.5, voice: 'buzz' },
    k2_125:    { gears: [9, 15, 21, 27, 33], idle: 0.18, fires: 0.5, voice: 'thump' },
    k3_pulsar: { gears: [9, 16, 23, 30, 35, 39], idle: 0.16, fires: 0.5, voice: 'thump' },
    k4_zx6r:   { gears: [16, 24, 32, 39, 46, 52], idle: 0.12, fires: 2, voice: 'scream' },
    k5_h2:     { gears: [20, 30, 40, 49, 57, 66], idle: 0.12, fires: 2, voice: 'whine' }
  };
  var RED = { k1_vino: 8500, k2_125: 9500, k3_pulsar: 9500, k4_zx6r: 16000, k5_h2: 14000 };

  // What the engine of bike `id` is doing at `speed` (metres a second):
  // its gear (0 for a scooter), its revs (a share of the red line, idle
  // when stopped), the revs a minute and how often it fires (Hz), which
  // sets its note.
  function engine(id, speed){
    var E = ENGINES[id] || ENGINES.k1_vino, red = RED[id] || RED.k1_vino, gear = 0, revs;
    speed = Math.max(0, speed || 0);
    if (!E.gears) {
      // A belt drive: the revs rise quickly, then hold while the belt does the rest.
      revs = E.idle + (1 - E.idle) * Math.min(1, 0.55 * Math.min(1, speed / 6) + 0.45 * speed / 25);
    } else {
      // Up a gear near the top of each one's revs, so they dip at each change.
      var G = E.gears;
      for (gear = 1; gear < G.length && speed > G[gear - 1] * 0.92; gear++);
      revs = Math.max(E.idle, Math.min(1, speed / G[gear - 1]));
    }
    var rpm = Math.round(revs * red);
    return { gear: gear, revs: revs, rpm: rpm, hz: rpm / 60 * E.fires, voice: E.voice };
  }

  // How a sound from (x, z) on the map is heard by a listener at (lx, lz)
  // heading `h`: louder near (0 to 1), from the left (-1) or right (1), and
  // higher as it closes in (the Doppler shift, a pitch factor) given both
  // speeds along the road (metres a second).
  function heard(lx, lz, h, x, z, speed, listenerSpeed){
    var dx = x - lx, dz = z - lz, d = Math.sqrt(dx * dx + dz * dz);
    var right = -Math.cos(h) * dx + Math.sin(h) * dz, along = Math.sin(h) * dx + Math.cos(h) * dz;
    var pan = d < 1e-6 ? 0 : Math.max(-1, Math.min(1, right / Math.max(d, 4)));
    // Closing speed: the gap shrinks if the one behind is faster.
    var closing = along > 0 ? listenerSpeed - speed : speed - listenerSpeed;
    var pitch = 340 / (340 - Math.max(-60, Math.min(60, closing)));
    return { gain: 1 / (1 + d * d / 64), pan: pan, pitch: pitch, distance: d };
  }

  // ---------- Graphics quality ----------
  // How much to draw: 'high' unless the machine says it's weak, or the
  // player picks 'low'. Shadows, the people on the footpaths, how far ahead
  // the road is built and the sharpest the picture is drawn (pixels for
  // each of the screen's points) follow from it.
  var QUALITY = {
    high: { ahead: 300, behind: 40, pixels: 2, shadows: true, people: 1 },
    low: { ahead: 200, behind: 25, pixels: 1.5, shadows: false, people: 0.5 }
  };
  function quality(o){
    var cores = o.cores || 4, memory = o.memory || 4;
    return cores < 4 || memory < 4 ? 'low' : 'high';
  }

  // Keeping the game smooth: given the pixels drawn for each of the screen's
  // points now, the most it may be, and how long frames took over the last
  // couple of seconds (ms, on average), the sharpness to draw at next. Slower
  // than 50 frames a second, it's drawn a step coarser, down to 0.75 (or the
  // most, if that's less); it never sharpens again, so it doesn't swing back
  // and forth. `shadows` says whether to keep drawing shadows: only while
  // it can still go coarser, or the frames are quick enough.
  var SLOW = 20;
  function sharpness(now, most, ms){
    var least = Math.min(most, 0.75);
    if (ms <= SLOW) return { pixels: now, shadows: true };
    var next = Math.max(least, Math.round(now * 0.85 * 100) / 100);
    return { pixels: next, shadows: next < now };
  }

  // ---------- Steering by tilting the phone ----------
  // The phone held like a handlebar, turned to the right to steer right.
  // How far it's turned (radians, positive to the right), from how the
  // phone says it's tilted (deviceorientation's beta and gamma, degrees),
  // seen on the screen as it's shown (`angle`: 0 upright, 90 turned on its
  // left side, 180, 270). The way up, in the phone's own x (to the right of
  // its screen held upright), y (to its top) and z (out of the screen),
  // follows from beta and gamma alone, whichever way it's held.
  function turned(beta, gamma, angle){
    var b = beta * Math.PI / 180, g = gamma * Math.PI / 180, a = (angle || 0) * Math.PI / 180;
    var ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b);
    var sx = ux * Math.cos(a) - uy * Math.sin(a), sy = ux * Math.sin(a) + uy * Math.cos(a);
    return -Math.atan2(sx, sy);
  }
  // The steering for a phone turned `by` radians, against how it was held
  // when the race started (`from`): nothing within 3 degrees, full lock at
  // 25.
  var DEAD = 3 * Math.PI / 180, LOCK = 25 * Math.PI / 180;
  function tilt(by, from){
    var d = by - (from || 0);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < DEAD) return 0;
    return Math.max(-1, Math.min(1, (d - (d > 0 ? DEAD : -DEAD)) / (LOCK - DEAD)));
  }

  window.bdnixStreetScene = {
    TURN: TURN, MAX_TURN: MAX_TURN, CHUNK: CHUNK, ENGINES: ENGINES, QUALITY: QUALITY,
    path: path, place: place, chunks: chunks, chase: chase, cockpit: cockpit, engine: engine, heard: heard, quality: quality, sharpness: sharpness, turned: turned, tilt: tilt
  };
})();
