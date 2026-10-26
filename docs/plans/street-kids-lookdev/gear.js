// Dress a scanned rider in riding gear: repaint the clothes as a leather suit with gloves and
// boots (keeping the photo's folds as shading) and tuck the head and hair inside the helmet.
import * as THREE from 'three';
import { canonical } from './rider.js';


// suit: { sex, main, trim, accent } colours. Panels are placed in each bone's own frame, so the
// pose the person was scanned in doesn't move them.
export function dress(root, suit) {
  root.traverse(m => {
    if (!m.isSkinnedMesh) return;
    // Face parts and hair go: the helmet hides the head.
    if (/hair|scalp|eyelash|eye|teeth|tongue|mouth/i.test(m.material.name || '')) { m.visible = false; return; }
    if (!m.material.map) return;
    m.geometry = m.geometry.clone();
    const g = m.geometry, pos = g.attributes.position, uv = g.attributes.uv;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const bones = m.skeleton.bones;
    // Where each named bone sits in bind space.
    const at = {};
    // Measure in the rest pose, in the mesh's own space, as three.js skins it (rigs differ in how they store the bind pose).
    root.updateMatrixWorld(true); m.skeleton.update();
    const toMesh = m.matrixWorld.clone().invert();
    bones.forEach(b => { const k = canonical(b.name); if (k && !at[k]) at[k] = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toMesh); });
    // Each bone's nearest named ancestor (itself included) says which part of the body it moves.
    const named = bones.map(b => { let n = b; while (n && !canonical(n.name)) n = n.parent; return n ? canonical(n.name) : 'hip'; });
    const V = () => new THREE.Vector3();
    const dir = (a, b) => at[b].clone().sub(at[a]).normalize();
    const perp = (v, axis) => v.clone().sub(axis.clone().multiplyScalar(v.dot(axis))).normalize();
    const torsoUp = dir('hip', 'neck');
    const toes = at.ball_l.clone().sub(at.foot_l);
    const frames = {};
    for (const [k, next, l, r] of [['hip', 'spine_01', 'upperleg_l', 'upperleg_r'], ['spine_01', 'spine_02', 'upperleg_l', 'upperleg_r'], ['spine_02', 'spine_03', 'upperarm_l', 'upperarm_r'], ['spine_03', 'neck', 'upperarm_l', 'upperarm_r']]) {
      const along = k === 'hip' ? torsoUp.clone() : dir(k, next);
      const lat = perp(at[l].clone().sub(at[r]), along);
      const front = V().crossVectors(along, lat); if (front.dot(toes) < 0) front.negate();
      frames[k] = { o: at[k], along, lat, front };
    }
    const torsoFront = frames.spine_02.front;
    const torsoLat = frames.hip.lat;
    for (const s of ['l', 'r']) {
      const sx = s === 'l' ? 1 : -1;
      for (const [k, next] of [['upperarm_', 'lowerarm_'], ['lowerarm_', 'hand_'], ['upperleg_', 'lowerleg_'], ['lowerleg_', 'foot_']]) {
        const along = dir(k + s, next + s), len = at[next + s].distanceTo(at[k + s]);
        const top = perp(torsoUp, along), out = perp(torsoLat.clone().multiplyScalar(sx), along), front = perp(torsoFront, along);
        frames[k + s] = { o: at[k + s], along, len, top, out, front };
      }
    }
    const torsoLen = at.neck.distanceTo(at.hip);
    // How much each vertex belongs to each part of the body (from its skin weights). Parts are
    // blended across triangles and the strongest wins per pixel, so part edges run smooth.
    const SLOTS = ['torso', 'shoulder', 'neck', 'head', 'hand', 'foot', 'upperarm_l', 'upperarm_r', 'forearm_l', 'forearm_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r'];
    const SLOT_PART = SLOTS.map(x => x.replace(/_[lr]$/, ''));
    const SLOT_FRAME = { upperarm_l: 'upperarm_l', upperarm_r: 'upperarm_r', forearm_l: 'lowerarm_l', forearm_r: 'lowerarm_r', thigh_l: 'upperleg_l', thigh_r: 'upperleg_r', shin_l: 'lowerleg_l', shin_r: 'lowerleg_r' };
    const PART = { hip: 'torso', spine_01: 'torso', spine_02: 'torso', spine_03: 'torso', neck: 'neck', head: 'head', head_end: 'head',
      shoulder: 'shoulder', upperarm: 'upperarm', lowerarm: 'forearm', hand: 'hand', upperleg: 'thigh', lowerleg: 'shin', foot: 'foot', ball: 'foot', foot_end: 'foot' };
    const slotOfBone = named.map(key => {
      const part = PART[key.replace(/_[lr]$/, '')] || 'torso', side = key.slice(-1);
      const sl = SLOTS.indexOf(part + '_' + side); return sl >= 0 ? sl : SLOTS.indexOf(part);
    });
    const NS = SLOTS.length, pw = new Float32Array(pos.count * NS), vpart = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w) pw[i * NS + slotOfBone[si.getComponent(i, k)]] += w; }
      for (let k = 0; k < NS; k++) if (pw[i * NS + k] > bw) { bw = pw[i * NS + k]; best = k; }
      vpart[i] = SLOT_PART[best];
    }
    // Bind-space positions (what the bones' frames are measured in).
    const bp = []; const tmp = V();
    for (let i = 0; i < pos.count; i++) bp.push(m.applyBoneTransform(i, tmp.fromBufferAttribute(pos, i)).clone());
    const torsoH = p => p.clone().sub(at.hip).dot(torsoUp) / torsoLen;
    // Torso measures per vertex (across, front-back), blended between the spine bones by skin weight so panel edges run smooth.
    const tu = new Float32Array(pos.count), tf = new Float32Array(pos.count), th = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let ws = 0, u = 0, f = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k), fr = frames[named[si.getComponent(i, k)]];
        if (!w || !fr || !fr.lat) continue;
        const d = bp[i].clone().sub(fr.o); u += w * d.dot(fr.lat); f += w * d.dot(fr.front); ws += w;
      }
      if (!ws) { const fr = frames.spine_02, d = bp[i].clone().sub(fr.o); u = d.dot(fr.lat); f = d.dot(fr.front); ws = 1; }
      tu[i] = Math.abs(u / ws); tf[i] = f / ws; th[i] = torsoH(bp[i]);
    }
    // The torso's half-width at each height, for side panels that follow the body's outline.
    const BINS = 60, wide = new Float32Array(BINS);
    const binOf = h => Math.min(BINS - 1, Math.max(0, Math.floor((h + 0.3) / 1.4 * BINS)));
    for (let i = 0; i < pos.count; i++) if (vpart[i] === 'torso' || vpart[i] === 'shoulder') { const k = binOf(th[i]); wide[k] = Math.max(wide[k], tu[i]); }
    for (let k = 1; k < BINS; k++) if (!wide[k]) wide[k] = wide[k - 1];
    // Smooth the outline so the panels' edges don't wobble.
    for (let pass = 0; pass < 3; pass++) { const c = wide.slice(); for (let k = 1; k < BINS - 1; k++) wide[k] = (c[k - 1] + 2 * c[k] + c[k + 1]) / 4; }
    const widthAt = h => { const x = (h + 0.3) / 1.4 * BINS - 0.5, k = Math.max(0, Math.min(BINS - 2, Math.floor(x))), t = Math.min(1, Math.max(0, x - k)); return wide[k] * (1 - t) + wide[k + 1] * t; };
    const female = suit.sex === 'f';
    // Panels: 0 main, 1 trim, 2 accent, 3 black (armour, gloves, boots, collar).
    function panel(part, fr, p, h, u, fz) {
      if (part === 'hand' || part === 'foot' || part === 'neck' || part === 'head') return 3;
      if (part === 'torso' || part === 'shoulder') {
        const edge = u / (widthAt(h) || 1);
        if (h < 0.12) return 1;                                   // seat
        if (female) return edge > 0.7 ? 1 : edge > 0.6 ? 2 : 0;   // contoured side panels, accent-edged
        if (edge > 0.78) return 1;                                // side panels
        if (h > 0.9) return 1;                                    // shoulder yoke
        if (Math.abs(h - 0.6) < 0.03 && fz > 0) return 2;         // chest stripe
        if (fz < 0 && h > 0.45 && edge < 0.16) return 1;          // spine stripe
        return 0;
      }
      const f = frames[fr], d = p.clone().sub(f.o);
      const t = d.dot(f.along) / f.len, r = perp(d, f.along);
      if (part === 'upperarm' || part === 'forearm') {
        if (r.dot(f.top) > 0.8) return 2;                         // stripe along the top of the arm
        return part === 'upperarm' ? 0 : 1;
      }
      if (part === 'shin' && t < 0.22 && r.dot(f.front) > 0.35) return 3; // knee armour
      if (r.dot(f.out) > 0.82) return 2;                          // stripe down the outside of the leg
      return part === 'thigh' ? 0 : 1;
    }
    // Head and hair inside the helmet.
    const c = V(); let nh = 0;
    for (let i = 0; i < pos.count; i++) if (vpart[i] === 'head') { c.x += pos.getX(i); c.y += pos.getY(i); c.z += pos.getZ(i); nh++; }
    if (nh) {
      c.divideScalar(nh);
      for (let i = 0; i < pos.count; i++) if (vpart[i] === 'head') pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * 0.55, c.y + (pos.getY(i) - c.y) * 0.55, c.z + (pos.getZ(i) - c.z) * 0.55);
      pos.needsUpdate = true;
    }
    if (suit.paint === false) return;   // keep their own clothes
    // Repaint the texture.
    const img = m.material.map.image, W = img.width, H = img.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H), px = data.data;
    const PARTS = ['torso', 'shoulder', 'upperarm', 'forearm', 'thigh', 'shin', 'hand', 'foot', 'neck', 'head'];
    const rmap = new Int8Array(W * H).fill(-1), pmap = new Int8Array(W * H).fill(-1);
    const idx = g.index ? g.index.array : null, tri = idx ? idx.length / 3 : pos.count / 3;
    const P = V();
    for (let t = 0; t < tri; t++) {
      const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, d = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const vs = [a, b, d];
      // Tiled UVs (a model laid out over several tiles) map back onto the one texture.
      const ou = Math.floor(Math.min(uv.getX(a), uv.getX(b), uv.getX(d)) + 1e-4), ov = Math.floor(Math.min(uv.getY(a), uv.getY(b), uv.getY(d)) + 1e-4);
      const x0 = (uv.getX(a) - ou) * W, y0 = (uv.getY(a) - ov) * H, x1 = (uv.getX(b) - ou) * W, y1 = (uv.getY(b) - ov) * H, x2 = (uv.getX(d) - ou) * W, y2 = (uv.getY(d) - ov) * H;
      const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(den) < 1e-9) continue;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px_ = x + 0.5, py = y + 0.5;
        const l0 = ((y1 - y2) * (px_ - x2) + (x2 - x1) * (py - y2)) / den;
        const l1 = ((y2 - y0) * (px_ - x2) + (x0 - x2) * (py - y2)) / den;
        const l2 = 1 - l0 - l1;
        if (l0 >= -0.01 && l1 >= -0.01 && l2 >= -0.01) {
          let sl = 0, bw = -1;
          for (let k = 0; k < NS; k++) { const w = l0 * pw[a * NS + k] + l1 * pw[b * NS + k] + l2 * pw[d * NS + k]; if (w > bw) { bw = w; sl = k; } }
          const part = SLOT_PART[sl], fr = SLOT_FRAME[SLOTS[sl]];
          const q = y * W + x; rmap[q] = PARTS.indexOf(part);
          P.set(0, 0, 0).addScaledVector(bp[vs[0]], l0).addScaledVector(bp[vs[1]], l1).addScaledVector(bp[vs[2]], l2);
          pmap[q] = panel(part, fr, P, l0 * th[a] + l1 * th[b] + l2 * th[d], l0 * tu[a] + l1 * tu[b] + l2 * tu[d], l0 * tf[a] + l1 * tf[b] + l2 * tf[d]);
        }
      }
    }
    const lum = i => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const sum = new Float64Array(PARTS.length), cnt = new Float64Array(PARTS.length);
    for (let q = 0; q < W * H; q++) if (rmap[q] >= 0) { sum[rmap[q]] += lum(q * 4); cnt[rmap[q]]++; }
    const COL = [suit.main, suit.trim, suit.accent || [235, 235, 235], [20, 20, 22]];
    const out = new Uint8ClampedArray(px), done = new Uint8Array(W * H);
    for (let q = 0; q < W * H; q++) {
      const r = rmap[q]; if (r < 0) continue;
      const i = q * 4, mean = sum[r] / cnt[r] || 128;
      const detail = Math.min(1.3, Math.max(0.6, Math.pow(lum(i) / mean, 0.55)));
      const cc = COL[pmap[q]];
      const x = q % W, y = (q / W) | 0; let seam = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const qq = yy * W + xx; if (rmap[qq] === r && pmap[qq] >= 0 && pmap[qq] !== pmap[q]) seam = true;
      }
      const k = detail * (seam ? 0.6 : 1);
      out[i] = cc[0] * k; out[i + 1] = cc[1] * k; out[i + 2] = cc[2] * k; done[q] = 1;
    }
    // Spread the paint past the edges of each piece of the texture, so the photo's colours don't bleed in at seams.
    for (let pass = 0; pass < 6; pass++) {
      const add = [];
      for (let q = 0; q < W * H; q++) {
        if (done[q]) continue;
        const x = q % W, y = (q / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const qq = yy * W + xx; if (done[qq] === 1) { add.push(q, qq); break; }
        }
      }
      for (let j = 0; j < add.length; j += 2) { const q = add[j], qq = add[j + 1]; out[q * 4] = out[qq * 4]; out[q * 4 + 1] = out[qq * 4 + 1]; out[q * 4 + 2] = out[qq * 4 + 2]; done[q] = 2; }
      for (let j = 0; j < add.length; j += 2) done[add[j]] = 1;
    }
    px.set(out);
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.wrapS = m.material.map.wrapS; tex.wrapT = m.material.map.wrapT;
    // Plain leather: keep only the colour and the folds (normal map) of the original material.
    const old = m.material;
    m.material = new THREE.MeshStandardMaterial({ name: old.name, map: tex, normalMap: old.normalMap || null, roughness: 0.42, metalness: 0, side: old.side });
    if (old.normalMap) m.material.normalScale.copy(old.normalScale);
  });
}

