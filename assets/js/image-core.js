// Image compressor (compress-image): the rules for what goes in and what
// comes out, kept apart from the page so they can be unit tested. The
// browser does the decoding and encoding (see image.js).
(function(){
  // The formats a canvas can save. PNG is lossless, so quality doesn't
  // apply to it.
  var FORMATS = {
    jpeg: { type: 'image/jpeg', ext: 'jpg', name: 'JPEG', lossy: true },
    webp: { type: 'image/webp', ext: 'webp', name: 'WebP', lossy: true },
    png: { type: 'image/png', ext: 'png', name: 'PNG', lossy: false }
  };

  // Browsers can't all read these, but some can (HEIC on Safari, AVIF on
  // most). A file the browser can't read is marked on the list instead.
  var EXTENSIONS = /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif|tiff?|ico)$/i;

  // Canvases bigger than this (4096 x 4096) fail on iPhones and iPads, so
  // bigger images are scaled down to fit.
  var MAX_AREA = 16777216;

  // SVG is left out: drawing it on a canvas would turn a drawing into
  // pixels, which is rarely smaller.
  function isImage(file){
    var type = file.type || '';
    if (type === 'image/svg+xml') return false;
    return /^image\//.test(type) || EXTENSIONS.test(file.name || '');
  }

  // Which of FORMATS the file already is, or null.
  function formatOf(file){
    var type = file.type || '', name = file.name || '';
    if (type === 'image/jpeg' || /\.(jpe?g|jfif)$/i.test(name)) return 'jpeg';
    if (type === 'image/png' || /\.png$/i.test(name)) return 'png';
    if (type === 'image/webp' || /\.webp$/i.test(name)) return 'webp';
    return null;
  }

  // The format to save as. 'same' keeps JPEG, PNG and WebP as they are;
  // anything else (GIF, BMP, HEIC...) becomes a JPEG, which suits photos.
  function target(choice, file){
    if (Object.prototype.hasOwnProperty.call(FORMATS, choice)) return choice;
    return formatOf(file) || 'jpeg';
  }

  // photo.png saved as a JPEG is photo-compressed.jpg, so it doesn't
  // replace the original in the downloads folder.
  function outName(name, format){
    var dot = name.lastIndexOf('.');
    var base = dot > 0 ? name.slice(0, dot) : name;
    return base + '-compressed.' + FORMATS[format].ext;
  }

  // The size to draw a width x height image at: its longest side no more
  // than `longest` pixels (0 for no limit) and its area no more than
  // `area` (MAX_AREA by default). Never bigger than the original, and never
  // less than 1 x 1.
  function fit(width, height, longest, area){
    area = area || MAX_AREA;
    var scale = 1;
    if (longest && Math.max(width, height) > longest) scale = longest / Math.max(width, height);
    if (width * height * scale * scale > area) scale = Math.sqrt(area / (width * height));
    if (scale >= 1) return { width: width, height: height, scaled: false };
    // Rounding up can overshoot the area by a pixel's width, so round down.
    return {
      width: Math.max(1, Math.floor(width * scale)),
      height: Math.max(1, Math.floor(height * scale)),
      scaled: true
    };
  }

  // The middle square of a width x height image, for a thumbnail that
  // fills its tile: { x, y, size } in the image's pixels.
  function cover(width, height){
    var size = Math.min(width, height);
    return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size: size };
  }

  // Whether to hand back the original instead: when the result is no
  // smaller, and it's the same format at the same size, the original is
  // the better file.
  function keepOriginal(file, format, blobSize, scaled){
    return !scaled && blobSize >= file.size && formatOf(file) === format;
  }

  // "62% smaller". Rounds down, so a file only 0.4% smaller doesn't claim
  // 1%, and never says 100%.
  function saving(before, after){
    if (!before || after >= before) return 'no smaller';
    var pct = Math.min(99, Math.floor((1 - after / before) * 100));
    return pct < 1 ? 'under 1% smaller' : pct + '% smaller';
  }

  window.bdnixImage = {
    FORMATS: FORMATS, MAX_AREA: MAX_AREA,
    isImage: isImage, formatOf: formatOf, target: target, outName: outName,
    fit: fit, cover: cover, keepOriginal: keepOriginal, saving: saving
  };
})();
