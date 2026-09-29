// Flap rules: the bird, the pipes, collisions and scoring. No DOM, so
// it can be unit tested; flappy.js draws the world and handles input.
// Distances are in world units on a board 512 high and 288 wide (wider on a
// phone held sideways), times in seconds.
(function(){
  var W = 288, H = 512;
  var MAX_W = 960;              // the widest board, on a phone held sideways
  var GROUND = 432;             // top of the ground strip
  var BIRD_X = 80, BIRD_R = 12;
  var GRAVITY = 1500, FLAP = -420, MAX_FALL = 620;
  var SPEED = 130;              // how fast the pipes scroll
  var PIPE_W = 52, GAP = 124, SPACING = 172;
  var CAP_H = 22, LIP = 4;      // each pipe's end cap, LIP wider on both sides
  var GAP_MARGIN = 64;          // keeps each gap this far from the top and the ground
  var KNOCK_X = -70, KNOCK_Y = -210; // the bounce off a pipe
  var DRAG = 0.97;              // per step, slows the bounce back
  var STEP = 1 / 120;           // fixed physics step

  // Top of a pipe's gap, from a random number in [0, 1).
  function gapTop(r){
    var lo = GAP_MARGIN, hi = GROUND - GAP_MARGIN - GAP;
    return Math.round(lo + Math.min(Math.max(r, 0), 1) * (hi - lo));
  }

  // A board `width` units wide, from W to MAX_W.
  function fitWidth(width){
    return Math.max(W, Math.min(MAX_W, Math.floor(width) || W));
  }

  // A new round. `rand` picks the gap heights (Math.random if omitted);
  // `width` is the board's width (W if omitted).
  function create(rand, width){
    return {
      rand: rand || Math.random,
      width: fitWidth(width),
      bird: { x: BIRD_X, y: 220, vx: 0, vy: 0 },
      pipes: [],
      nextPipe: fitWidth(width) + 40, // where the next pipe appears
      score: 0,
      dead: false,
      landed: false,
      impact: null,             // where the bird hit, and which way it bounced
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

  // A pipe as rectangles: its two halves and their wider caps. Pipes reach
  // past the top of the board, so flying over them doesn't work.
  function pipeRects(p){
    var bottom = p.top + GAP;
    return [
      { x: p.x, y: -1000, w: PIPE_W, h: p.top + 1000 },
      { x: p.x - LIP, y: p.top - CAP_H, w: PIPE_W + LIP * 2, h: CAP_H },
      { x: p.x, y: bottom, w: PIPE_W, h: GROUND - bottom },
      { x: p.x - LIP, y: bottom, w: PIPE_W + LIP * 2, h: CAP_H }
    ];
  }

  // Whether the bird touches a pipe.
  function hitsPipe(w){
    var b = w.bird;
    for (var i = 0; i < w.pipes.length; i++) {
      var r = pipeRects(w.pipes[i]);
      for (var j = 0; j < r.length; j++) {
        if (circleHitsRect(b.x, b.y, BIRD_R, r[j].x, r[j].y, r[j].w, r[j].h)) return true;
      }
    }
    return false;
  }

  // Pushes the bird out of any pipe it overlaps and stops it moving into
  // the pipe. Returns the last contact, { x, y, nx, ny }: the point touched
  // and the direction the bird was pushed, or null if it touched nothing.
  function pushOut(w){
    var b = w.bird, contact = null;
    for (var i = 0; i < w.pipes.length; i++) {
      var r = pipeRects(w.pipes[i]);
      for (var j = 0; j < r.length; j++) {
        var q = r[j];
        if (!circleHitsRect(b.x, b.y, BIRD_R, q.x, q.y, q.w, q.h)) continue;
        var px = Math.max(q.x, Math.min(b.x, q.x + q.w));
        var py = Math.max(q.y, Math.min(b.y, q.y + q.h));
        var dx = b.x - px, dy = b.y - py, d = Math.sqrt(dx * dx + dy * dy);
        var nx, ny;
        if (d > 1e-9) { nx = dx / d; ny = dy / d; }
        else {
          // The centre is inside: out through the nearest side.
          var left = b.x - q.x, right = q.x + q.w - b.x, up = b.y - q.y, down = q.y + q.h - b.y;
          var m = Math.min(left, right, up, down);
          nx = m === left ? -1 : m === right ? 1 : 0;
          ny = nx ? 0 : m === up ? -1 : 1;
          px = nx < 0 ? q.x : nx > 0 ? q.x + q.w : b.x;
          py = ny < 0 ? q.y : ny > 0 ? q.y + q.h : b.y;
        }
        // A hair further than touching, so rounding can't leave it inside.
        b.x = px + nx * (BIRD_R + 1e-6);
        b.y = py + ny * (BIRD_R + 1e-6);
        var into = b.vx * nx + b.vy * ny;
        if (into < 0) { b.vx -= into * nx; b.vy -= into * ny; }
        contact = { x: px, y: py, nx: nx, ny: ny };
      }
    }
    return contact;
  }

  // Hitting a pipe: the bird bounces back off it, up a little unless it hit
  // the underside of the top pipe.
  function knock(w){
    var b = w.bird, c = pushOut(w);
    b.vx = KNOCK_X;
    b.vy = c.ny > 0.7 ? Math.max(b.vy, 60) : KNOCK_Y;
    w.impact = c;
  }

  // After a hit: the bird tumbles to the ground, or onto the pipe below it,
  // and never through a pipe.
  function tumble(w){
    var b = w.bird;
    b.vx *= DRAG;
    b.x = Math.max(BIRD_R, b.x + b.vx * STEP);
    var c = pushOut(w);
    // Resting on top of a pipe; on its corner, it slides off.
    if (c && c.nx === 0 && c.ny < 0 && b.vy >= 0) { b.vx = 0; b.vy = 0; w.landed = true; }
  }

  // One fixed step. Returns what happened: 'score', 'hit' or null.
  function tick(w){
    var b = w.bird, event = null;
    if (w.landed) return null;
    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * STEP);
    b.y += b.vy * STEP;
    if (b.y < BIRD_R) { b.y = BIRD_R; b.vy = Math.max(0, b.vy); }
    if (w.dead) tumble(w);            // falling after a hit: the world stops
    if (b.y >= GROUND - BIRD_R) {
      b.y = GROUND - BIRD_R; b.vx = 0; b.vy = 0;
      w.landed = true;
      if (!w.dead) { w.dead = true; event = 'hit'; w.impact = { x: b.x, y: GROUND, nx: 0, ny: -1 }; }
      return event;
    }
    if (w.dead) return null;

    var dx = SPEED * STEP;
    w.distance += dx;
    w.nextPipe -= dx;
    // A loop, in case the board has just grown wider.
    while (w.nextPipe <= w.width) {
      w.pipes.push({ x: w.nextPipe, top: gapTop(w.rand()), scored: false });
      w.nextPipe += SPACING;
    }
    for (var i = 0; i < w.pipes.length; i++) {
      var p = w.pipes[i];
      p.x -= dx;
      if (!p.scored && p.x + PIPE_W < BIRD_X) { p.scored = true; w.score++; event = 'score'; }
    }
    while (w.pipes.length && w.pipes[0].x + PIPE_W < 0) w.pipes.shift();

    if (hitsPipe(w)) { w.dead = true; event = 'hit'; knock(w); }
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
    W: W, H: H, MAX_W: MAX_W, GROUND: GROUND, BIRD_X: BIRD_X, BIRD_R: BIRD_R,
    PIPE_W: PIPE_W, CAP_H: CAP_H, LIP: LIP, GAP: GAP, SPACING: SPACING, SPEED: SPEED, STEP: STEP, FLAP: FLAP,
    gapTop: gapTop, fitWidth: fitWidth, create: create, flap: flap, tick: tick, advance: advance,
    hitsPipe: hitsPipe, pushOut: pushOut, circleHitsRect: circleHitsRect, medal: medal
  };
})();
