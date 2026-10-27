// The rider's own view: working mirrors, a lit dashboard where the model has none, and the camera framing.
import * as THREE from 'three';

const V = () => new THREE.Vector3();

// The triangles of `root`'s meshes, in `root`'s space: [{ a, b, c, n }].
function triangles(root) {
  const inv = root.matrixWorld.clone().invert(), out = [];
  root.traverse(m => {
    if (!m.isMesh || m.isSkinnedMesh || !m.visible) return;
    const g = m.geometry, p = g.attributes.position, idx = g.index;
    const mx = inv.clone().multiply(m.matrixWorld);
    const n = idx ? idx.count : p.count;
    const at = i => V().fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(mx);
    for (let i = 0; i < n; i += 3) {
      const a = at(i), b = at(i + 1), c = at(i + 2);
      const nn = V().crossVectors(b.clone().sub(a), c.clone().sub(a));
      if (nn.lengthSq() < 1e-14) continue;
      out.push({ a, b, c, n: nn.normalize(), mesh: m });
    }
  });
  return out;
}

const key = v => Math.round(v.x * 2000) + ',' + Math.round(v.y * 2000) + ',' + Math.round(v.z * 2000);

// The flat face around `seed` (bike space): grown from the triangle nearest it across
// triangles that share a corner and face the same way, no further than `reach`.
export function face(tris, seed, reach = 0.16, flat = 0.9) {
  let best = null, bd = Infinity;
  const tmp = new THREE.Triangle(), cp = V();
  for (const t of tris) {
    tmp.set(t.a, t.b, t.c); tmp.closestPointToPoint(seed, cp);
    const d = cp.distanceTo(seed);
    if (d < bd) { bd = d; best = t; }
  }
  if (!best || bd > 0.03) return null;
  const by = new Map();
  for (const t of tris) for (const v of [t.a, t.b, t.c]) { const k = key(v); (by.get(k) || by.set(k, []).get(k)).push(t); }
  const n0 = best.n, got = new Set([best]), todo = [best];
  while (todo.length) {
    const t = todo.pop();
    for (const v of [t.a, t.b, t.c]) for (const u of by.get(key(v))) {
      if (got.has(u) || u.n.dot(n0) < flat) continue;
      if (u.a.distanceTo(seed) > reach || u.b.distanceTo(seed) > reach || u.c.distanceTo(seed) > reach) continue;
      got.add(u); todo.push(u);
    }
  }
  return { tris: [...got], n: n0.clone() };
}

