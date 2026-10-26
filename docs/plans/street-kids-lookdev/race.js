// Street Kids look test: a race frame on a city road, made of artists' models and photo textures.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { bike, rider, thing, CHARACTERS, hairModel } from './common.js';
import { dress, paintHelmet, ponytail } from './gear.js';
import { seat, helmet, hold } from './rider.js';
import * as dhaka from './dhaka.js';
import * as marks from './landmarks.js';
import * as bits from './streetbits.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const q = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
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

// Time of day sets the sky, the light, the haze, how much traffic there is and what's lit.
const TIMES = {
  night: { sky: 'qwantani_night_puresky_2k', env: 0.12, bg: 0.1, sun: [0x9fb4ff, 0.18], sunAt: [-20, 40, 30], fog: [0x0d1018, 25, 230], exp: 1.15, traffic: 0.12, people: 0.12, lit: 1 },
  dawn: { sky: 'kloofendal_misty_morning_puresky_2k', env: 0.75, bg: 1, sun: [0xffc08a, 1.5], sunAt: [-25, 9, 90], fog: [0xd6d3cb, 12, 170], exp: 0.95, traffic: 0.3, people: 0.45, lit: 0 },
  day: { sky: 'kloofendal_48d_partly_cloudy_puresky_2k', env: 0.9, bg: 1, sun: [0xfff1dc, 3.2], sunAt: [-30, 60, -10], fog: [0xcdc6b5, 40, 300], exp: 0.9, traffic: 0.55, people: 1, lit: 0 },
  rush: { sky: 'kloofendal_48d_partly_cloudy_puresky_2k', env: 0.85, bg: 1, sun: [0xffeccc, 2.8], sunAt: [-40, 35, 40], fog: [0xc9bea8, 22, 230], exp: 0.92, traffic: 1, people: 1.8, lit: 0 },
  dusk: { sky: 'qwantani_dusk_2_puresky_2k', env: 0.55, bg: 0.9, sun: [0xff9a5a, 1.6], sunAt: [-60, 9, 70], fog: [0x8f8189, 20, 240], exp: 1.0, traffic: 1, people: 1.8, lit: 0.7 },
};
const TIME = TIMES[q.get('time') || 'day'];
const hdr = await new RGBELoader().loadAsync('/ph/' + (q.get('sky') || TIME.sky) + '.hdr');
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.background = hdr;
scene.environment = hdr;
const skyTurn = +(q.get('skyrot') || 0) * Math.PI / 180;
scene.backgroundRotation.set(0, skyTurn, 0);
scene.environmentRotation.set(0, skyTurn, 0);
scene.environmentIntensity = TIME.env;
scene.backgroundIntensity = TIME.bg;
scene.fog = new THREE.Fog(TIME.fog[0], TIME.fog[1], TIME.fog[2]);
renderer.toneMappingExposure = +(q.get('exp') || TIME.exp);

const sun = new THREE.DirectionalLight(TIME.sun[0], TIME.sun[1]);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 260;
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
  await bits.footpath(scene, s, ROAD / 2, WALK, -60, LEN);
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

// The player's spot, the flyover (if any) and how high the deck is there.
const P = { x: +(q.get('px') || 0.4), z: +(q.get('pz') || 0), y: 0 };
const FLY = q.get('fly');   // 'flyover' (two lanes, 7.5 m up) or 'expressway' (four lanes, 14 m up)
let deck = null;
if (FLY) {
  deck = marks.flyover(scene, FLY === 'expressway' ? { x: 0, width: 15, z0: 30, z1: 700, rise: 140, height: 14, span: 36, night: TIME.lit } : { x: 0, width: 9, z0: 30, z1: 700, rise: 75, height: 7.5, span: 32, night: TIME.lit });
  if (q.get('ondeck')) P.y = deck.h(P.z);
}
const ZEND = Math.max(320, P.z + 330);

// Dhaka buildings along both sides, fronts on the pavement's back edge, and concrete poles with cables.
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const FRONT = ROAD / 2 + WALK;
await dhaka.prepare({ night: TIME.lit });
await marks.prepare();
const MOSQUE_AT = { '-1': [70, 330], '1': [205] };
if (q.get('oldblocks') === null) for (const s of [-1, 1]) {
  const mq = (MOSQUE_AT[s] || []).slice();
  for (let z = -40; z < ZEND;) {
    if (mq.length && z >= mq[0]) {
      mq.shift(); const w = 26, m = marks.mosque(s < 0 ? 0 : 1, w);
      m.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(s * FRONT, 0, s < 0 ? z + w : z); scene.add(m);
      z += w + 0.5; continue;
    }
    const w = 7 + rnd() * 7, b = dhaka.building(w);
    b.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    b.position.set(s * FRONT, 0, s < 0 ? z + w : z); scene.add(b);
    z += w + (rnd() < 0.25 ? 1 + rnd() * 2 : 0.05);
  }
  await dhaka.poles(scene, s * (ROAD / 2 + 0.6), -30, ZEND, 30, s);
}

