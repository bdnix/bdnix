// Dress a scanned rider in riding gear: repaint the clothes as a leather suit with gloves and
// boots (keeping the photo's folds as shading) and tuck the head and hair inside the helmet.
import * as THREE from 'three';

function region(name) {
  const n = name.toLowerCase();
  if (/neck/.test(n)) return 'neck';
  if (/head|jaw|eye|mouth|brow|lid/.test(n)) return 'head';
  if (/hand|thumb|index|middle|ring|pinky/.test(n)) return 'hand';
  if (/lowerarm/.test(n)) return 'forearm';
  if (/upperarm|shoulder/.test(n)) return 'upperarm';
  if (/upperleg/.test(n)) return 'thigh';
  if (/lowerleg/.test(n)) return 'shin';
  if (/foot|ball|toe/.test(n)) return 'foot';
  return 'torso';
}

// suit: { main, trim } colours. main covers the torso, upper arms and thighs; trim the rest of the suit.
export function dress(root, suit) {
  root.traverse(m => {
    if (!m.isSkinnedMesh || !m.material.map) return;
    m.geometry = m.geometry.clone();
    const g = m.geometry, pos = g.attributes.position, uv = g.attributes.uv;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const bones = m.skeleton.bones;
    const vreg = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let best = 0, w = -1;
      for (let k = 0; k < 4; k++) { const x = sw.getComponent(i, k); if (x > w) { w = x; best = si.getComponent(i, k); } }
      vreg[i] = region(bones[best].name);
    }
    // Head and hair inside the helmet.
    const c = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < pos.count; i++) if (vreg[i] === 'head') { c.x += pos.getX(i); c.y += pos.getY(i); c.z += pos.getZ(i); n++; }
    if (n) {
      c.divideScalar(n);
      for (let i = 0; i < pos.count; i++) if (vreg[i] === 'head') pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * 0.55, c.y + (pos.getY(i) - c.y) * 0.55, c.z + (pos.getZ(i) - c.z) * 0.55);
      pos.needsUpdate = true;
    }
    // Repaint the texture.
    const img = m.material.map.image, W = img.width, H = img.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H), px = data.data;
    const REG = ['torso', 'upperarm', 'thigh', 'forearm', 'shin', 'hand', 'foot', 'neck', 'head'];
    // Body measures from the vertices (bind pose: y up, x across, z forward).
    let cx = 0, nt = 0, ymin = Infinity, ymax = -Infinity;
    const ext = {}; for (const r of REG) ext[r] = { ax0: Infinity, ax1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); if (vreg[i] === 'torso') { cx += pos.getX(i); nt++; } }
    cx /= nt || 1; const HT = ymax - ymin;
    for (let i = 0; i < pos.count; i++) { const e = ext[vreg[i]], ax = Math.abs(pos.getX(i) - cx), y = pos.getY(i), z = pos.getZ(i);
      e.ax0 = Math.min(e.ax0, ax); e.ax1 = Math.max(e.ax1, ax); e.y0 = Math.min(e.y0, y); e.y1 = Math.max(e.y1, y); e.z0 = Math.min(e.z0, z); e.z1 = Math.max(e.z1, z); }
    // Panels: 0 main, 1 trim, 2 accent, 3 black (armour, gloves, boots, collar).
    function panel(r, x, y, z) {
      const e = ext[r], ax = Math.abs(x - cx), h = (y - ymin) / HT;
      const zc = (e.z0 + e.z1) / 2, front = (z - zc) / ((e.z1 - e.z0) / 2 || 1);
      if (r === 'hand' || r === 'foot' || r === 'neck' || r === 'head') return 3;
      if (r === 'torso') {
        const side = (ax - e.ax0) / ((e.ax1 - e.ax0) || 1);
        if (h < 0.5) return 1;                               // seat and waist
        if (side > 0.72) return 1;                           // side panels
        if (Math.abs(h - 0.69) < 0.012 && front > 0) return 2; // chest stripe
        if (front < -0.35 && h > 0.72) return 1;             // back hump
        return 0;
      }
      if (r === 'upperarm') {
        if (h > (e.y1 - ymin) / HT - 0.015) return 2;        // stripe along the top of the arm
        return 0;
      }
      if (r === 'forearm') return Math.abs(front) < 0.18 ? 2 : 1;
      if (r === 'thigh' || r === 'shin') {
        const out = (ax - e.ax0) / ((e.ax1 - e.ax0) || 1);
        if (r === 'shin' && (e.y1 - y) / (e.y1 - e.y0) < 0.28 && front > 0.1) return 3; // knee armour
        if (out > 0.86) return 2;                            // outside stripe
        return r === 'thigh' ? 0 : 1;
      }
      return 0;
    }
    const rmap = new Int8Array(W * H).fill(-1), pmap = new Int8Array(W * H).fill(-1);
    const idx = g.index ? g.index.array : null, tri = idx ? idx.length / 3 : pos.count / 3;
    for (let t = 0; t < tri; t++) {
      const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, d = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const rs = [vreg[a], vreg[b], vreg[d]];
      const r = rs[0] === rs[1] || rs[0] === rs[2] ? rs[0] : rs[1] === rs[2] ? rs[1] : rs[0];
      const ri = REG.indexOf(r);
      const x0 = uv.getX(a) * W, y0 = uv.getY(a) * H, x1 = uv.getX(b) * W, y1 = uv.getY(b) * H, x2 = uv.getX(d) * W, y2 = uv.getY(d) * H;
      const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2)) - 1), maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)) + 1);
      const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2)) - 1), maxy = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)) + 1);
      const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(den) < 1e-9) continue;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px_ = x + 0.5, py = y + 0.5;
        const l0 = ((y1 - y2) * (px_ - x2) + (x2 - x1) * (py - y2)) / den;
        const l1 = ((y2 - y0) * (px_ - x2) + (x0 - x2) * (py - y2)) / den;
        const l2 = 1 - l0 - l1;
        if (l0 >= -0.02 && l1 >= -0.02 && l2 >= -0.02) {
          const q = y * W + x; rmap[q] = ri;
          pmap[q] = panel(r, l0 * pos.getX(a) + l1 * pos.getX(b) + l2 * pos.getX(d), l0 * pos.getY(a) + l1 * pos.getY(b) + l2 * pos.getY(d), l0 * pos.getZ(a) + l1 * pos.getZ(b) + l2 * pos.getZ(d));
        }
      }
    }
    const lum = i => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const sum = new Float64Array(REG.length), cnt = new Float64Array(REG.length);
    for (let p = 0; p < W * H; p++) if (rmap[p] >= 0) { sum[rmap[p]] += lum(p * 4); cnt[rmap[p]]++; }
    const COL = [suit.main, suit.trim, suit.accent || [235, 235, 235], [20, 20, 22]];
    const out = new Uint8ClampedArray(px);
    for (let p = 0; p < W * H; p++) {
      const r = rmap[p]; if (r < 0) continue;
      const i = p * 4, mean = sum[r] / cnt[r] || 128;
      const detail = Math.min(1.3, Math.max(0.6, Math.pow(lum(i) / mean, 0.55)));
      let cc = COL[pmap[p]];
      // Stitched seams where one panel meets another.
      const x = p % W, y = (p / W) | 0; let seam = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const qq = yy * W + xx; if (rmap[qq] === r && pmap[qq] !== pmap[p]) seam = true;
      }
      const k = detail * (seam ? 0.55 : 1);
      out[i] = cc[0] * k; out[i + 1] = cc[1] * k; out[i + 2] = cc[2] * k;
    }
    px.set(out);
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    m.material = m.material.clone();
    m.material.map = tex;
    m.material.roughness = 0.42; m.material.roughnessMap = null; m.material.metalness = 0;
    m.material.needsUpdate = true;
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
