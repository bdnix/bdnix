// Dhaka street buildings: plastered concrete blocks with photo textures, recessed windows behind
// steel grills, balconies, shops with shutters and Bangla signboards at street level, and the
// clutter on top (water tanks, rebar), built from measured parts so every building differs.
import * as THREE from 'three';
import { thing } from './common.js';

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];

const tl = new THREE.TextureLoader();
let pending = 0;
export const loading = () => pending;
function img(url) {
  pending++;
  return new Promise(res => { const i = new Image(); i.onload = () => { pending--; res(i); }; i.onerror = () => { pending--; res(null); }; i.src = url; });
}
function tex(url, srgb) {
  pending++;
  const t = tl.load(url, () => pending--, undefined, () => pending--);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Walls are painted in the colours Dhaka's buildings are: creams, pale yellows, pinks, greens, greys.
const PAINT = ['#e9dfc6', '#e4d08f', '#dca592', '#bfd3b4', '#ebe7de', '#c4d0d8', '#d8c3a6', '#cfc9bd', '#e2b98a', '#f0ead8'];

let PLASTER, PLASTER_N, STAIN;
// A wall texture for one building: the plaster photo, tinted, with monsoon streaks running down
// from every slab and grime collecting at the bottom. 1 px = 1 cm.
function wallTexture(widthM, heightM, colour, floorH, groundH, old) {
  const W = 512, H = Math.min(4096, Math.round(512 * heightM / widthM));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const s = W / widthM; // px per metre
  // Plaster photo tiled every 2.5 m.
  const tile = 2.5 * s;
  for (let y = 0; y < H; y += tile) for (let x = 0; x < W; x += tile) g.drawImage(PLASTER, x, y, tile, tile);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = colour; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  // Some buildings are older: patches of the damp-stained plaster photo.
  if (STAIN && (old || rnd() < 0.6)) {
    g.globalAlpha = old ? 0.6 + rnd() * 0.3 : 0.25 + rnd() * 0.25;
    for (let i = 0; i < 4 + rnd() * 6; i++) { const w = (1 + rnd() * 3) * s, h = (1 + rnd() * 4) * s; g.drawImage(STAIN, rnd() * W - w / 2, rnd() * H, w, h); }
    g.globalAlpha = 1;
  }
  // Streaks below each slab, where rain runs off.
  const slabs = [];
  for (let y = groundH; y < heightM; y += floorH) slabs.push(y);
  for (const yM of slabs) {
    const y = H - yM * s;
    for (let i = 0; i < W / 6; i++) {
      const x = rnd() * W, len = (0.3 + rnd() * 1.8) * s, w = 1 + rnd() * 5;
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, `rgba(40,38,32,${0.12 + rnd() * 0.25})`); gr.addColorStop(1, 'rgba(40,38,32,0)');
      g.fillStyle = gr; g.fillRect(x, y, w, len);
    }
  }
  // Roof edge streaks, the darkest.
  for (let i = 0; i < W / 4; i++) {
    const x = rnd() * W, len = (0.5 + rnd() * 3) * s, w = 1 + rnd() * 6;
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, `rgba(30,30,28,${0.2 + rnd() * 0.3})`); gr.addColorStop(1, 'rgba(30,30,28,0)');
    g.fillStyle = gr; g.fillRect(x, 0, w, len);
  }
  // Grime at the bottom.
  const gr = g.createLinearGradient(0, H - 1.2 * s, 0, H);
  gr.addColorStop(0, 'rgba(50,45,38,0)'); gr.addColorStop(1, 'rgba(50,45,38,0.55)');
  g.fillStyle = gr; g.fillRect(0, H - 1.2 * s, W, 1.2 * s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// Steel window grills: several designs, drawn into alpha textures.
function grillTexture(design, colour) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.strokeStyle = colour; g.lineCap = 'square';
  g.lineWidth = 7; g.strokeRect(4, 4, 248, 248);
  g.lineWidth = 5;
  if (design === 0) { for (let x = 32; x < 256; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } g.beginPath(); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke(); }
  if (design === 1) { for (let i = -256; i < 512; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); } }
  if (design === 2) { for (let x = 32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } for (let y = 64; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } g.lineWidth = 3; for (let y = 32; y < 256; y += 64) for (let x = 48; x < 256; x += 64) { g.beginPath(); g.arc(x, y, 14, 0, 7); g.stroke(); } }
  if (design === 3) { for (let x = 26; x < 256; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } g.lineWidth = 3; g.beginPath(); for (let x = 0; x < 256; x += 26) { g.moveTo(x, 70); g.quadraticCurveTo(x + 13, 40, x + 26, 70); g.moveTo(x, 190); g.quadraticCurveTo(x + 13, 220, x + 26, 190); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Shop signboards in Bangla, as flex banners are: bright backgrounds, bold lettering, a smaller line under.
const SHOPS = [
  ['মায়ের দোয়া স্টোর', 'মুদি মালামাল'], ['নিউ ঢাকা টেলার্স', 'অভিজাত পোশাক'], ['বিসমিল্লাহ হোটেল', 'ভাত মাছ মাংস'],
  ['আল-মদিনা ইলেকট্রনিক্স', 'মোবাইল ও সার্ভিসিং'], ['জনতা ফার্মেসী', 'সকল প্রকার ঔষধ'], ['রহমান হার্ডওয়্যার', 'রং ও স্যানিটারি'],
  ['সোনার বাংলা মিষ্টান্ন', 'দই মিষ্টি'], ['ভাই ভাই টেলিকম', 'ফ্লেক্সিলোড'], ['মেসার্স করিম ট্রেডার্স', 'পাইকারি ও খুচরা'],
  ['ঢাকা লাইব্রেরি', 'বই খাতা কলম'], ['হাজী বিরিয়ানি হাউস', 'কাচ্চি বিরিয়ানি'], ['নূর জুয়েলার্স', 'স্বর্ণ ও রৌপ্য'],
  ['তাজ ক্লথ স্টোর', 'থান কাপড়'], ['আমেনা ডেন্টাল কেয়ার', 'দাঁতের চিকিৎসা'], ['সিটি মোটরস', 'মোটরসাইকেল পার্টস'], ['নিউ মডেল সেলুন', 'চুল কাটা'],
];
const BIG = [['উদ্ভাস কোচিং সেন্টার', 'এসএসসি · এইচএসসি · ভর্তি'], ['সেবা ডায়াগনস্টিক সেন্টার', 'বিশেষজ্ঞ ডাক্তার · ২৪ ঘণ্টা'], ['মোবাইল মার্কেট', 'সব ব্র্যান্ডের ফোন'], ['আধুনিক হাসপাতাল', 'জরুরি বিভাগ খোলা'], ['ফ্যাশন হাউস', 'ঈদ কালেকশন'], ['রেস্তোরাঁ', 'দ্বিতীয় তলায়']];
const SIGN_BG = [['#c8102e', '#ffffff'], ['#0b6e3f', '#ffffff'], ['#f2c200', '#1b1b1b'], ['#1d4f9c', '#ffffff'], ['#ffffff', '#c8102e'], ['#6a1b9a', '#ffe082'], ['#e65100', '#ffffff'], ['#00897b', '#ffffff']];
function signTexture(widthM, big) {
  const [name, sub] = big ? pick(BIG) : pick(SHOPS), [bg, fg] = pick(SIGN_BG);
  const c = document.createElement('canvas'); c.width = Math.round(160 * widthM); c.height = big ? 330 : 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, c.width, 10);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 64; g.font = `${size}px Kalpurush`;
  while (g.measureText(name).width > c.width * 0.9 && size > 20) { size -= 2; g.font = `${size}px Kalpurush`; }
  if (big) { size = 110; g.font = `${size}px Kalpurush`; while (g.measureText(name).width > c.width * 0.9 && size > 30) { size -= 4; g.font = `${size}px Kalpurush`; } g.fillText(name, c.width / 2, 120); g.font = '56px Kalpurush'; g.fillText(sub, c.width / 2, 250); }
  else { g.fillText(name, c.width / 2, 50); g.font = '28px Kalpurush'; g.fillText(sub, c.width / 2, 103); }
  // Sun-faded and dusty.
  g.fillStyle = 'rgba(120,110,90,0.12)'; g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const M = {};
function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; }
// A box whose UVs are in metres in the facade's plane, so the wall texture lines up across pieces.
function wallBox(w, h, d, mat, x0, y0, W, H) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + pos.getX(i) + w / 2) / W, (y0 + pos.getY(i) + h / 2) / H);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m;
}

