// Street detail for the Dhaka look: tiled footpaths with real kerb stones, Bangladeshi number
// plates, and a local bus livery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let seed = 23;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const tl = new THREE.TextureLoader();
let pending = 0;
export const loading = () => pending;
function tex(url, rep, srgb) {
  pending++;
  const t = tl.load(url, () => pending--, undefined, () => pending--);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Dust, stains and broken tiles over a footpath: a canvas laid over the whole length, 1 px = 5 cm.
function grime(widthM, lenM) {
  const W = Math.round(widthM * 20), H = Math.round(lenM * 20);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  // Dust collecting along the kerb (x = 0) and the shop fronts (x = W).
  let gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, 'rgba(120,100,70,0.55)'); gr.addColorStop(0.12, 'rgba(120,100,70,0)'); gr.addColorStop(0.88, 'rgba(90,80,65,0)'); gr.addColorStop(1, 'rgba(90,80,65,0.45)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // Stains: tea, oil, water.
  for (let i = 0; i < lenM * 0.8; i++) {
    const x = rnd() * W, y = rnd() * H, r = 4 + rnd() * 30;
    const s = g.createRadialGradient(x, y, 0, x, y, r);
    const c0 = pick(['60,50,40', '40,38,36', '90,75,55']);
    s.addColorStop(0, `rgba(${c0},${0.2 + rnd() * 0.35})`); s.addColorStop(1, `rgba(${c0},0)`);
    g.fillStyle = s; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + rnd()), rnd() * 3, 0, 7); g.fill();
  }
  // Broken or missing tiles (40 cm = 8 px), showing dark soil and rubble.
  for (let i = 0; i < lenM * 0.15; i++) {
    const tx = Math.floor(rnd() * widthM / 0.4) * 8, ty = Math.floor(rnd() * lenM / 0.4) * 8;
    g.fillStyle = `rgba(${pick(['70,58,45', '55,50,44'])},0.85)`; g.fillRect(tx, ty, 8 * (1 + Math.floor(rnd() * 2)), 8 * (1 + Math.floor(rnd() * 2)));
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}

