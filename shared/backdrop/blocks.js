// Shared by every bdnix page: one palette, one way of drawing a block,
// and the grid-aligned falling-piece backdrop.
(function(){
  var PALETTE = {
    I:'#22d3ee', J:'#60a5fa', L:'#818cf8', T:'#a855f7',
    S:'#d946ef', Z:'#f472b6', O:'#fb7185'
  };
  var SHAPES = {
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]]
  };

  function block(ctx, x, y, s, color, alpha){
    var g = Math.max(1, Math.round(s * 0.06));
    var r = Math.max(2, s * 0.18);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    roundRect(ctx, x + g, y + g, s - g * 2, s - g * 2, r);
    ctx.fill();
    // soft top sheen
    var grd = ctx.createLinearGradient(0, y, 0, y + s);
    grd.addColorStop(0, 'rgba(255,255,255,.28)');
    grd.addColorStop(.5, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = grd;
    roundRect(ctx, x + g, y + g, s - g * 2, s - g * 2, r);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.bdnix = { PALETTE: PALETTE, SHAPES: SHAPES, block: block };

  // ---- Backdrop ----
  var canvas = document.getElementById('bg');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CELL = 26, STEP = 520, TYPES = Object.keys(SHAPES);
  var cols, rows, w, h, pieces = [];
  var alpha = parseFloat(canvas.getAttribute('data-alpha')) || 0.22;

  function spawn(scatter){
    var t = TYPES[Math.floor(Math.random() * TYPES.length)];
    return {
      t: t,
      x: Math.floor(Math.random() * Math.max(1, cols - 3)),
      y: scatter ? Math.floor(Math.random() * rows) : -4,
      every: 1 + Math.floor(Math.random() * 3) // steps per move: varied speeds
    };
  }
  function resize(){
    var dpr = window.devicePixelRatio || 1;
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
    var want = Math.max(6, Math.min(26, Math.round(cols * rows / 90)));
    while (pieces.length < want) pieces.push(spawn(true));
    pieces.length = want;
    draw();
  }
  function draw(){
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.035)';
    ctx.lineWidth = 1;
    for (var x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * CELL + .5, 0); ctx.lineTo(x * CELL + .5, h); ctx.stroke(); }
    for (var y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL + .5); ctx.lineTo(w, y * CELL + .5); ctx.stroke(); }
    pieces.forEach(function(p){
      var m = SHAPES[p.t];
      for (var r = 0; r < m.length; r++) for (var c = 0; c < m[r].length; c++) {
        if (m[r][c]) block(ctx, (p.x + c) * CELL, (p.y + r) * CELL, CELL, PALETTE[p.t], alpha);
      }
    });
  }
  var tick = 0;
  function step(){
    tick++;
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (tick % p.every === 0) p.y++;
      if (p.y > rows) pieces[i] = spawn(false);
    }
    draw();
  }
  resize();
  window.addEventListener('resize', resize);
  if (!reduce) setInterval(function(){ if (!document.hidden) step(); }, STEP);
})();
