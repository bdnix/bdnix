// Dhaka landmarks for the look test: neighbourhood mosques behind their compound walls, and
// flyovers and elevated expressways on concrete piers. Dhaka is flat: a road only rises on a flyover.
import * as THREE from 'three';
import { thing } from './common.js';

let seed = 41;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const tl = new THREE.TextureLoader();
let pending = 0;
export const loading = () => pending;
function tex(url, srgb) {
  pending++;
  const t = tl.load(url, () => pending--, undefined, () => pending--);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function pbr(name, color) {
  return new THREE.MeshStandardMaterial({ map: tex(`/ph/${name}_diff.jpg`, true), normalMap: tex(`/ph/${name}_nor_gl.jpg`), roughnessMap: tex(`/ph/${name}_rough.jpg`), color: color || 0xffffff });
}

// UVs in metres from world position, picked by each triangle's facing, so one tiling texture
// wraps any shape (a model without UVs, or a swept section).
function boxUV(geo, scale) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// --- Mosques ---------------------------------------------------------------------------------
let MOSQUES = null;
export async function prepare() {
  const big = await thing('q_masjid', 16, { byHeight: true });
  const old = await thing('q_lalbagh', 1, { hide: /^(Plane00[12]|Plane009|Arc001)/ });
  // The Lalbagh model has no textures: lime plaster wrapped round it in world metres.
  const plaster = pbr('white_plaster_02'); plaster.color.setRGB(2.0, 1.95, 1.82);
  old.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(old, true); old.scale.multiplyScalar(13 / (b.max.y - b.min.y));
  old.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(old, true); old.children[0].position.y -= b2.min.y / old.scale.y;
  old.traverse(m => {
    if (!m.isMesh) return;
    if (/Metal/.test(m.material.name)) { m.material = new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.9, roughness: 0.3 }); return; }
    m.updateMatrixWorld(true);
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    m.geometry = boxUV(g, 2.5).applyMatrix4(m.matrixWorld.clone().invert());
    m.material = plaster;
  });
  MOSQUES = [big, old];
}

// A mosque compound on one side of the road: front wall with a gate on the footpath's back
// edge (x = 0 in the group, facing +z towards the road), the mosque set back behind a courtyard.
export function mosque(kind, width) {
  const g = new THREE.Group();
  const wallMat = pbr('white_plaster_02'); wallMat.color.setRGB(1.95, 1.9, 1.75);
  const green = new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.5, metalness: 0.3 });
  const H = 2.4, gate = 4;
  for (const [x0, x1] of [[0, width / 2 - gate / 2], [width / 2 + gate / 2, width]]) {
    const geo = boxUV(new THREE.BoxGeometry(x1 - x0, H, 0.3).translate((x0 + x1) / 2, H / 2, -0.15), 2.5);
    const w = new THREE.Mesh(geo, wallMat); w.castShadow = w.receiveShadow = true; g.add(w);
    // A green band of railings on top, as most compound walls have.
    for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.18) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5), green); r.position.set(x, H + 0.4, -0.15); g.add(r); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.05), green); rail.position.set((x0 + x1) / 2, H + 0.8, -0.15); g.add(rail);
  }
  // The gate: two plastered pillars with small domes, an arch, green steel gates folded open.
  for (const x of [width / 2 - gate / 2 - 0.4, width / 2 + gate / 2 + 0.4]) {
    const p = new THREE.Mesh(boxUV(new THREE.BoxGeometry(0.8, 4.2, 0.8).translate(x, 2.1, -0.15), 2.5), wallMat); p.castShadow = true; g.add(p);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), wallMat); d.position.set(x, 4.2, -0.15); g.add(d);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(gate / 2 + 0.2, 0.25, 8, 24, Math.PI), wallMat); arch.position.set(width / 2, 4.0, -0.15); g.add(arch);
  for (const s of [-1, 1]) { const gt = new THREE.Mesh(new THREE.PlaneGeometry(gate / 2, 2.2), green); gt.position.set(width / 2 + s * (gate / 2 + 0.05), 1.1, -1.1); gt.rotation.y = s * Math.PI / 2; g.add(gt); }
  // The courtyard and the mosque.
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(width, 16), pbr('concrete_tiles')); yard.material.map.repeat.set(width / 3, 16 / 3); yard.rotation.x = -Math.PI / 2; yard.position.set(width / 2, 0.03, -8.3); yard.receiveShadow = true; g.add(yard);
  const m = MOSQUES[kind].clone();
  m.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m, true), sz = bb.getSize(new THREE.Vector3());
  const fit = Math.min(1, (width - 4) / sz.x); m.scale.multiplyScalar(fit);
  m.position.set(width / 2, 0, -4 - sz.z * fit / 2);
  m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  g.add(m);
  return g;
}

