// King of Streets: the people. Riders sat on their bikes in the poses baked
// for them (data/poses.json: each rider's every bone, with both hands
// closed round the grips), their helmets, punches, kicks and swings; CNG
// drivers in their uniforms; and people walking on the footpaths. The
// figures are scans of real people, rigged by their artists in one of a few
// skeletons, so bones are found by what they are (canonical()), not their
// names. street-3d.js calls init() with three.js once it has loaded.
(function(){
  var T = null, SU = null;
  function init(three, skeletonUtils){ T = three; SU = skeletonUtils; }
  function V(x, y, z){ return new T.Vector3(x || 0, y || 0, z || 0); }
  function Q(){ return new T.Quaternion(); }

  // ---------- Bones ----------
  // HumanIK, Mixamo and Character Creator names for the bones that matter.
  var HIK = { Hips: 'hip', Spine: 'spine_01', Spine1: 'spine_02', Spine2: 'spine_03', Neck: 'neck', Head: 'head',
    LeftShoulder: 'shoulder_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
    RightShoulder: 'shoulder_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
    LeftUpLeg: 'upperleg_l', LeftLeg: 'lowerleg_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
    RightUpLeg: 'upperleg_r', RightLeg: 'lowerleg_r', RightFoot: 'foot_r', RightToeBase: 'ball_r', HeadTop: 'head_end' };
  var CC = { Hip: 'hip', Waist: 'spine_01', Spine01: 'spine_02', Spine02: 'spine_03', NeckTwist01: 'neck', Head: 'head',
    L_Clavicle: 'shoulder_l', L_Upperarm: 'upperarm_l', L_Forearm: 'lowerarm_l', L_Hand: 'hand_l',
    R_Clavicle: 'shoulder_r', R_Upperarm: 'upperarm_r', R_Forearm: 'lowerarm_r', R_Hand: 'hand_r',
    L_Thigh: 'upperleg_l', L_Calf: 'lowerleg_l', L_Foot: 'foot_l', L_ToeBase: 'ball_l',
    R_Thigh: 'upperleg_r', R_Calf: 'lowerleg_r', R_Foot: 'foot_r', R_ToeBase: 'ball_r' };
  // What a bone is, in any of the rigs ('hand_l', 'spine_02' and so on), or null.
  function canonical(name){
    var m = /(?:^|_)((?:hip|spine_0\d|neck|head|shoulder_[lr]|upperarm_[lr]|lowerarm_[lr]|hand_[lr]|upperleg_[lr]|lowerleg_[lr]|foot_[lr]|ball_[lr]|head_end))_\d+$/.exec(name);
    if (m) return m[1];
    if (/^(?:mixamorig:?)?HeadTop_End_\d+$/.test(name)) return 'head_end';
    m = /^(?:mixamorig:?)?([A-Za-z0-9]+)_\d+$/.exec(name);
    if (m && HIK[m[1]]) return HIK[m[1]];
    m = /^CC_Base_([A-Za-z0-9_]+?)_\d+$/.exec(name);
    return m && CC[m[1]] || null;
  }
  function bones(root){
    var b = {};
    root.traverse(function(n){
      var k = n.isBone && canonical(n.name);
      if (k && !b[k]) b[k] = n;
    });
    return b;
  }
  function wpos(o){ return o.getWorldPosition(V()); }

  // Turns `bone` so the direction from it to `child` points at `target`.
  function aim(bone, child, target){
    bone.updateWorldMatrix(true, true);
    var a = wpos(bone), from = wpos(child).sub(a).normalize(), to = target.clone().sub(a).normalize();
    var q = Q().setFromUnitVectors(from, to), wq = bone.getWorldQuaternion(Q()), pq = bone.parent.getWorldQuaternion(Q());
    bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
    bone.updateWorldMatrix(false, true);
  }
  // A two-bone reach: a (shoulder or hip) and b (elbow or knee) turned so c
  // (wrist or ankle) reaches target, the joint bending towards pole.
  function ik(a, b, c, target, pole){
    a.updateWorldMatrix(true, true);
    var A = wpos(a), B = wpos(b), C = wpos(c), l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    var toT = target.clone().sub(A), d = Math.min(toT.length(), (l1 + l2) * 0.999), dir = toT.normalize();
    var along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    var p = pole.clone().sub(A);
    p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
    aim(a, b, A.clone().add(dir.clone().multiplyScalar(along)).add(p.multiplyScalar(h)));
    aim(b, c, target);
  }

  // ---------- Sitting on a bike ----------
  // Puts a figure (as place() in street-3d.js made it: a group holding the
  // model) into the pose baked for it on this bike: where it sits, how big
  // it is and how every bone is turned.
  function pose(rd, P){
    rd.position.fromArray(P.at);
    rd.quaternion.fromArray(P.q);
    rd.scale.setScalar(P.s);
    var o = rd.children[0];
    o.position.fromArray(P.inner.at);
    o.scale.setScalar(P.inner.s);
    rd.traverse(function(n){
      var q = n.isBone && P.bones[n.name];
      if (q) n.quaternion.fromArray(q);
    });
    rd.updateMatrixWorld(true);
  }

  // ---------- Getting ready to ride ----------
  // Hair and faces go (the helmet covers them) and the head shrinks inside
  // it. Done once for each model and shared by everyone wearing it, before
  // it's posed, while the figure stands as it was scanned.
  var headless = {};
  function dress(root, key){
    var meshes = [];
    root.traverse(function(m){ if (m.isSkinnedMesh) meshes.push(m); });
    meshes.forEach(function(m, k){
      if (/hair|scalp|eyelash|eye|teeth|tongue|mouth/i.test(m.material.name || '')) { m.visible = false; return; }
      var id = key + ':' + k;
      if (!headless[id]) headless[id] = shrinkHead(root, m);
      m.geometry = headless[id];
    });
  }
  function shrinkHead(root, m){
    var g = m.geometry.clone(), pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    root.updateMatrixWorld(true);
    m.skeleton.update();
    var toMesh = m.matrixWorld.clone().invert(), at = {};
    var named = m.skeleton.bones.map(function(b){
      var k = canonical(b.name);
      if (k && !at[k]) at[k] = b.getWorldPosition(V()).applyMatrix4(toMesh);
      var n = b;
      while (n && !canonical(n.name)) n = n.parent;
      return n ? canonical(n.name) : 'hip';
    });
    if (!at.neck || !at.hip) return g;
    var up = at.neck.clone().sub(at.hip), len = up.length();
    up.normalize();
    var c = V(), inHead = [], p = V(), i, k;
    for (i = 0; i < pos.count; i++) {
      // What the vertex hangs from most: the head, a hand or forearm, or the rest.
      var best = '', bw = -1;
      for (k = 0; k < 4; k++) { var w = sw.getComponent(i, k); if (w > bw) { bw = w; best = named[si.getComponent(i, k)]; } }
      m.applyBoneTransform(i, p.fromBufferAttribute(pos, i));
      var d = p.clone().sub(at.neck), h = d.dot(up), side = d.sub(up.clone().multiplyScalar(h)).length();
      var head = /^head/.test(best) || (h > 0.06 * len && side < 0.3 * len && !/^(hand|lowerarm)/.test(best));
      if (head) { inHead.push(i); c.x += pos.getX(i); c.y += pos.getY(i); c.z += pos.getZ(i); }
    }
    if (!inHead.length) return g;
    c.divideScalar(inHead.length);
    inHead.forEach(function(j){
      pos.setXYZ(j, c.x + (pos.getX(j) - c.x) * 0.4, c.y + (pos.getY(j) - c.y) * 0.4, c.z + (pos.getZ(j) - c.z) * 0.4);
    });
    pos.needsUpdate = true;
    return g;
  }

  // A helmet (front +z, its base at y 0) on the head, hung off the head
  // bone; `fwd` is the way the rider faces.
  function helmet(b, model, size, fwd){
    var H = wpos(b.head), E = b.head_end ? wpos(b.head_end) : null, nd = H.clone().sub(wpos(b.neck)).normalize();
    if (!E || E.distanceTo(H) < 0.08 || E.distanceTo(H) > 0.35 || E.clone().sub(H).normalize().dot(nd) < 0.6) E = H.clone().add(nd.multiplyScalar(0.2));
    var up = E.clone().sub(H), hl = up.length();
    up.normalize();
    var f = fwd.clone().sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
    var basis = new T.Matrix4().makeBasis(V().crossVectors(up, f), up, f);
    var box = new T.Box3().setFromObject(model), sz = box.getSize(V());
    model.scale.multiplyScalar(size / sz.z);
    model.updateMatrixWorld(true);
    var centre = new T.Box3().setFromObject(model).getCenter(V()), holder = new T.Group();
    holder.add(model);
    model.position.sub(centre);
    holder.quaternion.setFromRotationMatrix(basis);
    holder.position.copy(H).add(up.multiplyScalar(hl * 0.42)).add(f.multiplyScalar(0.015));
    b.head.attach(holder);
    return holder;
  }
  // Paints a helmet: the shell in the rider's colour, the visor dark and mirrored.
  function paintHelmet(h, colour){
    h.traverse(function(m){
      if (!m.isMesh) return;
      var x = m.material.clone();
      if (x.transparent || x.opacity < 1 || /glass|visor|vidrio|lens|clear/i.test(x.name)) {
        x.transparent = false; x.opacity = 1; x.color = new T.Color(0x0b0d10); x.map = null; x.metalness = 0.9; x.roughness = 0.08;
      } else if (/^helmet$|base_plastic/i.test(x.name)) {
        x.color = new T.Color(colour); x.map = null; x.metalness = 0.1; x.roughness = 0.25;
      }
      m.material = x;
    });
  }
  // A weapon in a hand: its long axis (`along`, in the model) pointing `dir` (world).
  function hold(b, side, model, dir, along){
    var hand = b['hand_' + side], box = new T.Box3().setFromObject(model), sz = box.getSize(V());
    var holder = new T.Group(), len = Math.abs(along.dot(sz));
    holder.add(model);
    model.position.sub(box.getCenter(V())).add(along.clone().multiplyScalar(len * 0.4));
    holder.quaternion.setFromUnitVectors(along, dir.clone().normalize());
    holder.position.copy(wpos(hand)).add(dir.clone().normalize().multiplyScalar(0.04));
    hand.attach(holder);
    return holder;
  }

  // ---------- Clothes and skin ----------
  // Dyes a garment: its texture's light and shade kept, its colour changed;
  // `plain` (0 to 1) blurs a print away. One material per garment and
  // colour, shared.
  var dyed = {};
  function recolor(m, rgb, plain){
    var key = m.material.uuid + '|' + rgb + '|' + plain;
    if (dyed[key]) { m.material = dyed[key]; return; }
    var img = m.material.map.image, W = img.width, H = img.height, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    if (plain) g.filter = 'blur(' + Math.round(W / 90) + 'px)';
    g.drawImage(img, 0, 0);
    g.filter = 'none';
    var d = g.getImageData(0, 0, W, H), p = d.data, sum = 0, i;
    for (i = 0; i < p.length; i += 4) sum += Math.max(p[i], p[i + 1], p[i + 2]);
    var mean = sum / (p.length / 4) || 1;
    for (i = 0; i < p.length; i += 4) {
      var k = Math.max(p[i], p[i + 1], p[i + 2]) / mean;
      if (plain) k = 1 + (k - 1) * plain;
      p[i] = rgb[0] * k; p[i + 1] = rgb[1] * k; p[i + 2] = rgb[2] * k;
    }
    g.putImageData(d, 0, 0);
    var t = new T.CanvasTexture(cv), o = m.material.map;
    t.flipY = o.flipY; t.colorSpace = T.SRGBColorSpace; t.wrapS = o.wrapS; t.wrapT = o.wrapT; t.channel = o.channel;
    m.material = m.material.clone();
    m.material.map = t;
    m.material.roughness = Math.max(m.material.roughness, 0.85);
    m.material.metalness = 0;
    dyed[key] = m.material;
  }
  // A CNG driver's uniform: a plain blue shirt worn out over grey-blue
  // trousers, and dark sandals.
  var SHIRTS = [[52, 84, 158], [44, 76, 150], [62, 96, 168], [56, 88, 150]], TROUSERS = [[82, 88, 120], [70, 74, 98], [96, 100, 122]];
  var untucked = {};
  function uniform(rd, n){
    rd.traverse(function(m){
      if (!m.isMesh || !m.material.map) return;
      var name = m.material.name || '';
      if (/outfit_top/i.test(name)) {
        if (m.isSkinnedMesh) m.geometry = untucked[m.geometry.uuid] || (untucked[m.geometry.uuid] = untuck(m.geometry.clone()));
        recolor(m, SHIRTS[n % SHIRTS.length], 0.55);
      } else if (/outfit_bottom/i.test(name)) recolor(m, TROUSERS[n % TROUSERS.length], 0.5);
      else if (/outfit_shoes/i.test(name)) recolor(m, [52, 40, 32], 0.6);
    });
  }
  // A shirt's last 12 cm above the hem (in the model's standing pose, metres,
  // y up) let down 11 cm and flared out, to hang over the belt.
  function untuck(g){
    var p = g.attributes.position, hem = Infinity, cz = 0, n = 0, i;
    for (i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 0.3) hem = Math.min(hem, p.getY(i));
    for (i = 0; i < p.count; i++) if (p.getY(i) < hem + 0.12 && Math.abs(p.getX(i)) < 0.3) { cz += p.getZ(i); n++; }
    cz /= n || 1;
    for (i = 0; i < p.count; i++) {
      var y = p.getY(i);
      if (y > hem + 0.12 || Math.abs(p.getX(i)) > 0.3) continue;
      var t = 1 - (y - hem) / 0.12, k = 1 + 0.12 * t;
      p.setXYZ(i, p.getX(i) * k, y - 0.11 * t, cz + (p.getZ(i) - cz) * k);
    }
    p.needsUpdate = true;
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
  // Darkens a figure's skin by `tone` (an RGB multiplier), where the model
  // keeps its skin apart, for Bangladeshi skin.
  var toned = {};
  function skinTone(rd, tone){
    rd.traverse(function(m){
      if (!m.isMesh || !/AvatarBody|AvatarHead|Std_Skin|_Skin_|^Skin|Body_Skin/i.test(m.material.name || '')) return;
      var key = m.material.uuid + '|' + tone;
      if (!toned[key]) { toned[key] = m.material.clone(); toned[key].color.multiply(new T.Color(tone[0], tone[1], tone[2])); }
      m.material = toned[key];
    });
  }

  // ---------- Standing and walking ----------
  // Stands a figure up with its arms hanging at its sides.
  function stand(rd){
    var b = bones(rd);
    rd.updateMatrixWorld(true);
    var up = V(0, 1, 0).transformDirection(rd.matrixWorld), fwd = V(0, 0, 1).transformDirection(rd.matrixWorld), side = V().crossVectors(up, fwd);
    ['l', 'r'].forEach(function(s){
      var sx = s === 'l' ? 1 : -1, sh = b['upperarm_' + s], el = b['lowerarm_' + s], wr = b['hand_' + s];
      if (!sh || !el || !wr) return;
      var l1 = wpos(sh).distanceTo(wpos(el)), l2 = wpos(el).distanceTo(wpos(wr));
      aim(sh, el, wpos(sh).add(up.clone().multiplyScalar(-l1 * 0.97)).add(side.clone().multiplyScalar(sx * l1 * 0.2)).add(fwd.clone().multiplyScalar(-l1 * 0.05)));
      aim(el, wr, wpos(el).add(up.clone().multiplyScalar(-l2 * 0.9)).add(fwd.clone().multiplyScalar(l2 * 0.35)).add(side.clone().multiplyScalar(sx * l2 * 0.05)));
    });
  }
  // The old man's walk (the one figure scanned walking), taken in place and
  // put onto another figure's skeleton by its bones' names, which the
  // figures share give or take a numbered ending. One clip per figure.
  var walks = {};
  function walkSource(gltf){
    var clip = gltf.animations[0].clone(), mesh = null;
    clip.tracks.forEach(function(t){
      if (!/(Hips|hip|CC_Base_Hip).*\.position$/i.test(t.name)) return;
      for (var k = 0; k < t.values.length; k += 3) { t.values[k] = t.values[0]; t.values[k + 2] = t.values[2]; }
    });
    gltf.scene.traverse(function(m){ if (m.isSkinnedMesh && !mesh) mesh = m; });
    return { clip: clip, mesh: mesh };
  }
  function walk(rd, name, src, phase){
    var mesh = null;
    rd.traverse(function(m){ if (m.isSkinnedMesh && !mesh) mesh = m; });
    if (!mesh) return null;
    var clip = walks[name];
    if (!clip && name === 'p_old') clip = walks[name] = src.clip;
    if (!clip) {
      var base = function(n){ return n.replace(/^mixamorig:?/, '').replace(/_\d+$/, ''); }, by = {}, names = {};
      src.mesh.skeleton.bones.forEach(function(b){ by[base(b.name)] = b.name; });
      mesh.skeleton.bones.forEach(function(b){ if (by[base(b.name)]) names[b.name] = by[base(b.name)]; });
      clip = walks[name] = SU.retargetClip(mesh, src.mesh, src.clip, { names: names, hip: by.Hips, hipInfluence: V(), useFirstFramePosition: true, preserveBonePositions: true });
    }
    var mixer = new T.AnimationMixer(name === 'p_old' ? rd.children[0] : mesh);
    mixer.clipAction(clip).play();
    mixer.setTime(phase * clip.duration);
    mixer.length = clip.duration;
    return mixer;
  }

  // ---------- Fighting ----------
  // The bones a move turns, as they sit on the bike, to go back to.
  var LIMBS = ['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'upperleg_l', 'lowerleg_l', 'foot_l', 'upperleg_r', 'lowerleg_r', 'foot_r', 'spine_02', 'spine_03', 'head'];
  function rest(b){
    var r = {};
    LIMBS.forEach(function(k){ if (b[k]) r[k] = b[k].quaternion.clone(); });
    return r;
  }
  function relax(b, r){
    for (var k in r) b[k].quaternion.copy(r[k]);
  }
  // A move part way through: `bike` the rider's bike (its matrices up to
  // date), `b` the rider's bones, `move` 'punch', 'kick' or a weapon, `side`
  // which way (-1 the rider's left, 1 right), `u` how far through (0 to 1)
  // and `at` when in it the blow lands; `goal`, if there's someone to hit,
  // where they are (world): the blow goes at them, as far as an arm or a
  // leg reaches. A wind-up first (the fist drawn back, the leg lifted, the
  // shoulders turned away), then the blow, hard, and back.
  function strike(bike, b, move, side, u, at, goal){
    var s = side < 0 ? 'l' : 'r', sx = -side;   // the rider's left is the bike's +x
    var wind = at * 0.45, back = u < wind ? Math.sin(u / wind * Math.PI / 2) : u < at ? Math.cos((u - wind) / (at - wind) * Math.PI / 2) : 0;
    var out = u < wind ? 0 : u < at ? Math.sin((u - wind) / (at - wind) * Math.PI / 2) : Math.cos((u - at) / (1 - at) * Math.PI / 2);
    var L = function(x, y, z){ return bike.localToWorld(V(x, y, z)); };
    var twist = V(0, 1, 0).transformDirection(bike.matrixWorld);
    if (b.spine_03) turnAbout(b.spine_03, twist, sx * (0.45 * out - 0.3 * back));
    var g = goal ? bike.worldToLocal(goal.clone()) : null;
    // Towards the goal from `from`, no further than `len`.
    var toward = function(from, fallback, len){
      if (!g) return fallback;
      var d = g.clone().sub(from);
      if (d.x * sx < 0.2) d.x = sx * 0.2;   // always out to its side
      return from.clone().add(d.setLength(Math.min(len, d.length())));
    };
    if (move === 'kick') {
      var hip = bike.worldToLocal(wpos(b['upperleg_' + s])), foot = bike.worldToLocal(wpos(b['foot_' + s]));
      var lift = V(foot.x + sx * 0.15, foot.y + 0.25, foot.z - 0.15);
      var hit = toward(hip, V(sx * 0.95, hip.y - 0.25, hip.z + 0.1), 0.95);
      var to = foot.clone().lerp(lift, back).lerp(hit, out);
      ik(b['upperleg_' + s], b['lowerleg_' + s], b['foot_' + s], bike.localToWorld(to), L(sx * 0.5, hip.y + 0.3, hip.z + 1));
      return;
    }
    var sh = bike.worldToLocal(wpos(b['upperarm_' + s])), hand = bike.worldToLocal(wpos(b['hand_' + s]));
    // A fist goes out at the head; a weapon comes down from high over the shoulder.
    var drawn = move === 'punch' ? V(sh.x + sx * 0.05, sh.y - 0.1, sh.z - 0.25) : V(sh.x + sx * 0.15, sh.y + 0.5, sh.z - 0.15);
    var aimAt = toward(sh, V(sh.x + sx * 0.62, sh.y - 0.02, sh.z + 0.2), move === 'punch' ? 0.66 : 0.6);
    var target = hand.clone().lerp(drawn, back).lerp(aimAt, out);
    ik(b['upperarm_' + s], b['lowerarm_' + s], b['hand_' + s], bike.localToWorld(target), L(sh.x + sx * 0.3, sh.y - 0.6, sh.z - 0.4));
  }
  // A rider reeling from a blow: bent away from it (`side`, as in strike(),
  // the way they're knocked), the head snapping back, `k` (0 to 1) how hard.
  function recoil(bike, b, side, k){
    var fwd = V(0, 0, 1).transformDirection(bike.matrixWorld), across = V(1, 0, 0).transformDirection(bike.matrixWorld);
    if (b.spine_03) turnAbout(b.spine_03, fwd, side * 0.35 * k);
    if (b.head) { turnAbout(b.head, fwd, side * 0.5 * k); turnAbout(b.head, across, -0.35 * k); }
  }
  function turnAbout(bone, axis, angle){
    bone.updateWorldMatrix(true, false);
    var q = Q().setFromAxisAngle(axis, angle), wq = bone.getWorldQuaternion(Q()), pq = bone.parent.getWorldQuaternion(Q());
    bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
  }

  window.bdnixStreetRider = {
    init: init, canonical: canonical, bones: bones, aim: aim, ik: ik, pose: pose, dress: dress, helmet: helmet,
    paintHelmet: paintHelmet, hold: hold, recolor: recolor, uniform: uniform, skinTone: skinTone, stand: stand,
    walkSource: walkSource, walk: walk, rest: rest, relax: relax, strike: strike, recoil: recoil
  };
})();