// Shade trees on the pavement: mango and rain trees, as on a Bangladeshi street.
const trees = [await thing('tr_mango', 7.5, { byHeight: true }), await thing('tr_rain', 10, { byHeight: true })];
let ti = 0;
for (const s of [-1, 1]) for (let z = -15 + (s > 0 ? 25 : 0); z < ZEND; z += 45 + rnd() * 25) {
  const t = trees[ti++ % trees.length].clone(); t.position.set(s * (ROAD / 2 + 2.6), 0.16, z); t.rotation.y = rnd() * 6; t.scale.setScalar(0.85 + rnd() * 0.3); scene.add(t);
}

// People walking along the footpaths: photo-scanned walkers, each at a different moment of its stride.
{
  const { clone } = await import('three/addons/utils/SkeletonUtils.js');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const walkers = await Promise.all(['nathan', 'sophia', 'walkman'].map(n => new GLTFLoader().loadAsync('/models/' + n + '.glb')));
  const heights = { 0: 1.78, 1: 1.64, 2: 1.75 };
  let ps = 3;
  const prnd = () => (ps = (ps * 16807) % 2147483647) / 2147483647;
  for (const side of [-1, 1]) for (let z = -10; z < ZEND - 60; z += (4 + prnd() * 10) / TIME.people) {
    const k = Math.floor(prnd() * walkers.length), gl = walkers[k];
    const o = clone(gl.scene);
    const wrap = new THREE.Group(); wrap.add(o); wrap.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o, true); o.scale.multiplyScalar(heights[k] / (box.max.y - box.min.y));
    const mixer = new THREE.AnimationMixer(o);
    if (gl.animations[0]) { const a = mixer.clipAction(gl.animations[0]); a.play(); mixer.setTime(prnd() * gl.animations[0].duration); }
    wrap.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(o, true);
    o.position.y -= b2.min.y; o.position.x -= (b2.min.x + b2.max.x) / 2; o.position.z -= (b2.min.z + b2.max.z) / 2;
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    wrap.position.set(side * (ROAD / 2 + 1.2 + prnd() * 3.2), 0.2, z);
    wrap.rotation.y = prnd() < 0.5 ? 0 : Math.PI;
    scene.add(wrap);
  }
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