// A footpath on one side: s = -1 left, +1 right; inner edge at x = s * edge; from z0 for len.
// A 4 m square of 40 cm concrete tiles cut from the photo: each tile its own patch of the photo
// and its own tone, with mortar joints, chipped corners and the odd cracked or sunken tile.
// Returns the colour map and a matching normal map (joints as grooves).
let PHOTO = null;
async function photo() {
  if (PHOTO) return PHOTO;
  pending++;
  PHOTO = await new Promise(r => { const i = new Image(); i.onload = () => { pending--; r(i); }; i.onerror = () => { pending--; r(null); }; i.src = '/ph/concrete_pavement_diff.jpg'; });
  return PHOTO;
}
function tileMaps(img) {
  const N = 10, T = 96, S = N * T;
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const h = document.createElement('canvas'); h.width = h.height = S; const hg = h.getContext('2d');   // height
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  g.fillStyle = '#6d665d'; g.fillRect(0, 0, S, S);                                                     // mortar
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * T + 3, y = j * T + 3, w = T - 6;
    g.save(); g.beginPath(); g.rect(x, y, w, w); g.clip();
    g.drawImage(img, rnd() * (img.width - 220), rnd() * (img.height - 220), 220, 220, x, y, w, w);
    const tone = rnd(); g.fillStyle = tone < 0.5 ? `rgba(0,0,0,${0.03 + rnd() * 0.12})` : `rgba(255,245,225,${0.03 + rnd() * 0.1})`; g.fillRect(x, y, w, w);
    if (rnd() < 0.12) { g.strokeStyle = 'rgba(40,35,30,0.7)'; g.lineWidth = 1.5; g.beginPath(); let px = x + rnd() * w, py = y; g.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 30; py += w / 6; g.lineTo(px, py); } g.stroke(); }
    g.restore();
    const lift = rnd() < 0.08 ? 90 : 128 + (rnd() - 0.5) * 20;   // most tiles level, a few sunk
    hg.fillStyle = `rgb(${lift},${lift},${lift})`; hg.fillRect(x, y, w, w);
    // Chipped corners.
    for (let k = 0; k < 4; k++) if (rnd() < 0.25) { const cx = x + (k % 2) * w, cy = y + Math.floor(k / 2) * w, r = 4 + rnd() * 10; g.fillStyle = '#5e574f'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); hg.fillStyle = '#404040'; hg.beginPath(); hg.arc(cx, cy, r, 0, 7); hg.fill(); }
  }
  // Normal map from the height map.
  const hd = hg.getImageData(0, 0, S, S).data, n = document.createElement('canvas'); n.width = n.height = S;
  const ng = n.getContext('2d'), nd = ng.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const H = (xx, yy) => hd[(((yy + S) % S) * S + ((xx + S) % S)) * 4] / 255;
    const dx = (H(x + 1, y) - H(x - 1, y)) * 4, dy = (H(x, y + 1) - H(x, y - 1)) * 4;
    const l = Math.hypot(dx, dy, 1), o = (y * S + x) * 4;
    nd.data[o] = (-dx / l * 0.5 + 0.5) * 255; nd.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[o + 3] = 255;
  }
  ng.putImageData(nd, 0, 0);
  const map = new THREE.CanvasTexture(c), nrm = new THREE.CanvasTexture(n);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, nrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; }
  return { map, normalMap: nrm };
}
let TILES = null;
export async function footpath(scene, s, edge, width, z0, len) {
  const h = 0.2;
  if (!TILES) TILES = tileMaps(await photo());
  const tiles = { map: TILES.map.clone(), normalMap: TILES.normalMap.clone(), roughnessMap: tex('/ph/concrete_tiles_rough.jpg', [width / 2, len / 2]) };
  tiles.map.repeat.set((width - 0.3) / 4, len / 4); tiles.normalMap.repeat.set((width - 0.3) / 4, len / 4); tiles.map.needsUpdate = tiles.normalMap.needsUpdate = true;
  // The tiles photo's colour, multiplied by the grime layer through a second UV set would need a
  // custom shader; a second plane just above blends it instead.
  const top = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.3, len, 1, 1), new THREE.MeshStandardMaterial({ ...tiles, color: 0xe8e0d0 }));
  top.material.normalScale.set(1.2, 1.2);
  top.rotation.x = -Math.PI / 2; top.position.set(s * (edge + 0.3 + (width - 0.3) / 2), h, z0 + len / 2); top.receiveShadow = true; scene.add(top);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.3, len), new THREE.MeshStandardMaterial({ map: grime(width - 0.3, len), transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  dirt.rotation.x = -Math.PI / 2; dirt.rotation.z = s > 0 ? Math.PI : 0; dirt.position.copy(top.position); dirt.position.y += 0.002; scene.add(dirt);
  // The body under the tiles, hidden by the kerbs.
  const body = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, h - 0.01, len), new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 1 }));
  body.position.set(top.position.x, (h - 0.01) / 2, top.position.z); scene.add(body);
  // Kerb stones: 1 m blocks, chamfered on top, each set a little differently, painted alternately
  // yellow and black and worn through to concrete.
  const geo = kerbGeometry();
  const mats = [new THREE.MeshStandardMaterial({ color: 0xd9a722, roughness: 0.75 }), new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95 })];
  const worn = tex('/ph/concrete_tiles_rough.jpg', [1, 1]);
  mats.forEach(m => { m.roughnessMap = worn; });
  const n = Math.floor(len);
  const meshes = mats.map(m => new THREE.InstancedMesh(geo, m, n));
  const counts = [0, 0, 0], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const k = rnd() < 0.08 ? 2 : i % 2;
    Q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.01, (s > 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.015, (rnd() - 0.5) * 0.02));
    P.set(s * (edge + 0.15) + (rnd() - 0.5) * 0.015, (rnd() - 0.5) * 0.012, z0 + i + 0.5);
    M.compose(P, Q, S1); meshes[k].setMatrixAt(counts[k]++, M);
  }
  meshes.forEach((m, i) => { m.count = counts[i]; m.castShadow = m.receiveShadow = true; scene.add(m); });
  // The gutter: a strip of darker, dusty asphalt along the kerb.
  const gut = new THREE.Mesh(new THREE.PlaneGeometry(0.6, len), new THREE.MeshStandardMaterial({ color: 0x6f675c, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  gut.rotation.x = -Math.PI / 2; gut.position.set(s * (edge - 0.3), 0.026, z0 + len / 2); scene.add(gut);
}
function kerbGeometry() {
  // 0.3 wide, 0.25 tall (5 cm below the road), 0.99 long, a 3 cm chamfer on the road side.
  const sh = new THREE.Shape();
  sh.moveTo(-0.15, -0.05); sh.lineTo(0.15, -0.05); sh.lineTo(0.15, 0.2); sh.lineTo(-0.12, 0.2); sh.lineTo(-0.15, 0.17); sh.lineTo(-0.15, -0.05);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.99, bevelEnabled: false });
  g.translate(0, 0, -0.495);
  g.computeVertexNormals();
  return g;
}