let AC, SHUTTER;
export async function prepare() {
  const [p, st] = await Promise.all([img('/ph/plastered_wall_04_diff.jpg'), img('/ph/worn_plaster_wall_diff.jpg')]);
  PLASTER = p; STAIN = st;
  PLASTER_N = tex('/ph/plastered_wall_04_nor_gl.jpg');
  await document.fonts.load('64px Kalpurush');
  AC = await thing('p_ac', 0.85, { byWidth: true });
  SHUTTER = await thing('p_shutter', 3, { byWidth: true });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x1d2a2c, roughness: 0.08, metalness: 0.6 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.9 });
  M.shopIn = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.9 });
  M.tank = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55 });
  M.rebar = new THREE.MeshStandardMaterial({ color: 0x4a2e1e, roughness: 0.8, metalness: 0.4 });
  M.slab = new THREE.MeshStandardMaterial({ color: 0x9d988c, roughness: 0.95 });
  M.grills = [0, 1, 2, 3].flatMap(d => ['#f2f2ee', '#1f5f3a', '#222222', '#6b3a1f'].map(c => new THREE.MeshStandardMaterial({ map: grillTexture(d, c), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 })));
  M.tube = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4fbff, emissiveIntensity: 3 });
  M.shopWalls = ['#d9d4c4', '#c9e0d2', '#e8d7b0', '#d6dbe6'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.9 }));
  M.shopLit = new THREE.MeshStandardMaterial({ color: 0x8f897c, emissive: 0x6f6a60, emissiveIntensity: 0.45, roughness: 0.9 });
  M.goods = ['#c62828', '#1565c0', '#f9a825', '#2e7d32', '#6a1b9a', '#ef6c00', '#f5f5f5', '#4e342e', '#00838f'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.7 }));
  M.sack = new THREE.MeshStandardMaterial({ color: 0xcdb98f, roughness: 1 });
  M.crate = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
  M.counter = new THREE.MeshStandardMaterial({ color: 0x6d4c33, emissive: 0x4a3322, emissiveIntensity: 0.7, roughness: 0.7 });
  M.alu = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.8 });
  M.blueGlass = new THREE.MeshStandardMaterial({ color: 0x24506a, roughness: 0.05, metalness: 0.7 });
  M.clothes = ['#c62828', '#1565c0', '#f9a825', '#2e7d32', '#ad1457', '#ffffff', '#5d4037'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
}

