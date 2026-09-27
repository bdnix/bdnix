// Snake rules: the snake's moves and turns, the food, and what ends a round.
// No DOM, so it can be unit tested; snake.js draws the board and handles
// input. Positions are in cells (the board is COLS wide, ROWS tall), with
// x counting right from 0 and y counting down from 0 at the top; times are
// in seconds.
(function(){
  var COLS = 17, ROWS = 17;
  var START_LEN = 3;
  var START = { x: 6, y: 8 };           // the head; the tail trails off to the left
  var FIRST_FOOD = { x: 12, y: 8 };     // straight ahead, so the first bite is easy
  var SLOW = 0.15, FAST = 0.07;         // seconds per step, at the start and at top speed
  var SPEEDUP = 0.004;                  // seconds taken off per piece of food eaten

  var DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // How long each step takes: the snake speeds up as it eats.
  function interval(score){ return Math.max(FAST, SLOW - score * SPEEDUP); }

  function onBody(body, x, y){
    for (var i = 0; i < body.length; i++) if (body[i].x === x && body[i].y === y) return true;
    return false;
  }

  // Drops the food on a free cell picked with `rand`. Returns false when
  // there's no room left.
  function placeFood(w){
    var free = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) if (!onBody(w.body, x, y)) free.push({ x: x, y: y });
    }
    if (!free.length) { w.food = null; return false; }
    w.food = free[Math.min(free.length - 1, Math.floor(w.rand() * free.length))];
    return true;
  }

  // A new round. `rand` places the food after the first (Math.random if omitted).
  function create(rand){
    var body = [];
    for (var i = 0; i < START_LEN; i++) body.push({ x: START.x - i, y: START.y });
    return {
      rand: rand || Math.random,
      body: body,               // head first
      dir: 'right',             // the way the snake last moved
      queue: [],                // turns pressed but not made yet
      food: { x: FIRST_FOOD.x, y: FIRST_FOOD.y },
      score: 0,
      dead: null                // how the round ended: 'wall', 'self' or 'full'
    };
  }

  // Queues a turn for the coming steps. Pressing the way the snake is already
  // going, or straight back into itself, does nothing; two quick presses make
  // two turns on two steps. Returns whether the turn was queued.
  function turn(w, dir){
    if (w.dead || !DIRS[dir]) return false;
    var last = w.queue.length ? w.queue[w.queue.length - 1] : w.dir;
    if (dir === last || dir === OPPOSITE[last] || w.queue.length >= 2) return false;
    w.queue.push(dir);
    return true;
  }

  // Moves the snake one cell. Returns how the round ended, or null.
  function step(w){
    if (w.dead) return null;
    if (w.queue.length) w.dir = w.queue.shift();
    var d = DIRS[w.dir], head = w.body[0];
    var x = head.x + d.x, y = head.y + d.y;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return (w.dead = 'wall');
    var eats = !!w.food && x === w.food.x && y === w.food.y;
    // The tail moves out of the way on this step unless the snake is growing.
    var rest = eats ? w.body : w.body.slice(0, -1);
    if (onBody(rest, x, y)) return (w.dead = 'self');
    w.body.unshift({ x: x, y: y });
    if (!eats) { w.body.pop(); return null; }
    w.score++;
    if (!placeFood(w)) w.dead = 'full';
    return w.dead;
  }

  // Runs whole steps for `dt` seconds. `carry` is the time left over from the
  // last call; returns the new carry, how many steps were taken, and how the
  // round ended, if it did.
  function advance(w, dt, carry){
    var t = (carry || 0) + dt, end = null, steps = 0;
    while (t >= interval(w.score) && !end) {
      t -= interval(w.score);
      end = step(w);
      steps++;
    }
    return { carry: end ? 0 : t, steps: steps, end: end };
  }

  window.bdnixSnake = {
    COLS: COLS, ROWS: ROWS, START_LEN: START_LEN, START: START, FIRST_FOOD: FIRST_FOOD,
    SLOW: SLOW, FAST: FAST, SPEEDUP: SPEEDUP, DIRS: DIRS, OPPOSITE: OPPOSITE,
    create: create, turn: turn, step: step, advance: advance,
    interval: interval, placeFood: placeFood, onBody: onBody
  };
})();
