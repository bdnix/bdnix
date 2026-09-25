// Redaction maths: text search and box geometry. No DOM or pdf.js, so it
// can be unit tested (tests/unit/redact-core.test.mjs).
//
// A box is { x, y, w, h } as fractions of the page as the reader sees it
// (after its /Rotate), measured from the top-left corner. That keeps boxes
// the same whatever size the page is drawn at.
(function(){
  function clamp01(n){ return Math.min(1, Math.max(0, n)); }

  // The box between two corners, given in any order, clipped to the page.
  function boxFrom(x0, y0, x1, y1){
    var l = clamp01(Math.min(x0, x1)), r = clamp01(Math.max(x0, x1));
    var t = clamp01(Math.min(y0, y1)), b = clamp01(Math.max(y0, y1));
    return { x: l, y: t, w: r - l, h: b - t };
  }

  function sameBox(a, b){
    return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 &&
      Math.abs(a.w - b.w) < 1e-6 && Math.abs(a.h - b.h) < 1e-6;
  }

  // Adds each box not already in list. Returns how many were added.
  function addBoxes(list, boxes){
    var added = 0;
    boxes.forEach(function(b){
      if (list.some(function(o){ return sameBox(o, b); })) return;
      list.push(b);
      added++;
    });
    return added;
  }

  // The whole pixels a box covers on a w x h canvas, rounded outwards so no
  // sliver of what's underneath is left showing.
  function pixelRect(box, w, h){
    var l = Math.floor(box.x * w), t = Math.floor(box.y * h);
    var r = Math.ceil((box.x + box.w) * w), b = Math.ceil((box.y + box.h) * h);
    return { x: l, y: t, w: r - l, h: b - t };
  }

  // How much to scale a page (vw x vh points) when it's redrawn as an image:
  // 144 dpi, but no side over 5000 pixels.
  function outputScale(vw, vh){
    return Math.min(2, 5000 / Math.max(vw, vh));
  }

  function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Case-insensitive, and any run of spaces in the query matches any spacing
  // (or none, since PDFs often leave spaces out and just move the next word).
  function pattern(query){
    var words = String(query).trim().split(/\s+/).filter(Boolean);
    return words.length ? new RegExp(words.map(escapeRe).join('\\s*'), 'gi') : null;
  }

  // Finds query in a page's text pieces ({ str, hasEOL }, as pdf.js gives
  // them). A match can run across pieces, so each is a list of
  // { item, start, end }: which piece, and which characters of it.
  function findMatches(items, query){
    var re = pattern(query);
    if (!re) return [];
    // owner[i] says which piece character i of the joined text came from;
    // null for the line breaks added between lines.
    var text = '', owner = [];
    items.forEach(function(it, n){
      for (var i = 0; i < it.str.length; i++) owner.push([n, i]);
      text += it.str;
      if (it.hasEOL) { text += '\n'; owner.push(null); }
    });
    var out = [], m;
    while ((m = re.exec(text))) {
      var parts = [];
      for (var i = m.index; i < m.index + m[0].length; i++) {
        var o = owner[i];
        if (!o) continue;
        var last = parts[parts.length - 1];
        if (last && last.item === o[0]) last.end = o[1] + 1;
        else parts.push({ item: o[0], start: o[1], end: o[1] + 1 });
      }
      out.push(parts);
    }
    return out;
  }

  // The box around characters start..end of a text piece. The piece is
  // { str, tx, width }: tx is its text matrix in page pixels (y down) and
  // width its length along the baseline, for a vw x vh page. Where the
  // characters sit is estimated with measure(text, piece), the width of
  // some text in a similar font (or the character count if not given), so
  // the box is padded a little to make up for the guess, and to cover
  // accents and descenders.
  function textBox(it, start, end, vw, vh, measure){
    var m = measure ? function(s){ return measure(s, it); } : function(s){ return s.length; };
    var total = m(it.str) || 1;
    var a = it.width * m(it.str.slice(0, start)) / total;
    var b = it.width * m(it.str.slice(0, end)) / total;
    var tx = it.tx, size = Math.hypot(tx[2], tx[3]) || 1, len = Math.hypot(tx[0], tx[1]) || 1;
    // Along the baseline, and up from it.
    var ux = tx[0] / len, uy = tx[1] / len, vx = tx[2] / size, vy = tx[3] / size;
    var pad = size * 0.12;
    var xs = [], ys = [];
    [a - pad, b + pad].forEach(function(along){
      [-0.3, 1.05].forEach(function(up){
        xs.push(tx[4] + ux * along + vx * up * size);
        ys.push(tx[5] + uy * along + vy * up * size);
      });
    });
    return boxFrom(Math.min.apply(null, xs) / vw, Math.min.apply(null, ys) / vh,
      Math.max.apply(null, xs) / vw, Math.max.apply(null, ys) / vh);
  }

  // One box per piece of each match.
  function matchBoxes(items, matches, vw, vh, measure){
    var out = [];
    matches.forEach(function(parts){
      parts.forEach(function(p){
        out.push(textBox(items[p.item], p.start, p.end, vw, vh, measure));
      });
    });
    return out;
  }

  // Whether a page draws a picture, from its pdf.js operator list and
  // pdf.js's OPS table. Words inside pictures can't be searched.
  var PICTURE_OPS = ['paintImageXObject', 'paintImageXObjectRepeat', 'paintInlineImageXObject', 'paintInlineImageXObjectGroup'];
  function hasPicture(fnArray, ops){
    var codes = PICTURE_OPS.map(function(name){ return ops[name]; });
    return fnArray.some(function(fn){ return codes.indexOf(fn) >= 0; });
  }

  // 0-based page indices (at least one) as the reader counts them: "page 2",
  // "pages 1–5", "pages 1, 3 and 5–7".
  function pageList(indices){
    var runs = [];
    indices.slice().sort(function(a, b){ return a - b; }).forEach(function(i){
      var last = runs[runs.length - 1];
      if (last && i === last[1] + 1) last[1] = i;
      else if (!last || i > last[1]) runs.push([i, i]);
    });
    var parts = runs.map(function(r){ return r[0] === r[1] ? String(r[0] + 1) : (r[0] + 1) + '–' + (r[1] + 1); });
    var one = runs.length === 1 && runs[0][0] === runs[0][1];
    var text = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    return (one ? 'page ' : 'pages ') + text;
  }

  window.bdnixRedact = {
    boxFrom: boxFrom, sameBox: sameBox, addBoxes: addBoxes, pixelRect: pixelRect,
    outputScale: outputScale, pattern: pattern, findMatches: findMatches,
    textBox: textBox, matchBoxes: matchBoxes, hasPicture: hasPicture, pageList: pageList
  };
})();
