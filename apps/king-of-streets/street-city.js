// King of Streets: Dhaka beside the road. Plastered concrete buildings with
// windows behind steel grills, balconies, water tanks on the roofs and shops
// at street level under Bangla signboards; tiled footpaths behind yellow and
// black kerbs; concrete poles strung with cables; mango and rain trees;
// mosques; the lake on the Hatirjheel route; and the bridges, flyover and
// expressway, up on their piers. Built a chunk of road at a time
// (bdnixStreetScene.CHUNK metres), each chunk's pieces merged into one mesh
// for each material, so a chunk draws in a few dozen calls. Everything
// follows from the race's number, so the same race is the same city.
(function(){
  var F = window.bdnixStreet, S = window.bdnixStreetScene;
  var T = null, merge = null;
  var ROAD = F.ROAD;
  var KERB = 0.3, WALK = 4.7, FRONT = ROAD + KERB + WALK;   // the buildings' fronts, 12 m out
  var DEPTH = 14, GROUND = 3.6, FLOOR = 3;                    // a building's depth, ground floor and floors (metres)
  var WALL_W = 8, WALL_H = 6;                                 // what a wall texture covers (metres)

  function init(three, mergeGeometries){ T = three; merge = mergeGeometries; }
  function V(x, y, z){ return new T.Vector3(x || 0, y || 0, z || 0); }

  // ---------- Textures drawn once ----------
  var PAINT = ['#e9dfc6', '#e4d08f', '#dca592', '#bfd3b4', '#ebe7de', '#c4d0d8', '#d8c3a6', '#e2b98a'];
  var OLD = ['#b9ab92', '#a89f8f', '#c4a98a'];
  function canvas(w, h){ var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function texture(c, srgb, repeat){
    var t = new T.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = T.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  // A wall: the plaster photo tinted a building's paint, damp patches and
  // the streaks rain leaves under each floor's slab (at the texture's top and
  // middle, 3 m apart). It tiles WALL_W by WALL_H metres.
  function wallTexture(r, plaster, stain, colour, old){
    var W = 512, H = 384, s = W / WALL_W, c = canvas(W, H), g = c.getContext('2d'), x, y, i;
    for (y = 0; y < H; y += 2.5 * s) for (x = 0; x < W; x += 2.5 * s) g.drawImage(plaster, x, y, 2.5 * s, 2.5 * s);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = colour;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = old ? 0.7 : 0.3;
    for (i = 0; i < 5; i++) { var w = (1 + r() * 2.5) * s, h = (1 + r() * 3) * s; g.drawImage(stain, r() * (W - w), r() * (H - h), w, h); }
    g.globalAlpha = 1;
    [0, H / 2].forEach(function(top){
      for (var k = 0; k < W / 6; k++) {
        var sx = r() * W, len = (0.3 + r() * 1.8) * s, gr = g.createLinearGradient(0, top, 0, top + len);
        gr.addColorStop(0, 'rgba(40,38,32,' + (0.12 + r() * 0.25) + ')');
        gr.addColorStop(1, 'rgba(40,38,32,0)');
        g.fillStyle = gr;
        g.fillRect(sx, top, 1 + r() * 5, len);
      }
    });
    return texture(c, true, true);
  }
  // Steel window grills: four designs in four colours, a 4 by 4 sheet.
  function grillSheet(){
    var c = canvas(1024, 1024), g = c.getContext('2d'), cols = ['#f2f2ee', '#1f5f3a', '#222222', '#6b3a1f'];
    for (var d = 0; d < 4; d++) for (var k = 0; k < 4; k++) {
      g.save();
      g.translate(k * 256, d * 256);
      g.beginPath(); g.rect(0, 0, 256, 256); g.clip();
      g.strokeStyle = cols[k]; g.lineWidth = 7; g.strokeRect(4, 4, 248, 248); g.lineWidth = 5;
      var x, y, i;
      g.beginPath();
      if (d === 0) { for (x = 32; x < 256; x += 28) { g.moveTo(x, 0); g.lineTo(x, 256); } g.moveTo(0, 128); g.lineTo(256, 128); }
      if (d === 1) for (i = -256; i < 512; i += 40) { g.moveTo(i, 0); g.lineTo(i + 256, 256); g.moveTo(i + 256, 0); g.lineTo(i, 256); }
      if (d === 2) { for (x = 32; x < 256; x += 32) { g.moveTo(x, 0); g.lineTo(x, 256); } for (y = 64; y < 256; y += 64) { g.moveTo(0, y); g.lineTo(256, y); } }
      if (d === 3) { for (x = 26; x < 256; x += 26) { g.moveTo(x, 0); g.lineTo(x, 256); } for (x = 0; x < 256; x += 26) { g.moveTo(x, 70); g.quadraticCurveTo(x + 13, 40, x + 26, 70); g.moveTo(x, 190); g.quadraticCurveTo(x + 13, 220, x + 26, 190); } }
      g.stroke();
      if (d === 2) { g.lineWidth = 3; for (y = 32; y < 256; y += 64) for (x = 48; x < 256; x += 64) { g.beginPath(); g.arc(x, y, 14, 0, 7); g.stroke(); } }
      g.restore();
    }
    var t = texture(c);
    t.flipY = false;
    return t;
  }
  // Shop signboards in Bangla, as flex banners are: bright, bold lettering,
  // a smaller line under, sun-faded, dusty and wrinkled. A sheet of 32, two
  // across; and a sheet of 6 billboards.
  var SHOPS = [
    ['মায়ের দোয়া স্টোর', 'মুদি মালামাল'], ['নিউ ঢাকা টেলার্স', 'অভিজাত পোশাক'], ['বিসমিল্লাহ হোটেল', 'ভাত মাছ মাংস'],
    ['আল-মদিনা ইলেকট্রনিক্স', 'মোবাইল ও সার্ভিসিং'], ['জনতা ফার্মেসী', 'সকল প্রকার ঔষধ'], ['রহমান হার্ডওয়্যার', 'রং ও স্যানিটারি'],
    ['সোনার বাংলা মিষ্টান্ন', 'দই মিষ্টি'], ['ভাই ভাই টেলিকম', 'ফ্লেক্সিলোড'], ['মেসার্স করিম ট্রেডার্স', 'পাইকারি ও খুচরা'],
    ['ঢাকা লাইব্রেরি', 'বই খাতা কলম'], ['হাজী বিরিয়ানি হাউস', 'কাচ্চি বিরিয়ানি'], ['নূর জুয়েলার্স', 'স্বর্ণ ও রৌপ্য'],
    ['তাজ ক্লথ স্টোর', 'থান কাপড়'], ['আমেনা ডেন্টাল কেয়ার', 'দাঁতের চিকিৎসা'], ['সিটি মোটরস', 'মোটরসাইকেল পার্টস'], ['নিউ মডেল সেলুন', 'চুল কাটা']
  ];
  var BIG = [['উদ্ভাস কোচিং সেন্টার', 'এসএসসি · এইচএসসি · ভর্তি'], ['সেবা ডায়াগনস্টিক সেন্টার', 'বিশেষজ্ঞ ডাক্তার · ২৪ ঘণ্টা'], ['মোবাইল মার্কেট', 'সব ব্র্যান্ডের ফোন'],
    ['আধুনিক হাসপাতাল', 'জরুরি বিভাগ খোলা'], ['ফ্যাশন হাউস', 'ঈদ কালেকশন'], ['রেস্তোরাঁ', 'দ্বিতীয় তলায়']];
  var SIGN_BG = [['#c8102e', '#ffffff'], ['#0b6e3f', '#ffffff'], ['#f2c200', '#1b1b1b'], ['#1d4f9c', '#ffffff'], ['#ffffff', '#c8102e'], ['#6a1b9a', '#ffe082'], ['#e65100', '#ffffff'], ['#00897b', '#ffffff']];
  function signs(r, list, n, cw, ch, cols){
    var c = canvas(cw * cols, ch * Math.ceil(n / cols)), g = c.getContext('2d');
    for (var i = 0; i < n; i++) {
      var x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch, words = list[i % list.length], col = SIGN_BG[(i * 5 + Math.floor(i / list.length)) % SIGN_BG.length];
      g.save();
      g.translate(x0, y0);
      g.beginPath(); g.rect(0, 0, cw, ch); g.clip();
      g.fillStyle = col[0]; g.fillRect(0, 0, cw, ch);
      g.fillStyle = col[1]; g.textAlign = 'center'; g.textBaseline = 'middle';
      var size = ch * 0.48;
      g.font = size + 'px Kalpurush';
      while (g.measureText(words[0]).width > cw * 0.9 && size > 12) { size -= 2; g.font = size + 'px Kalpurush'; }
      g.fillText(words[0], cw / 2, ch * 0.4);
      g.font = Math.round(ch * 0.22) + 'px Kalpurush';
      g.fillText(words[1], cw / 2, ch * 0.8);
      g.fillStyle = 'rgba(120,110,90,0.12)'; g.fillRect(0, 0, cw, ch);
      for (var k = 0; k < cw / 40; k++) {
        var wx = r() * cw, w = 6 + r() * 30, gr = g.createLinearGradient(wx - w, 0, wx + w, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(wx - w, 0, 2 * w, ch);
      }
      var dg = g.createLinearGradient(0, 0, 0, ch * 0.35);
      dg.addColorStop(0, 'rgba(70,60,45,0.45)'); dg.addColorStop(1, 'rgba(70,60,45,0)');
      g.fillStyle = dg; g.fillRect(0, 0, cw, ch * 0.35);
      g.strokeStyle = '#8d8f8f'; g.lineWidth = 6; g.strokeRect(3, 3, cw - 6, ch - 6);
      g.restore();
    }
    return texture(c);
  }
  // A footpath's 40 cm concrete tiles, each its own patch of the photo and
  // its own tone, with mortar joints and chipped corners: a 4 m square.
  function tiles(r, photo){
    var N = 10, P = 64, S2 = N * P, c = canvas(S2, S2), g = c.getContext('2d');
    g.fillStyle = '#6d665d'; g.fillRect(0, 0, S2, S2);
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      var x = i * P + 2, y = j * P + 2, w = P - 4;
      g.drawImage(photo, r() * (photo.width - 220), r() * (photo.height - 220), 220, 220, x, y, w, w);
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,' + (0.03 + r() * 0.12) + ')' : 'rgba(255,245,225,' + (0.03 + r() * 0.1) + ')';
      g.fillRect(x, y, w, w);
      if (r() < 0.25) { g.fillStyle = '#5e574f'; g.beginPath(); g.arc(x + (r() < 0.5 ? 0 : w), y + (r() < 0.5 ? 0 : w), 3 + r() * 6, 0, 7); g.fill(); }
    }
    return texture(c, true, true);
  }
  // Kerb stones, a metre each, painted yellow and black in turn.
  // The start and finish lines: black and white squares.
  function chequer(){
    var c = canvas(256, 64), g = c.getContext('2d');
    for (var x = 0; x < 8; x++) for (var y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f2f2f2'; g.fillRect(x * 32, y * 32, 32, 32); }
    return texture(c, true, true);
  }
  function kerbTexture(){
    var c = canvas(64, 128), g = c.getContext('2d');
    g.fillStyle = '#d9a722'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1d1d1d'; g.fillRect(0, 64, 64, 64);
    g.fillStyle = 'rgba(150,140,125,0.5)'; g.fillRect(0, 62, 64, 3); g.fillRect(0, 126, 64, 2);
    return texture(c, true, true);
  }
  // Dashed and solid lane lines and a double yellow line, drawn on a strip.
  function glowTexture(inner, outer){
    var c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner); gr.addColorStop(0.3, outer); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return texture(c);
  }

  // ---------- Materials ----------
  var M = null, NIGHT = 0, MODELS = null;
  function std(o){ return new T.MeshStandardMaterial(o); }
  // Ready the city's materials and models for a time of day (night: 0 to 1).
  // `img` has the photos (plaster, stain, pavement) as images and `tex` the
  // tiling textures (asphalt, concrete, white plaster); `models` the pieces
  // (shutter, front, crates, ac, pole, mango, rain, masjid, lalbagh) as
  // three.js objects, each standing on y 0, front to +z.
  function prepare(img, tex, models, night){
    var r = F.seeded(4242);
    NIGHT = night;
    MODELS = {};
    for (var k in models) MODELS[k] = parts(models[k]);
    M = {};
    M.walls = PAINT.concat(OLD).map(function(c, i){
      var m = std({ map: wallTexture(r, img.plaster, img.stain, c, i >= PAINT.length), normalMap: tex.plasterN, roughness: 0.92 });
      m.normalScale.set(0.6, 0.6);
      return m;
    });
    M.glass = std({ color: 0x1d2a2c, roughness: 0.08, metalness: 0.6 });
    M.lit = ['#ffd9a0', '#fff1d6', '#d8ecff', '#ffe7b8'].map(function(c){ return std({ color: 0x222222, emissive: c, emissiveIntensity: 1.4, roughness: 0.2 }); });
    M.grill = std({ map: grillSheet(), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.6, metalness: 0.3 });
    M.slab = std({ color: 0x9d988c, roughness: 0.95 });
    M.dark = std({ color: 0x15130f, roughness: 0.9 });
    M.shop = std({ color: 0x8f897c, emissive: night ? 0x9a7a52 : 0x6f6a60, emissiveIntensity: night ? 0.75 : 0.45, roughness: 0.9, side: T.BackSide });
    M.tank = std({ color: 0x141414, roughness: 0.55 });
    var sg = signs(r, SHOPS, 32, 512, 96, 2), bb = signs(r, BIG, 6, 768, 220, 2);
    M.signs = std({ map: sg, roughness: 0.7, emissiveMap: sg, emissive: night ? 0xffffff : 0, emissiveIntensity: night ? 0.8 : 0 });
    M.boards = std({ map: bb, roughness: 0.6, emissiveMap: bb, emissive: night ? 0xffffff : 0, emissiveIntensity: night ? 0.7 : 0 });
    M.road = std({ map: tex.asphalt.map, normalMap: tex.asphalt.normalMap, roughnessMap: tex.asphalt.roughnessMap, roughness: 1 });
    M.foot = std({ map: tiles(r, img.pavement), roughnessMap: tex.tilesRough, color: 0xe8e0d0 });
    M.under = std({ color: 0x77706a, roughness: 1 });
    M.kerb = std({ map: kerbTexture(), roughness: 0.8 });
    M.ground = std({ map: tex.pavement.map, normalMap: tex.pavement.normalMap, roughnessMap: tex.pavement.roughnessMap, color: 0xaaaaaa });
    M.paint = std({ color: 0xe8e6dc, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    M.yellow = std({ color: 0xd9a520, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    M.concrete = std({ map: tex.concrete.map, normalMap: tex.concrete.normalMap, roughnessMap: tex.concrete.roughnessMap, color: new T.Color(1.5, 1.48, 1.42) });
    M.plaster = std({ map: tex.plaster.map, normalMap: tex.plaster.normalMap, roughnessMap: tex.plaster.roughnessMap, color: new T.Color(1.95, 1.9, 1.75) });
    M.chequer = std({ map: chequer(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, side: T.DoubleSide });
    M.green = std({ color: 0x1f6b3a, roughness: 0.5, metalness: 0.3 });
    M.cable = std({ color: 0x0c0c0c, roughness: 0.45, metalness: 0.1 });
    M.metal = std({ color: 0x8a8d90, metalness: 0.7, roughness: 0.4 });
    M.lamp = std({ color: 0x333333, emissive: 0xffe2b0, emissiveIntensity: night ? 12 : 0 });
    M.water = std({ color: 0x223a3c, roughness: 0.06, metalness: 0.4, envMapIntensity: 1.2 });
    M.rail = std({ color: 0xcfd2d0, metalness: 0.6, roughness: 0.35 });
    // Swept surfaces are seen from either side (a kerb's face, a deck's underside).
    [M.road, M.foot, M.kerb, M.ground, M.concrete, M.plaster, M.water, M.paint].forEach(function(m){ m.side = T.DoubleSide; });
    M.glow = new T.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.45)'), color: 0xffe0b0, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.9 * night });
    M.pool = new T.MeshBasicMaterial({ map: glowTexture('rgba(255,214,160,0.9)', 'rgba(255,200,140,0.35)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.85 * night, polygonOffset: true, polygonOffsetFactor: -6 });
  }
  // A model as its meshes' geometries, each with its place in the model
  // baked in, and materials: what instancing and merging need.
  function parts(o){
    var out = [];
    o.updateMatrixWorld(true);
    var inv = o.matrixWorld.clone().invert();
    o.traverse(function(m){
      if (!m.isMesh) return;
      var g = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
      [].concat(m.material).forEach(function(mat, i){
        var gi = g;
        if (Array.isArray(m.material)) { gi = g.clone(); gi.clearGroups(); }
        out.push({ geometry: gi, material: mat });
        void i;
      });
    });
    return out;
  }

  // ---------- Building a chunk ----------
  // A chunk's pieces are gathered by material, then merged.
  function Bucket(){ this.by = {}; this.mats = {}; }
  Bucket.prototype.add = function(mat, geo, matrix){
    if (matrix) geo.applyMatrix4(matrix);
    if (!geo.attributes.uv) geo.setAttribute('uv', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.index) geo.setIndex([].slice.call(new Uint32Array(geo.attributes.position.count).map(function(_, i){ return i; })));
    (this.by[mat.uuid] = this.by[mat.uuid] || []).push(geo);
    this.mats[mat.uuid] = mat;
  };
  Bucket.prototype.meshes = function(group, shadows){
    for (var id in this.by) {
      var list = this.by[id].map(function(g){
        var keep = new T.BufferGeometry();
        keep.setAttribute('position', g.attributes.position);
        keep.setAttribute('normal', g.attributes.normal);
        keep.setAttribute('uv', g.attributes.uv);
        keep.setIndex(g.index);
        return keep;
      });
      var m = new T.Mesh(merge(list, false), this.mats[id]);
      m.castShadow = shadows && !/Basic/.test(m.material.type);
      m.receiveShadow = shadows;
      m.matrixAutoUpdate = false;
      group.add(m);
    }
  };

  // A box, w by h by d, its centre at (x, y, z), its UVs in metres on the
  // wall textures' grid: along the front and up from the first floor.
  function box(w, h, d, x, y, z, wall){
    var g = new T.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    if (wall) {
      var p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      for (var i = 0; i < p.count; i++) uv.setXY(i, (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / WALL_W, (p.getY(i) - GROUND) / WALL_H);
    }
    return g;
  }
  function plane(w, h, x, y, z){ return new T.PlaneGeometry(w, h).translate(x, y, z); }

  // Where a thing at (z, x) on the road stands, facing `face` (the road's
  // way, 0; or turned by that many radians), on the ground or at height y.
  function at(P, z, x, y, face){
    var p = S.place(P, z, x), m = new T.Matrix4().makeRotationY(p.heading + (face || 0));
    m.setPosition(p.x, y === undefined ? p.y : y, p.z);
    return m;
  }

  // A building's frame: its front on the building line, facing the road,
  // from z0 to z0 + w along it; local x runs along its front, z out of it.
  function frame(P, side, z0, w){
    var mid = S.place(P, z0 + w / 2, side * FRONT), h = mid.heading;
    var fwd = V(Math.sin(h), 0, Math.cos(h)), right = V(-Math.cos(h), 0, Math.sin(h));
    var along = side < 0 ? fwd : fwd.clone().negate(), out = side < 0 ? right : right.clone().negate();
    var m = new T.Matrix4().makeBasis(along, V(0, 1, 0), out);
    m.setPosition(mid.x - along.x * w / 2, 0, mid.z - along.z * w / 2);
    return m;
  }

  // A building w metres wide, its pieces in `B` (a Bucket) and its shops
  // in `shops` (each a matrix in the building's frame, open or shut), in
  // the frame `fm`.
  function building(B, shops, fm, w, r){
    var styles = ['shades', 'shades', 'balconies', 'old', 'glass'], style = styles[Math.floor(r() * styles.length)];
    var floors = (style === 'old' ? 2 : 3) + Math.floor(r() * 5), H = GROUND + floors * FLOOR;
    var wall = M.walls[style === 'old' ? PAINT.length + Math.floor(r() * OLD.length) : Math.floor(r() * PAINT.length)];
    var add = function(mat, g){ B.add(mat, g, fm); };
    add(wall, box(w, H - GROUND, DEPTH - 0.4, w / 2, GROUND + (H - GROUND) / 2, -DEPTH / 2 - 0.2, true));
    add(wall, box(w, GROUND, DEPTH - 3.1, w / 2, GROUND / 2, -DEPTH / 2 - 1.55, true));
    add(M.dark, box(w, 1, 3, w / 2, GROUND - 0.5, -1.55));
    add(M.slab, box(w, 0.25, 1.4, w / 2, GROUND, 0.3));
    // Shops, 4 to 5.5 m wide: open and lit inside, or shuttered; a signboard over each.
    var nShops = Math.max(1, Math.round(w / 4.7)), sw = w / nShops, b;
    for (b = 0; b < nShops; b++) {
      var x0 = b * sw, cx = x0 + sw / 2 + 0.15, inner = sw - 0.3, open = r() < 0.62;
      add(wall, box(0.3, GROUND, 3.1, x0 + 0.15, GROUND / 2, -1.55, true));
      if (open) add(M.shop, box(inner, GROUND - 0.95, 3, cx, (GROUND - 0.95) / 2, -1.6));
      else add(M.dark, box(inner, GROUND - 0.95, 0.4, cx, (GROUND - 0.95) / 2, -1.9));
      shops.push({ open: open, m: new T.Matrix4().compose(V(cx, open ? 0.02 : 0, open ? -0.75 : -0.3), new T.Quaternion(), open ? V(inner / 4.06, (GROUND - 1.15) / 2.1, 0.8) : V(inner / 5.45, (GROUND - 0.95) / 3, 0.5)) });
      var sign = box(inner, 0.85, 0.06, cx, GROUND - 0.55, 0.05), k = Math.floor(r() * 32);
      cellUV(sign, k % 2, Math.floor(k / 2), 2, 16);
      add(M.signs, sign);
    }
    add(wall, box(0.3, GROUND, 3.1, w - 0.15, GROUND / 2, -1.55, true));
    if (r() < 0.3) {
      var bw = Math.min(w - 1, 8), board = box(bw, 2.2, 0.1, w / 2, GROUND + 1.5, 0.45), kb = Math.floor(r() * 6);
      cellUV(board, kb % 2, Math.floor(kb / 2), 2, 3);
      add(M.boards, board);
    }
    // The floors above: bays 2.6 to 3.4 m wide, each a window behind a grill.
    var bays = Math.max(2, Math.round(w / 3)), bayW = w / bays, grill = Math.floor(r() * 16), f;
    if (style === 'glass') {
      add(M.glass, box(w - 0.6, floors * FLOOR - 0.4, 0.1, w / 2, GROUND + floors * FLOOR / 2, 0.05));
      for (f = 0; f <= floors; f++) add(M.metal, box(w - 0.6, 0.12, 0.18, w / 2, GROUND + 0.2 + f * FLOOR - (f === floors ? 0.4 : 0), 0.08));
      add(wall, box(0.3, floors * FLOOR, 0.3, 0.15, GROUND + floors * FLOOR / 2, -0.05, true));
      add(wall, box(0.3, floors * FLOOR, 0.3, w - 0.15, GROUND + floors * FLOOR / 2, -0.05, true));
    } else for (f = 0; f < floors; f++) {
      var y0 = GROUND + f * FLOOR, balcony = style === 'balconies' || (style === 'shades' && r() < 0.25);
      add(M.slab, box(w, 0.2, 0.25, w / 2, y0 + 0.1, 0.12));
      for (b = 0; b < bays; b++) {
        var bx = b * bayW, winW = Math.min(bayW - 0.7, 1.9), xs = bx + (bayW - winW) / 2, ys = y0 + 0.9;
        add(wall, box(xs - bx, FLOOR, 0.3, bx + (xs - bx) / 2, y0 + FLOOR / 2, -0.15, true));
        add(wall, box(bx + bayW - xs - winW, FLOOR, 0.3, xs + winW + (bx + bayW - xs - winW) / 2, y0 + FLOOR / 2, -0.15, true));
        add(wall, box(winW, 0.9, 0.3, xs + winW / 2, y0 + 0.45, -0.15, true));
        add(wall, box(winW, FLOOR - 2.4, 0.3, xs + winW / 2, ys + 1.5 + (FLOOR - 2.4) / 2, -0.15, true));
        add(NIGHT && r() < 0.45 ? M.lit[Math.floor(r() * M.lit.length)] : M.glass, box(winW, 1.5, 0.04, xs + winW / 2, ys + 0.75, -0.3));
        var gr = plane(winW, 1.5, xs + winW / 2, ys + 0.75, 0.02);
        cellUV(gr, grill % 4, Math.floor(grill / 4), 4, 4, true);
        add(M.grill, gr);
        if (style === 'shades') add(M.slab, box(winW + 0.3, 0.06, 0.45, xs + winW / 2, ys + 1.62, 0.22));
        if (balcony && (style === 'balconies' || b % 2 === 0)) {
          add(M.slab, box(bayW, 0.15, 1.1, bx + bayW / 2, y0 + 0.08, 0.55));
          var rail = plane(bayW, 1, bx + bayW / 2, y0 + 0.65, 1.1);
          cellUV(rail, grill % 4, Math.floor(grill / 4), 4, 4, true);
          add(M.grill, rail);
        } else if (r() < 0.12) shops.push({ ac: true, m: new T.Matrix4().makeTranslation(xs + winW / 2, y0 + 0.15, 0.3) });
      }
    }
    // The roof: a parapet and black water tanks.
    add(wall, box(w, 1.1, 0.2, w / 2, H + 0.55, -0.1, true));
    for (var t = 0; t < 1 + r() * 2; t++) add(M.tank, new T.CylinderGeometry(0.6, 0.6, 1.3, 12).translate(1 + r() * (w - 2), H + 0.65, -2 - r() * 6));
  }
  // Points a piece's UVs at one cell of a sheet (cols by rows), its front
  // face only for a box (a plane's whole face).
  function cellUV(g, cx, cy, cols, rows, flat){
    var uv = g.attributes.uv, n = g.attributes.normal;
    for (var i = 0; i < uv.count; i++) {
      if (!flat && n.getZ(i) < 0.5) { uv.setXY(i, (cx + 0.5) / cols, 1 - (cy + 0.5) / rows); continue; }
      var u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, (cx + u) / cols, flat ? (cy + 1 - v) / rows : 1 - (cy + 1 - v) / rows);
    }
  }

  // Sweeps a cross-section along the road from z0 to z1: `sec` is a list
  // of [x, y] (x across the road, y up from `base(z)`), `uv` metres to a
  // texture's width. The faces point the way the section turns: list it
  // from the road's right to its left for a face that looks up.
  function sweep(B, mat, P, z0, z1, sec, base, uvScale, step){
    step = step || 2.5;
    var zs = [], z, pos = [], uvs = [], idx = [], across = [0], j;
    for (z = z0; z < z1 - 1e-6; z += step) zs.push(z);
    zs.push(z1);
    for (j = 1; j < sec.length; j++) across.push(across[j - 1] + Math.hypot(sec[j][0] - sec[j - 1][0], sec[j][1] - sec[j - 1][1]));
    zs.forEach(function(zz){
      var y0 = base(zz);
      sec.forEach(function(s, k){
        var p = S.place(P, zz, s[0]);
        pos.push(p.x, y0 + s[1], p.z);
        uvs.push(across[k] / uvScale, zz / uvScale);
      });
    });
    var n = sec.length;
    for (var i = 0; i < zs.length - 1; i++) for (j = 0; j < n - 1; j++) { var a = i * n + j; idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    B.add(mat, g);
  }

  // ---------- The layout of a race's city ----------
  // Which buildings stand where along each side (z, width), where mosques
  // stand instead, and where the city gives way: to the lake, and to the
  // ramps and decks of a raised road (the buildings stay; the deck runs
  // over the street). Made once for each race.
  var layouts = {};
  function layout(P){
    if (layouts[P.race]) return layouts[P.race];
    var Tk = P.track, r = F.seeded(P.race * 3571 + 9), L = { left: [], right: [], mosques: [] }, end = P.n * F.SEG;
    Tk.scenery.forEach(function(things, i){
      things.forEach(function(o){ if (o.kind === 'mosque') L.mosques.push({ z: i * F.SEG, side: o.x < 0 ? -1 : 1, kind: L.mosques.length % 2 }); });
    });
    [-1, 1].forEach(function(side){
      if (side < 0 && Tk.lake) return;
      var list = side < 0 ? L.left : L.right, z = -40;
      while (z < end + 60) {
        var mq = L.mosques.filter(function(q){ return q.side === side && q.z >= z && q.z < z + 14; })[0];
        if (mq) { list.push({ z: z, w: 26, mosque: mq.kind }); z += 26.5; continue; }
        var w = 7 + r() * 7;
        list.push({ z: z, w: w, seed: Math.floor(r() * 1e9) });
        z += w + (r() < 0.25 ? 1 + r() * 2 : 0.05);
      }
    });
    layouts[P.race] = L;
    return L;
  }

  // ---------- A chunk ----------
  // Builds chunk c of race P's road: a group to add to the scene, the street
  // lamps in it (for their glow and pools of light at night) and dispose().
  function chunk(P, c, q){
    var CH = S.CHUNK, z0 = c * CH, z1 = Math.min((c + 1) * CH, P.n * F.SEG), Tk = P.track;
    var B = new Bucket(), group = new T.Group(), lamps = [], inst = {}, i, k;
    var height = function(z){ return F.heightAt(Tk, z); }, flat = function(){ return 0; };
    var raised = Tk.raised.filter(function(s){ return s.z1 + s.ramp > z0 && s.z0 - s.ramp < z1; })[0];
    var place = function(name, m){ (inst[name] = inst[name] || []).push(m); };
    // The road: at street level, and up on the deck where it's raised.
    var lane = [[ROAD, 0.02], [-ROAD, 0.02]];
    sweep(B, M.road, P, z0, z1, lane, flat, 5);
    if (raised) sweep(B, M.road, P, Math.max(z0, raised.z0 - raised.ramp), Math.min(z1, raised.z1 + raised.ramp), [[ROAD - 0.1, 0.06], [-ROAD + 0.1, 0.06]], height, 5);
    lines(B, P, z0, z1, flat);
    if (raised) lines(B, P, Math.max(z0, raised.z0 - raised.ramp + 2), Math.min(z1, raised.z1 + raised.ramp - 2), function(z){ return height(z) + 0.05; });
    // The start line, and the finish line under a gantry across the road.
    [0, Tk.length].forEach(function(z, k){
      if (z < z0 || z >= z1) return;
      sweep(B, M.chequer, P, z - 0.8, z + 0.8, [[ROAD, 0.035], [-ROAD, 0.035]], function(zz){ return height(zz); }, 1.75, 0.8);
      if (!k) return;
      var gm = at(P, z, 0, height(z));
      [-1, 1].forEach(function(s){ B.add(M.metal, box(0.35, 6, 0.35, s * (ROAD + 0.6), 3, 0), gm); });
      var banner = box(2 * ROAD + 1.6, 1.2, 0.12, 0, 5.6, 0);
      var uv = banner.attributes.uv;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i));
      B.add(M.chequer, banner, gm);
    });
    // Footpaths and kerbs; the ground beyond. On the lake route the left is water behind a railing.
    [-1, 1].forEach(function(s){
      if (s < 0 && Tk.lake) {
        sweep(B, M.plaster, P, z0, z1, [[-ROAD - 0.35, 0], [-ROAD - 0.35, 0.9], [-ROAD, 0.9], [-ROAD, 0]], flat, 2);
        sweep(B, M.water, P, z0, z1, [[-ROAD - 0.35, -0.5], [-160, -0.5]], flat, 8, 5);
        return;
      }
      var e = ROAD * s, sec = function(a){ return s > 0 ? a.slice().reverse() : a; };
      sweep(B, M.kerb, P, z0, z1, sec([[e + s * KERB, 0.2], [e + s * 0.03, 0.2], [e, 0.17], [e, 0]]).reverse(), flat, 0.3, 1);
      sweep(B, M.foot, P, z0, z1, sec([[e + s * (KERB + WALK), 0.2], [e + s * KERB, 0.2]]), flat, 4);
      sweep(B, M.ground, P, z0, z1, sec([[s * 70, 0.01], [s * FRONT, 0.01]]), flat, 4, 5);
    });
    // The raised road: its deck's girder, the barriers at its edges and its piers.
    if (raised) {
      var a = Math.max(z0, raised.z0 - raised.ramp), b2 = Math.min(z1, raised.z1 + raised.ramp), w2 = ROAD + 0.4;
      var girder = raised.kind === 'bridge' ? [[w2, 0.06], [w2, -0.6], [-w2, -0.6], [-w2, 0.06]] : [[w2, 0.06], [w2, -0.35], [w2 - 0.7, -0.55], [w2 - 1.6, -1.9], [-w2 + 1.6, -1.9], [-w2 + 0.7, -0.55], [-w2, -0.35], [-w2, 0.06]];
      sweep(B, M.concrete, P, a, b2, girder, height, 2.5);
      [-1, 1].forEach(function(s){
        var e = s * w2, sc = [[e - s * 0.45, 0.06], [e - s * 0.38, 0.14], [e - s * 0.22, 0.4], [e - s * 0.1, 1.1], [e, 1.1], [e, 0.06]];
        sweep(B, M.concrete, P, a, b2, s < 0 ? sc : sc.slice().reverse(), height, 2);
      });
      for (var pz = Math.ceil(a / 32) * 32; pz < b2; pz += 32) {
        var h = height(pz) - (raised.kind === 'bridge' ? 0.6 : 1.9);
        if (h < 1.5 && raised.kind !== 'bridge') continue;
        var pm = at(P, pz, 0, 0);
        var bottom = raised.kind === 'bridge' && Tk.lake ? -1 : 0;
        B.add(M.concrete, box(1.5, h - bottom - 1.1, 1.2, 0, bottom + (h - bottom - 1.1) / 2, 0), pm);
        B.add(M.concrete, box(2 * w2 - 2.6, 1.2, 1.6, 0, h - 0.6, 0), pm);
        if (raised.kind !== 'bridge' && pz % 64 === 0) [-1, 1].forEach(function(s){
          var lm = at(P, pz, s * (w2 - 0.1), height(pz));
          B.add(M.metal, new T.CylinderGeometry(0.06, 0.09, 8, 6).translate(0, 5.1, 0), lm);
          B.add(M.metal, box(1.6, 0.08, 0.08, 0, 9, 0).translate(0, 0, 0), new T.Matrix4().multiplyMatrices(lm, new T.Matrix4().makeTranslation(-s * 0.8, 0, 0)));
          B.add(M.lamp, box(0.6, 0.08, 0.25, 0, 8.95, 0), new T.Matrix4().multiplyMatrices(lm, new T.Matrix4().makeTranslation(-s * 1.5, 0, 0)));
          lamps.push(V(-s * 1.5, 8.9, 0).applyMatrix4(lm));
        });
      }
    }
    // Poles, with lamps on every other one, and the cables strung from each to the next on its side.
    var poles = [];
    for (i = Math.max(0, Math.floor(z0 / F.SEG)); i < Math.min(Tk.n, Math.ceil(z1 / F.SEG)); i++) Tk.scenery[i].forEach(function(o){
      var z = i * F.SEG;
      if (z < z0 || z >= z1) return;
      if (o.kind === 'pole') poles.push({ z: z, x: o.x });
      if (o.kind === 'tree') place(i % 3 ? 'mango' : 'rain', at(P, z, o.x, 0.2, i * 1.7));
    });
    poles.forEach(function(p){
      var s = p.x < 0 ? -1 : 1, pm = at(P, p.z, p.x, 0.2, s < 0 ? 0 : Math.PI);
      place('pole', pm);
      if ((p.z / 30) % 2 < 1) {
        var lm = at(P, p.z, p.x, 0);
        B.add(M.metal, new T.CylinderGeometry(0.035, 0.035, 2.4, 6).rotateZ(Math.PI / 2).translate(s * 1.15, 8.1, 0), lm);
        B.add(M.lamp, box(0.55, 0.06, 0.25, s * 2.3, 7.97, 0), lm);
        lamps.push(V(s * 2.3, 7.9, 0).applyMatrix4(lm));
      }
      // The cables: bundles at different sags to the next pole on this side.
      var rr = F.seeded(p.z * 13 + (s > 0 ? 7 : 0)), next = p.z + 60;
      if (next > P.n * F.SEG) return;
      for (k = 0; k < (q === 'low' ? 5 : 12); k++) {
        var bundle = Math.floor(rr() * 3), y = 9.2 - bundle * 0.7 - rr() * 0.25, off = p.x - s * (0.05 + bundle * 0.12 + rr() * 0.1), sag = 0.4 + bundle * 0.3 + rr() * 0.8, pts = [];
        for (var t = 0; t <= 8; t++) { var u = t / 8, pp = S.place(P, p.z + u * 60, off); pts.push(V(pp.x, y - sag * 4 * u * (1 - u), pp.z)); }
        B.add(M.cable, new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 0.008 + rr() * 0.01, 3));
      }
    });
    // Buildings and mosques.
    var L = layout(P), shopsOpen = [], shopsShut = [], acs = [];
    [-1, 1].forEach(function(side){
      (side < 0 ? L.left : L.right).forEach(function(bd){
        if (bd.z < z0 || bd.z >= z1) return;
        var fm = frame(P, side, bd.z, bd.w);
        if (bd.mosque !== undefined) { mosque(B, place, fm, bd.w, bd.mosque); return; }
        var shops = [];
        building(B, shops, fm, bd.w, F.seeded(bd.seed));
        shops.forEach(function(s){ (s.ac ? acs : s.open ? shopsOpen : shopsShut).push(new T.Matrix4().multiplyMatrices(fm, s.m)); });
      });
    });
    inst.crates = shopsOpen; inst.front = shopsShut; inst.ac = acs;
    // Pools of light under the lamps at night, and their glow.
    if (NIGHT) lamps.forEach(function(l){
      var floor = l.y > 10 ? l.y - 8.85 : 0.07, m = new T.Mesh(new T.PlaneGeometry(14, 14), M.pool);
      m.rotation.x = -Math.PI / 2; m.position.set(l.x, floor, l.z);
      group.add(m);
      var sp = new T.Sprite(M.glow); sp.scale.setScalar(2.2); sp.position.copy(l);
      group.add(sp);
    });
    B.meshes(group, q !== 'low');
    // The shops' fronts and the air conditioners are small and many: they
    // take shadows, but cast none.
    for (var name in inst) if (inst[name].length) instance(group, MODELS[name], inst[name], q !== 'low', !/^(crates|front|ac)$/.test(name));
    return { group: group, lamps: lamps, dispose: function(){ dispose(group); } };
  }
  // Lane lines: dashes between the lanes, solid lines along the edges.
  function lines(B, P, z0, z1, base){
    for (var z = Math.ceil(z0 / 9) * 9; z < z1; z += 9) [-3.5, 0, 3.5].forEach(function(x){
      sweepStrip(B, M.paint, P, z, Math.min(z + 3, z1), x, 0.12, base);
    });
    [-ROAD + 0.3, ROAD - 0.3].forEach(function(x){ sweepStrip(B, M.paint, P, z0, z1, x, 0.12, base); });
  }
  function sweepStrip(B, mat, P, z0, z1, x, w, base){
    sweep(B, mat, P, z0, z1, [[x + w / 2, 0.03], [x - w / 2, 0.03]], base, 1, 3);
  }
  // A mosque compound: a plastered wall with a gate on the footpath's back
  // edge, a courtyard, and the mosque set back behind it.
  function mosque(B, place, fm, w, kind){
    var gate = 4;
    [[0, w / 2 - gate / 2], [w / 2 + gate / 2, w]].forEach(function(s){
      B.add(M.plaster, box(s[1] - s[0], 2.4, 0.3, (s[0] + s[1]) / 2, 1.2, -0.15), fm);
      B.add(M.green, box(s[1] - s[0], 0.05, 0.05, (s[0] + s[1]) / 2, 3.2, -0.15), fm);
      for (var x = s[0] + 0.2; x < s[1] - 0.1; x += 0.3) B.add(M.green, new T.CylinderGeometry(0.015, 0.015, 0.8, 4).translate(x, 2.8, -0.15), fm);
    });
    [w / 2 - gate / 2 - 0.4, w / 2 + gate / 2 + 0.4].forEach(function(x){
      B.add(M.plaster, box(0.8, 4.2, 0.8, x, 2.1, -0.15), fm);
      B.add(M.plaster, new T.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 4.2, -0.15), fm);
    });
    B.add(M.plaster, new T.TorusGeometry(gate / 2 + 0.2, 0.25, 6, 16, Math.PI).translate(w / 2, 4, -0.15), fm);
    B.add(M.foot, plane(w, 16, 0, 0, 0).rotateX(-Math.PI / 2).translate(w / 2, 0.03, -8.3), fm);
    place(kind ? 'lalbagh' : 'masjid', new T.Matrix4().multiplyMatrices(fm, new T.Matrix4().makeTranslation(w / 2, 0, -12)));
  }
  // One instanced mesh for each part of a model, at each of `matrices`.
  function instance(group, list, matrices, shadows, cast){
    list.forEach(function(p){
      var m = new T.InstancedMesh(p.geometry, p.material, matrices.length);
      matrices.forEach(function(x, i){ m.setMatrixAt(i, x); });
      m.castShadow = shadows && cast; m.receiveShadow = shadows;
      m.computeBoundingSphere();
      group.add(m);
    });
  }
  // Frees what a chunk made for itself (its merged geometry; the models'
  // and materials are shared).
  function dispose(group){
    group.traverse(function(m){
      if (m.isInstancedMesh) m.dispose();
      else if (m.isMesh) m.geometry.dispose();
    });
  }

  window.bdnixStreetCity = { FRONT: FRONT, init: init, prepare: prepare, layout: layout, chunk: chunk, parts: parts };
})();
