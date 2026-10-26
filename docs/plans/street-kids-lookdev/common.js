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
export const RIDERS = { nathan: 1.78, manuel: 1.80, eric: 1.80, justman: 1.80, carla: 1.70, claudia: 1.72, sophia: 1.68 };
// The six characters: a scanned body, a suit (main, trim) and a helmet colour.
export const CHARACTERS = [
  { id: 'nathan', sex: 'm', main: [165, 20, 24], trim: [24, 24, 27], accent: [235, 235, 235], helmet: 0x9c1418 },
  { id: 'manuel', sex: 'm', main: [22, 58, 150], trim: [210, 210, 212], accent: [220, 30, 36], helmet: 0x173a96 },
  { id: 'eric', sex: 'm', main: [24, 104, 58], trim: [24, 24, 27], accent: [230, 200, 30], helmet: 0x1a1a1c },
  { id: 'carla', sex: 'f', main: [222, 168, 24], trim: [24, 24, 27], accent: [235, 235, 235], helmet: 0xd9a514 },
  { id: 'claudia', sex: 'f', main: [228, 228, 230], trim: [160, 20, 32], accent: [26, 26, 30], helmet: 0xe8e8ea },
  { id: 'sophia', sex: 'f', main: [228, 98, 22], trim: [44, 44, 50], accent: [235, 235, 235], helmet: 0xe0601a },
];
export async function glb(name) {
  if (!cache[name]) cache[name] = loader.loadAsync('/models/' + name + '.glb');
  return cache[name];
}
function place(o, hide, len, ry, byHeight, byWidth) {
  const g = new THREE.Group();
  if (hide) { const kill = []; o.traverse(n => { if (n.isMesh && (hide.test(n.name) || hide.test(n.material?.name || ''))) kill.push(n); }); kill.forEach(n => n.removeFromParent()); }
  o.rotation.y = (ry || 0) * Math.PI / 180;
  g.add(o); g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o); const sz = box.getSize(new THREE.Vector3());
  const s = byHeight ? len / sz.y : byWidth ? len / Math.max(sz.x, sz.z) : len / sz.z; o.scale.multiplyScalar(s);
  g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o);
  o.position.x -= (b.min.x + b.max.x) / 2; o.position.z -= (b.min.z + b.max.z) / 2; o.position.y -= b.min.y;
  o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; } });
  return g;
}
export async function bike(name) {
  const c = BIKES[name]; const g = await glb(name);
  const o = place(g.scene.clone(true), c.hide, c.len, c.ry, false); o.userData.fit = c.fit; return o;
}
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
export async function rider(name) {
  const g = await glb(name);
  return place(skClone(g.scene), null, RIDERS[name], 0, true);
}
export async function thing(name, len, opts = {}) {
  const g = await glb(name);
  return place(g.scene.clone(true), opts.hide, len, opts.ry, opts.byHeight, opts.byWidth);
}
