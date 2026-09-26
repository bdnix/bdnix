// Flappy Bird rules: the bird, the pipes, collisions and scoring. No DOM, so
// it can be unit tested; flappy.js draws the world and handles input.
// Distances are in world units on a 288 x 512 board, times in seconds.
(function(){
  var W = 288, H = 512;
  var GROUND = 432;             // top of the ground strip
  var BIRD_X = 80, BIRD_R = 12;
  var GRAVITY = 1500, FLAP = -420, MAX_FALL = 620;
  var SPEED = 130;              // how fast the pipes scroll
  var PIPE_W = 52, GAP = 124, SPACING = 172;
  var GAP_MARGIN = 64;          // keeps each gap this far from the top and the ground
  var FIRST_PIPE = W + 40;
  var STEP = 1 / 120;           // fixed physics step

  // Top of a pipe's gap, from a random number in [0, 1).
  function gapTop(r){
    var lo = GAP_MARGIN, hi = GROUND - GAP_MARGIN - GAP;
    return Math.round(lo + Math.min(Math.max(r, 0), 1) * (hi - lo));
  }

  // A new round. `rand` picks the gap heights (Math.random if omitted).
  function create(rand){
    return {
      rand: rand || Math.random,
      bird: { y: 220, vy: 0 },
      pipes: [],
      nextPipe: FIRST_PIPE,     // where the next pipe appears, relative to the right edge
      score: 0,
      dead: false,
      landed: false,
      distance: 0               // how far the world has scrolled, for the ground stripes
    };
  }

  function flap(w){
    if (w.dead) return false;
    w.bird.vy = FLAP;
    return true;
  }

  // Whether a circle at (cx, cy) with radius r overlaps the rectangle.
  function circleHitsRect(cx, cy, r, x, y, rw, rh){
    var nx = Math.max(x, Math.min(cx, x + rw));
    var ny = Math.max(y, Math.min(cy, y + rh));
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  // Whether the bird touches a pipe. Pipes reach past the top of the board,
  // so flying over them doesn't work.
  function hitsPipe(w){
    var y = w.bird.y;
    for (var i = 0; i < w.pipes.length; i++) {
      var p = w.pipes[i];
      if (circleHitsRect(BIRD_X, y, BIRD_R, p.x, -1000, PIPE_W, p.top + 1000)) return true;
      if (circleHitsRect(BIRD_X, y, BIRD_R, p.x, p.top + GAP, PIPE_W, GROUND - p.top - GAP)) return true;
    }
    return false;
  }

  // One fixed step. Returns what happened: 'score', 'hit' or null.
  function tick(w){
    var b = w.bird, event = null;
    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * STEP);
    b.y += b.vy * STEP;
    if (b.y < BIRD_R) { b.y = BIRD_R; b.vy = Math.max(0, b.vy); }
    if (b.y >= GROUND - BIRD_R) {
      b.y = GROUND - BIRD_R; b.vy = 0;
      w.landed = true;
      if (!w.dead) { w.dead = true; event = 'hit'; }
      return event;
    }
    if (w.dead) return null;          // falling after a hit: the world stops

    var dx = SPEED * STEP;
    w.distance += dx;
    w.nextPipe -= dx;
    if (w.nextPipe <= W) {
      w.pipes.push({ x: w.nextPipe, top: gapTop(w.rand()), scored: false });
      w.nextPipe += SPACING;
    }
    for (var i = 0; i < w.pipes.length; i++) {
      var p = w.pipes[i];
      p.x -= dx;
      if (!p.scored && p.x + PIPE_W < BIRD_X) { p.scored = true; w.score++; event = 'score'; }
    }
    while (w.pipes.length && w.pipes[0].x + PIPE_W < 0) w.pipes.shift();

    if (hitsPipe(w)) { w.dead = true; event = 'hit'; }
    return event;
  }

  // Runs whole steps for `dt` seconds. `carry` is the time left over from the
  // last call; returns the new carry and every event, in order.
  function advance(w, dt, carry){
    var t = (carry || 0) + dt, events = [];
    while (t >= STEP) {
      var e = tick(w);
      if (e) events.push(e);
      t -= STEP;
    }
    return { carry: t, events: events };
  }

  // The medal a score earns, if any.
  function medal(score){
    return score >= 40 ? 'platinum' : score >= 30 ? 'gold' : score >= 20 ? 'silver' : score >= 10 ? 'bronze' : null;
  }

  window.bdnixFlappy = {
    W: W, H: H, GROUND: GROUND, BIRD_X: BIRD_X, BIRD_R: BIRD_R,
    PIPE_W: PIPE_W, GAP: GAP, SPACING: SPACING, SPEED: SPEED, STEP: STEP, FLAP: FLAP,
    gapTop: gapTop, create: create, flap: flap, tick: tick, advance: advance,
    hitsPipe: hitsPipe, circleHitsRect: circleHitsRect, medal: medal
  };
})();
