// Resize Without Cropping (fit-to-frame): where an image goes in its new frame, kept
// apart from the page so it can be unit tested. The browser does the
// decoding, drawing and encoding (see frame.js).
(function(){
  // The shapes social sites ask for, at the size they recommend.
  var SHAPES = {
    square: { width: 1080, height: 1080 },
    portrait: { width: 1080, height: 1350 },
    story: { width: 1080, height: 1920 },
    landscape: { width: 1200, height: 630 },
    wide: { width: 1920, height: 1080 },
    tall: { width: 1000, height: 1500 }
  };

  // The largest width or height that can be typed in. The canvas area
  // limit (bdnixImages.MAX_AREA) still applies on top of it.
  var MAX_SIDE = 10000;

  // Space around the image goes up to a quarter of the frame on each side.
  var MAX_MARGIN = 25;

  // A width or height typed by the visitor: a whole number of pixels from
  // 1 to MAX_SIDE, or null.
  function side(text){
    var m = /^\s*(\d{1,6})\s*$/.exec(text == null ? '' : String(text));
    if (!m) return null;
    var n = +m[1];
    return n >= 1 && n <= MAX_SIDE ? n : null;
  }

  // Which of SHAPES is exactly width x height, or 'custom'.
  function shapeOf(width, height){
    for (var id in SHAPES) {
      if (Object.prototype.hasOwnProperty.call(SHAPES, id) && SHAPES[id].width === width && SHAPES[id].height === height) return id;
    }
    return 'custom';
  }

  // Where a width x height image goes in a frame shaped frameW x frameH:
  // { width, height } of the frame and { x, y, w, h } of the image in it,
  // in whole pixels. The image is centred and never cropped.
  //
  // opts.exact: the frame is exactly frameW x frameH pixels and the image is
  //   scaled up or down to fit. Otherwise the frame only takes that shape:
  //   the image keeps its size and space is added to two of its sides.
  // opts.margin: extra space on every side, as a percentage (0 to
  //   MAX_MARGIN) of the frame's shorter side.
  // opts.area: the most pixels the frame may have (bdnixImages.MAX_AREA by
  //   default in the page); a bigger frame is scaled down, image and all.
  function layout(width, height, frameW, frameH, opts){
    opts = opts || {};
    var p = Math.min(MAX_MARGIN, Math.max(0, +opts.margin || 0)) / 100;
    var W, H, scale;
    if (opts.exact) {
      W = frameW;
      H = frameH;
      var m = p * Math.min(W, H);
      scale = Math.min((W - 2 * m) / width, (H - 2 * m) / height);
    } else {
      // The frame's sides relative to its shorter side, which is s.
      var r = frameW / frameH, a = Math.max(r, 1), b = Math.max(1 / r, 1);
      var s = Math.max(width / (a - 2 * p), height / (b - 2 * p));
      W = s * a;
      H = s * b;
      scale = 1;
    }
    // Rounding down keeps a scaled-down frame within the area.
    var round = Math.round;
    if (opts.area && W * H > opts.area) {
      var k = Math.sqrt(opts.area / (W * H));
      W *= k;
      H *= k;
      scale *= k;
      round = Math.floor;
    }
    var fw = Math.max(1, round(W)), fh = Math.max(1, round(H));
    var w = Math.max(1, Math.min(fw, Math.round(width * scale)));
    var h = Math.max(1, Math.min(fh, Math.round(height * scale)));
    return { width: fw, height: fh, x: Math.floor((fw - w) / 2), y: Math.floor((fh - h) / 2), w: w, h: h };
  }

  window.bdnixFrame = {
    SHAPES: SHAPES, MAX_SIDE: MAX_SIDE, MAX_MARGIN: MAX_MARGIN,
    side: side, shapeOf: shapeOf, layout: layout
  };
})();
