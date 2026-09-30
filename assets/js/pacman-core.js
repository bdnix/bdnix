// Maze Chase rules: the maze, how the player and the ghosts move through it,
// where each ghost heads, speeds and points, and the saved-game check. No DOM,
// so it can be unit tested; pacman.js runs the game, draws it and handles
// input. Positions are in tiles (x across from 0 at the left, y down from 0
// at the top), with whole numbers at tile centres; speeds are in tiles per
// second and times in seconds. A direction is one of UP, LEFT, DOWN, RIGHT.
(function(){
  // 28x31 maze drawn for this game. # wall, - ghost-house door, . dot, o power pellet.
  var MAP = [
    '############################',
    '#o........................o#',
    '#.###.####.######.####.###.#',
    '#.###.####.######.####.###.#',
    '#..........................#',
    '#.####.###.######.###.####.#',
    '#.####.###.######.###.####.#',
    '#..........................#',
    '###.####.##########.####.###',
    '###.####.##########.####.###',
    '###.####.##########.####.###',
    '###......          ......###',
    '######.## ###--### ##.######',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '######.## ######## ##.######',
    '###......          ......###',
    '###.##### ######## #####.###',
    '###.##### ######## #####.###',
    '#..........................#',
    '#.##.####.########.####.##.#',
    '#.##.####.########.####.##.#',
    '#o...........  ...........o#',
    '###.##.###.######.###.##.###',
    '###.##.###.######.###.##.###',
    '#..........................#',
    '#.#####.############.#####.#',
    '#.#####.############.#####.#',
    '#..........................#',
    '############################'
  ];
  var COLS = 28, ROWS = 31, TUNNEL_ROW = 14;
  var DOOR = { x: 13.5, y: 11 }, HOUSE_Y = 14;
  var UP = {x:0,y:-1}, LEFT = {x:-1,y:0}, DOWN = {x:0,y:1}, RIGHT = {x:1,y:0};
  var DIRS = [UP, LEFT, DOWN, RIGHT]; // tie-break order, as in the arcade
  var DIR_BY_NAME = { up: UP, left: LEFT, down: DOWN, right: RIGHT };
  var MODES = [7, 20, 7, 20, 5, 20, 5, Infinity]; // scatter, chase, scatter, ...
  // Where each ghost starts, the corner it heads for when scattering, and
  // when it leaves the house: after `wait` seconds of a life, or once
  // `dots` dots have been eaten in the level.
  var GHOSTS = [
    { name:'blinky', corner:{x:25,y:-3}, start:{x:13.5,y:11},      inHouse:false },
    { name:'pinky',  corner:{x:2, y:-3}, start:{x:13.5,y:HOUSE_Y}, inHouse:true, wait:1,  dots:0 },
    { name:'inky',   corner:{x:27,y:32}, start:{x:11.5,y:HOUSE_Y}, inHouse:true, wait:5,  dots:30 },
    { name:'clyde',  corner:{x:0, y:32}, start:{x:15.5,y:HOUSE_Y}, inHouse:true, wait:9,  dots:60 }
  ];
  var GHOST_STATES = ['house', 'leaving', 'active', 'eaten', 'entering'];
  var RUNNING = ['ready', 'playing', 'dying', 'cleared'];

  // ---------- Maze ----------
  // Off the board is wall, except along the tunnel row.
  function isWall(x, y){
    if (y === TUNNEL_ROW && (x < 0 || x >= COLS)) return false;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    var c = MAP[y][x];
    return c === '#' || c === '-';
  }
  // A full level's dots: rows of 0 (none), 1 (dot) or 2 (power pellet).
  function newDots(){
    var dots = [], count = 0;
    for (var y = 0; y < ROWS; y++) {
      dots.push([]);
      for (var x = 0; x < COLS; x++) {
        var c = MAP[y][x];
        var v = c === '.' ? 1 : c === 'o' ? 2 : 0;
        dots[y].push(v);
        if (v) count++;
      }
    }
    return { dots: dots, count: count };
  }

  // ---------- Speeds (tiles per second) and points ----------
  function pacSpeed(level){ return Math.min(9.5, 7.6 + (level - 1) * 0.3); }
  function ghostSpeed(g, level){
    if (g.state === 'eaten') return 15;
    var base = Math.min(9.2, 7.1 + (level - 1) * 0.35);
    if (g.state !== 'active') return 4;
    var ty = Math.round(g.y), tx = Math.round(g.x);
    if (ty === TUNNEL_ROW && (tx <= 5 || tx >= 22)) return base * 0.45;
    if (g.fright) return base * 0.55;
    return base;
  }
  function frightDuration(level){ return Math.max(1.5, 7 - level); }
  function fruitPoints(level){ return Math.min(5000, 100 * level); }
  // 200, 400, 800, then 1600 for each ghost caught on one power pellet.
  function ghostPoints(combo){ return 200 << Math.min(combo, 3); }

  // ---------- Movement ----------
  // Through the tunnel and out the other side.
  function wrap(e){
    if (e.x < -1) e.x = COLS;
    else if (e.x > COLS) e.x = -1;
  }
  // Moves e along the grid by dist tiles. At each tile centre, choose(e) may
  // change e.dir; a null dir stops it. The player's chomp counts the distance.
  function advance(e, dist, choose){
    var guard = 0;
    while (dist > 1e-6 && guard++ < 8) {
      var rx = Math.round(e.x), ry = Math.round(e.y);
      if (Math.abs(e.x - rx) < 1e-6 && Math.abs(e.y - ry) < 1e-6) {
        e.x = rx; e.y = ry;
        wrap(e);
        choose(e);
        if (!e.dir) return;
      }
      var nx = e.dir.x > 0 ? Math.floor(e.x) + 1 : e.dir.x < 0 ? Math.ceil(e.x) - 1 : e.x;
      var ny = e.dir.y > 0 ? Math.floor(e.y) + 1 : e.dir.y < 0 ? Math.ceil(e.y) - 1 : e.y;
      var step = Math.min(Math.abs(nx - e.x) + Math.abs(ny - e.y), dist);
      e.x += e.dir.x * step; e.y += e.dir.y * step;
      dist -= step;
      if (typeof e.chomp === 'number') e.chomp += step;
    }
  }
  // Straight-line scripted move, across then up or down (used in and around
  // the ghost house). Returns true on arriving.
  function moveToward(e, tx, ty, dist){
    var dx = tx - e.x, dy = ty - e.y;
    if (Math.abs(dx) > 1e-6) {
      var sx = Math.sign(dx) * Math.min(Math.abs(dx), dist);
      e.x += sx; dist -= Math.abs(sx);
      e.dir = dx > 0 ? RIGHT : LEFT;
    }
    if (dist > 0 && Math.abs(dy) > 1e-6) {
      var sy = Math.sign(dy) * Math.min(Math.abs(dy), dist);
      e.y += sy; dist -= Math.abs(sy);
      e.dir = dy > 0 ? DOWN : UP;
    }
    return Math.abs(tx - e.x) < 1e-6 && Math.abs(ty - e.y) < 1e-6;
  }

  // At a tile centre the player turns the way that's wanted if it's open,
  // and stops at a wall.
  function pacChoose(p, wanted){
    var x = Math.round(p.x), y = Math.round(p.y);
    if (wanted && !isWall(x + wanted.x, y + wanted.y)) p.dir = wanted;
    else if (p.dir && isWall(x + p.dir.x, y + p.dir.y)) p.dir = null;
    if (p.dir) p.face = p.dir;
  }

  function reverse(g){ if (g.dir) g.dir = { x: -g.dir.x, y: -g.dir.y }; }

  // ---------- Ghosts ----------
  // The tile a ghost heads for. Eaten, it goes home; scattering, to its
  // corner; chasing, each has its own way of hunting the player:
  // blinky straight at them, pinky 4 tiles ahead of them, inky double the
  // line from blinky to 2 tiles ahead of them, clyde at them from afar but
  // to his corner when within 8 tiles.
  function ghostTarget(g, pac, blinky, chase){
    if (g.state === 'eaten') return { x: 13, y: 11 };
    if (!chase) return g.def.corner;
    var px = Math.round(pac.x), py = Math.round(pac.y), f = pac.face;
    switch (g.def.name) {
      case 'blinky': return { x: px, y: py };
      case 'pinky': return { x: px + f.x * 4, y: py + f.y * 4 };
      case 'inky':
        var vx = px + f.x * 2, vy = py + f.y * 2;
        return { x: vx * 2 - Math.round(blinky.x), y: vy * 2 - Math.round(blinky.y) };
      default:
        var dx = px - g.x, dy = py - g.y;
        return dx * dx + dy * dy > 64 ? { x: px, y: py } : g.def.corner;
    }
  }
  // At a tile centre a ghost never turns back. It takes the open way that
  // gets it nearest its target, or a random one (from rand) when frightened.
  // An eaten ghost reaching the door goes in.
  function ghostChoose(g, pac, blinky, chase, rand){
    var x = Math.round(g.x), y = Math.round(g.y);
    if (g.state === 'eaten' && y === 11 && (x === 13 || x === 14)) {
      g.state = 'entering'; g.dir = null; return;
    }
    var opts = [];
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i];
      if (g.dir && d.x === -g.dir.x && d.y === -g.dir.y) continue;
      if (!isWall(x + d.x, y + d.y)) opts.push(d);
    }
    if (!opts.length) { g.dir = { x: -g.dir.x, y: -g.dir.y }; return; }
    if (g.fright) { g.dir = opts[Math.floor(rand() * opts.length)]; return; }
    var t = ghostTarget(g, pac, blinky, chase), bestD = Infinity;
    opts.forEach(function(d){
      var ex = x + d.x - t.x, ey = y + d.y - t.y, dd = ex * ex + ey * ey;
      if (dd < bestD) { bestD = dd; g.dir = d; }
    });
  }

  // Moves a ghost for dt seconds. `w` is what it reacts to: the level,
  // lifeTime (seconds since this life began), dotsEaten, the pac, blinky,
  // chase (true in a chase phase) and rand.
  function updateGhost(g, dt, w){
    var dist = ghostSpeed(g, w.level) * dt;
    switch (g.state) {
      case 'house':
        g.bob += dt * 4;
        g.y = HOUSE_Y + Math.sin(g.bob) * 0.35;
        g.dir = Math.cos(g.bob) > 0 ? DOWN : UP;
        if (w.lifeTime >= g.def.wait || (g.def.dots && w.dotsEaten >= g.def.dots)) g.state = 'leaving';
        break;
      case 'leaving':
        if (Math.abs(g.x - DOOR.x) > 1e-6) moveToward(g, DOOR.x, HOUSE_Y, dist);
        else if (moveToward(g, DOOR.x, DOOR.y, dist)) { g.state = 'active'; g.dir = LEFT; }
        break;
      case 'entering':
        if (Math.abs(g.x - DOOR.x) > 1e-6 && g.y <= DOOR.y + 1e-6) moveToward(g, DOOR.x, DOOR.y, dist);
        else if (moveToward(g, DOOR.x, HOUSE_Y, dist)) g.state = 'leaving';
        break;
      default:
        advance(g, dist, function(e){ ghostChoose(e, w.pac, w.blinky, w.chase, w.rand); });
    }
  }

  // ---------- Saving ----------
  // Whether a saved game (see snapshot() in pacman.js) makes sense.
  function num(n){ return typeof n === 'number' && isFinite(n); }
  function isDir(d){ return !!d && [-1, 0, 1].indexOf(d.x) >= 0 && [-1, 0, 1].indexOf(d.y) >= 0; }
  // A dot or pellet can only be where the maze has one (a save from an older maze doesn't fit).
  function isRow(r, y){ return Array.isArray(r) && r.length === COLS && r.every(function(v, x){ return v === 0 || v === '.o'.indexOf(MAP[y][x]) + 1; }); }
  function validSave(s){
    if (!s || typeof s !== 'object') return false;
    var p = s.pac, f = s.fruit;
    return RUNNING.indexOf(s.state) >= 0 &&
      Array.isArray(s.dots) && s.dots.length === ROWS && s.dots.every(isRow) &&
      !!p && num(p.x) && num(p.y) && num(p.chomp) && isDir(p.face) && (p.dir === null || isDir(p.dir)) &&
      (s.wanted === null || isDir(s.wanted)) &&
      Array.isArray(s.ghosts) && s.ghosts.length === GHOSTS.length && s.ghosts.every(function(g){
        return !!g && num(g.x) && num(g.y) && num(g.bob) && (g.dir === null || isDir(g.dir)) &&
          GHOST_STATES.indexOf(g.state) >= 0;
      }) &&
      (f === null || (!!f && num(f.x) && num(f.y) && num(f.t))) &&
      Array.isArray(s.popups) && s.popups.every(function(q){ return !!q && num(q.x) && num(q.y) && num(q.t); }) &&
      [s.stateTime, s.dotsLeft, s.dotsEaten, s.totalDots, s.score, s.level, s.lives, s.modeIndex,
        s.modeTime, s.frightTime, s.frightCombo, s.lifeTime, s.freeze].every(num);
  }

  window.bdnixPacman = {
    MAP: MAP, COLS: COLS, ROWS: ROWS, TUNNEL_ROW: TUNNEL_ROW, DOOR: DOOR, HOUSE_Y: HOUSE_Y,
    UP: UP, LEFT: LEFT, DOWN: DOWN, RIGHT: RIGHT, DIRS: DIRS, DIR_BY_NAME: DIR_BY_NAME,
    MODES: MODES, GHOSTS: GHOSTS, RUNNING: RUNNING,
    isWall: isWall, newDots: newDots,
    pacSpeed: pacSpeed, ghostSpeed: ghostSpeed, frightDuration: frightDuration,
    fruitPoints: fruitPoints, ghostPoints: ghostPoints,
    wrap: wrap, advance: advance, moveToward: moveToward, pacChoose: pacChoose, reverse: reverse,
    ghostTarget: ghostTarget, ghostChoose: ghostChoose, updateGhost: updateGhost,
    validSave: validSave
  };
})();
