import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const loader = new GLTFLoader();
const cache = {};
// Bikes: front to +z, length in metres, junk to drop, where the rider sits.
export const BIKES = {
  nr750: { len: 2.03, hide: /floor/i, ry: 0, fit: { seat: [0, 0.86, -0.36], grip: [0.27, 0.84, 0.42], peg: [0.17, 0.36, -0.30], lean: 0.95 } },
  gsxr:  { len: 2.03, hide: null, ry: 0, fit: { seat: [0, 0.90, -0.36], grip: [0.27, 0.88, 0.40], peg: [0.17, 0.38, -0.30], lean: 0.95 } },
  z1000: { len: 2.05, hide: null, ry: 180, fit: { seat: [0, 0.88, -0.30], grip: [0.36, 1.00, 0.32], peg: [0.17, 0.36, -0.22], lean: 0.55 } },
};
Object.assign(BIKES, {
  k1_vino:   { len: 1.80, hide: null, ry: 0, fit: { seat: [0, 0.86, -0.22], grip: [0.32, 1.04, 0.36], bar: [[0.195, 1.04, 0.294], [0.306, 1.034, 0.254]], peg: [0.15, 0.28, 0.16], lean: 0.2 } },
  k2_125:    { len: 2.00, hide: /ground/i, ry: 0, fit: { seat: [0, 0.90, -0.28], grip: [0.34, 1.06, 0.30], bar: [[0.198, 1.062, 0.244], [0.28, 1.05, 0.182]], peg: [0.17, 0.33, -0.10], lean: 0.3 } },
  k3_pulsar: { len: 1.98, hide: null, ry: 180, fit: { seat: [0, 0.88, -0.22], grip: [0.33, 1.05, 0.40], bar: [[0.29, 1.012, 0.36], [0.398, 1.01, 0.30]], peg: [0.17, 0.36, -0.08], lean: 0.5 } },
  k4_zx6r:   { len: 2.03, hide: null, ry: 0, fit: { seat: [0, 0.88, -0.36], grip: [0.30, 0.86, 0.42], bar: [[0.215, 0.898, 0.435], [0.315, 0.862, 0.34]], peg: [0.17, 0.40, -0.25], lean: 1.25 } },
  k5_h2:     { len: 2.07, hide: null, ry: 90, fit: { seat: [0, 0.84, -0.28], grip: [0.32, 0.88, 0.45], bar: [[0.248, 0.866, 0.398], [0.37, 0.80, 0.342]], peg: [0.17, 0.38, -0.20], lean: 1.2 } },
});
export const RIDERS = { nathan: 1.83, manuel: 1.84, eric: 1.84, justman: 1.84, carla: 1.64, claudia: 1.65, sophia: 1.63, walkwoman_mr: 1.66, c_teenboy: 1.80, c_blackm: 1.84, c_greg: 1.82, c_polom: 1.82, c_leatherw: 1.66, c_teenblack: 1.64, c_teew: 1.65, c_hoodiew: 1.64, d_striped: 1.68, d_pattern: 1.70 };
// The six characters: a scanned body, a suit (main, trim) and a helmet colour.
export const CHARACTERS = [
  { id: 'c_teenboy', sex: 'm', paint: false, helmet: 0x1a1a1c },
  { id: 'c_blackm', sex: 'm', paint: false, helmet: 0x9c1418 },
  { id: 'c_polom', sex: 'm', paint: false, top: [28, 52, 96], helmet: 0xd9a514 },
  { id: 'c_leatherw', sex: 'f', paint: false, helmet: 0xe8e8ea },
  { id: 'c_teenblack', sex: 'f', paint: false, helmet: 0x18a0a8 },
  { id: 'c_teew', sex: 'f', paint: false, helmet: 0xe0601a },
];
export async function hairModel() { return glb('ponytail'); }
export async function glb(name) {
  if (!cache[name]) cache[name] = loader.loadAsync('/models/' + name + '.glb');
  return cache[name];
}
function place(o, hide, len, ry, byHeight, byWidth) {
  const g = new THREE.Group();
  if (hide) { const kill = []; o.traverse(n => { if (n.isMesh && (hide.test(n.name) || hide.test(n.material?.name || ''))) kill.push(n); }); kill.forEach(n => n.removeFromParent()); }
  o.rotation.y = (ry || 0) * Math.PI / 180;
  g.add(o); g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o, !byHeight); const sz = box.getSize(new THREE.Vector3());
  const s = byHeight ? len / sz.y : byWidth ? len / Math.max(sz.x, sz.z) : len / sz.z; o.scale.multiplyScalar(s);
  g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o, !byHeight);
  o.position.x -= (b.min.x + b.max.x) / 2; o.position.z -= (b.min.z + b.max.z) / 2; o.position.y -= b.min.y;
  o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; } });
  return g;
}
export async function bike(name) {
  const c = BIKES[name]; const g = await glb(name);
  const o = place(g.scene.clone(true), c.hide, c.len, c.ry, false); o.userData.fit = c.fit; return o;
}
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
// Smooth shading: vertices at the same spot (split at UV seams) share one averaged normal,
// so seams in the clothes don't show as hard lines.
function smoothNormals(root) {
  root.traverse(m => {
    if (!m.isSkinnedMesh) return;
    const g = m.geometry = m.geometry.clone(), p = g.attributes.position, n = g.attributes.normal;
    if (!n) return;
    const key = i => Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    const sum = new Map();
    for (let i = 0; i < p.count; i++) { const k = key(i), v = sum.get(k) || [0, 0, 0]; v[0] += n.getX(i); v[1] += n.getY(i); v[2] += n.getZ(i); sum.set(k, v); }
    for (let i = 0; i < p.count; i++) { const v = sum.get(key(i)), l = Math.hypot(v[0], v[1], v[2]) || 1; n.setXYZ(i, v[0] / l, v[1] / l, v[2] / l); }
    n.needsUpdate = true;
  });
}
export async function rider(name) {
  const g = await glb(name);
  const o = place(skClone(g.scene), null, RIDERS[name], 0, true);
  smoothNormals(o);
  return o;
}
export async function thing(name, len, opts = {}) {
  const g = await glb(name);
  return place(g.scene.clone(true), opts.hide, len, opts.ry, opts.byHeight, opts.byWidth);
}
