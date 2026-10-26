// Street Kids look test: a race frame on a city road, made of artists' models and photo textures.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { bike, rider, thing, CHARACTERS, hairModel } from './common.js';
import { dress, paintHelmet, ponytail } from './gear.js';
import { seat, helmet, hold } from './rider.js';
import * as dhaka from './dhaka.js';

const q = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(+(q.get('dpr') || devicePixelRatio));
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = +(q.get('exp') || 0.9);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(W > H ? 55 : 70, W / H, 0.1, 1500);

// Sky and light from a photographed street.
const hdr = await new RGBELoader().loadAsync('/ph/' + (q.get('sky') || 'kloofendal_48d_partly_cloudy_puresky_2k') + '.hdr');
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.background = hdr;
scene.environment = hdr;
const skyTurn = +(q.get('skyrot') || 0) * Math.PI / 180;
scene.backgroundRotation.set(0, skyTurn, 0);
scene.environmentRotation.set(0, skyTurn, 0);
scene.environmentIntensity = 0.9;
scene.fog = new THREE.Fog(0xc9c3b4, 60, 330);

const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
sun.position.set(-30, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 200;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// Textures.
let pending = 0;
const tl0 = new THREE.TextureLoader();
const tl = { load: u => { pending++; return tl0.load(u, () => pending--, undefined, () => pending--); } };
function pbr(name, rep, ext = 'jpg') {
  const t = {};
  for (const [k, f] of [['map', 'diff'], ['normalMap', 'nor_gl'], ['roughnessMap', 'rough']]) {
    const x = tl.load('/ph/' + name + '_' + f + '.' + ext);
    x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(rep[0], rep[1]); x.anisotropy = 8;
    if (k === 'map') x.colorSpace = THREE.SRGBColorSpace;
    t[k] = x;
  }
  return t;
}

const bands = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 16; const g = c.getContext('2d');
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#1b1b1b' : '#e3b51e'; g.fillRect(i * 64, 0, 64, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; })();
// The road: straight, 4 lanes of 3.5 m, kerbs and pavements.
const LEN = 900, ROAD = 14, WALK = 5;
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, LEN), new THREE.MeshStandardMaterial({ ...pbr('asphalt_02', [ROAD / 5, LEN / 5]), roughness: 1 }));
road.rotation.x = -Math.PI / 2; road.position.z = LEN / 2 - 60; road.receiveShadow = true; scene.add(road);
for (const s of [-1, 1]) {
  const walk = new THREE.Mesh(new THREE.BoxGeometry(WALK, 0.16, LEN), new THREE.MeshStandardMaterial({ ...pbr('concrete_pavement', [WALK / 2, LEN / 2]) }));
  walk.position.set(s * (ROAD / 2 + WALK / 2), 0.08, LEN / 2 - 60); walk.receiveShadow = true; scene.add(walk);
  const kt = bands.clone(); kt.repeat.set(LEN / 2, 1); kt.needsUpdate = true; const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, LEN), new THREE.MeshStandardMaterial({ map: kt, roughness: 0.85 }));
  kerb.position.set(s * (ROAD / 2 + 0.1), 0.09, LEN / 2 - 60); kerb.receiveShadow = true; scene.add(kerb);
}
// Lane markings: dashed lines between lanes, a double yellow line in the middle, solid edges.
const paint = new THREE.MeshStandardMaterial({ color: 0xe8e6dc, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
const yellow = new THREE.MeshStandardMaterial({ color: 0xd9a520, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
function stripe(x, z, len, w, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.005, z); m.receiveShadow = true; scene.add(m);
}
// One-way, four lanes: dashed white lines between them.
for (let z = -60; z < LEN - 60; z += 9) { stripe(-3.5, z, 3, 0.12, paint); stripe(0, z, 3, 0.12, paint); stripe(3.5, z, 3, 0.12, paint); }

stripe(-ROAD / 2 + 0.3, LEN / 2 - 60, LEN, 0.12, paint); stripe(ROAD / 2 - 0.3, LEN / 2 - 60, LEN, 0.12, paint);
// The world beyond the pavements.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, LEN), new THREE.MeshStandardMaterial({ ...pbr('concrete_pavement', [100, LEN / 4]), color: 0xbbbbbb }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.01, LEN / 2 - 60); ground.receiveShadow = true; scene.add(ground);
road.position.y = 0.02;

// Dhaka buildings along both sides, fronts on the pavement's back edge, and concrete poles with cables.
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const FRONT = ROAD / 2 + WALK;
await dhaka.prepare();
if (q.get('oldblocks') === null) for (const s of [-1, 1]) {
  for (let z = -40; z < 320;) {
    const w = 7 + rnd() * 7, b = dhaka.building(w);
    b.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    b.position.set(s * FRONT, 0, s < 0 ? z + w : z); scene.add(b);
    z += w + (rnd() < 0.25 ? 1 + rnd() * 2 : 0.05);
  }
  dhaka.poles(scene, s * (ROAD / 2 + 0.6), -30, 320, 32);
}

// Shade trees on the pavement: mango and rain trees, as on a Bangladeshi street.
const trees = [await thing('tr_mango', 7.5, { byHeight: true }), await thing('tr_rain', 10, { byHeight: true })];
let ti = 0;
for (const s of [-1, 1]) for (let z = -15 + (s > 0 ? 25 : 0); z < 320; z += 45 + rnd() * 25) {
  const t = trees[ti++ % trees.length].clone(); t.position.set(s * (ROAD / 2 + 2.6), 0.16, z); t.rotation.y = rnd() * 6; t.scale.setScalar(0.85 + rnd() * 0.3); scene.add(t);
}

// Soft contact shadow under a vehicle (sun shadows alone leave them floating).
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
function blob(o) {
  const box = new THREE.Box3().setFromObject(o); const sz = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * 1.25, sz.z * 1.15), blobMat); m.rotation.x = -Math.PI / 2; m.position.set(c.x, 0.03, c.z); scene.add(m);
}

// Traffic, going our way.
const traffic = [
  ['cng', 2.6, { ry: -90 }, 5.25, 17],
  ['corolla', 4.6, {}, -1.75, 27],
  ['b_hino', 10.5, { ry: 180, hide: /_blinn6_|_phongE3_|CarPlate/, mirror: true }, 1.75, 44],
  ['yaris', 3.7, { ry: 180 }, 5.25, 58],
  ['t_al', 8, {}, -5.25, 72],
  ['b_ecolin', 12, {}, 5.25, 150],
  ['t_bd', 8.5, {}, -1.75, 180],
  ['cng', 2.6, { ry: -90 }, -1.75, 95],
  ['corolla', 4.6, {}, 1.75, 125],
];
for (const [name, len, opts, x, z] of traffic) {
  const v = await thing(name, len, opts); if (opts.mirror) v.scale.x = -1; v.position.set(x, 0.02, z); scene.add(v); v.updateMatrixWorld(true); blob(v);
}

// The riders.
const LEAN = { nr750: 1.3, gsxr: 1.3, z1000: 0.85 };
async function racer(b, r, x, z, opts = {}) {
  const ch = CHARACTERS.find(c => c.id === r);
  const bk = await bike(b); const rd = await rider(r); bk.add(rd);
  if (ch) dress(rd, ch);
  const fit = Object.assign({}, bk.userData.fit, { lean: opts.lean ?? LEAN[b] ?? bk.userData.fit.lean });
  bk.position.set(x, 0.02, z); bk.rotation.z = opts.roll || 0; bk.rotation.y = opts.yaw || 0; scene.add(bk); bk.updateMatrixWorld(true);
  const bn = seat(rd, bk, fit, opts);
  const hm = await thing('fullface', 1); paintHelmet(hm, ch && ch.helmet); helmet(bn, hm, ch && ch.id === 'justman' ? 0.37 : ch && ch.sex === 'f' ? 0.29 : 0.31, ch && ch.id === 'justman' ? { up: new THREE.Vector3(0, 1, 0.15).applyQuaternion(bk.quaternion), lift: 0.06, push: 0 } : {}); if (ch && ch.hair) ponytail(bn._helmet, await hairModel(), ch.hair);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.4), blobMat); sh.rotation.x = -Math.PI / 2; sh.position.set(x, 0.03, z); scene.add(sh);
  return { bk, bn };
}
const shot = q.get('shot') || 'race';
const P = { x: +(q.get('px') || 0.4), z: 0 };
const headOf = r => r.bn.head.getWorldPosition(new THREE.Vector3());
let me;
if (shot === 'none') {
} else if (shot === 'career') {
  me = await racer('k1_vino', 'c_teenboy', P.x, P.z);
  await racer('k1_vino', 'c_teew', P.x - 1.7, P.z + 1.6, { roll: 0.02 });
  await racer('k2_125', 'c_polom', P.x + 3.2, P.z + 6, { roll: -0.03 });
  await racer('k2_125', 'c_leatherw', P.x - 2.8, P.z + 14);
  await racer('k1_vino', 'c_teenblack', P.x + 4.6, P.z + 16);
  await racer('k2_125', 'c_blackm', P.x + 1.5, P.z + 24);
} else if (shot === 'race') {
  me = await racer('k5_h2', 'c_teenboy', P.x, P.z);
  await racer('k4_zx6r', 'c_teew', P.x - 1.7, P.z + 1.6, { roll: 0.02 });
  await racer('z1000', 'c_polom', P.x + 3.2, P.z + 6, { roll: -0.03 });
  await racer('gsxr', 'c_leatherw', P.x - 2.8, P.z + 14);
  await racer('z1000', 'c_teenblack', P.x + 4.6, P.z + 16);
  await racer('nr750', 'c_blackm', P.x + 1.5, P.z + 24);
} else {
  // The rival on our right, close enough to hit.
  const foe = await racer('gsxr', 'c_blackm', P.x - 1.15, P.z + 0.55, { roll: 0.09, twist: 0.35 });
  const target = headOf(foe).add(new THREE.Vector3(0.12, -0.05, -0.05));
  if (shot === 'punch') {
    me = await racer('nr750', 'c_teenblack', P.x, P.z, { twist: -0.45, handsWorld: { r: target } });
  } else {
    // Swinging a stick down at him.
    const up = target.clone().add(new THREE.Vector3(0.35, 0.55, -0.25));
    me = await racer('nr750', 'nathan', P.x, P.z, { twist: -0.4, handsWorld: { r: up } });
    const dir = target.clone().sub(up).add(new THREE.Vector3(0, 0.25, 0));
    hold(me.bn, 'r', shot === 'nunchaku' ? await thing('nunchaku', 0.33, { byHeight: true }) : await thing('bat', 0.85, { byWidth: true }), dir, shot === 'nunchaku' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
  }
  await racer('z1000', 'c_teenboy', P.x + 3.2, P.z + 8, { roll: -0.03 });
}

// Chase camera behind and above.
const tall = H > W;
const cam = { back: +(q.get('back') || (tall ? 3.4 : 4.2)), up: +(q.get('up') || (tall ? 1.9 : 1.85)), look: 9 };
const cx = P.x - (shot === 'race' ? (tall ? 0.1 : 0.4) : 0.6);
camera.position.set(cx, cam.up, P.z - cam.back);
camera.lookAt(cx, 1.0, P.z + cam.look);
if (q.get('cam')) { const c = q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); if (c[6]) { camera.fov = c[6]; camera.updateProjectionMatrix(); } }
if (q.get('side')) { camera.position.set(P.x + 6, 1.5, P.z); camera.lookAt(P.x, 1, P.z); }
sun.target.position.set(P.x, 0, P.z + 15); sun.position.set(P.x - 30, 60, P.z - 10);

await new Promise(r => { const t = setInterval(() => { if (pending === 0 && dhaka.loading() === 0) { clearInterval(t); r(); } }, 100); });
renderer.render(scene, camera);
document.body.dataset.shot = shot; if (q.get('nohud')) document.querySelector('.hud').style.display = 'none';
document.title = 'ok';