// A mesh over a face, lifted off it a little towards `toward`, with flat UVs spanning it:
// s runs along `right`, t along the face's up. uv(s, t) maps them to texture coordinates.
function skin(f, toward, right, uv) {
  const n = f.n.clone(); if (n.dot(toward) < 0) n.negate();
  const r = right.clone().sub(n.clone().multiplyScalar(right.dot(n))).normalize();
  const up = V().crossVectors(n, r).normalize();
  const pts = []; for (const t of f.tris) pts.push(t.a, t.b, t.c);
  let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
  for (const p of pts) { const s = p.dot(r), t = p.dot(up); s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
  const pos = [], uvs = [];
  for (const t of f.tris) {
    // Keep each triangle wound to face `n`.
    const flip = t.n.dot(n) < 0, vs = flip ? [t.a, t.c, t.b] : [t.a, t.b, t.c];
    for (const p of vs) {
      const q = p.clone().add(n.clone().multiplyScalar(0.002));
      pos.push(q.x, q.y, q.z);
      const [u, v] = uv((p.dot(r) - s0) / (s1 - s0), (p.dot(up) - t0) / (t1 - t0));
      uvs.push(u, v);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const c = V(); for (const p of pts) c.add(p); c.divideScalar(pts.length);
  return { geometry: g, centre: c, normal: n, width: s1 - s0, height: t1 - t0 };
}

// Working mirrors: each mirror's glass shows what's behind on its side, from a camera at the glass.
// seeds: a point on each mirror's glass, bike space, the rider's left (+x) first.
export function mirrors(bk, scene, seeds, size = [512, 160]) {
  bk.updateMatrixWorld(true);
  const tris = triangles(bk);
  const rt = new THREE.WebGLRenderTarget(size[0], size[1], { type: THREE.HalfFloatType });
  const mat = new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xd8dce0 });
  const back = new THREE.Vector3(0, 0, -1), right = new THREE.Vector3(-1, 0, 0);
  const views = [];
  seeds.forEach((seed, i) => {
    const f = face(tris, new THREE.Vector3(...seed));
    if (!f) return;
    // Each mirror shows itself flipped left to right, from its half of the target.
    const half = i === 0 ? 0 : 0.5;
    const sk = skin(f, back, right, (s, t) => [half + 0.5 * (1 - s), t]);
    const glass = new THREE.Mesh(sk.geometry, mat); glass.name = 'mirrorGlass'; glass.layers.set(1);
    bk.add(glass);
    const cam = new THREE.PerspectiveCamera(22, sk.width / sk.height, 0.9, 400);
    views.push({ cam, centre: sk.centre, normal: sk.normal, side: seed[0] > 0 ? 1 : -1, x: i === 0 ? 0 : size[0] / 2 });
  });
  const vp = new THREE.Vector4(), on = V();
  return {
    glass: mat,
    // Draw the mirrors' views: call before rendering the frame.
    update(renderer) {
      bk.updateMatrixWorld(true);
      const was = renderer.getRenderTarget(); renderer.getViewport(vp);
      for (const v of views) {
        const c = bk.localToWorld(v.centre.clone()), n = v.normal.clone().transformDirection(bk.matrixWorld);
        v.cam.position.copy(c).add(n.clone().multiplyScalar(-0.04));
        // Behind, a little outward and down, as a rider sets a mirror.
        on.set(v.side * 0.12, -0.06, -1).transformDirection(bk.matrixWorld).add(v.cam.position);
        v.cam.up.set(0, 1, 0); v.cam.lookAt(on); v.cam.updateMatrixWorld(true);
        // The target's viewport only takes when it's set as the target.
        rt.viewport.set(v.x, 0, size[0] / 2, size[1]); rt.scissor.copy(rt.viewport); rt.scissorTest = true;
        renderer.setRenderTarget(rt);
        renderer.render(scene, v.cam);
      }
      renderer.setRenderTarget(was); renderer.setViewport(vp);
    }
  };
}

// A lit dashboard drawn on a model's own (untextured) dash: `seeds` are points on its faces,
// in bike space; draw(ctx, w, h, boxes) paints it, boxes being each face's place on the canvas.
export function dashboard(bk, seeds, draw, px = 512) {
  bk.updateMatrixWorld(true);
  const tris = triangles(bk), toward = new THREE.Vector3(0, 0.6, -1).normalize(), right = new THREE.Vector3(-1, 0, 0);
  const faces = seeds.map(s => face(tris, new THREE.Vector3(...s), 0.12, 0.6)).filter(Boolean);
  if (!faces.length) return null;
  // One canvas for the whole dash, laid out by where the faces are.
  const all = { tris: faces.flatMap(f => f.tris), n: faces[0].n };
  const probe = skin(all, toward, right, (s, t) => [s, t]);
  const uv = probe.geometry.attributes.uv, aspect = probe.width / probe.height;
  const canvas = document.createElement('canvas'); canvas.width = px; canvas.height = Math.round(px / aspect);
  const boxes = []; let k = 0;
  for (const f of faces) {
    const b = { x0: 1, x1: 0, y0: 1, y1: 0 };
    for (let i = 0; i < f.tris.length * 3; i++, k++) { const u = uv.getX(k), v = uv.getY(k); b.x0 = Math.min(b.x0, u); b.x1 = Math.max(b.x1, u); b.y0 = Math.min(b.y0, v); b.y1 = Math.max(b.y1, v); }
    boxes.push({ x: b.x0 * canvas.width, y: (1 - b.y1) * canvas.height, w: (b.x1 - b.x0) * canvas.width, h: (b.y1 - b.y0) * canvas.height });
  }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0 });
  const mesh = new THREE.Mesh(probe.geometry, mat); mesh.name = 'dashScreen'; bk.add(mesh);
  const ctx = canvas.getContext('2d');
  return { set(state) { draw(ctx, canvas.width, canvas.height, boxes, state); tex.needsUpdate = true; } };
}