// One building, its front face in the plane z = 0 facing +z, from x = 0 to x = w, standing on y = 0.
export function building(w) {
  const g = new THREE.Group();
  const style = pick(['shades', 'shades', 'balconies', 'old', 'glass']);
  const floors = (style === 'old' ? 3 : 4) + Math.floor(rnd() * 5), floorH = 3, groundH = 3.6, depth = 14;
  const H = groundH + floors * floorH;
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(w, H + 1.1, style === 'old' ? pick(['#b9ab92', '#a89f8f', '#c4a98a']) : style === 'glass' ? pick(['#d9d6cf', '#c9c6c0']) : pick(PAINT), floorH, groundH, style === 'old'), normalMap: PLASTER_N, roughness: 0.92 });
  wallMat.normalScale.set(0.6, 0.6);
  // Body behind the facade.
  // Body behind the facade: above the shops it comes up to the facade, at street level it starts behind them.
  const body = wallBox(w, H - groundH, depth - 0.4, wallMat, 0, groundH, w, H + 1.1); body.position.set(w / 2, groundH + (H - groundH) / 2, -(depth - 0.4) / 2 - 0.4); g.add(body);
  const back = wallBox(w, groundH, depth - 3.1, wallMat, 0, 0, w, H + 1.1); back.position.set(w / 2, groundH / 2, -(depth - 3.1) / 2 - 3.1); g.add(back);
  const shopTop = box(w, 1.0, 3.0, M.shopIn); shopTop.position.set(w / 2, groundH - 0.5, -1.55); g.add(shopTop);
  // Bays across the front: 2.6–3.4 m each.
  const bays = Math.max(2, Math.round(w / 3)), bw = w / bays;
  const grill = pick(M.grills);
  const balconyFloors = new Set(); for (let f = 0; f < floors; f++) if (style === 'balconies' || (style === 'shades' && rnd() < 0.25)) balconyFloors.add(f);
  // Ground floor: shops.
  const slab0 = box(w, 0.25, 1.4, M.slab); slab0.position.set(w / 2, groundH, 0.3); g.add(slab0);
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const pier = wallBox(0.3, groundH, 3.1, wallMat, x0, 0, w, H + 1.1); pier.position.set(x0 + 0.15, groundH / 2, -1.55); g.add(pier);
    const state = rnd(), open = state < 0.7;
    if (open) {
      // A lit shop: back wall, shelves of goods, a tube light.
      const bwall = box(bw - 0.3, groundH - 1.0, 0.1, pick(M.shopWalls)); bwall.position.set(x0 + bw / 2 + 0.15, (groundH - 1.0) / 2, -3); g.add(bwall);
      const floor = box(bw - 0.3, 0.05, 3, M.shopLit); floor.position.set(x0 + bw / 2 + 0.15, 0.02, -1.5); g.add(floor);
      for (const side of [-1, 1]) { const sw2 = box(0.1, groundH - 1.0, 3, M.shopLit); sw2.position.set(x0 + bw / 2 + 0.15 + side * (bw - 0.4) / 2, (groundH - 1.0) / 2, -1.5); g.add(sw2); }
      const ceil = box(bw - 0.3, 0.05, 3, M.shopLit); ceil.position.set(x0 + bw / 2 + 0.15, groundH - 1.0, -1.5); g.add(ceil);
      const tube = box(1.2, 0.04, 0.04, M.tube); tube.position.set(x0 + bw / 2 + 0.15, groundH - 1.08, -1.2); g.add(tube);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) {
        const it = box(0.12 + rnd() * 0.2, 0.15 + rnd() * 0.25, 0.25, pick(M.goods));
        it.position.set(x0 + 0.5 + rnd() * (bw - 0.7), 0.4 + r * 0.55 + 0.1, -2.8 + rnd() * 0.3); it.castShadow = false; g.add(it);
      }
      // Goods on show at the front: strings of packets hanging from the top, sacks and crates on the step.
      for (let k = 0; k < 10; k++) { const pk = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.24), pick(M.goods)); pk.position.set(x0 + 0.45 + k * (bw - 0.9) / 9, groundH - 1.25 - (k % 2) * 0.1, -0.15); g.add(pk); }
      for (let k = 0; k < 6; k++) { const pk = box(0.3 + rnd() * 0.3, 0.3 + rnd() * 0.5, 0.4, pick([M.sack, M.crate, ...M.goods])); pk.position.set(x0 + 0.5 + rnd() * (bw - 1), 0.25, -0.35 - rnd() * 0.6); pk.rotation.y = (rnd() - 0.5) * 0.4; g.add(pk); }
      const counter = box(bw * 0.6, 0.9, 0.5, M.counter); counter.position.set(x0 + bw / 2 + 0.15, 0.45, -0.8); g.add(counter);
      // The shutter rolled up into its box.
      const sh = SHUTTER.clone(); sh.scale.multiplyScalar((bw - 0.3) / 3); sh.position.set(x0 + bw / 2 + 0.15, groundH - 1.0 - 0.15, -0.35); sh.scale.y *= 0.06; g.add(sh);
    } else {
      const inside = box(bw - 0.3, groundH - 1.0, 2.6, M.shopIn); inside.position.set(x0 + bw / 2 + 0.15, (groundH - 1.0) / 2, -1.8); g.add(inside);
      const sh = SHUTTER.clone(); sh.scale.multiplyScalar((bw - 0.3) / 3); sh.position.set(x0 + bw / 2 + 0.15, 0, -0.35); g.add(sh);
    }
    // Signboard over the shop.
    const sw = bw - 0.3, sign = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.85, 0.06), [M.dark, M.dark, M.dark, M.dark, new THREE.MeshStandardMaterial({ map: signTexture(sw), roughness: 0.7 }), M.dark]);
    sign.position.set(x0 + bw / 2 + 0.15, groundH - 0.55, 0.05); sign.castShadow = true; g.add(sign);
  }
  if (style === 'glass') {
    const cw = box(w - 0.6, floors * floorH - 0.4, 0.1, M.blueGlass); cw.position.set(w / 2, groundH + floors * floorH / 2, 0.05); g.add(cw);
    for (let x = 0.3; x <= w - 0.3 + 1e-6; x += (w - 0.6) / Math.round((w - 0.6) / 1.5)) { const m = box(0.08, floors * floorH - 0.4, 0.16, M.alu); m.position.set(x, groundH + floors * floorH / 2, 0.08); g.add(m); }
    for (let f = 0; f <= floors; f++) { const m = box(w - 0.6, 0.12, 0.18, M.alu); m.position.set(w / 2, groundH + 0.2 + f * floorH - (f === floors ? 0.4 : 0), 0.08); g.add(m); }
    for (const sx of [0.15, w - 0.15]) { const p = wallBox(0.3, floors * floorH, 0.3, wallMat, sx - 0.15, groundH, w, H + 1.1); p.position.set(sx, groundH + floors * floorH / 2, -0.05); g.add(p); }
  }
  // A billboard across the first floor on some buildings: coaching centres, clinics, mobile shops.
  if (rnd() < 0.3) {
    const bwid = Math.min(w - 1, 8), bb = new THREE.Mesh(new THREE.BoxGeometry(bwid, 2.2, 0.1), [M.dark, M.dark, M.dark, M.dark, new THREE.MeshStandardMaterial({ map: signTexture(bwid, true), roughness: 0.6 }), M.dark]);
    bb.position.set(w / 2, groundH + 1.5, 0.45); bb.castShadow = true; g.add(bb);
  }
  { const pier = wallBox(0.3, groundH, 3.1, wallMat, w - 0.3, 0, w, H + 1.1); pier.position.set(w - 0.15, groundH / 2, -1.55); g.add(pier); }
  // Upper floors.
  for (let f = 0; f < floors && style !== 'glass'; f++) {
    const y0 = groundH + f * floorH;
    const slab = box(w, 0.2, 0.25, M.slab); slab.position.set(w / 2, y0 + 0.1, 0.12); g.add(slab);
    const balcony = balconyFloors.has(f);
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw;
      const winW = Math.min(bw - 0.7, 1.9), winH = 1.5, sill = 0.9;
      const xs = x0 + (bw - winW) / 2, ys = y0 + sill;
      // Wall around the opening: piers left and right, spandrel below, lintel above.
      const L = wallBox(xs - x0, floorH, 0.3, wallMat, x0, y0, w, H + 1.1); L.position.set(x0 + (xs - x0) / 2, y0 + floorH / 2, -0.15); g.add(L);
      const R = wallBox(x0 + bw - xs - winW, floorH, 0.3, wallMat, xs + winW, y0, w, H + 1.1); R.position.set(xs + winW + (x0 + bw - xs - winW) / 2, y0 + floorH / 2, -0.15); g.add(R);
      const B = wallBox(winW, sill, 0.3, wallMat, xs, y0, w, H + 1.1); B.position.set(xs + winW / 2, y0 + sill / 2, -0.15); g.add(B);
      const T = wallBox(winW, floorH - sill - winH, 0.3, wallMat, xs, ys + winH, w, H + 1.1); T.position.set(xs + winW / 2, ys + winH + (floorH - sill - winH) / 2, -0.15); g.add(T);
      // Recessed glass, curtains half drawn behind it, and the grill in front.
      const glass = box(winW, winH, 0.04, M.glass); glass.position.set(xs + winW / 2, ys + winH / 2, -0.3); g.add(glass);
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), grill); gr.position.set(xs + winW / 2, ys + winH / 2, 0.02); g.add(gr);
      // Sun shade over the window.
      if (style === 'shades') { const shade = box(winW + 0.3, 0.06, 0.45, M.slab); shade.position.set(xs + winW / 2, ys + winH + 0.12, 0.22); g.add(shade); }
      if (balcony && (style === 'balconies' || b % 2 === 0)) {
        const bal = box(bw, 0.15, 1.1, M.slab); bal.position.set(x0 + bw / 2, y0 + 0.08, 0.55); g.add(bal);
        const par = style === 'balconies' && rnd() < 0.5 ? wallBox(bw, 1.0, 0.1, wallMat, x0, y0, w, H + 1.1) : new THREE.Mesh(new THREE.PlaneGeometry(bw, 1.0), grill); par.position.set(x0 + bw / 2, y0 + 0.65, 1.1); g.add(par);
        // Washing on a line.
        if (rnd() < 0.4) {
          const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, bw - 0.4, 4), M.dark); line.rotation.z = Math.PI / 2; line.position.set(x0 + bw / 2, y0 + 2.2, 0.75); g.add(line);
          for (let k = 0; k < 1 + rnd() * 3; k++) { const h = 0.5 + rnd() * 0.6, cl = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + rnd() * 0.35, h), pick(M.clothes)); cl.position.set(x0 + 0.4 + rnd() * (bw - 0.8), y0 + 2.2 - h / 2, 0.75); g.add(cl); }
        }
      } else if (rnd() < 0.12) {
        const ac = AC.clone(); ac.position.set(xs + winW / 2, y0 + 0.15, 0.3); ac.rotation.y = 0; g.add(ac);
      }
    }
  }
  // Roof: parapet, black water tanks, rebar left sticking up for the next floor.
  const par = wallBox(w, 1.1, 0.2, wallMat, 0, H, w, H + 1.1); par.position.set(w / 2, H + 0.55, -0.1); g.add(par);
  for (let k = 0; k < 1 + rnd() * 2; k++) {
    const r = 0.55 + rnd() * 0.2, t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.3, 20), M.tank);
    t.position.set(1 + rnd() * (w - 2), H + 0.65 + 0.6, -2 - rnd() * 6); t.castShadow = true; g.add(t);
  }
  if (rnd() < 0.6) for (let x = 0.2; x < w; x += bw) for (let k = 0; k < 4; k++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2 + rnd() * 0.8, 5), M.rebar);
    bar.position.set(x + (k % 2) * 0.2, H + 1.1, -0.3 - Math.floor(k / 2) * 0.2); bar.rotation.z = (rnd() - 0.5) * 0.2; g.add(bar);
  }
  g.userData.height = H;
  return g;
}

// Concrete electricity poles with sagging bundles of cables between them, as along every Dhaka road.
export function poles(scene, x, z0, z1, gap) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.9 });
  const cable = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  const tops = [];
  for (let z = z0; z < z1; z += gap) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 10, 10), mat); p.position.set(x, 5, z); p.castShadow = true; scene.add(p);
    const arm = box(1.4, 0.1, 0.1, mat); arm.position.set(x, 9.2, z); scene.add(arm);
    tops.push(z);
  }
  for (let i = 0; i < tops.length - 1; i++) {
    for (let k = 0; k < 7; k++) {
      const off = (k % 4 - 1.5) * 0.35, y = 9.25 - Math.floor(k / 4) * 0.6 - rnd() * 0.3, sag = 0.5 + rnd() * 1.0;
      const pts = []; for (let t = 0; t <= 16; t++) { const u = t / 16; pts.push(new THREE.Vector3(x + off + (rnd() - 0.5) * 0.02, y - sag * 4 * u * (1 - u), tops[i] + u * (tops[i + 1] - tops[i]))); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012 + rnd() * 0.012, 4), cable); scene.add(m);
    }
  }
}