// Bangladeshi number plates: white, black Bangla lettering in two lines, "ঢাকা মেট্রো-গ" over "১২-৩৪৫৬".
const DIG = '০১২৩৪৫৬৭৮৯';
const bn = n => String(n).split('').map(d => DIG[+d]).join('');
function plateTexture(cls, aspect) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * aspect);
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 512, 256); bg.addColorStop(0, '#dcdcd6'); bg.addColorStop(1, '#c9c9c2');
  g.fillStyle = bg; g.fillRect(0, 0, 512, c.height);
  g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(12, 12, 488, c.height - 24);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const num = bn(11 + Math.floor(rnd() * 89)) + '-' + bn(1000 + Math.floor(rnd() * 9000));
  // Two lines, sized to the plate's height; squeezed sideways only if they don't fit.
  const Hc = c.height, lines = [['ঢাকা মেট্রো-' + cls, 0.36, 0.31], [num, 0.47, 0.71]];
  for (const [txt, size, yy] of lines) {
    g.font = `${Math.round(Hc * size)}px Kalpurush`;
    const sx = Math.min(1, 440 / g.measureText(txt).width);
    for (const [dy, col] of [[Math.max(1, Hc * 0.012), 'rgba(255,255,255,0.6)'], [-Math.max(1, Hc * 0.008), 'rgba(0,0,0,0.35)'], [0, '#1a1a1a']]) {
      g.save(); g.translate(256, Hc * yy + dy); g.scale(sx, 1); g.fillStyle = col; g.fillText(txt, 0, 0); g.restore();
    }
  }
  // Grit and smears.
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(80,70,55,${rnd() * 0.25})`; g.fillRect(rnd() * 512, rnd() * c.height, 1 + rnd() * 3, 1 + rnd() * 3); }
  // Road dust.
  const d = g.createLinearGradient(0, 0, 0, 256); d.addColorStop(0, 'rgba(110,95,70,0.08)'); d.addColorStop(1, 'rgba(110,95,70,0.3)');
  g.fillStyle = d; g.fillRect(0, 0, 512, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
// Put plates on a vehicle (its front +z, standing on y = 0, in its parent's units after scaling).
// spots: [{ y, z, w, ry }] in metres; cls is the plate's class letter (গ car, ব bus, ট truck, থ CNG).
export function plates(v, cls, spots) {
  v.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const sp of spots) {
    // Find the body's surface at that height by casting a ray in from the end of the vehicle.
    if (sp.z === undefined) {
      const box = new THREE.Box3().setFromObject(v, true), dir = sp.end > 0 ? -1 : 1;
      const from = new THREE.Vector3(v.position.x + (sp.x || 0), sp.y + v.position.y, (sp.end > 0 ? box.max.z : box.min.z) - dir * 0.5);
      ray.set(from, new THREE.Vector3(0, 0, dir));
      const hit = ray.intersectObject(v, true).find(h => h.object.visible);
      sp.z = (hit ? hit.point.z : (sp.end > 0 ? box.max.z : box.min.z)) - v.position.z - dir * 0.012;
      sp.ry = sp.end > 0 ? 0 : Math.PI;
    }
    const w = sp.w || 0.4, h = sp.h || w * 0.5;
    const grp = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: plateTexture(cls, h / w), roughness: 0.35, metalness: 0.15 }));
    grp.position.set(sp.x || 0, sp.y, sp.z); grp.rotation.y = sp.ry || 0; grp.receiveShadow = true;
    v.add(grp);
  }
}

// A Dhaka local bus livery, painted straight onto the body by projecting from the side:
// two colours split by stripes, the operator's name in Bangla, the route, dents and grime.
const LIVERIES = [
  { lower: '#1f7a3a', upper: '#f1ece0', stripe: '#d32f2f', name: 'সবুজ বাংলা পরিবহন', route: 'গাবতলী - মতিঝিল' },
  { lower: '#b71c1c', upper: '#f4e9d4', stripe: '#1b1b1b', name: 'লাল সবুজ পরিবহন', route: 'মিরপুর - যাত্রাবাড়ী' },
  { lower: '#1d4f9c', upper: '#eeeeee', stripe: '#f2c200', name: 'নীলাচল পরিবহন', route: 'উত্তরা - সদরঘাট' },
];
function liveryTexture(L, lenM, hM) {
  const W = 2048, H = Math.round(W * hM / lenM);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), s = W / lenM, y = m => H - m * s;
  g.fillStyle = L.upper; g.fillRect(0, 0, W, H);
  g.fillStyle = L.lower; g.fillRect(0, y(1.05), W, H);
  g.fillStyle = L.stripe; g.fillRect(0, y(1.25), W, 0.12 * s); g.fillRect(0, y(1.08), W, 0.05 * s);
  // A swoosh along the side, as most private buses have.
  g.fillStyle = L.stripe; g.beginPath(); g.moveTo(W * 0.15, y(1.25)); g.bezierCurveTo(W * 0.45, y(1.9), W * 0.7, y(1.0), W * 0.98, y(1.6)); g.lineTo(W * 0.98, y(1.5)); g.bezierCurveTo(W * 0.7, y(0.9), W * 0.45, y(1.75), W * 0.15, y(1.13)); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.round(0.42 * s)}px Kalpurush`;
  g.fillText(L.name, W * 0.5, y(0.62));
  g.fillStyle = L.lower; g.font = `${Math.round(0.26 * s)}px Kalpurush`; g.fillText(L.route, W * 0.5, y(2.05));
  // Scrapes, dents and rust, as on every city bus.
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W, yy = y(0.3 + rnd() * 1.4), w = (0.2 + rnd() * 1.2) * s;
    g.strokeStyle = `rgba(${pick(['230,230,225', '60,50,40', '120,70,40'])},${0.25 + rnd() * 0.4})`; g.lineWidth = 1 + rnd() * 3;
    g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy + (rnd() - 0.5) * 8); g.stroke();
  }
  for (let i = 0; i < 25; i++) { const x = rnd() * W, yy = y(rnd() * 1.1), r = (0.05 + rnd() * 0.25) * s; const gr = g.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, 'rgba(110,60,30,0.55)'); gr.addColorStop(1, 'rgba(110,60,30,0)'); g.fillStyle = gr; g.fillRect(x - r, yy - r, 2 * r, 2 * r); }
  // Grime: dark at the bottom, streaks down from the roof.
  let gr = g.createLinearGradient(0, y(0.9), 0, H); gr.addColorStop(0, 'rgba(50,42,32,0)'); gr.addColorStop(1, 'rgba(50,42,32,0.6)'); g.fillStyle = gr; g.fillRect(0, y(0.9), W, H);
  for (let i = 0; i < 120; i++) { const x = rnd() * W, len = (0.2 + rnd() * 1.0) * s; gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(40,36,30,0.35)'); gr.addColorStop(1, 'rgba(40,36,30,0)'); g.fillStyle = gr; g.fillRect(x, y(3.1), 2 + rnd() * 5, len); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
// Paint the meshes whose material name matches `body` on a vehicle (front +z), projecting from the side.
export function livery(v, body, i) {
  const L = LIVERIES[i % LIVERIES.length];
  v.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(v, true);
  const inv = v.matrixWorld.clone().invert(), lenM = box.max.z - box.min.z, hM = box.max.y - box.min.y;
  const map = liveryTexture(L, lenM, hM);
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.1 });
  v.traverse(m => {
    if (!m.isMesh || !body.test(m.material.name || '')) return;
    const g = m.geometry = m.geometry.clone(), p = g.attributes.position, uv = new Float32Array(p.count * 2), w = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      w.fromBufferAttribute(p, k).applyMatrix4(m.matrixWorld);
      // Seen from the left (+x) the bus's front is to the right; from the right it's mirrored back.
      const u = w.x - (box.min.x + box.max.x) / 2 > 0 ? (box.max.z - w.z) / lenM : (w.z - box.min.z) / lenM;
      uv[k * 2] = u; uv[k * 2 + 1] = (w.y - box.min.y) / hM;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    m.material = mat;
  });
  return L;
}

// Paint plates onto a vehicle's own plate parts (meshes whose name matches `re`), keeping the
// model's shape and recess; the plate is projected flat from behind or in front.
export function platesOnModel(v, cls, re) {
  v.updateMatrixWorld(true);
  v.traverse(m => {
    if (!m.isMesh || !re.test(m.name)) return;
    const box = new THREE.Box3().setFromObject(m, true), sz = box.getSize(new THREE.Vector3());
    const g = m.geometry = m.geometry.clone(), p = g.attributes.position, uv = new Float32Array(p.count * 2), w = new THREE.Vector3();
    const back = box.getCenter(new THREE.Vector3()).z < v.position.z;
    for (let k = 0; k < p.count; k++) {
      w.fromBufferAttribute(p, k).applyMatrix4(m.matrixWorld);
      const u = (w.x - box.min.x) / sz.x;
      uv[k * 2] = back ? 1 - u : u; uv[k * 2 + 1] = (w.y - box.min.y) / sz.y;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    m.material = new THREE.MeshStandardMaterial({ map: plateTexture(cls, sz.y / sz.x), roughness: 0.35, metalness: 0.15 });
  });
}