// --- Flyovers and expressways ------------------------------------------------------------------
// A deck along z, centred on x, with height h(z). Built from a section swept along its length:
// asphalt on top, a concrete box girder under it, jersey barriers on both edges, hammerhead
// piers every `span` metres, LED lamps on the barriers.
export function flyover(scene, o) {
  const { x = 0, width = 9, z0, z1, rise = 70, height = 7.5, span = 32, night = 0 } = o;
  const h = z => { if (z < z0 || z > z1) return 0; const t = Math.min(1, (z - z0) / rise, (z1 - z) / rise); const s = Math.max(0, t); return height * s * s * (3 - 2 * s); };
  const concrete = pbr('concrete_wall_006'), deckMat = pbr('asphalt_02'), barrier = pbr('concrete_wall_006'); concrete.color.setRGB(1.5, 1.48, 1.42); barrier.color.setRGB(1.6, 1.58, 1.52);
  deckMat.map.repeat.set(width / 5, 1); deckMat.normalMap.repeat.set(width / 5, 1); deckMat.roughnessMap.repeat.set(width / 5, 1);
  const step = 1, zs = []; for (let z = z0; z <= z1 + 1e-6; z += step) zs.push(z);
  // Sweep a section (array of [dx, dy] relative to the deck's centre line at the road surface).
  function sweep(sec, mat, uvScale, closed) {
    const pos = [], uv = [], idx = [];
    const along = [0]; for (let i = 1; i < zs.length; i++) along.push(along[i - 1] + Math.hypot(zs[i] - zs[i - 1], h(zs[i]) - h(zs[i - 1])));
    const across = [0]; for (let j = 1; j < sec.length; j++) across.push(across[j - 1] + Math.hypot(sec[j][0] - sec[j - 1][0], sec[j][1] - sec[j - 1][1]));
    for (let i = 0; i < zs.length; i++) for (let j = 0; j < sec.length; j++) { pos.push(x + sec[j][0], h(zs[i]) + sec[j][1], zs[i]); uv.push(across[j] / uvScale, along[i] / uvScale); }
    const n = sec.length;
    for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m;
  }
  const w2 = width / 2;
  // Deck top (left edge to right edge, so its face points up).
  const top = sweep([[w2 - 0.45, 0.06], [-w2 + 0.45, 0.06]], deckMat, 5);
  top.material.side = THREE.DoubleSide;
  // Girder: from the right edge round underneath to the left edge.
  sweep([[w2, 0.06], [w2, -0.35], [w2 - 0.7, -0.55], [w2 - 1.6, -1.9], [-w2 + 1.6, -1.9], [-w2 + 0.7, -0.55], [-w2, -0.35], [-w2, 0.06]].reverse(), concrete, 2.5);
  // Jersey barriers.
  for (const s of [-1, 1]) {
    const e = s * w2, sec = [[e - s * 0.45, 0.06], [e - s * 0.38, 0.14], [e - s * 0.22, 0.4], [e - s * 0.1, 1.1], [e, 1.1], [e, 0.06]];
    sweep(s > 0 ? sec : sec.slice().reverse(), barrier, 2);
  }
  // Lane markings on the deck: dashed centre line, solid edge lines.
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e6dc, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  for (let z = z0 + 2; z < z1 - 2; z += 9) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 3), paint); const y0 = h(z), y1 = h(z + 3); t.rotation.x = -Math.PI / 2 + Math.atan2(y1 - y0, 3) * 0; t.position.set(x, (y0 + y1) / 2 + 0.07, z + 1.5); t.rotation.x = -Math.PI / 2; t.rotateX(-Math.atan2(y1 - y0, 3)); scene.add(t); }
  for (const s of [-1, 1]) sweep([[s * (w2 - 0.55) + 0.06, 0.068], [s * (w2 - 0.55) - 0.06, 0.068]], paint, 1);
  // Piers where the deck is high enough to stand on one.
  const pierMat = pbr('concrete_wall_006'); pierMat.color.setRGB(1.5, 1.48, 1.42);
  for (let z = z0 + rise * 0.55; z < z1 - rise * 0.5; z += span) {
    const y = h(z) - 1.9; if (y < 1.5) continue;
    const col = new THREE.Mesh(boxUV(new THREE.BoxGeometry(1.5, y - 1.1, 1.2).translate(x, (y - 1.1) / 2, z), 2.5), pierMat);
    const cap = new THREE.Mesh(boxUV(new THREE.BoxGeometry(width - 2.6, 1.2, 1.6).translate(x, y - 0.6, z), 2.5), pierMat);
    for (const m of [col, cap]) { m.castShadow = m.receiveShadow = true; scene.add(m); }
  }
  // LED lamps on the barriers, every 30 m, alternating sides.
  const lampsOut = [], grey = new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: 0.7, roughness: 0.4 });
  for (let z = z0 + rise; z < z1 - rise; z += 30) for (const s of [-1, 1]) {
    const y = h(z), px = x + s * (w2 - 0.1);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 8, 8), grey); pole.position.set(px, y + 1.1 + 4, z); scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), grey); arm.position.set(px - s * 0.8, y + 9, z); scene.add(arm);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.25), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xf2f6ff, emissiveIntensity: night ? 12 : 0 })); lens.position.set(px - s * 1.5, y + 8.95, z); scene.add(lens);
    lampsOut.push(new THREE.Vector3(px - s * 1.5, y + 8.9, z));
  }
  return { h, lamps: lampsOut };
}