// Number plates: where each vehicle carries them (height in metres, which end).
const PLATES = {
  corolla: { cls: 'গ', model: /^Cube00[23]/, spots: [] },
  yaris: { cls: 'গ', spots: [{ y: 0.462, end: -1, w: 0.47, h: 0.15 }, { y: 0.40, end: 1, w: 0.42, h: 0.15 }] },
  cng: { cls: 'থ', spots: [{ y: 0.62, end: -1, w: 0.4 }] },
  b_viking: { cls: 'ব', spots: [{ y: 0.75, end: -1 }] },
  t_al: { cls: 'ট', spots: [{ y: 0.9, end: -1 }] },
  t_bd: { cls: 'ট', spots: [{ y: 0.9, end: -1 }] },
};
// Lights on a vehicle: tail lamps (and their glow) at its back, lit at night and in rush hour
// (brake lights in a jam).
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function glow(colour, size, at, strength = 1) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: colour, transparent: true, opacity: strength, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })); sp.scale.setScalar(size); sp.position.copy(at); scene.add(sp); return sp; }
function tailLights(v, name, on) {
  if (!on) return;
  const box = new THREE.Box3().setFromObject(v, true), w = box.max.x - box.min.x;
  const y = box.min.y + { cng: 0.55, corolla: 0.92, yaris: 0.95, b_viking: 1.0, t_al: 0.95, t_bd: 0.95 }[name];
  for (const s of [-1, 1]) {
    const at = new THREE.Vector3((box.min.x + box.max.x) / 2 + s * (w / 2 - 0.18), y, box.min.z - 0.03);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a14 })); lamp.position.copy(at); lamp.rotation.y = Math.PI; scene.add(lamp);
    glow(0xff2a14, 0.55, at, 0.75);
  }
}
// Traffic, going our way, as dense as the time of day makes it. Nothing is put where a racer is.
const VEH = {
  cng: { len: 2.6, w: 1.4, opts: { ry: -90 } }, corolla: { len: 4.6, w: 1.8, opts: {} }, yaris: { len: 3.7, w: 1.7, opts: {} },
  b_viking: { len: 11, w: 2.6, opts: { bus: 0 } }, t_al: { len: 8, w: 2.5, opts: {} }, t_bd: { len: 8.5, w: 2.5, opts: {} },
};
const MIX = ['cng', 'cng', 'cng', 'corolla', 'yaris', 'b_viking', 'cng', 'corolla', 't_al', 'b_viking', 't_bd', 'yaris'];
const keepClear = [];   // filled with the racers' spots before traffic is placed
let busN = 0;
async function addVehicle(name, x, z, y = 0) {
  const V = VEH[name], opts = Object.assign({}, V.opts); if (name === 'b_viking') opts.bus = busN++;
  const v = await thing(name, V.len, opts); v.position.set(x, y + 0.02, z); scene.add(v); v.updateMatrixWorld(true); if (!y) blob(v);
  v.traverse(m => { if (m.isMesh && /glass|kaca|window|vidrio/i.test(m.material.name || '')) { m.material = m.material.clone(); m.material.color = new THREE.Color(0x0e1214); m.material.map = null; m.material.metalness = 0.6; m.material.roughness = 0.08; m.material.transparent = false; m.material.opacity = 1; } });
  // Dhaka's cars are mostly white, silver and black, with the odd red, blue or grey.
  if (name === 'corolla' || name === 'yaris') {
    const paint = [0xf2f2f0, 0xf2f2f0, 0xb8bcc0, 0x9ea3a8, 0x141516, 0x2b2d30, 0x7a1418, 0x1d3a6b, 0x5c5f63][Math.floor(Math.random() * 9)];
    v.traverse(m => { if (m.isMesh && /main_paint|WCCARBODY/.test(m.material.name || '')) { m.material = m.material.clone(); m.material.color = new THREE.Color(paint); if (name === 'yaris') m.material.color.multiplyScalar(1.15); } });
  }
  if (opts.bus !== undefined) bits.livery(v, /^(Material_13|Material_23|Material_23_1)$/, opts.bus);
  const PL = PLATES[name]; if (PL && PL.model) bits.platesOnModel(v, PL.cls, PL.model); else if (PL) bits.plates(v, PL.cls, PL.spots.map(o => Object.assign({}, o)));
  tailLights(v, name, TIME.lit || TIME.traffic >= 1);
}
async function traffic(lanes, z0, z1, yAt) {
  let tseed = 5; const trnd = () => (tseed = (tseed * 16807) % 2147483647) / 2147483647;
  const dens = TIME.traffic;
  for (const x of lanes) {
    for (let z = z0 + trnd() * 10; z < z1;) {
      const name = MIX[Math.floor(trnd() * MIX.length)], V = VEH[name];
      const gap = dens >= 1 ? 1.2 + trnd() * 2.5 : (6 + trnd() * 40) / dens;
      const zc = z + V.len / 2;
      const blocked = keepClear.some(k => Math.abs(k.x - x) < V.w / 2 + 0.7 && Math.abs(k.z - zc) < V.len / 2 + 2.5);
      if (!blocked && trnd() < Math.min(1, 0.35 + dens)) await addVehicle(name, x, zc, yAt ? yAt(zc) : 0);
      z += V.len + gap;
    }
  }
}

// The riders.
const LEAN = { nr750: 1.3, gsxr: 1.3, z1000: 0.85 };
async function racer(b, r, x, z, opts = {}) {
  const ch = CHARACTERS.find(c => c.id === r);
  const bk = await bike(b); const rd = await rider(r); bk.add(rd);
  if (ch) dress(rd, ch);
  const fit = Object.assign({}, bk.userData.fit, { lean: opts.lean ?? LEAN[b] ?? bk.userData.fit.lean });
  bk.position.set(x, P.y + 0.02, z); bk.rotation.z = opts.roll || 0; bk.rotation.y = opts.yaw || 0; scene.add(bk); bk.updateMatrixWorld(true);
  const bn = seat(rd, bk, fit, opts);
  const hm = await thing('fullface', 1); paintHelmet(hm, ch && ch.helmet); helmet(bn, hm, ch && ch.id === 'justman' ? 0.37 : ch && ch.sex === 'f' ? 0.29 : 0.31, ch && ch.id === 'justman' ? { up: new THREE.Vector3(0, 1, 0.15).applyQuaternion(bk.quaternion), lift: 0.06, push: 0 } : {}); if (ch && ch.hair) ponytail(bn._helmet, await hairModel(), ch.hair);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.4), blobMat); sh.rotation.x = -Math.PI / 2; sh.position.set(x, P.y + 0.09, z); scene.add(sh);
  keepClear.push({ x, z });
  if (TIME.lit || TIME.traffic >= 1) {
    const bb = new THREE.Box3().setFromObject(bk, true), at = new THREE.Vector3(x, P.y + 0.78, bb.min.z + 0.12);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2a14 })); lamp.position.copy(at); lamp.position.z -= 0.02; lamp.rotation.y = Math.PI; scene.add(lamp);
    glow(0xff2a14, 0.32, at, 0.7);
  }
  return { bk, bn };
}
const shot = q.get('shot') || 'race';
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

