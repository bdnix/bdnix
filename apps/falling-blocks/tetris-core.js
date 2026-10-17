// Falling Blocks rules: the board, how pieces are dealt, move, rotate, lock
// and clear lines, and the score and speed. No DOM, so it can be unit tested;
// tetris.js draws the game and handles input and timing.
// The board is ROWS rows of COLS cells, each null or the type of the piece
// that left it ('I', 'O', ...). A piece is { type, m, x, y }: m is its square
// matrix of 0s and 1s, and (x, y) the board cell under the matrix's top left,
// with y counting down from 0 at the top (negative while it's coming in).
// The piece shapes come from blocks.js, so the functions that need them take
// them as `shapes`.
(function(){
  var COLS = 10, ROWS = 20;
  var LINE_SCORES = [0, 100, 300, 500, 800];      // for 0 to 4 lines, times the level
  // Where a rotated piece may shift to fit, tried in order.
  var KICKS = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[-1,-1],[1,-1]];

  function emptyRow(){ return new Array(COLS).fill(null); }
  function emptyGrid(){
    var grid = [];
    for (var i = 0; i < ROWS; i++) grid.push(emptyRow());
    return grid;
  }

  // One of each piece type in a random order (a "7-bag"), shuffled with `rand`.
  function bag(shapes, rand){
    var b = Object.keys(shapes);
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  // A new piece at the top, centred. The I piece's matrix has an empty top
  // row, so it starts a row higher to show on the board's first row.
  function makePiece(shapes, type){
    var m = shapes[type].map(function(r){ return r.slice(); });
    return { type: type, m: m, x: Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
  }

  // The matrix turned a quarter clockwise (dir 1) or anticlockwise (dir -1).
  function rotateMatrix(m, dir){
    var n = m.length, out = [];
    for (var r = 0; r < n; r++) {
      out.push([]);
      for (var c = 0; c < n; c++) {
        out[r][c] = dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r];
      }
    }
    return out;
  }

  // Whether matrix m at (x, y) would overlap a wall, the floor or a filled
  // cell. Above the board is open.
  function collides(grid, m, x, y){
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var gx = x + c, gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function onGround(grid, p){ return collides(grid, p.m, p.x, p.y + 1); }

  // Where the piece ends up turned: { m, x, y } at the first kick that fits,
  // or null if none does. The O piece looks the same turned, so it doesn't.
  function rotated(grid, p, dir){
    if (p.type === 'O') return null;
    var m = rotateMatrix(p.m, dir);
    for (var i = 0; i < KICKS.length; i++) {
      var x = p.x + KICKS[i][0], y = p.y + KICKS[i][1];
      if (!collides(grid, m, x, y)) return { m: m, x: x, y: y };
    }
    return null;
  }

  // How many rows the piece can fall before it lands.
  function dropDistance(grid, p){
    var d = 0;
    while (!collides(grid, p.m, p.x, p.y + d + 1)) d++;
    return d;
  }

  // Writes the piece into the board. Returns true if any of it was left
  // above the top, which ends the game.
  function place(grid, p){
    var above = false;
    for (var r = 0; r < p.m.length; r++) {
      for (var c = 0; c < p.m[r].length; c++) {
        if (!p.m[r][c]) continue;
        var gy = p.y + r;
        if (gy < 0) { above = true; continue; }
        grid[gy][p.x + c] = p.type;
      }
    }
    return above;
  }

  // The rows with no gaps, top to bottom.
  function fullRows(grid){
    var full = [];
    for (var y = 0; y < ROWS; y++) if (grid[y].every(Boolean)) full.push(y);
    return full;
  }

  // Takes the rows out and drops everything above them.
  function clearRows(grid, rows){
    rows.forEach(function(y){
      grid.splice(y, 1);
      grid.unshift(emptyRow());
    });
  }

  function lineScore(n, level){ return LINE_SCORES[n] * level; }
  // A level every 10 lines, starting at 1.
  function levelFor(lines){ return Math.floor(lines / 10) + 1; }
  // Roughly follows the guideline gravity curve, in ms per row.
  function dropInterval(level){
    return Math.max(30, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000);
  }

  // Whether a saved game (see snapshot() in tetris.js) makes sense.
  function num(n){ return typeof n === 'number' && isFinite(n); }
  function validSave(s, shapes){
    function isType(t){ return typeof t === 'string' && Object.prototype.hasOwnProperty.call(shapes, t); }
    function isRow(r){ return Array.isArray(r) && r.length === COLS && r.every(function(c){ return c === null || isType(c); }); }
    function isMatrix(m){ return Array.isArray(m) && m.length > 0 && m.every(function(r){ return Array.isArray(r) && r.length === m.length; }); }
    if (!s || typeof s !== 'object') return false;
    var p = s.piece, c = s.clearing;
    return Array.isArray(s.grid) && s.grid.length === ROWS && s.grid.every(isRow) &&
      Array.isArray(s.queue) && s.queue.length >= 3 && s.queue.every(isType) &&
      Array.isArray(s.bag) && s.bag.every(isType) &&
      (s.held === null || isType(s.held)) &&
      // Either a piece is falling, or rows are being cleared.
      (p ? isType(p.type) && isMatrix(p.m) && num(p.x) && num(p.y) :
        !!c && num(c.t) && Array.isArray(c.rows) && c.rows.every(function(y){ return num(y) && y >= 0 && y < ROWS; })) &&
      [s.score, s.lines, s.level, s.dropAcc, s.lockAcc, s.lockResets].every(num);
  }

  // Touch. A finger that goes sideways moves the piece a column for every
  // `step` pixels, one that goes down soft drops it a row for every `step`;
  // which way a stroke goes is settled once it has gone TAP_PX. A tap
  // rotates, and a quick flick down drops the piece, or up holds it. Give it
  // where the finger is and when (ms) as it goes down, moves and comes up;
  // each returns the moves that makes, in order: 'left', 'right', 'down',
  // 'rotate', 'drop' or 'hold'.
  var TAP_PX = 10, TAP_MS = 300;
  var FLICK_PX = 30, FLICK_SPEED = 0.5, FLICK_MS = 100;   // px, px per ms, and over about the last how many ms
  function gesture(step){
    var start, at, axis, trail;
    function track(x, y, t){
      var out = [];
      trail.push({ x: x, y: y, t: t });
      while (trail.length > 2 && t - trail[0].t > FLICK_MS) trail.shift();
      if (!axis) {
        var dx = Math.abs(x - start.x), dy = Math.abs(y - start.y);
        if (Math.max(dx, dy) <= TAP_PX) return out;
        axis = dx > dy ? 'x' : 'y';
      }
      if (axis === 'x') {
        while (x - at.x >= step) { out.push('right'); at.x += step; }
        while (at.x - x >= step) { out.push('left'); at.x -= step; }
      } else {
        while (y - at.y >= step) { out.push('down'); at.y += step; }
        if (y < at.y) at.y = y;   // back up and down again soft drops from there
      }
      return out;
    }
    return {
      down: function(x, y, t){
        start = { x: x, y: y, t: t }; at = { x: x, y: y }; axis = null; trail = [start];
        return [];
      },
      move: function(x, y, t){ return start ? track(x, y, t) : []; },
      up: function(x, y, t){
        if (!start) return [];
        var out = track(x, y, t);
        var first = trail[0], dy = y - first.y, speed = dy / Math.max(1, t - first.t);
        if (!axis && t - start.t <= TAP_MS) out.push('rotate');
        else if (axis === 'y' && dy >= FLICK_PX && speed >= FLICK_SPEED) out.push('drop');
        else if (axis === 'y' && -dy >= FLICK_PX && -speed >= FLICK_SPEED) out.push('hold');
        start = null;
        return out;
      }
    };
  }

  window.bdnixTetris = {
    COLS: COLS, ROWS: ROWS, LINE_SCORES: LINE_SCORES, KICKS: KICKS,
    emptyGrid: emptyGrid, bag: bag, makePiece: makePiece, rotateMatrix: rotateMatrix,
    collides: collides, onGround: onGround, rotated: rotated, dropDistance: dropDistance,
    place: place, fullRows: fullRows, clearRows: clearRows,
    lineScore: lineScore, levelFor: levelFor, dropInterval: dropInterval, validSave: validSave,
    gesture: gesture
  };
})();