// Paint a helmet: shell in the rider's colour, visor dark and mirrored.
export function paintHelmet(h, color) {
  h.traverse(m => {
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    m.material = mats.map(mt => {
      const x = mt.clone();
      const glass = x.transparent || x.opacity < 1 || /glass|visor|vidrio|lens|clear/i.test(x.name);
      if (glass) {
        x.transparent = false; x.opacity = 1; x.color = new THREE.Color(0x0b0d10); x.map = null;
        x.metalness = 0.9; x.roughness = 0.08; x.transmission = 0;
      } else if (color && /^helmet$|base_plastic/i.test(x.name)) {
        x.color = new THREE.Color(color); x.map = null; x.metalness = 0.1; x.roughness = 0.25;
      }
      return x;
    });
    if (m.material.length === 1) m.material = m.material[0];
  });
}

// A ponytail out of the back of the helmet: the tail strands of a hair model, tinted.
export function ponytail(holder, gltf, tint) {
  const g = new THREE.Group();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(n => {
    if (!n.isMesh || !/Object_4$|Object_2$/.test(n.name)) return;
    const geo = n.geometry.clone().applyMatrix4(n.matrixWorld);
    // Keep only what's behind the hair tie (the tail), not the cap and fringe that the helmet covers.
    const p = geo.attributes.position, idx = geo.index.array, keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      let back = true;
      for (let k = 0; k < 3; k++) if (p.getZ(idx[t + k]) > -15.5) back = false;
      if (back || /Object_2$/.test(n.name)) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    geo.setIndex(keep);
    const mat = n.material.clone();
    if (/Object_4$/.test(n.name)) {
      mat.transparent = false; mat.alphaTest = 0.35; mat.side = THREE.DoubleSide; mat.depthWrite = true;
      mat.color = new THREE.Color(tint[0], tint[1], tint[2]); mat.roughness = 0.55;
    } else mat.color = new THREE.Color(0x111111);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m);
  });
  // Model units are centimetres with the tie at about (0, 164, -14.5); hang it off the helmet's back rim.
  g.scale.set(0.011, 0.022, 0.016);
  g.position.set(0, -164 * 0.022, 14.5 * 0.016);
  const pivot = new THREE.Group(); pivot.add(g);
  pivot.position.set(0, -0.05, -0.14);
  pivot.rotation.x = 0.5;   // hanging back over the shoulders, blown by the wind
  holder.add(pivot);
  return pivot;
}