// Traffic around them: on the deck if we're on the flyover, and on the road below.
if (q.get('traffic') !== '0') {
  if (deck && P.y > 0) {
    const half = FLY === 'expressway' ? [-5.25, -1.75, 1.75, 5.25] : [-2, 2];
    await traffic(half, P.z - 10, P.z + 260, deck.h);
    await traffic([-5.25, 5.25], P.z - 20, P.z + 260);
  } else await traffic(deck ? [-5.25, 5.25] : [-5.25, -1.75, 1.75, 5.25], P.z - 10, P.z + 260);
}

// Street lamps at night: a pool of light under each, and real lights near the camera.
if (TIME.lit) {
  const pool = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,160,0.9)'); gr.addColorStop(0.5, 'rgba(255,200,140,0.35)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 * TIME.lit, polygonOffset: true, polygonOffsetFactor: -6 });
  const all = dhaka.lamps.concat(deck ? deck.lamps : []);
  for (const l of all) {
    const floorY = deck && Math.abs(l.x) < 8 && l.y > 6 ? deck.h(l.z) + 0.08 : 0.06;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), poolMat); m.rotation.x = -Math.PI / 2; m.position.set(l.x, floorY, l.z); scene.add(m);
    glow(0xffe0b0, 2.2, l, 0.9 * TIME.lit);
  }
  if (TIME.lit >= 1) all.filter(l => l.z > P.z - 20 && l.z < P.z + 120).slice(0, 12).forEach(l => { const pl = new THREE.PointLight(0xffd9a8, 90 * TIME.lit, 30, 1.5); pl.position.copy(l); scene.add(pl); });
  // The city's own glow: shop lights and sky glow lifting the shadows a little, warm from below.
  scene.add(new THREE.HemisphereLight(0x2a3346, 0x4a3420, 0.9 * TIME.lit));
  // The player's headlight on the road ahead.
  const hl = new THREE.SpotLight(0xf2f5ff, 120 * TIME.lit, 60, 0.42, 0.6, 1.4); hl.position.set(P.x, P.y + 1.0, P.z + 1.0); hl.target.position.set(P.x, P.y, P.z + 30); scene.add(hl, hl.target);
}

// Chase camera behind and above.
const tall = H > W;
const cam = { back: +(q.get('back') || (tall ? 3.4 : 4.2)), up: +(q.get('up') || (tall ? 1.9 : 1.85)), look: 9 };
const cx = P.x - (shot === 'race' ? (tall ? 0.1 : 0.4) : 0.6);
camera.position.set(cx, P.y + cam.up, P.z - cam.back);
camera.lookAt(cx, P.y + 1.0, P.z + cam.look);
if (q.get('cam')) { const c = q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); if (c[6]) { camera.fov = c[6]; camera.updateProjectionMatrix(); } }
if (q.get('side')) { camera.position.set(P.x + 6, 1.5, P.z); camera.lookAt(P.x, 1, P.z); }
sun.target.position.set(P.x, P.y, P.z + 15); sun.position.set(P.x + TIME.sunAt[0], P.y + TIME.sunAt[1], P.z + TIME.sunAt[2]);

await new Promise(r => { const t = setInterval(() => { if (pending === 0 && dhaka.loading() === 0 && bits.loading() === 0 && marks.loading() === 0) { clearInterval(t); r(); } }, 100); });
if (q.get('nopost')) renderer.render(scene, camera);
else {
  const comp = new EffectComposer(renderer);
  comp.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, W, H); ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 16 }); ao.blendIntensity = 1.0; comp.addPass(ao);
  comp.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.18, 0.5, 0.92));
  comp.addPass(new OutputPass());
  // Colour grade: a little warmth and contrast, dusty highlights, a soft vignette.
  comp.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
        c = mix(c, c * vec3(1.05, 1.0, 0.92), 0.6);
        c = (c - 0.5) * 1.08 + 0.5;
        float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, 0.92);
        vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.55;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
  }));
  comp.addPass(new SMAAPass(W * renderer.getPixelRatio(), H * renderer.getPixelRatio()));
  comp.render();
}
document.body.dataset.shot = shot; if (q.get('nohud')) document.querySelector('.hud').style.display = 'none';
document.title = 'ok';
