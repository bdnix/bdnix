// Brick Bounce rules: the wall of bricks, the paddle, and the ball bouncing
// between them. No DOM, so it can be unit tested; bricks.js draws the board
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

  function paddleWidth(w){ return w.small ? SMALL_W : PADDLE_W; }

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

  // Puts the ball back on the middle of the paddle, waiting to be launched.
  function stick(w){
    w.stuck = true;
    w.ball = { x: w.paddle, y: PADDLE_Y - R, dx: 0, dy: -1 };
  }

  // A new game. `rand` picks which way each ball is launched (Math.random if omitted).
  function create(rand){
    var w = {
      rand: rand || Math.random,
      level: 1,                 // which wall this is, from 1
      bricks: fullWall(),
      paddle: W / 2,            // the middle of the paddle
      small: false,
      ball: null,
      stuck: true,              // the ball sits on the paddle until it's launched
      lives: LIVES,             // balls left, including the one in play
      score: 0,
      dead: null                // 'out' once the last ball is lost
    };
    stick(w);
    return w;
  }

  // Moves the paddle so its middle is at `x`, as far as the walls allow. A
  // ball waiting on the paddle moves with it.
  function movePaddle(w, x){
    if (w.dead) return;
    var half = paddleWidth(w) / 2;
    w.paddle = Math.max(half, Math.min(W - half, x));
    if (w.stuck) w.ball.x = w.paddle;
  }

  // Launches the ball off the paddle, up and to one side. Returns whether it went.
  function launch(w){
    if (w.dead || !w.stuck) return false;
    var side = w.rand() < 0.5 ? -1 : 1;
    w.stuck = false;
    w.ball.dx = side * Math.sin(SERVE);
    w.ball.dy = -Math.cos(SERVE);
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

  // Moves the ball `d` units. Fills in `ev` with what happened.
  function move(w, d, ev){
    var b = w.ball, px = b.x, py = b.y;
    b.x += b.dx * d; b.y += b.dy * d;

    if (b.x < R) { b.x = R; b.dx = Math.abs(b.dx); ev.wall = true; }
    if (b.x > W - R) { b.x = W - R; b.dx = -Math.abs(b.dx); ev.wall = true; }
    if (b.y < R) {
      b.y = R; b.dy = Math.abs(b.dy); ev.wall = true;
      if (!w.small) { w.small = true; ev.shrink = true; }
    }

    var hit = brickAt(w, b.x, b.y);
    if (hit >= 0) {
      var r = brickRect(hit);
      // It bounces off the side it came in through: off the top or bottom
      // when it was level with the brick across, otherwise off an end.
      if (px >= r.x && px <= r.x + r.w) b.dy = py < r.y + r.h / 2 ? -Math.abs(b.dy) : Math.abs(b.dy);
      else if (py >= r.y && py <= r.y + r.h) b.dx = px < r.x + r.w / 2 ? -Math.abs(b.dx) : Math.abs(b.dx);
      else b.dy = -b.dy;
      b.x = px; b.y = py;
      w.bricks[hit] = 0;
      w.score += POINTS[Math.floor(hit / COLS)];
      ev.bricks.push(hit);
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

  // Runs the game for `dt` seconds. Returns what happened: the bricks broken
  // (by index), whether the ball bounced off the paddle or a wall, whether
  // the paddle shrank, a ball was lost, the wall was cleared, and how the
  // game ended, if it did.
  function advance(w, dt){
    var ev = { bricks: [], paddle: false, wall: false, shrink: false, lost: false, cleared: false, end: null };
    if (w.dead || w.stuck) return ev;
    var dist = speed(w) * dt;
    var n = Math.ceil(dist / SUBSTEP);
    for (var i = 0; i < n; i++) {
      move(w, dist / n, ev);
      if (w.bricks.indexOf(1) < 0) {
        // The wall is cleared: a new one goes up, and the ball starts again on the paddle.
        w.level++;
        w.bricks = fullWall();
        w.small = false;
        movePaddle(w, w.paddle);
        stick(w);
        ev.cleared = true;
        break;
      }
      if (w.ball.y - R > H) {
        w.lives--;
        ev.lost = true;
        if (w.lives <= 0) { w.lives = 0; w.dead = ev.end = 'out'; }
        else stick(w);
        break;
      }
    }
    return ev;
  }

  window.bdnixBricks = {
    W: W, H: H, COLS: COLS, ROWS: ROWS, SIDE: SIDE, TOP: TOP, BW: BW, BH: BH, GAP: GAP, POINTS: POINTS,
    PADDLE_Y: PADDLE_Y, PADDLE_H: PADDLE_H, PADDLE_W: PADDLE_W, SMALL_W: SMALL_W, R: R, LIVES: LIVES,
    BASE: BASE, BOOST: BOOST, MAX: MAX, MAX_ANGLE: MAX_ANGLE, SERVE: SERVE,
    create: create, fullWall: fullWall, brickRect: brickRect, paddleWidth: paddleWidth, progress: progress,
    speed: speed, stick: stick, movePaddle: movePaddle, launch: launch, brickAt: brickAt, advance: advance
  };
})();