// A sports bike's dash: an analogue rev counter in the round face, speed and gear on the screen.
export function sportsDash(ctx, w, h, boxes, st) {
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h);
  const [dial, scr] = boxes.slice().sort((a, b) => a.x - b.x);
  if (dial) {
    const cx = dial.x + dial.w / 2, cy = dial.y + dial.h / 2, r = Math.min(dial.w, dial.h) / 2;
    ctx.fillStyle = '#0d1014'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, max = 14;
    const at = v => a0 + (a1 - a0) * v / max;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#d0242a'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, at(12), at(14)); ctx.stroke();
    for (let v = 0; v <= max; v += 0.5) {
      const a = at(v), big = v % 1 === 0, r0 = r * (big ? 0.74 : 0.8);
      ctx.strokeStyle = v >= 12 ? '#ff4038' : '#e8ecef'; ctx.lineWidth = r * (big ? 0.035 : 0.018);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); ctx.stroke();
      if (big && v % 2 === 0) { ctx.fillStyle = '#e8ecef'; ctx.font = '600 ' + Math.round(r * 0.17) + 'px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v, cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58); }
    }
    ctx.fillStyle = '#8a9096'; ctx.font = Math.round(r * 0.1) + 'px Inter, sans-serif'; ctx.fillText('×1000 r/min', cx, cy + r * 0.42);
    const a = at(st.rpm / 1000);
    ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r * 0.12, cy - Math.sin(a) * r * 0.12); ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); ctx.stroke();
    ctx.fillStyle = '#22262b'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.1, 0, 7); ctx.fill();
  }
  if (scr) {
    const g = ctx.createLinearGradient(0, scr.y, 0, scr.y + scr.h); g.addColorStop(0, '#0b1a24'); g.addColorStop(1, '#050b10');
    ctx.fillStyle = g; ctx.fillRect(scr.x, scr.y, scr.w, scr.h);
    ctx.fillStyle = '#e9f6ff'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 ' + Math.round(scr.h * 0.42) + 'px Inter, sans-serif';
    ctx.fillText(String(Math.round(st.speed)), scr.x + scr.w * 0.7, scr.y + scr.h * 0.55);
    ctx.font = '500 ' + Math.round(scr.h * 0.12) + 'px Inter, sans-serif'; ctx.fillStyle = '#9fb8c8';
    ctx.fillText('km/h', scr.x + scr.w * 0.7, scr.y + scr.h * 0.7);
    ctx.textAlign = 'center'; ctx.fillStyle = '#38e07b'; ctx.font = '700 ' + Math.round(scr.h * 0.3) + 'px Inter, sans-serif';
    ctx.fillText(String(st.gear), scr.x + scr.w * 0.86, scr.y + scr.h * 0.5);
    ctx.font = '500 ' + Math.round(scr.h * 0.1) + 'px Inter, sans-serif'; ctx.fillStyle = '#9fb8c8';
    ctx.fillText('GEAR', scr.x + scr.w * 0.86, scr.y + scr.h * 0.66);
    // Fuel and clock along the bottom.
    ctx.textAlign = 'left'; ctx.fillText(st.clock || '', scr.x + scr.w * 0.06, scr.y + scr.h * 0.9);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i < 4 ? '#e9f6ff' : '#2a3a46'; ctx.fillRect(scr.x + scr.w * (0.55 + i * 0.07), scr.y + scr.h * 0.83, scr.w * 0.05, scr.h * 0.08); }
  }
}

// Point the camera so the grips sit low in the frame and the road fills the rest, widening
// the view (up to maxFov) if the grips and the hands round them wouldn't fit across it.
export function frame(camera, grips, gripsAt = -0.62, maxFov = 110) {
  for (let i = 0; i < 3; i++) {
    aimAt(camera, grips, gripsAt);
    camera.updateMatrixWorld(true);
    const across = Math.max(...grips.map(g => { const c = camera.worldToLocal(g.clone()); return Math.abs(c.x) / -c.z; })) * 1.3 + 0.08;
    const need = THREE.MathUtils.radToDeg(2 * Math.atan(across / camera.aspect));
    if (need <= camera.fov + 0.5) return;
    camera.fov = Math.min(maxFov, need); camera.updateProjectionMatrix();
  }
}
function aimAt(camera, grips, gripsAt) {
  const mid = grips[0].clone().add(grips[1]).multiplyScalar(0.5);
  const d = mid.clone().sub(camera.position);
  const horiz = Math.hypot(d.x, d.z), below = Math.atan2(-d.y, horiz);
  const half = THREE.MathUtils.degToRad(camera.fov / 2);
  // Angle of a point at ndc y = gripsAt below the view's centre.
  const off = Math.atan(-gripsAt * Math.tan(half));
  const pitch = below - off;
  const dir = new THREE.Vector3(d.x / horiz, -Math.tan(pitch), d.z / horiz);
  camera.lookAt(camera.position.clone().add(dir));
}

// Take the head and neck off the player's own figure, so nothing of them sits round the lens:
// every triangle with a corner hanging mostly from the neck or anything above it goes.
export function behead(root, neck) {
  const above = new Set(); neck.traverse(b => { if (b.isBone) above.add(b); });
  root.traverse(m => {
    if (!m.isSkinnedMesh) return;
    const bones = m.skeleton.bones, idxs = m.geometry.attributes.skinIndex, wts = m.geometry.attributes.skinWeight;
    const hit = new Set(bones.map((b, i) => above.has(b) ? i : -1).filter(i => i >= 0));
    if (!hit.size) return;
    const g = m.geometry = m.geometry.clone();
    const n = g.attributes.position.count, top = new Uint8Array(n);
    for (let v = 0; v < n; v++) { let w = 0; for (let k = 0; k < 4; k++) if (hit.has(idxs.getComponent(v, k))) w += wts.getComponent(v, k); top[v] = w > 0.2 ? 1 : 0; }
    const src = g.index ? g.index.array : [...Array(n).keys()], keep = [];
    for (let i = 0; i < src.length; i += 3) if (!top[src[i]] && !top[src[i + 1]] && !top[src[i + 2]]) keep.push(src[i], src[i + 1], src[i + 2]);
    g.setIndex(keep);
  });
}
