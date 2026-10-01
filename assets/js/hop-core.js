// Road Hop rules: the lanes, the traffic and logs, the chicken's hops and
// what ends a round. No DOM, so it can be unit tested; hop.js draws the
// world and handles input. Positions are in cells (the board is COLS wide,
// ROWS tall), times in seconds. Row 0 is where the chicken starts and rows
// count up the screen.
(function(){
  var COLS = 9, ROWS = 13;
  var START_COL = 4;
  var MARGIN = 3;               // cars and logs wrap this far off each side of the board
  var PERIOD = COLS + MARGIN * 2;
  var AHEAD = 4;                // the camera keeps the chicken at least this many rows from the bottom
  var CREEP = 0.3;              // rows a second the camera moves on by itself once the round starts
  var STEP = 1 / 120;           // fixed physics step
  var BODY = 0.2;               // the chicken's body leaves this much of its cell clear on each side

  // Everything below row 0 is a hedge the chicken can't hop into.
  var HEDGE = { type: 'grass', trees: [0, 1, 2, 3, 4, 5, 6, 7, 8], speed: 0, items: [] };

  function mod(a, n){ return ((a % n) + n) % n; }

  // Traffic and the river get faster the further the chicken goes.
  function pace(row){ return 1 + Math.min(row, 150) / 100; }

  // Grass: up to three trees, never in the start column of the first rows.
  function grass(w, row){
    var trees = [], n = row < 2 ? 0 : Math.floor(w.rand() * 4);
    for (var i = 0; i < n; i++) {
      var c = Math.min(COLS - 1, Math.floor(w.rand() * COLS));
      if (trees.indexOf(c) < 0) trees.push(c);
    }
    return { type: 'grass', trees: trees, speed: 0, items: [] };
  }

  // A road: two or three cars (sometimes trucks) spaced evenly round the lane.
  // Neighbouring lanes run opposite ways.
  function road(w, row){
    var dir = row % 2 ? 1 : -1;
    var speed = dir * (1.2 + w.rand() * 1.6) * pace(row);
    var n = 2 + Math.floor(w.rand() * 2), gap = PERIOD / n, items = [];
    var shift = w.rand() * gap;
    for (var i = 0; i < n; i++) {
      var len = w.rand() > 0.75 ? 2 : 1;
      items.push({ pos: mod(shift + i * gap, PERIOD), len: len, color: Math.floor(w.rand() * 4) });
    }
    return { type: 'road', trees: [], speed: speed, items: items };
  }

  // A river: three logs, slower than the traffic.
  function river(w, row){
    var dir = row % 2 ? 1 : -1;
    var speed = dir * (0.8 + w.rand() * 1.0) * pace(row);
    var gap = PERIOD / 3, items = [], shift = w.rand() * gap;
    for (var i = 0; i < 3; i++) {
      items.push({ pos: mod(shift + i * gap, PERIOD), len: 3 - Math.floor(w.rand() * 2), color: 0 });
    }
    return { type: 'river', trees: [], speed: speed, items: items };
  }

  // Lanes come in stretches: one to four roads, or one to three rivers, then
  // a strip or two of grass to rest on. A river never follows a river.
  function nextLane(w){
    var g = w.gen;
    if (g.left === 0) {
      if (g.kind !== 'grass') {
        g.kind = 'grass';
        g.left = 1 + (w.rand() < 0.3 ? 1 : 0);
      } else {
        g.kind = g.last === 'road' && w.rand() < 0.5 ? 'river' : 'road';
        g.left = g.kind === 'road' ? 1 + Math.floor(w.rand() * 4) : 1 + Math.floor(w.rand() * 3);
        g.last = g.kind;
      }
    }
    g.left--;
    var lane = g.kind === 'road' ? road(w, g.row) : g.kind === 'river' ? river(w, g.row) : grass(w, g.row);
    w.lanes.push(lane);
    g.row++;
  }

  // Makes lanes to past the top of the screen and drops ones well below it.
  function fill(w){
    while (w.gen.row < Math.max(w.camera, w.chicken.row - AHEAD) + ROWS + 2) nextLane(w);
    while (w.base < w.camera - 3) { w.lanes.shift(); w.base++; }
  }

  function laneAt(w, row){
    return row < 0 ? HEDGE : w.lanes[row - w.base] || HEDGE;
  }

  // The left edge of a car or log on the board.
  function left(item){ return item.pos - MARGIN; }

  // A new round. `rand` lays out the lanes (Math.random if omitted).
  function create(rand){
    var w = {
      rand: rand || Math.random,
      chicken: { x: START_COL, row: 0, face: 'up' },
      lanes: [], base: 0,
      gen: { row: 0, kind: 'grass', left: 0, last: null },
      camera: -2,               // the row at the bottom of the screen
      score: 0,
      started: false,
      dead: null                // how the round ended: 'car', 'water', 'swept' or 'behind'
    };
    w.gen.left = 2;             // two rows of grass to start on
    fill(w);
    return w;
  }

  // What would end the round where the chicken is now, if anything.
  function danger(w){
    var c = w.chicken, lane = laneAt(w, c.row), i, l;
    if (c.row + 0.6 < w.camera) return 'behind';
    if (lane.type === 'road') {
      for (i = 0; i < lane.items.length; i++) {
        l = left(lane.items[i]);
        if (c.x + BODY < l + lane.items[i].len && c.x + 1 - BODY > l) return 'car';
      }
    }
    if (lane.type === 'river') {
      var mid = c.x + 0.5;
      if (mid < 0 || mid > COLS) return 'swept';
      for (i = 0; i < lane.items.length; i++) {
        l = left(lane.items[i]);
        if (mid >= l && mid <= l + lane.items[i].len) return null;
      }
      return 'water';
    }
    return null;
  }

  // Hops one cell 'up', 'down', 'left' or 'right'. Returns whether it moved:
  // the edges of the board and trees are in the way.
  function hop(w, dir){
    if (w.dead) return false;
    var c = w.chicken, row = c.row, x = c.x;
    if (dir === 'up') row++;
    else if (dir === 'down') row--;
    else if (dir === 'left') x--;
    else if (dir === 'right') x++;
    else return false;
    c.face = dir;
    var lane = laneAt(w, row);
    // Only logs leave the chicken between cells; anywhere else it lands on one.
    if (lane.type !== 'river') x = Math.round(x);
    if (x < -0.01 || x > COLS - 0.99) return false;
    if (lane.trees.indexOf(Math.round(x)) >= 0) return false;
    c.row = row; c.x = x;
    w.started = true;
    if (row > w.score) w.score = row;
    w.dead = danger(w);
    fill(w);
    return true;
  }

  // One fixed step: traffic and logs move, a log carries the chicken, and the
  // camera moves on. Returns how the round ended, or null.
  function tick(w){
    if (w.dead) return null;
    var c = w.chicken;
    for (var i = 0; i < w.lanes.length; i++) {
      var lane = w.lanes[i];
      for (var j = 0; j < lane.items.length; j++) {
        lane.items[j].pos = mod(lane.items[j].pos + lane.speed * STEP, PERIOD);
      }
    }
    var here = laneAt(w, c.row);
    if (here.type === 'river') c.x += here.speed * STEP;
    if (w.started) w.camera += CREEP * STEP;
    w.camera = Math.max(w.camera, c.row - AHEAD);
    fill(w);
    w.dead = danger(w);
    return w.dead;
  }

  // Runs whole steps for `dt` seconds. `carry` is the time left over from the
  // last call; returns the new carry and how the round ended, if it did.
  function advance(w, dt, carry){
    var t = (carry || 0) + dt, end = null;
    while (t >= STEP && !end) {
      end = tick(w);
      t -= STEP;
    }
    return { carry: end ? 0 : t, end: end };
  }

  // How a car hit looks `t` seconds after it, for a car driving `dir` (1 to
  // the right, -1 to the left): the chicken squashes flat and is shoved along
  // with the car, the board shakes, a ring flashes and feathers burst out,
  // drifting down as they fade. Offsets are in cells from the chicken's centre.
  var FEATHERS = 7;
  function hitPose(t, dir){
    var squash = Math.min(1, t / 0.08);
    var shove = 1 - Math.pow(1 - Math.min(1, t / 0.15), 2);
    var shake = Math.max(0, 1 - t / 0.35);
    var p = Math.min(1, t / 0.6), spread = 1 - Math.pow(1 - p, 3);
    var feathers = [];
    for (var i = 0; i < FEATHERS; i++) {
      var a = i / FEATHERS * Math.PI * 2 + 0.4, reach = 0.6 + (i % 3) * 0.2;
      feathers.push({
        x: Math.sin(a) * reach * spread,
        y: -Math.cos(a) * reach * spread + 0.3 * p * p,
        spin: a + t * (i % 2 ? 6 : -6),
        alpha: Math.max(0, 1 - t / 0.8)
      });
    }
    return {
      sx: 1 + 0.35 * squash, sy: 1 - 0.65 * squash,
      dx: (dir < 0 ? -1 : 1) * 0.3 * shove,
      shakeX: Math.sin(t * 90) * 4 * shake, shakeY: Math.cos(t * 70) * 3 * shake,
      flash: Math.max(0, 1 - t / 0.15),
      feathers: feathers
    };
  }

  window.bdnixHop = {
    COLS: COLS, ROWS: ROWS, START_COL: START_COL, MARGIN: MARGIN, PERIOD: PERIOD,
    AHEAD: AHEAD, CREEP: CREEP, STEP: STEP,
    create: create, hop: hop, tick: tick, advance: advance,
    laneAt: laneAt, left: left, danger: danger, fill: fill, pace: pace, hitPose: hitPose
  };
})();
