// Image files for the image tools (compress-image, photo-collage,
// fit-to-frame): which files are images, the formats a canvas can save, the
// canvas size limit and names for the results. No DOM, so it can be unit
// tested.
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

  // The name to save as: each tool adds its own word for what it did, so
  // photo.png compressed to a JPEG is photo-compressed.jpg and doesn't
  // replace the original in the downloads folder.
  function outName(name, format, suffix){
    var dot = name.lastIndexOf('.');
    var base = dot > 0 ? name.slice(0, dot) : name;
    return base + '-' + suffix + '.' + FORMATS[format].ext;
  }

  // The middle square of a width x height image, for a thumbnail that
  // fills its tile: { x, y, size } in the image's pixels.
  function cover(width, height){
    var size = Math.min(width, height);
    return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size: size };
  }

  window.bdnixImages = {
    FORMATS: FORMATS, MAX_AREA: MAX_AREA,
    isImage: isImage, formatOf: formatOf, target: target, outName: outName, cover: cover
  };
})();
