// King of Streets in 3D: three.js (vendored, fetched when the game starts),
// the sky and light for the race's time of day, the city streamed in a
// chunk at a time as the race goes on (street-city.js), the racers on their
// bikes (street-rider.js), the traffic and the people on the footpaths, and
// the camera, behind the player or from their helmet. street.js runs the
// race and calls frame() to draw it.
(function(){
  var F = window.bdnixStreet, S = window.bdnixStreetScene, R = window.bdnixStreetRider, C = window.bdnixStreetCity;
  var BASE = '/assets/street/';
  var THREE_URL = '/assets/vendor/three/';
  var V3 = '?v=0.170.0';
  var T = null, loader = null, SkeletonUtils = null, mergeGeometries = null;

  // Whether this browser can draw the game (WebGL 2).
  function supported(){
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
  }

  // three.js and the add-ons the game uses, fetched once.
  var ready = null;
  function load(){
    if (ready) return ready;
    ready = Promise.all(['three.module.min.js', 'GLTFLoader.js', 'meshopt_decoder.module.js', 'RGBELoader.js', 'SkeletonUtils.js', 'BufferGeometryUtils.js'].map(function(f){
      return import(THREE_URL + f + V3);
    })).then(function(m){
      T = m[0];
      SkeletonUtils = m[4];
      loader = new m[1].GLTFLoader().setMeshoptDecoder(m[2].MeshoptDecoder);
      R.init(T, SkeletonUtils);
      mergeGeometries = m[5].mergeGeometries;
      C.init(T, mergeGeometries);
      return { RGBELoader: m[3].RGBELoader };
    });
    return ready;
  }

  // ---------- Models ----------
  var gltfs = {};
  function gltf(name){
    if (!gltfs[name]) gltfs[name] = new Promise(function(ok, fail){ loader.load(BASE + 'models/' + name + '.glb', ok, undefined, fail); });
    return gltfs[name];
  }
  // A copy of a model stood on the ground, centred, front to +z, `len`
  // metres long (or tall, `by: 'height'`; or across its widest, 'width'),
  // turned `ry` degrees first, its parts named by `hide` left out. Or put
  // exactly where `fix` (baked with the riders' poses) says.
  function place(o, opts){
    var g = new T.Group(), kill = [];
    if (opts.hide) o.traverse(function(n){ if (n.isMesh && (opts.hide.test(n.name) || opts.hide.test(n.material.name || ''))) kill.push(n); });
    kill.forEach(function(n){ n.removeFromParent(); });
    g.add(o);
    if (opts.fix) {
      o.position.fromArray(opts.fix.at);
      if (opts.fix.q) o.quaternion.fromArray(opts.fix.q);
      o.scale.setScalar(opts.fix.s);
    } else {
      o.rotation.y = (opts.ry || 0) * Math.PI / 180;
      g.updateMatrixWorld(true);
      var precise = opts.by !== 'height', sz = new T.Box3().setFromObject(o, precise).getSize(new T.Vector3());
      o.scale.multiplyScalar(opts.len / (opts.by === 'height' ? sz.y : opts.by === 'width' ? Math.max(sz.x, sz.z) : sz.z));
      g.updateMatrixWorld(true);
      var b = new T.Box3().setFromObject(o, precise);
      o.position.x -= (b.min.x + b.max.x) / 2; o.position.z -= (b.min.z + b.max.z) / 2; o.position.y -= b.min.y;
    }
    o.traverse(function(n){ if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = n.isSkinnedMesh ? false : n.frustumCulled; } });
    return g;
  }
  function thing(name, opts){
    return gltf(name).then(function(g){ return place(g.scene.clone(true), opts || {}); });
  }

  // A model that doesn't move its parts, merged so it draws in a few calls:
  // its plain parts (a colour, no texture) into one mesh coloured vertex by
  // vertex, one for each kind of finish (shiny, metal, matt), and its
  // textured parts into one mesh for each material. With `flat` (a model
  // only ever seen from afar) a texture counts as its average colour, so
  // nearly everything is plain. A new group in the place of `o`, its parts'
  // geometry in o's space.
  function compact(o, flat){
    o.updateMatrixWorld(true);
    var inv = o.matrixWorld.clone().invert(), buckets = {}, out = new T.Group();
    o.traverse(function(m){
      if (!m.isMesh || m.isSkinnedMesh || !m.visible) return;
      var mats = [].concat(m.material), g = m.geometry, groups = Array.isArray(m.material) && g.groups.length ? g.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
      var to = inv.clone().multiply(m.matrixWorld);
      groups.forEach(function(gr){
        var mat = mats[gr.materialIndex];
        if (!mat) return;
        var colour = plainColour(mat, flat), key = colour ? 'plain|' + (mat.metalness > 0.5 ? 'm' : '') + (mat.roughness < 0.35 ? 's' : '') + mat.side : mat.uuid;
        var b = buckets[key] || (buckets[key] = { mat: mat, plain: !!colour, list: [], rough: 0, metal: 0, n: 0 });
        b.list.push(clean(g, gr, to, colour));
        if (colour) { b.rough += mat.roughness; b.metal += mat.metalness; b.n++; }
      });
    });
    for (var k in buckets) {
      var b = buckets[k], mesh = new T.Mesh(mergeGeometries(b.list, false), b.plain ? plainMaterial(b) : b.mat);
      mesh.castShadow = mesh.receiveShadow = true;
      out.add(mesh);
    }
    out.position.copy(o.position); out.quaternion.copy(o.quaternion); out.scale.copy(o.scale);
    return out;
  }
  function plainMaterial(b){
    return new T.MeshStandardMaterial({ vertexColors: true, roughness: b.n ? b.rough / b.n : 0.8, metalness: b.n ? b.metal / b.n : 0, side: b.mat.side });
  }
  // The colour a material draws as a plain part, or null if it can't be one
  // (see-through, glowing, or textured unless `flat`).
  function plainColour(mat, flat){
    if (!mat.isMeshStandardMaterial || mat.transparent || mat.opacity < 1 || mat.alphaTest || mat.alphaMap || mat.vertexColors) return null;
    if (mat.emissiveMap || (mat.emissive && mat.emissive.getHex() !== 0)) return null;
    if (!mat.map) return mat.color;
    return flat ? mat.color.clone().multiply(average(mat.map)) : null;
  }
  // A texture's average colour (linear), drawn small to measure it.
  var averages = {};
  function average(t){
    if (averages[t.uuid]) return averages[t.uuid];
    var c = new T.Color(0.6, 0.6, 0.6);
    try {
      var cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
      cv.width = cv.height = 8;
      g.drawImage(t.image, 0, 0, 8, 8);
      var d = g.getImageData(0, 0, 8, 8).data, r = 0, gg = 0, bb = 0;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
      c.setRGB(r / 64 / 255, gg / 64 / 255, bb / 64 / 255, T.SRGBColorSpace);
    } catch (e) {}
    return (averages[t.uuid] = c);
  }
  // A figure's skinned meshes merged into one, every part its average
  // colour: for figures only seen from afar (rivals out ahead, people on
  // the footpaths). Done once for each look (`key`) and shared; each copy
  // keeps its own skeleton. Left as it is if its meshes don't share one.
  var slims = {};
  function slim(rd, key){
    var meshes = [];
    rd.traverse(function(m){ if (m.isSkinnedMesh && m.visible) meshes.push(m); });
    var first = meshes[0];
    if (!first) return;
    var fits = meshes.every(function(m){
      return m.parent === first.parent && m.matrix.equals(first.matrix) && m.bindMatrix.equals(first.bindMatrix) && m.skeleton.bones.length === first.skeleton.bones.length &&
        m.skeleton.bones.every(function(b, i){ return b === first.skeleton.bones[i]; });
    });
    if (!fits) return;
    var made = slims[key];
    if (!made) {
      var b = { mat: first.material, list: [], rough: 0, metal: 0, n: 0 };
      meshes.forEach(function(m){
        var colour = plainColour(m.material, true) || average(m.material.map || { uuid: 'none', image: null });
        var g = clean(m.geometry, { start: 0, count: Infinity }, new T.Matrix4(), colour, true);
        b.list.push(g); b.rough += m.material.roughness; b.metal += m.material.metalness; b.n++;
      });
      made = slims[key] = { geometry: mergeGeometries(b.list, false), material: plainMaterial(b) };
      made.material.side = T.FrontSide;
    }
    var one = new T.SkinnedMesh(made.geometry, made.material);
    one.name = first.name;
    one.position.copy(first.position); one.quaternion.copy(first.quaternion); one.scale.copy(first.scale);
    one.bindMode = first.bindMode;
    one.bind(first.skeleton, first.bindMatrix);
    one.frustumCulled = false;
    one.castShadow = true;
    first.parent.add(one);
    meshes.forEach(function(m){ m.removeFromParent(); });
  }
  // A model, placed and merged once, then copied (sharing its geometry).
  // A geometry's triangles in a group's range, in plain floats, moved by
  // `m`, with normals, UVs and, for a plain part, its colour on every
  // vertex; with `skin`, the bones each vertex hangs from too.
  function clean(g, gr, m, colour, skin){
    var idx = g.index, start = gr.start, end = Math.min(gr.start + gr.count, idx ? idx.count : g.attributes.position.count);
    var pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, n = end - start, i, k;
    var P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), Cc = colour ? new Float32Array(n * 3) : null;
    var si = skin && g.attributes.skinIndex, sw = skin && g.attributes.skinWeight, SI = skin ? new Uint16Array(n * 4) : null, SW = skin ? new Float32Array(n * 4) : null;
    for (i = 0; i < n; i++) {
      var v = idx ? idx.getX(start + i) : start + i;
      if (skin) for (k = 0; k < 4; k++) { SI[i * 4 + k] = si.getComponent(v, k); SW[i * 4 + k] = sw.getComponent(v, k); }
      P[i * 3] = pos.getX(v); P[i * 3 + 1] = pos.getY(v); P[i * 3 + 2] = pos.getZ(v);
      if (nor) { N[i * 3] = nor.getX(v); N[i * 3 + 1] = nor.getY(v); N[i * 3 + 2] = nor.getZ(v); }
      if (uv) { U[i * 2] = uv.getX(v); U[i * 2 + 1] = uv.getY(v); }
      if (Cc) { Cc[i * 3] = colour.r; Cc[i * 3 + 1] = colour.g; Cc[i * 3 + 2] = colour.b; }
    }
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(P, 3));
    out.setAttribute('normal', new T.BufferAttribute(N, 3));
    out.setAttribute('uv', new T.BufferAttribute(U, 2));
    if (Cc) out.setAttribute('color', new T.BufferAttribute(Cc, 3));
    if (skin) { out.setAttribute('skinIndex', new T.BufferAttribute(SI, 4)); out.setAttribute('skinWeight', new T.BufferAttribute(SW, 4)); }
    if (!nor) out.computeVertexNormals();
    out.applyMatrix4(m);
    return out;
  }
  // UVs in metres (every 2.5 m) from where each vertex is, picked by which
  // way its face looks, for a model with none.
  function boxUV(g, m){
    g = g.index ? g.toNonIndexed() : g.clone();
    var p = g.attributes.position, uv = new Float32Array(p.count * 2), a = new T.Vector3(), b = new T.Vector3(), n = new T.Vector3();
    for (var i = 0; i < p.count; i += 3) {
      var pts = [0, 1, 2].map(function(k){ return new T.Vector3().fromBufferAttribute(p, i + k).applyMatrix4(m); });
      n.crossVectors(a.subVectors(pts[1], pts[0]), b.subVectors(pts[2], pts[0]));
      var ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      for (var k = 0; k < 3; k++) {
        var w = pts[k];
        uv[(i + k) * 2] = (ay >= ax && ay >= az ? w.x : ax >= az ? w.z : w.x) / 2.5;
        uv[(i + k) * 2 + 1] = (ay >= ax && ay >= az ? w.z : w.y) / 2.5;
      }
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }
  // A model, placed and merged once, then copied (sharing its geometry).
  var compacted = {};
  function solid(name, opts, key, prep){
    key = name + '|' + (key || '');
    if (!compacted[key]) compacted[key] = thing(name, opts).then(function(o){ if (prep) prep(o); return compact(o, /_lo$/.test(name) && !opts.keep); });
    return compacted[key].then(function(o){ return o.clone(); });
  }
  function figure(name, opts){
    return gltf(name).then(function(g){
      var o = place(SkeletonUtils.clone(g.scene), opts);
      o.name = name;
      return o;
    });
  }

  // ---------- Times of day ----------
  // The sky, how much it lights the scene, the sun, the haze, the exposure
  // and whether the street lamps are lit (0 to 1).
  var TIMES = {
    night: { sky: 'qwantani_night', env: 0.12, bg: 0.1, sun: [0x9fb4ff, 0.18], sunAt: [-20, 40, 30], fog: [0x0d1018, 25, 230], exp: 1.15, lit: 1, clock: '02:00' },
    dawn: { sky: 'kloofendal_misty_morning', env: 0.75, bg: 1, sun: [0xffc08a, 1.5], sunAt: [-25, 9, 90], fog: [0xd6d3cb, 12, 170], exp: 0.95, lit: 0, clock: '05:30' },
    day: { sky: 'kloofendal_48d_partly_cloudy', env: 0.9, bg: 1, sun: [0xfff1dc, 3.2], sunAt: [-30, 60, -10], fog: [0xcdc6b5, 40, 300], exp: 0.9, lit: 0, clock: '13:10' },
    rush: { sky: 'kloofendal_48d_partly_cloudy', env: 0.85, bg: 1, sun: [0xffeccc, 2.8], sunAt: [-40, 35, 40], fog: [0xc9bea8, 22, 230], exp: 0.92, lit: 0, clock: '09:00' },
    dusk: { sky: 'qwantani_dusk_2', env: 0.55, bg: 0.9, sun: [0xff9a5a, 1.6], sunAt: [-60, 9, 70], fog: [0x8f8189, 20, 240], exp: 1.0, lit: 0.7, clock: '18:00' }
  };

  // ---------- The cast ----------
  // The six characters (three men, three women) and their helmets' colours.
  var CHARACTERS = [
    { id: 'c_teenboy', sex: 'm', helmet: 0x1a1a1c },
    { id: 'c_blackm', sex: 'm', helmet: 0x9c1418 },
    { id: 'c_polom', sex: 'm', helmet: 0xd9a514, top: [28, 52, 96] },
    { id: 'c_leatherw', sex: 'f', helmet: 0xe8e8ea },
    { id: 'c_teenblack', sex: 'f', helmet: 0x18a0a8 },
    { id: 'c_teew', sex: 'f', helmet: 0xe0601a }
  ];
  var RIVAL_HELMETS = [0x2f6fd0, 0x4caf50, 0x8e24aa, 0xf4511e, 0x546e7a, 0xec407a];
  // Who rides for each rival: the men's bodies for the five lads, a
  // woman's for Pinky, never quite the player's look.
  function cast(me){
    var men = [0, 1, 2].filter(function(i){ return i !== me; }), women = [3, 4, 5].filter(function(i){ return i !== me; });
    return F.RIVALS.map(function(o, i){ return i === 5 ? women[0] : men[i % men.length]; });
  }

  // Traffic: each kind's models (a car or truck is one of two, by its tint)
  // and how they're sized; a CNG is put where its driver's pose was baked.
  var VEHICLES = {
    cng: [{ name: 'cng', fix: 'cng' }],
    car: [{ name: 'corolla', len: 4.6 }, { name: 'yaris', len: 3.7 }],
    bus: [{ name: 'b_viking', len: 11 }],
    truck: [{ name: 't_al', len: 8 }, { name: 't_bd', len: 8.5 }]
  };
  var CAR_PAINT = [0xf2f2f0, 0xb8bcc0, 0x141516, 0x7a1418];
  // People on the footpaths, and how much to darken those who need it.
  var PEOPLE = [{ n: 'p_man_lo' }, { n: 'p_teen_lo' }, { n: 'p_shirt_lo' }, { n: 'd_pattern_lo' }, { n: 'd_striped_lo' }, { n: 'p_old', own: true }, { n: 'c_teew_lo', tone: true }, { n: 'c_hoodiew_lo', tone: true }];
  var TONES = [[0.62, 0.5, 0.42], [0.55, 0.43, 0.36], [0.7, 0.57, 0.48]];
  var NEAR = 22;          // metres from the camera within which the detailed models are drawn
  var NEAR_RACER = { high: 45, low: 25 };   // for racers, who are fewer and looked at more

  // ---------- The view ----------
  // Starts the 3D view on `canvas`. opts: { quality: 'high' or 'low' }.
  // Resolves to the view once three.js has loaded.
  function start(canvas, opts){
    return load().then(function(mods){ return (G3.current = new View(canvas, mods, opts || {})); });
  }

  function View(canvas, mods, opts){
    this.mods = mods;
    this.q = opts.quality === 'low' ? 'low' : 'high';
    this.Q = S.QUALITY[this.q];
    var r = this.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: this.q === 'high', powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.Q.pixels));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.shadowMap.enabled = this.Q.shadows;
    r.shadowMap.type = T.PCFSoftShadowMap;
    this.camera = new T.PerspectiveCamera(60, 1, 0.1, 900);
    // Cuts the player's head and shoulders away in the rider's view.
    this.clip = [new T.Plane(new T.Vector3(0, 1, 0), 1e6), new T.Plane(new T.Vector3(0, 1, 0), 1e6)];
    r.localClippingEnabled = true;
    this.mode = 'chase';
    this.chunks = {};
    this.racers = [];
    this.cars = {};
    this.walkers = {};
    this.time = 0;
    this.camAt = null;
  }

  // Readies a race: the world (from bdnixStreet.create) and opts
  // { character: 0 to 5 }. Resolves once everything the first frame needs
  // has loaded; the detailed models of the others follow.
  View.prototype.race = function(w, opts){
    var self = this, L = F.level(w.race), time = TIMES[L.time];
    this.clear();
    this.w = w;
    this.P = S.path(w.race);
    this.time = time;
    this.level = L;
    this.me = opts.character || 0;
    var scene = this.scene = new T.Scene();
    scene.fog = new T.Fog(time.fog[0], time.fog[1], Math.min(time.fog[2], this.Q.ahead));
    var sun = this.sun = new T.DirectionalLight(time.sun[0], time.sun[1]);
    sun.castShadow = this.Q.shadows;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    if (time.lit) scene.add(new T.HemisphereLight(0x2a3346, 0x4a3420, 0.9 * time.lit));
    this.renderer.toneMappingExposure = time.exp;

    var tex = function(name, srgb){
      var t = new T.TextureLoader().load(BASE + 'textures/' + name + '.webp');
      t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
      if (srgb) t.colorSpace = T.SRGBColorSpace;
      return t;
    };
    var pbr = function(name){ return { map: tex(name + '_diff', true), normalMap: tex(name + '_nor_gl'), roughnessMap: tex(name + '_rough') }; };
    var img = function(name){ return new Promise(function(ok){ var i = new Image(); i.onload = function(){ ok(i); }; i.onerror = function(){ ok(null); }; i.src = BASE + 'textures/' + name + '.webp'; }); };
    var font = window.FontFace ? new FontFace('Kalpurush', 'url(/assets/fonts/kalpurush.ttf?v=0.258)').load().then(function(f){ document.fonts.add(f); }, function(){}) : Promise.resolve();
    var sky = new Promise(function(ok){ new self.mods.RGBELoader().load(BASE + 'textures/sky/' + time.sky + '.hdr', ok, undefined, function(){ ok(null); }); });

    var rivals = cast(this.me), bikes = {}, needs = [];
    w.rivals.forEach(function(o){ bikes[F.BIKES[o.bike - 1].id] = 1; });
    var mine = F.BIKES[w.bike - 1].id, myRider = CHARACTERS[this.me].id;
    for (var b in bikes) needs.push(b + '_lo');
    CHARACTERS.forEach(function(c){ needs.push(c.id + '_lo'); });
    needs.push(mine, myRider, 'fullface', 'fullface_lo', 'cng_lo', 'corolla_lo', 'yaris_lo', 'b_viking_lo', 't_al_lo', 't_bd_lo', 'd_striped_lo', 'p_pole2', 'p_shutter', 'x_front_lo', 'x_crates_lo', 'p_ac_lo', 'tr_mango_lo', 'tr_rain_lo', 'q_masjid', 'q_lalbagh', 'bat', 'nunchaku_lo');
    var poses = this.poses || fetch(BASE + 'data/poses.json').then(function(r){ return r.json(); });
    return Promise.all([sky, font, poses, Promise.all([img('plastered_wall_04_diff'), img('worn_plaster_wall_diff'), img('concrete_pavement_diff')])].concat(needs.map(gltf))).then(function(got){
      if (self.w !== w) return;
      self.poses = got[2];
      var hdr = got[0];
      if (hdr) {
        hdr.mapping = T.EquirectangularReflectionMapping;
        scene.background = hdr; scene.environment = hdr;
        scene.backgroundIntensity = time.bg; scene.environmentIntensity = time.env;
      } else scene.background = new T.Color(time.fog[0]);
      var plasterN = tex('plastered_wall_04_nor_gl');
      var plaster = pbr('white_plaster_02');
      return Promise.all([
        solid('p_shutter', { len: 3, by: 'width' }), thing('x_front_lo', { len: 3.24, ry: 90, by: 'height' }), thing('x_crates_lo', { len: 2.1, ry: 90, by: 'height' }),
        solid('p_ac_lo', { len: 0.85, by: 'width' }), solid('p_pole2', { len: 10, by: 'height' }), solid('tr_mango_lo', { len: 7.5, by: 'height' }),
        solid('tr_rain_lo', { len: 10, by: 'height' }), solid('q_masjid', { len: 16, by: 'height' }),
        solid('q_lalbagh', { len: 13, by: 'height', hide: /^(Plane00[12]|Plane009|Arc001)/ }, '', function(o){
          // The Lalbagh model has no textures: lime plaster wrapped round it.
          o.traverse(function(n){ if (n.isMesh && !/Metal/.test(n.material.name)) { n.geometry = boxUV(n.geometry, n.matrixWorld); n.material = new T.MeshStandardMaterial({ map: plaster.map, normalMap: plaster.normalMap, color: new T.Color(2, 1.95, 1.82) }); } });
        })
      ]).then(function(m){
        // The shopfront scans stand with their fronts on the building line.
        [m[1], m[2]].forEach(function(o){ var bx = new T.Box3().setFromObject(o, true); o.children[0].position.z -= bx.max.z; o.traverse(function(n){ if (n.isMesh) n.material.side = T.DoubleSide; }); });
        C.prepare({ plaster: got[3][0], stain: got[3][1], pavement: got[3][2] }, {
          plasterN: plasterN, asphalt: pbr('asphalt_02'), pavement: pbr('concrete_pavement'), concrete: pbr('concrete_wall_006'),
          plaster: plaster, tilesRough: tex('concrete_tiles_rough')
        }, { shutter: m[0], front: m[1], crates: m[2], ac: m[3], pole: m[4], mango: m[5], rain: m[6], masjid: m[7], lalbagh: m[8] }, time.lit);
        return self.cast(rivals);
      });
    }).then(function(){
      if (self.w !== w) return;
      self.frame(w, 0);
      // The detailed models of the others, for when they come close.
      var more = Object.keys(bikes).concat(rivals.map(function(i){ return CHARACTERS[i].id; }), ['cng', 'corolla', 'yaris', 'b_viking', 't_al', 't_bd', 'd_striped']);
      self.later = Promise.all(more.map(gltf)).then(function(){
        if (self.w === w) self.upgrade();
      }, function(){});
    });
  };

  // ---------- Racers ----------
  // A racer: a bike with its rider, helmet and weapon, as two sets, detailed
  // (hi) and plain (lo); only the player's starts detailed.
  View.prototype.cast = function(rivals){
    var self = this, w = this.w, jobs = [];
    var all = [{ me: true, bike: F.BIKES[w.bike - 1].id, ch: this.me, helmet: CHARACTERS[this.me].helmet }].concat(w.rivals.map(function(o, i){
      return { bike: F.BIKES[o.bike - 1].id, ch: rivals[i], helmet: RIVAL_HELMETS[i] };
    }));
    all.forEach(function(d, i){
      var g = new T.Group();
      self.scene.add(g);
      var racer = { i: i, d: d, group: g, sets: {}, roll: 0, yaw: 0, fall: 0, x: 0, weapon: null };
      self.racers.push(racer);
      jobs.push(self.rig(racer, 'lo'));
      if (d.me) jobs.push(self.rig(racer, 'hi'));
    });
    return Promise.all(jobs);
  };
  // Builds one set of a racer: `level` 'hi' or 'lo'.
  View.prototype.rig = function(racer, level){
    var self = this, d = racer.d, ch = CHARACTERS[d.ch], sfx = level === 'lo' ? '_lo' : '';
    return Promise.all([
      solid(d.bike + sfx, { fix: self.poses[d.bike], hide: /ground/i }),
      figure(ch.id + sfx, { len: 1, by: 'height' }),
      solid('fullface' + sfx, { len: 1 }, d.helmet, function(h){ R.paintHelmet(h, d.helmet); })
    ]).then(function(m){
      if (racer.sets[level]) return;
      var bike = m[0], rd = m[1], hm = m[2];
      R.dress(rd, ch.id + sfx);
      if (ch.top) rd.traverse(function(n){ if (n.isMesh && /outfit_top|shirt|top/i.test(n.material.name) && n.material.map) R.recolor(n, ch.top, 0); });
      bike.add(rd);
      R.pose(rd, self.poses[d.bike + ':' + ch.id]);
      var b = R.bones(rd);
      R.helmet(b, hm, ch.sex === 'f' ? 0.29 : 0.31, new T.Vector3(0, 0, 1));
      var set = { bike: bike, rider: rd, bones: b, rest: R.rest(b), helmet: hm, weapon: null, held: null };
      // The player's own figure gets materials of its own, which the rider's
      // view cuts off above the shoulders.
      if (d.me) rd.traverse(function(m){ if (m.isSkinnedMesh) { m.material = m.material.clone(); m.material.clippingPlanes = self.clip; } });
      racer.sets[level] = set;
      bike.visible = level === 'hi' || !racer.sets.hi;
      if (level === 'hi' && racer.sets.lo) racer.sets.lo.bike.visible = false;
      racer.group.add(bike);
    });
  };
  // Swaps in the detailed models, now loaded, for the others.
  View.prototype.upgrade = function(){
    var self = this;
    this.racers.forEach(function(r){ if (!r.sets.hi) self.rig(r, 'hi'); });
    this.upgraded = true;
  };
  // Puts a weapon in a rider's right hand, or takes it away.
  View.prototype.arm = function(racer, set, weapon){
    if (set.held === weapon) return;
    if (set.weapon) { set.weapon.removeFromParent(); set.weapon = null; }
    set.held = weapon;
    if (!weapon) return;
    var self = this, made = weapon === 'chain' ? Promise.resolve(chain()) : solid(weapon === 'stick' ? 'bat' : 'nunchaku_lo', weapon === 'stick' ? { len: 0.85, by: 'width' } : { len: 0.33, by: 'height' });
    made.then(function(o){
      if (set.held !== weapon || set.weapon) return;
      set.bike.updateMatrixWorld(true);
      var up = new T.Vector3(0, 1, 0.25).transformDirection(set.bike.matrixWorld);
      set.weapon = R.hold(set.bones, 'r', o, up, weapon === 'stick' ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0));
      void self;
    });
  };
  // A bike chain: links of steel, 70 cm of them.
  function chain(){
    var g = new T.Group(), mat = new T.MeshStandardMaterial({ color: 0x9a9da0, metalness: 0.9, roughness: 0.35 }), geo = new T.TorusGeometry(0.012, 0.004, 4, 8);
    for (var i = 0; i < 22; i++) {
      var l = new T.Mesh(geo, mat);
      l.position.set(0, i * 0.03, Math.sin(i * 0.3) * 0.02);
      l.rotation.y = i % 2 ? Math.PI / 2 : 0;
      g.add(l);
    }
    return g;
  }

  // ---------- Each frame ----------
  // Draws world w, `dt` seconds after the last frame.
  View.prototype.frame = function(w, dt){
    if (!this.scene || w !== this.w) return;
    var p = w.player, self = this;
    this.clock = (this.clock || 0) + dt;
    this.stream(p.z);
    // The racers: player first, then the rivals.
    [p].concat(w.rivals).forEach(function(o, i){ self.ride(self.racers[i], o, i === 0 ? p.crash > 0 || w.over === 'ko' : o.down > 0, dt); });
    this.traffic(w);
    this.people(p.z, dt);
    this.aim(w, dt);
    // The sun follows the player, so the shadows near them are sharp.
    var at = S.place(this.P, p.z, p.x), t = this.time;
    this.sun.target.position.set(at.x, at.y, at.z);
    this.sun.position.set(at.x + t.sunAt[0], at.y + t.sunAt[1], at.z + t.sunAt[2]);
    if (G3.draw) this.renderer.render(this.scene, this.camera);
  };

  // Builds the chunks of road the camera can see, and lets go of those behind.
  View.prototype.stream = function(z){
    var want = S.chunks(this.P, z, this.Q.ahead, this.Q.behind), keep = {}, self = this, built = 0;
    want.forEach(function(c){
      keep[c] = 1;
      // At most two new chunks a frame, nearest first, so a frame never stalls for long.
      if (self.chunks[c] || built >= 2) return;
      self.chunks[c] = C.chunk(self.P, c, self.q);
      self.scene.add(self.chunks[c].group);
      built++;
    });
    for (var c in this.chunks) if (!keep[c]) {
      this.scene.remove(this.chunks[c].group);
      this.chunks[c].dispose();
      delete this.chunks[c];
    }
  };

  // One racer: where they are, leaning into their steering, falling when
  // they crash, and the move they're making.
  View.prototype.ride = function(racer, o, down, dt){
    if (!racer) return;
    var at = S.place(this.P, o.z, o.x), g = racer.group;
    var steer = dt > 0 ? (o.x - racer.x) / dt : 0;
    racer.x = o.x;
    var lean = racer.i === 0 ? o.lean || 0 : Math.max(-1, Math.min(1, steer / 5));
    racer.roll += (lean * 0.32 - racer.roll) * Math.min(1, dt * 8);
    racer.fall = down ? Math.min(1, racer.fall + dt * 3) : Math.max(0, racer.fall - dt * 2);
    g.position.set(at.x, at.y + 0.02, at.z);
    g.rotation.set(0, at.heading - lean * 0.06, 0);
    g.rotateZ(racer.roll + racer.fall * 1.35 * (o.x < 0 ? 1 : -1));
    var near = racer.i === 0 || (this.camAt && this.camAt.distanceTo(g.position) < NEAR_RACER[this.q]);
    var hi = racer.sets.hi, lo = racer.sets.lo, set = hi && (near || !lo) ? hi : lo;
    if (hi) hi.bike.visible = set === hi;
    if (lo) lo.bike.visible = set === lo;
    if (!set) return;
    this.arm(racer, set, o.weapon || null);
    R.relax(set.bones, set.rest);
    var a = o.attack, M = a && F.MOVES[a.move];
    if (a && M && !down) {
      g.updateMatrixWorld(true);
      R.strike(set.bike, set.bones, a.move, a.side, Math.min(1, a.t / M.time), M.at / M.time);
    }
    // In the rider's own view the player's head and helmet are out of the way.
    // (Everything of them above the shoulders is cut away: see aim().)
    if (racer.i === 0) set.helmet.visible = this.mode !== 'rider';
  };

  // ---------- Traffic ----------
  View.prototype.traffic = function(w){
    var self = this, list = F.nearby(w, w.player.z, this.Q.ahead), seen = {};
    list.forEach(function(c){
      if (c.z < w.player.z - self.Q.behind) return;
      seen[c.id] = 1;
      var car = self.cars[c.id] || self.car(c);
      var at = S.place(self.P, c.z, c.x), s = w.shoved[c.id];
      car.group.position.set(at.x, at.y + 0.02, at.z);
      car.group.rotation.set(0, at.heading + (s ? s.vx * 0.05 : 0), 0);
      var near = self.camAt && self.camAt.distanceTo(car.group.position) < NEAR;
      if (car.hi) { car.hi.visible = near; car.lo.visible = !near; }
      else if (near && self.upgraded && !car.asked) { car.asked = true; self.detail(car); }
    });
    for (var id in this.cars) if (!seen[id]) { this.scene.remove(this.cars[id].group); delete this.cars[id]; }
  };
  // A vehicle's models: plain now, detailed once loaded and close.
  View.prototype.car = function(c){
    var v = F.traffic(this.w.race)[c.id], kinds = VEHICLES[v.kind], kind = kinds[v.tint % kinds.length];
    var car = { group: new T.Group(), kind: kind, v: v, lo: null, hi: null };
    this.cars[c.id] = car;
    this.scene.add(car.group);
    var self = this;
    this.vehicle(kind, v, '_lo').then(function(o){ car.lo = o; car.group.add(o); if (car.hi) o.visible = false; });
    if (v.kind === 'cng') this.driver(car, v);
    void self;
    return car;
  };
  View.prototype.detail = function(car){
    var self = this;
    this.vehicle(car.kind, car.v, '').then(function(o){ if (!self.cars[car.v.id]) return; car.hi = o; car.group.add(o); });
  };
  View.prototype.vehicle = function(kind, v, sfx){
    var self = this, opts = kind.fix ? { fix: this.poses[kind.fix] } : { len: kind.len }, lit = !!(this.time.lit || this.level.traffic >= 1);
    return solid(kind.name + sfx, opts, (v.kind === 'car' ? v.tint % CAR_PAINT.length : '') + (lit ? 'lit' : ''), function(o){
      o.traverse(function(m){
        if (!m.isMesh) return;
        var n = m.material.name || '';
        if (/glass|kaca|window|vidrio/i.test(n)) m.material = self.shared('glass', function(){ return new T.MeshStandardMaterial({ color: 0x0e1214, metalness: 0.6, roughness: 0.08 }); });
        else if (v.kind === 'car' && /main_paint|WCCARBODY/.test(n)) { m.material = m.material.clone(); m.material.color = new T.Color(CAR_PAINT[v.tint % CAR_PAINT.length]); }
      });
      if (lit) self.tail(o, kind.name);
    });
  };
  // One material for everyone that shares it, made the first time.
  View.prototype.shared = function(key, make){
    this.mats = this.mats || {};
    return this.mats[key] || (this.mats[key] = make());
  };
  // Tail lamps, red, lit at night and in the jam.
  View.prototype.tail = function(o, name){
    var box = new T.Box3().setFromObject(o, true), w = box.max.x - box.min.x;
    var lamp = this.shared('tail', function(){ return new T.MeshBasicMaterial({ color: 0xff2a14 }); });
    var y = { cng: 0.55, corolla: 0.92, yaris: 0.95, b_viking: 1.0, t_al: 0.95, t_bd: 0.95 }[name.replace('_lo', '')] || 0.9;
    [-1, 1].forEach(function(s){
      var m = new T.Mesh(new T.PlaneGeometry(0.16, 0.1), lamp);
      m.position.set((box.min.x + box.max.x) / 2 + s * w * 0.34, box.min.y + y, box.min.z - 0.02);
      m.rotation.y = Math.PI;
      o.add(m);
    });
  };
  // A CNG's driver: at the wheel when it's moving; when it's parked, now and
  // then standing by it on the footpath instead.
  View.prototype.driver = function(car, v){
    var self = this, n = v.id;
    figure('d_striped_lo', { len: 1, by: 'height' }).then(function(rd){
      if (!self.cars[v.id]) return;
      R.uniform(rd, n);
      slim(rd, 'driver' + n % 12);
      if (v.parked && n % 10 < 7) {
        var side = v.x < 0 ? -1 : 1, g = new T.Group();
        rd.scale.multiplyScalar(0.96);
        g.add(rd);
        rd.position.set(side * -1.7, 0.2, (n % 3 - 1) * 1.1);
        rd.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        R.stand(rd);
        car.group.add(g);
      } else {
        var holder = new T.Group();
        car.group.add(holder);
        holder.add(rd);
        R.pose(rd, self.poses['cng:d_striped']);
      }
    });
  };

  // ---------- People ----------
  // People walk along the footpaths at their own pace, each way; only those
  // near the camera are made.
  View.prototype.people = function(z, dt){
    var self = this, L = this.level, gap = 7 / Math.max(0.05, L.people * this.Q.people), w = this.w;
    if (!this.walkSrc) {
      if (!this.askedWalk) { this.askedWalk = true; gltf('p_old').then(function(g){ self.walkSrc = R.walkSource(g); }); }
      return;
    }
    var from = Math.floor((z - 20) / gap), to = Math.floor((z + Math.min(90, this.Q.ahead)) / gap), keep = {};
    for (var i = Math.max(0, from); i <= to; i++) [-1, 1].forEach(function(side){
      if (side < 0 && self.P.track.lake) return;
      var id = i * 2 + (side > 0 ? 1 : 0), r = F.seeded(w.race * 7777 + id), z0 = i * gap + r() * gap;
      if (F.heightAt(self.P.track, z0) > 0.3 && self.P.track.raised[0].kind === 'bridge') return;
      keep[id] = 1;
      var p = self.walkers[id] || self.walker(id, side, z0, r);
      if (!p.group) return;
      var zz = p.z0 + p.dir * p.speed * self.clock, at = S.place(self.P, zz, p.x);
      p.group.position.set(at.x, 0.2, at.z);
      p.group.rotation.y = at.heading + (p.dir > 0 ? 0 : Math.PI);
      if (p.mixer) p.mixer.update(dt);
    });
    for (var id in this.walkers) if (!keep[id]) { if (this.walkers[id].group) this.scene.remove(this.walkers[id].group); delete this.walkers[id]; }
  };
  View.prototype.walker = function(id, side, z0, r){
    var self = this, who = PEOPLE[Math.floor(r() * PEOPLE.length)];
    var p = this.walkers[id] = { z0: z0, x: side * (8.2 + r() * 3.2), dir: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.5, group: null, mixer: null };
    var tone = TONES[Math.floor(r() * TONES.length)], phase = r();
    figure(who.n, { len: 1.6 + r() * 0.15, by: 'height' }).then(function(o){
      if (self.walkers[id] !== p) return;
      if (who.tone) R.skinTone(o, tone);
      if (/^d_striped/.test(who.n)) R.uniform(o, id);
      slim(o, who.n + (who.tone ? tone : '') + (/^d_striped/.test(who.n) ? id % 12 : ''));
      p.mixer = R.walk(o, who.n.replace('_lo', ''), self.walkSrc, phase);
      // Feet on the ground, as the walk holds them.
      o.updateMatrixWorld(true);
      o.position.y -= new T.Box3().setFromObject(o, true).min.y;
      o.traverse(function(m){ if (m.isMesh) m.castShadow = self.Q.shadows; });
      p.group = new T.Group();
      p.group.add(o);
      self.scene.add(p.group);
    });
    return p;
  };

  // ---------- The camera ----------
  // Behind the player (chase) or from their helmet (rider), eased so it
  // follows the road's bends smoothly.
  View.prototype.view = function(mode){ this.mode = mode === 'rider' ? 'rider' : 'chase'; };
  View.prototype.aim = function(w, dt){
    var cam = this.camera, p = w.player, size = this.renderer.getSize(new T.Vector2()), tall = size.y > size.x;
    var k = dt > 0 ? Math.min(1, dt * 6) : 1;
    if (this.mode === 'rider' && this.racers[0] && this.racers[0].sets.hi) {
      // From the helmet, over the bars, both hands in view: framed once for
      // the screen's shape, in the bike's own frame, so it leans with it.
      var set = this.racers[0].sets.hi, bike = set.bike, aspect = size.x / Math.max(1, size.y);
      if (!this.cockpit || this.cockpit.aspect !== aspect || this.cockpit.set !== set) {
        this.racers[0].group.updateMatrixWorld(true);
        var local = function(b){ var v = bike.worldToLocal(b.getWorldPosition(new T.Vector3())); return { x: v.x, y: v.y, z: v.z }; };
        this.cockpit = S.cockpit(local(set.bones.head), [local(set.bones.hand_l), local(set.bones.hand_r)], aspect);
        this.cockpit.aspect = aspect; this.cockpit.set = set;
      }
      var ck = this.cockpit, sh = set.bones.upperarm_l.getWorldPosition(new T.Vector3()).add(set.bones.upperarm_r.getWorldPosition(new T.Vector3())).multiplyScalar(0.5);
      // Only what's below the shoulders and in front of them: the arms and hands.
      var fwd = new T.Vector3(0, 0, 1).transformDirection(bike.matrixWorld);
      this.clip[0].setFromNormalAndCoplanarPoint(new T.Vector3(0, -1, 0), sh.clone().add(new T.Vector3(0, -0.03, 0)));
      this.clip[1].setFromNormalAndCoplanarPoint(fwd, sh.clone().add(fwd.clone().multiplyScalar(0.2)));
      cam.position.copy(bike.localToWorld(new T.Vector3(ck.eye.x, ck.eye.y, ck.eye.z)));
      cam.near = 0.08;
      cam.fov = ck.fov;
      cam.up.set(0, 1, 0);
      cam.lookAt(bike.localToWorld(new T.Vector3(ck.look.x, ck.look.y, ck.look.z)));
      cam.updateProjectionMatrix();
    } else {
      this.clip.forEach(function(c){ c.normal.set(0, 1, 0); c.constant = 1e6; });
      var c = S.chase(this.P, p.z, p.x, tall), to = new T.Vector3(c.to.x, c.to.y, c.to.z), from = new T.Vector3(c.from.x, c.from.y, c.from.z);
      if (!this.look || k === 1) { this.look = to.clone(); cam.position.copy(from); }
      else { cam.position.lerp(from, k); this.look.lerp(to, k); }
      cam.near = 0.1;
      cam.fov = tall ? 70 : 58;
      cam.lookAt(this.look);
      cam.updateProjectionMatrix();
    }
    this.camAt = cam.position;
  };
  View.prototype.resize = function(w, h){
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // What's drawn, for checking: chunks built, racers, vehicles and people
  // shown, and the renderer's count of draw calls and triangles.
  View.prototype.stats = function(){
    var count = function(o){ var n = 0; for (var k in o) if (o[k]) n++; return n; };
    return {
      chunks: count(this.chunks), racers: this.racers.filter(function(r){ return r.sets.lo || r.sets.hi; }).length,
      cars: count(this.cars), people: count(this.walkers), calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      mode: this.mode, quality: this.q
    };
  };

  // Lets go of the race's scene.
  View.prototype.clear = function(){
    for (var c in this.chunks) this.chunks[c].dispose();
    this.chunks = {}; this.racers = []; this.cars = {}; this.walkers = {}; this.look = null; this.clock = 0;
    this.scene = null; this.w = null; this.upgraded = false;
  };

  // `current`: the view last started. `draw`: whether frames are drawn. Everything else about them (the road
  // built, everyone moved, the camera) happens either way; the tests turn
  // drawing off to play quickly in a browser that draws in software.
  var G3 = window.bdnixStreet3d = { current: null, draw: true, supported: supported, start: start, TIMES: TIMES, CHARACTERS: CHARACTERS, cast: cast };
})();
