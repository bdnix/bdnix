// Photo collage (photo-collage): the layouts, shapes and sizes, kept apart
// from the page so they can be unit tested. The page draws the photos into
// the boxes worked out here (see collage.js).
(function(){
  // A collage takes 3, 6 or 9 photos.
  var COUNTS = [3, 6, 9];
  var MAX = COUNTS[COUNTS.length - 1];

  // Rows of photos, top to bottom: [2, 3] is two photos side by side above
  // three. Every row is the same height and its photos share it equally.
  function rows(counts){
    var cells = [];
    counts.forEach(function(n, r){
      for (var i = 0; i < n; i++) cells.push([i / n, r / counts.length, 1 / n, 1 / counts.length]);
    });
    return cells;
  }

  // The same, turned on its side: columns of photos, left to right.
  function columns(counts){
    return rows(counts).map(function(c){ return [c[1], c[0], c[3], c[2]]; });
  }

  // Each cell is [x, y, width, height] as fractions of the collage, in the
  // order the photos fill them. Together they cover the collage exactly.
  var T = 1 / 3;
  var LAYOUTS = {
    3: [
      { id: 'row', name: 'Side by side', cells: rows([3]) },
      { id: 'stack', name: 'Stacked', cells: rows([1, 1, 1]) },
      { id: 'left', name: 'Big left', cells: [[0, 0, 2 * T, 1], [2 * T, 0, T, 0.5], [2 * T, 0.5, T, 0.5]] },
      { id: 'top', name: 'Big top', cells: [[0, 0, 1, 2 * T], [0, 2 * T, 0.5, T], [0.5, 2 * T, 0.5, T]] }
    ],
    6: [
      { id: 'grid', name: 'Grid, 3 across', cells: rows([3, 3]) },
      { id: 'tall', name: 'Grid, 2 across', cells: rows([2, 2, 2]) },
      { id: 'feature', name: 'Feature', cells: [[0, 0, 2 * T, 2 * T], [2 * T, 0, T, T], [2 * T, T, T, T]].concat(rows([3]).map(function(c){ return [c[0], 2 * T, c[2], T]; })) },
      { id: 'steps', name: 'Steps', cells: rows([1, 2, 3]) },
      { id: 'columns', name: 'Columns', cells: columns([2, 4]) }
    ],
    9: [
      { id: 'grid', name: 'Grid', cells: rows([3, 3, 3]) },
      { id: 'feature', name: 'Feature', cells: [[0, 0, 2 * T, 0.5], [2 * T, 0, T, 0.25], [2 * T, 0.25, T, 0.25]].concat(rows([3, 3]).map(function(c){ return [c[0], 0.5 + c[1] / 2, c[2], c[3] / 2]; })) },
      { id: 'steps', name: 'Steps', cells: rows([2, 3, 4]) },
      { id: 'mosaic', name: 'Mosaic', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.25, 0.25], [0.75, 0, 0.25, 0.25], [0.5, 0.25, 0.25, 0.25], [0.75, 0.25, 0.25, 0.25], [0, 0.5, 0.25, 0.5], [0.25, 0.5, 0.25, 0.5], [0.5, 0.5, 0.5, 0.25], [0.5, 0.75, 0.5, 0.25]] }
    ]
  };

  // The collage's proportions, width : height.
  var SHAPES = {
    square: { name: 'Square', w: 1, h: 1 },
    portrait: { name: 'Portrait 4:5', w: 4, h: 5 },
    story: { name: 'Story 9:16', w: 9, h: 16 },
    landscape: { name: 'Landscape 3:2', w: 3, h: 2 },
    wide: { name: 'Widescreen 16:9', w: 16, h: 9 }
  };

  // Output sizes, by the longest side. 4096 x 4096 is as big as a canvas
  // can be on iPhones and iPads.
  var SIZES = [1080, 2048, 4096];

  var FORMATS = {
    jpeg: { type: 'image/jpeg', ext: 'jpg' },
    png: { type: 'image/png', ext: 'png' }
  };

  function has(obj, key){ return Object.prototype.hasOwnProperty.call(obj, key); }

  // The layouts for this many photos; none if it isn't 3, 6 or 9.
  function layoutsFor(count){
    return has(LAYOUTS, count) ? LAYOUTS[count] : [];
  }

  // The layout with this id for this many photos, or the first one.
  function layout(count, id){
    var list = layoutsFor(count);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  }

  // The collage's size in pixels: its longest side `longest`, in the
  // shape's proportions.
  function size(shape, longest){
    var s = has(SHAPES, shape) ? SHAPES[shape] : SHAPES.square;
    var scale = longest / Math.max(s.w, s.h);
    return { width: Math.round(s.w * scale), height: Math.round(s.h * scale) };
  }

  // Spacing and corners are set per 1000 pixels of the longest side, so a
  // preview looks the same as the full-size collage.
  function scaled(value, longest){
    return Math.round(value * longest / 1000);
  }

  // Where each photo goes in a width x height collage: { x, y, w, h } in
  // whole pixels, `gap` pixels apart and `gap` from the edges.
  function boxes(cells, width, height, gap){
    gap = gap || 0;
    function at(f, total){ return gap / 2 + f * (total - gap); }
    return cells.map(function(c){
      var x = Math.round(at(c[0], width) + gap / 2), y = Math.round(at(c[1], height) + gap / 2);
      var r = Math.round(at(c[0] + c[2], width) - gap / 2), b = Math.round(at(c[1] + c[3], height) - gap / 2);
      return { x: x, y: y, w: Math.max(1, r - x), h: Math.max(1, b - y) };
    });
  }

  // The part of a width x height photo that fills a boxW x boxH box
  // without stretching, cropped to the box's shape. pos says which part:
  // { x, y } from 0 (the left or top edge) to 1 (the right or bottom
  // edge); the middle, { x: 0.5, y: 0.5 }, when it's left out.
  function cover(width, height, boxW, boxH, pos){
    var scale = Math.max(boxW / width, boxH / height);
    var sw = boxW / scale, sh = boxH / scale;
    pos = pos || CENTRE;
    return { sx: (width - sw) * pos.x, sy: (height - sh) * pos.y, sw: sw, sh: sh };
  }
  var CENTRE = { x: 0.5, y: 0.5 };

  // Where a photo sits in its box after being dragged dx, dy pixels of the
  // box: the new pos for cover(). The photo moves with the drag and stops
  // at its edges. A side with nothing cropped off can't move, so it keeps
  // its pos for when a new layout or shape crops it.
  function pan(pos, width, height, boxW, boxH, dx, dy){
    var c = cover(width, height, boxW, boxH);
    var scale = boxW / c.sw;
    function move(p, d, spare){
      return spare * scale < 0.5 ? p : Math.min(1, Math.max(0, p - d / scale / spare));
    }
    return { x: move(pos.x, dx, width - c.sw), y: move(pos.y, dy, height - c.sh) };
  }

  // Which box, if any, the point x, y is in: its index, or -1.
  function hit(list, x, y){
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return i;
    }
    return -1;
  }

  // What to do with `count` photos to make a collage, or '' when it's
  // ready to make.
  function advice(count){
    if (COUNTS.indexOf(count) >= 0) return '';
    if (!count) return 'Add 3, 6 or 9 photos.';
    var more = COUNTS.filter(function(n){ return n > count; })[0];
    var fewer = COUNTS.filter(function(n){ return n < count; }).pop();
    var text = 'Add ' + (more - count) + ' more for a collage of ' + more;
    if (fewer) text += ', or remove ' + (count - fewer) + ' for a collage of ' + fewer;
    return text + '.';
  }

  // collage.jpg or collage.png.
  function outName(format){
    return 'collage.' + (has(FORMATS, format) ? FORMATS[format] : FORMATS.jpeg).ext;
  }

  window.bdnixCollage = {
    COUNTS: COUNTS, MAX: MAX, LAYOUTS: LAYOUTS, SHAPES: SHAPES, SIZES: SIZES, FORMATS: FORMATS,
    layoutsFor: layoutsFor, layout: layout, size: size, scaled: scaled,
    boxes: boxes, cover: cover, pan: pan, hit: hit, advice: advice, outName: outName
  };
})();
