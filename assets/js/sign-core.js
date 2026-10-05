// Signing maths: where a signature sits on a page, how it moves, turns and
// grows, and the pixel work that turns a drawing, typed name or photo into a
// clean signature image. No DOM or pdf-lib, so it can be unit tested
// (tests/unit/sign-core.test.mjs).
//
// A placement is { x, y, w, angle } on the page as the reader sees it (after
// its /Rotate): x and y are the signature's centre as fractions of the page
// from its top-left corner, w its width as a fraction of the page's width,
// and angle how far it's turned clockwise, in degrees. Its height follows
// from the signature's shape, so it's never stretched.
(function(){
  var MIN_W = 0.03, MAX_W = 1;

  function clamp(n, lo, hi){ return Math.min(hi, Math.max(lo, n)); }

  // An angle in degrees as -180 < a <= 180.
  function normAngle(a){
    a = a % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a || 0;   // never -0
  }

  // A placement kept sensible: its centre on the page, a width that can be
  // seen and fits, and a tidy angle.
  function fix(p){
    return {
      x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1),
      w: clamp(p.w, MIN_W, MAX_W), angle: normAngle(Math.round(p.angle * 10) / 10)
    };
  }

  // Size of the page as the reader sees it. rot is 0, 90, 180 or 270.
  function viewSize(box, rot){
    var sideways = rot % 180 !== 0;
    return { vw: sideways ? box.height : box.width, vh: sideways ? box.width : box.height };
  }

  // The signature's height as a fraction of the page's height, for a
  // signature ratio times wider than it's tall on a vw x vh page.
  function heightOf(p, vw, vh, ratio){
    return p.w * vw / ratio / vh;
  }

  // Where a new signature goes: centred across, low on the page where
  // signatures usually are, a third of the page wide but no taller than
  // a seventh of it.
  function newPlacement(vw, vh, ratio){
    var w = Math.min(1 / 3, vh / 7 * ratio / vw);
    return fix({ x: 0.5, y: 0.8, w: w, angle: 0 });
  }

  // Maps a point from the page as the reader sees it (origin bottom-left,
  // y up) to PDF page space, undoing the page's /Rotate (which turns the
  // page clockwise) and its crop box.
  function toPage(vx, vy, rot, box){
    var p = rot === 90 ? [box.width - vy, vx] :
            rot === 180 ? [box.width - vx, box.height - vy] :
            rot === 270 ? [vy, box.height - vx] : [vx, vy];
    return [p[0] + box.x, p[1] + box.y];
  }

  // What pdf-lib's drawImage needs to put a placement on a page whose crop
  // box is box ({ x, y, width, height }) and /Rotate is rot. pdf-lib turns
  // an image anticlockwise around its bottom-left corner, so that corner
  // is moved to keep the signature's centre where it belongs.
  function drawParams(p, box, rot, ratio){
    var v = viewSize(box, rot);
    var width = p.w * v.vw, height = width / ratio;
    var c = toPage(p.x * v.vw, (1 - p.y) * v.vh, rot, box);
    var angle = normAngle(rot - p.angle), a = angle * Math.PI / 180;
    var ox = width / 2 * Math.cos(a) - height / 2 * Math.sin(a);
    var oy = width / 2 * Math.sin(a) + height / 2 * Math.cos(a);
    return { x: c[0] - ox, y: c[1] - oy, width: width, height: height, rotate: angle };
  }

  // A placement moved so its centre is at (x, y), as fractions of the page.
  function moveTo(p, x, y){
    return fix({ x: x, y: y, w: p.w, angle: p.angle });
  }

  // A placement nudged by the arrow keys: 1% of the page a press, 5% with
  // Shift. Returns null for any other key.
  var STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  function nudge(p, key, big){
    var s = STEPS[key];
    if (!s) return null;
    var d = big ? 0.05 : 0.01;
    return moveTo(p, p.x + s[0] * d, p.y + s[1] * d);
  }

  // A placement scaled about its centre, as the pointer dragging its corner
  // goes from dist0 to dist pixels from that centre.
  function resize(p, dist0, dist){
    return fix({ x: p.x, y: p.y, w: dist0 > 0 ? p.w * dist / dist0 : p.w, angle: p.angle });
  }

  // How far round (clockwise from straight up, in degrees) the point (px, py)
  // is from (cx, cy), in screen pixels with y down. Within 4° of upright or
  // a quarter turn, it snaps there, so a level signature is easy.
  function angleFrom(cx, cy, px, py){
    var a = Math.atan2(px - cx, cy - py) * 180 / Math.PI;
    var q = Math.round(a / 90) * 90;
    return normAngle(Math.abs(a - q) <= 4 ? q : Math.round(a));
  }

  // The bounds of what's drawn in RGBA pixels (alpha above min), padded by
  // pad pixels and kept inside the w x h image. null if nothing is drawn.
  function inkBounds(data, w, h, pad, min){
    var l = w, t = h, r = -1, b = -1;
    min = min || 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > min) {
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < t) t = y;
          if (y > b) b = y;
        }
      }
    }
    if (r < 0) return null;
    pad = pad || 0;
    l = Math.max(0, l - pad); t = Math.max(0, t - pad);
    r = Math.min(w - 1, r + pad); b = Math.min(h - 1, b + pad);
    return { x: l, y: t, w: r - l + 1, h: b - t + 1 };
  }

  // Makes the paper behind a photographed or scanned signature see-through:
  // pixels lighter than `light` (0-255) go clear, darker than `dark` stay
  // solid, and the ones between fade, so the ink keeps smooth edges.
  function clearPaper(data, light, dark){
    light = light || 225; dark = dark || 150;
    for (var i = 0; i < data.length; i += 4) {
      var v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      var keep = v >= light ? 0 : v <= dark ? 1 : (light - v) / (light - dark);
      data[i + 3] = Math.round(data[i + 3] * keep);
    }
    return data;
  }

  // A drawn line as smooth curves: for each point after the first, the
  // control point and end of a quadratic curve through the midpoints, so
  // the pen's path has no corners. A single point is a dot.
  function smooth(points){
    var out = [];
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1], b = points[i];
      var end = i === points.length - 1 ? b : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      out.push({ cx: a[0], cy: a[1], x: end[0], y: end[1] });
    }
    return out;
  }

  // How thick the ink is at each point of a drawn line, as a share of the
  // pen's width: a slow pen leaves more ink than a fast one, as a real one
  // does. points are [x, y, t]: where, in fractions of the pad's width, and
  // when, in milliseconds; size is the pad's width in pixels. The speed is
  // smoothed so the line swells and thins gradually, and a line starts at
  // full width, where the pen first touches down.
  var INK_MAX = 1.3, INK_MIN = 0.4;
  function inkWidths(points, size){
    var out = [], v = 0;
    for (var i = 0; i < points.length; i++) {
      if (i > 0) {
        var a = points[i - 1], b = points[i], dt = b[2] - a[2];
        if (dt > 0) v = 0.6 * v + 0.4 * Math.hypot(b[0] - a[0], b[1] - a[1]) * size / dt;
      }
      out.push(Math.max(INK_MIN, INK_MAX / (1 + v * 0.8)));
    }
    return out;
  }

  // The name typed for a signature: spaces tidied, at most 60 characters.
  function cleanName(text){
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  // The signed file's name: report.pdf -> report-signed.pdf.
  function signedName(name){
    return String(name).replace(/\.pdf$/i, '') + '-signed.pdf';
  }

  // A saved signature from storage, checked before it's used: { id, png
  // (the image's bytes), w, h }. Returns null if it doesn't make sense.
  function checkSaved(s, isBytes){
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id) return null;
    if (!isBytes(s.png)) return null;
    if (!(s.w >= 1 && s.h >= 1 && s.w <= 10000 && s.h <= 10000)) return null;
    return { id: s.id, png: s.png, w: Math.round(s.w), h: Math.round(s.h) };
  }

  window.bdnixSign = {
    MIN_W: MIN_W, MAX_W: MAX_W,
    normAngle: normAngle, fix: fix, viewSize: viewSize, heightOf: heightOf,
    newPlacement: newPlacement, toPage: toPage, drawParams: drawParams,
    moveTo: moveTo, nudge: nudge, resize: resize, angleFrom: angleFrom,
    inkBounds: inkBounds, clearPaper: clearPaper, smooth: smooth,
    INK_MAX: INK_MAX, INK_MIN: INK_MIN, inkWidths: inkWidths,
    cleanName: cleanName, signedName: signedName, checkSaved: checkSaved
  };
})();
