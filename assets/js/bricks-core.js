// Brick Bounce rules: the wall of bricks, the paddle, the balls bouncing
// between them, and the powers that fall from some of the bricks. No DOM, so it can be unit tested; bricks.js draws the board
// and handles input. Positions are in world units on a board W wide and H
// tall, with x counting right from 0 and y counting down from 0 at the top;
// times are in seconds.
(function(){
  var W = 360, H = 480;
  var COLS = 10, ROWS = 8;
  var SIDE = 12;                        // space between the wall of bricks and the sides
  var TOP = 64;                         // where the top row of bricks starts
  var BW = (W - SIDE * 2) / COLS;       // one brick's slot, gap included
  var BH = 16;
  var GAP = 3;
  var POINTS = [7, 7, 5, 5, 3, 3, 1, 1]; // per row, top to bottom
  var PADDLE_Y = 440;                   // the paddle's top edge
  var PADDLE_H = 10;
  var PADDLE_W = 64, SMALL_W = 40;      // the paddle shrinks once the ball reaches the top
  var R = 5;                            // the ball's radius
  var LIVES = 3;
  var BASE = 250, BOOST = 25, MAX = 450; // ball speed in units a second
  var MAX_ANGLE = Math.PI / 3;          // off the paddle's very edge, 60° from straight up
  var SERVE = Math.PI / 6;              // a new ball leaves at 30° from straight up
  var SUBSTEP = 3;                      // the ball moves at most this far between checks

  // Powers. A few bricks of each wall hide one; breaking the brick drops it as
  // a capsule, and catching the capsule with the paddle turns it on.
  var KINDS = ['multi', 'fire', 'laser', 'wide', 'life'];
  var LOOT = ['multi', 'fire', 'laser', 'wide', 'multi', 'life']; // hidden in every wall
  var FIRE_TIME = 8, LASER_TIME = 8, WIDE_TIME = 12; // how long each lasts, in seconds
  var WIDE_GROW = 1.5;                  // how much wider the wide paddle is
  var MAX_BALLS = 12;                   // in play at once
  var SPLIT = Math.PI / 7;              // how far apart a split sends the new balls
  var MIN_DY = 0.3;                     // no ball leaves a split flatter than this
  var MAX_LIVES = 5;
  var DROP_W = 26, DROP_H = 12, DROP_SPEED = 110; // a falling capsule
  var SHOT_SPEED = 520, SHOT_EVERY = 0.4, SHOT_H = 8; // the laser's shots

  // A full wall: 1 where there's a brick, row by row from the top.
  function fullWall(){
    var b = [];
    for (var i = 0; i < ROWS * COLS; i++) b.push(1);
    return b;
  }

  // Where brick `i` is drawn: { x, y, w, h }.
  function brickRect(i){
    var col = i % COLS, row = Math.floor(i / COLS);
    return { x: SIDE + col * BW + GAP / 2, y: TOP + row * BH + GAP / 2, w: BW - GAP, h: BH - GAP };
  }

  // Where each power is hidden in a new wall: '' for most bricks, a kind for
  // the few that hold one, picked by `rand`.
  function hideLoot(rand){
    var loot = [], free = [];
    for (var i = 0; i < ROWS * COLS; i++) { loot.push(''); free.push(i); }
    LOOT.forEach(function(kind){
      var j = Math.min(free.length - 1, Math.floor(rand() * free.length));
      loot[free.splice(j, 1)[0]] = kind;
    });
    return loot;
  }

  function paddleWidth(w){ return (w.small ? SMALL_W : PADDLE_W) * (w.wide > 0 ? WIDE_GROW : 1); }

  // How many bricks of the current wall have been broken, and the highest
  // row pair reached: 1 once a brick in the middle-top pair (rows 2 and 3)
  // is gone, 2 once one in the top pair is.
  function progress(w){
    var broken = 0, reach = 0;
    for (var i = 0; i < w.bricks.length; i++) {
      if (w.bricks[i]) continue;
      broken++;
      var row = Math.floor(i / COLS);
      if (row < 2) reach = 2; else if (row < 4 && reach < 1) reach = 1;
    }
    return { broken: broken, reach: reach };
  }

  // The ball picks up speed after the 4th and 12th bricks of a wall, when it
  // first breaks into the upper rows and again into the top rows, and with
  // each new wall.
  function speed(w){
    var p = progress(w);
    var boosts = (p.broken >= 4 ? 1 : 0) + (p.broken >= 12 ? 1 : 0) + p.reach + (w.level - 1);
    return Math.min(MAX, BASE + BOOST * boosts);
  }

  // Puts one ball back on the middle of the paddle, waiting to be launched.
  function stick(w){
    w.stuck = true;
    w.balls = [{ x: w.paddle, y: PADDLE_Y - R, dx: 0, dy: -1 }];
  }

  // A new wall of bricks, with its powers hidden in it.
  function build(w){
    w.bricks = fullWall();
    w.loot = hideLoot(w.rand);
  }

  // Turns every power off, and takes away falling capsules and shots in flight.
  function clearPowers(w){
    w.drops = [];
    w.shots = [];
    w.fire = w.laser = w.wide = w.reload = 0;
  }

  // A new game. `rand` picks where the powers hide and which way each ball
  // is launched (Math.random if omitted).
  function create(rand){
    var w = {
      rand: rand || Math.random,
      level: 1,                 // which wall this is, from 1
      bricks: null,
      loot: null,               // the power hidden in each brick, or ''
      paddle: W / 2,            // the middle of the paddle
      small: false,
      balls: null,              // { x, y, dx, dy } for each ball in play
      stuck: true,              // the ball sits on the paddle until it's launched
      lives: LIVES,             // balls left, counting the ones in play as one
      score: 0,
      drops: null,              // falling capsules: { x, y, kind }
      shots: null,              // the laser's shots: { x, y } at their tips
      fire: 0,                  // seconds left of each power
      laser: 0,
      wide: 0,
      reload: 0,                // seconds until the laser fires again
      dead: null                // 'out' once the last ball is lost
    };
    build(w);
    clearPowers(w);
    stick(w);
    return w;
  }

  // Moves the paddle so its middle is at `x`, as far as the walls allow. A
  // ball waiting on the paddle moves with it.
  function movePaddle(w, x){
    if (w.dead) return;
    var half = paddleWidth(w) / 2;
    w.paddle = Math.max(half, Math.min(W - half, x));
    if (w.stuck) w.balls[0].x = w.paddle;
  }

  // Launches the ball off the paddle, up and to one side. Returns whether it went.
  function launch(w){
    if (w.dead || !w.stuck) return false;
    var side = w.rand() < 0.5 ? -1 : 1;
    w.stuck = false;
    w.balls[0].dx = side * Math.sin(SERVE);
    w.balls[0].dy = -Math.cos(SERVE);
    return true;
  }

  // The brick the ball at (x, y) overlaps, or -1.
  function brickAt(w, x, y){
    // Only the bricks around the ball can be touching it.
    var c0 = Math.max(0, Math.floor((x - R - SIDE) / BW)), c1 = Math.min(COLS - 1, Math.floor((x + R - SIDE) / BW));
    var r0 = Math.max(0, Math.floor((y - R - TOP) / BH)), r1 = Math.min(ROWS - 1, Math.floor((y + R - TOP) / BH));
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var i = r * COLS + c;
        if (!w.bricks[i]) continue;
        var b = brickRect(i);
        var nx = Math.max(b.x, Math.min(x, b.x + b.w)), ny = Math.max(b.y, Math.min(y, b.y + b.h));
        if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < R * R) return i;
      }
    }
    return -1;
  }

  // Breaks brick `i`: it scores, and drops the power it hid.
  function breakBrick(w, i, ev){
    var r = brickRect(i);
    w.bricks[i] = 0;
    w.score += POINTS[Math.floor(i / COLS)];
    ev.bricks.push(i);
    if (w.loot[i]) {
      w.drops.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, kind: w.loot[i] });
      w.loot[i] = '';
    }
  }

  // Moves ball `b` `d` units. Fills in `ev` with what happened.
  function move(w, b, d, ev){
    var px = b.x, py = b.y;
    b.x += b.dx * d; b.y += b.dy * d;

    if (b.x < R) { b.x = R; b.dx = Math.abs(b.dx); ev.wall = true; }
    if (b.x > W - R) { b.x = W - R; b.dx = -Math.abs(b.dx); ev.wall = true; }
    if (b.y < R) {
      b.y = R; b.dy = Math.abs(b.dy); ev.wall = true;
      if (!w.small) { w.small = true; ev.shrink = true; }
    }

    var hit = brickAt(w, b.x, b.y);
    // A fireball burns through every brick it touches without bouncing.
    if (w.fire > 0) {
      for (; hit >= 0; hit = brickAt(w, b.x, b.y)) breakBrick(w, hit, ev);
    }
    if (hit >= 0) {
      var r = brickRect(hit);
      // It bounces off the side it came in through: off the top or bottom
      // when it was level with the brick across, otherwise off an end.
      if (px >= r.x && px <= r.x + r.w) b.dy = py < r.y + r.h / 2 ? -Math.abs(b.dy) : Math.abs(b.dy);
      else if (py >= r.y && py <= r.y + r.h) b.dx = px < r.x + r.w / 2 ? -Math.abs(b.dx) : Math.abs(b.dx);
      else b.dy = -b.dy;
      b.x = px; b.y = py;
      breakBrick(w, hit, ev);
      return;
    }

    // Off the paddle: where it lands decides the angle it leaves at, from
    // straight up in the middle to 60° at the ends.
    var half = paddleWidth(w) / 2;
    if (b.dy > 0 && py + R <= PADDLE_Y && b.y + R >= PADDLE_Y && Math.abs(b.x - w.paddle) <= half + R) {
      var off = Math.max(-1, Math.min(1, (b.x - w.paddle) / half));
      b.dx = Math.sin(off * MAX_ANGLE);
      b.dy = -Math.cos(off * MAX_ANGLE);
      b.y = PADDLE_Y - R;
      ev.paddle = true;
    }
  }

  // A ball heading off `a` radians round from `b`, never too flat to come back.
  function turned(b, a){
    var dx = b.dx * Math.cos(a) - b.dy * Math.sin(a), dy = b.dx * Math.sin(a) + b.dy * Math.cos(a);
    if (Math.abs(dy) < MIN_DY) {
      dy = dy > 0 ? MIN_DY : -MIN_DY;
      dx = (dx < 0 ? -1 : 1) * Math.sqrt(1 - MIN_DY * MIN_DY);
    }
    return { x: b.x, y: b.y, dx: dx, dy: dy };
  }

  // Turns on a power the paddle caught.
  function power(w, kind){
    if (kind === 'multi') {
      // Every ball splits in three, up to the limit.
      var more = [];
      w.balls.forEach(function(b){
        [SPLIT, -SPLIT].forEach(function(a){ if (w.balls.length + more.length < MAX_BALLS) more.push(turned(b, a)); });
      });
      w.balls = w.balls.concat(more);
    }
    else if (kind === 'fire') w.fire = FIRE_TIME;
    else if (kind === 'laser') { if (!(w.laser > 0)) w.reload = 0; w.laser = LASER_TIME; }
    else if (kind === 'wide') { w.wide = WIDE_TIME; movePaddle(w, w.paddle); }
    else if (kind === 'life') w.lives = Math.min(MAX_LIVES, w.lives + 1);
  }

  // The brick a shot's tip at (x, y) is in, or -1.
  function shotHit(w, x, y){
    var c = Math.floor((x - SIDE) / BW), r = Math.floor((y - TOP) / BH);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    return w.bricks[r * COLS + c] ? r * COLS + c : -1;
  }

  // Capsules fall and are caught; the laser fires and its shots fly; the
  // powers' time runs down.
  function stepPowers(w, dt, ev){
    var half = paddleWidth(w) / 2;
    w.drops = w.drops.filter(function(p){
      p.y += DROP_SPEED * dt;
      if (p.y + DROP_H / 2 >= PADDLE_Y && p.y - DROP_H / 2 <= PADDLE_Y + PADDLE_H && Math.abs(p.x - w.paddle) <= half + DROP_W / 2) {
        power(w, p.kind);
        ev.powers.push(p.kind);
        return false;
      }
      return p.y - DROP_H / 2 <= H;
    });

    if (w.laser > 0) {
      w.reload -= dt;
      if (w.reload <= 0) {
        // One shot from each end of the paddle.
        half = paddleWidth(w) / 2;
        w.shots.push({ x: w.paddle - half + 4, y: PADDLE_Y }, { x: w.paddle + half - 4, y: PADDLE_Y });
        w.reload = SHOT_EVERY;
        ev.shot = true;
      }
    }
    var dist = SHOT_SPEED * dt, n = Math.ceil(dist / SUBSTEP);
    w.shots = w.shots.filter(function(s){
      for (var i = 0; i < n; i++) {
        s.y -= dist / n;
        var hit = shotHit(w, s.x, s.y);
        if (hit >= 0) { breakBrick(w, hit, ev); return false; }
      }
      return s.y > 0;
    });

    w.fire = Math.max(0, w.fire - dt);
    w.laser = Math.max(0, w.laser - dt);
    w.wide = Math.max(0, w.wide - dt);
  }

  // After a move: a cleared wall puts up the next, and losing the last ball
  // in play loses a life. Returns whether either happened.
  function settle(w, ev){
    if (w.bricks.indexOf(1) < 0) {
      // The wall is cleared: a new one goes up, and the ball starts again on the paddle.
      w.level++;
      build(w);
      w.small = false;
      clearPowers(w);
      movePaddle(w, w.paddle);
      stick(w);
      ev.cleared = true;
      return true;
    }
    if (!w.balls.length) {
      w.lives--;
      ev.lost = true;
      clearPowers(w);
      if (w.lives <= 0) { w.lives = 0; w.dead = ev.end = 'out'; }
      else stick(w);
      return true;
    }
    return false;
  }

  // Runs the game for `dt` seconds. Returns what happened: the bricks broken
  // (by index), whether a ball bounced off the paddle or a wall, whether the
  // paddle shrank, the powers caught, whether the laser fired, a ball was
  // lost, the wall was cleared, and how the game ended, if it did.
  function advance(w, dt){
    var ev = { bricks: [], paddle: false, wall: false, shrink: false, powers: [], shot: false, lost: false, cleared: false, end: null };
    if (w.dead || w.stuck) return ev;
    var dist = speed(w) * dt;
    var n = Math.ceil(dist / SUBSTEP);
    for (var i = 0; i < n; i++) {
      w.balls.forEach(function(b){ move(w, b, dist / n, ev); });
      w.balls = w.balls.filter(function(b){ return b.y - R <= H; });
      if (settle(w, ev)) return ev;
    }
    stepPowers(w, dt, ev);
    settle(w, ev);
    return ev;
  }

  window.bdnixBricks = {
    W: W, H: H, COLS: COLS, ROWS: ROWS, SIDE: SIDE, TOP: TOP, BW: BW, BH: BH, GAP: GAP, POINTS: POINTS,
    PADDLE_Y: PADDLE_Y, PADDLE_H: PADDLE_H, PADDLE_W: PADDLE_W, SMALL_W: SMALL_W, R: R, LIVES: LIVES,
    BASE: BASE, BOOST: BOOST, MAX: MAX, MAX_ANGLE: MAX_ANGLE, SERVE: SERVE,
    KINDS: KINDS, LOOT: LOOT, FIRE_TIME: FIRE_TIME, LASER_TIME: LASER_TIME, WIDE_TIME: WIDE_TIME, WIDE_GROW: WIDE_GROW,
    MAX_BALLS: MAX_BALLS, SPLIT: SPLIT, MIN_DY: MIN_DY, MAX_LIVES: MAX_LIVES, DROP_W: DROP_W, DROP_H: DROP_H,
    DROP_SPEED: DROP_SPEED, SHOT_SPEED: SHOT_SPEED, SHOT_EVERY: SHOT_EVERY, SHOT_H: SHOT_H,
    create: create, fullWall: fullWall, hideLoot: hideLoot, brickRect: brickRect, paddleWidth: paddleWidth, progress: progress,
    speed: speed, stick: stick, movePaddle: movePaddle, launch: launch, brickAt: brickAt, power: power, advance: advance
  };
})();
