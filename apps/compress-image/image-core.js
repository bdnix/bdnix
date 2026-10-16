// Image compressor (compress-image): the rules for how big a result is
// and whether it's worth keeping, kept apart from the page so they can be
// unit tested. The browser does the decoding and encoding (see image.js);
// images.js has what the image tools share.
(function(){
  var Images = window.bdnixImages;

  // The size to draw a width x height image at: its longest side no more
  // than `longest` pixels (0 for no limit) and its area no more than
  // `area` (MAX_AREA by default). Never bigger than the original, and never
  // less than 1 x 1.
  function fit(width, height, longest, area){
    area = area || Images.MAX_AREA;
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

  // Whether to hand back the original instead: when the result is no
  // smaller, and it's the same format at the same size, the original is
  // the better file.
  function keepOriginal(file, format, blobSize, scaled){
    return !scaled && blobSize >= file.size && Images.formatOf(file) === format;
  }

  // "62% smaller". Rounds down, so a file only 0.4% smaller doesn't claim
  // 1%, and never says 100%.
  function saving(before, after){
    if (!before || after >= before) return 'no smaller';
    var pct = Math.min(99, Math.floor((1 - after / before) * 100));
    return pct < 1 ? 'under 1% smaller' : pct + '% smaller';
  }

  window.bdnixImage = { fit: fit, keepOriginal: keepOriginal, saving: saving };
})();
