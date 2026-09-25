// Where watermark copies go on a page. Pure geometry with no DOM or pdf-lib,
// so it can be unit tested (tests/unit/watermark-layout.test.mjs).
//
// "View" space is the page as the reader sees it: origin bottom-left, x to
// the right, y up, after the page's /Rotate. "Page" space is PDF user space
// inside the crop box, before /Rotate.
(function(){
  // Size of the page as the reader sees it. rot is 0, 90, 180 or 270.
  function viewSize(box, rot){
    var sideways = rot % 180 !== 0;
    var vw = sideways ? box.height : box.width, vh = sideways ? box.width : box.height;
    return { vw: vw, vh: vh, short: Math.min(vw, vh) };
  }

  // Maps a point from the page as the reader sees it to PDF page space,
  // undoing the page's /Rotate (which turns the page clockwise).
  function toPage(vx, vy, rot, box){
    var p = rot === 90 ? [box.width - vy, vx] :
            rot === 180 ? [box.width - vx, box.height - vy] :
            rot === 270 ? [vy, box.height - vx] : [vx, vy];
    return [p[0] + box.x, p[1] + box.y];
  }

  function placeCenter(pos, vw, vh, bw, bh, margin){
    var col = pos.charAt(1), row = pos.charAt(0);
    var x = col === 'l' ? margin + bw / 2 : col === 'r' ? vw - margin - bw / 2 : vw / 2;
    var y = row === 't' ? vh - margin - bh / 2 : row === 'b' ? margin + bh / 2 : vh / 2;
    return [x, y];
  }

  // A brick pattern of copies, centred on the page, covering it edge to edge.
  function tileCenters(vw, vh, bw, bh, gap){
    var sx = bw + gap, sy = bh + gap, out = [];
    var nx = Math.ceil((vw / 2 + bw) / sx) + 1, ny = Math.ceil((vh / 2 + bh) / sy);
    for (var j = -ny; j <= ny; j++) {
      var y = vh / 2 + j * sy, shift = Math.abs(j) % 2 ? sx / 2 : 0;
      for (var i = -nx; i <= nx; i++) {
        var x = vw / 2 + i * sx + shift;
        if (x + bw / 2 > 0 && x - bw / 2 < vw && y + bh / 2 > 0 && y - bh / 2 < vh) out.push([x, y]);
      }
    }
    return out;
  }

  // Works out where to draw each copy of a w x h watermark. Returns the
  // rotation to draw with in page space and each copy's drawing origin.
  function place(box, rot, w, h, s){
    var v = viewSize(box, rot);
    var a = s.rotation * Math.PI / 180;
    var bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    var bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    var centers = s.tile ? tileCenters(v.vw, v.vh, bw, bh, v.short * 0.08) :
      [placeCenter(s.pos, v.vw, v.vh, bw, bh, v.short * 0.06)];

    // pdf-lib rotates around the drawing origin (the bottom-left corner),
    // so shift the origin to keep each copy centred where we want it.
    var angle = s.rotation + rot;
    var pa = angle * Math.PI / 180;
    var ox = w / 2 * Math.cos(pa) - h / 2 * Math.sin(pa);
    var oy = w / 2 * Math.sin(pa) + h / 2 * Math.cos(pa);

    return {
      angle: angle,
      origins: centers.map(function(c){
        var p = toPage(c[0], c[1], rot, box);
        return [p[0] - ox, p[1] - oy];
      })
    };
  }

  window.bdnixWatermarkLayout = {
    viewSize: viewSize, toPage: toPage, placeCenter: placeCenter,
    tileCenters: tileCenters, place: place
  };
})();
