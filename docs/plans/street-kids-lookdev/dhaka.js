// Dhaka street buildings: plastered concrete blocks with photo textures, recessed windows behind
// steel grills, balconies, shops with shutters and Bangla signboards at street level, and the
// clutter on top (water tanks, rebar), built from measured parts so every building differs.
import * as THREE from 'three';
import { thing } from './common.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  // Vinyl wrinkles and sag: soft light and dark bands running across.
  for (let i = 0; i < c.width / 40; i++) {
    const x = rnd() * c.width, w = 6 + rnd() * 30, gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, rnd() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.save(); g.translate(x, 0); g.rotate((rnd() - 0.5) * 0.5); g.fillRect(-w, -20, 2 * w, c.height + 40); g.restore();
  }
  // Dust settling on the top edge, rain streaks, faded corners.
  let dg = g.createLinearGradient(0, 0, 0, c.height * 0.35); dg.addColorStop(0, 'rgba(70,60,45,0.45)'); dg.addColorStop(1, 'rgba(70,60,45,0)'); g.fillStyle = dg; g.fillRect(0, 0, c.width, c.height * 0.35);
  for (let i = 0; i < c.width / 25; i++) { const x = rnd() * c.width, l = rnd() * c.height; dg = g.createLinearGradient(0, 0, 0, l); dg.addColorStop(0, 'rgba(50,45,35,0.3)'); dg.addColorStop(1, 'rgba(50,45,35,0)'); g.fillStyle = dg; g.fillRect(x, 0, 1 + rnd() * 3, l); }
  // The aluminium frame.
  g.strokeStyle = '#8d8f8f'; g.lineWidth = 6; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(7, 7, c.width - 14, c.height - 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const M = {};
// A paper notice: "দোকান ভাড়া দেওয়া হইবে" (shop to let) with a phone number, red on white.
function noticeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 300; const g = c.getContext('2d');
  g.fillStyle = '#efece4'; g.fillRect(0, 0, 256, 300);
  g.fillStyle = '#c62828'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '44px Kalpurush'; g.fillText('দোকান', 128, 50); g.fillText('ভাড়া দেওয়া', 128, 105); g.fillText('হইবে', 128, 160);
  g.fillStyle = '#222'; g.font = '30px Kalpurush'; g.fillText('০১৭' + '১২৩৪৫৬৭৮'.split('').sort(() => rnd() - 0.5).join(''), 128, 230);
  for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(90,80,60,${rnd() * 0.2})`; g.fillRect(rnd() * 256, rnd() * 300, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; }
// A box whose UVs are in metres in the facade's plane, so the wall texture lines up across pieces.
function wallBox(w, h, d, mat, x0, y0, W, H) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + pos.getX(i) + w / 2) / W, (y0 + pos.getY(i) + h / 2) / H);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m;
}

let AC, SHUTTER, SCAN;
// Time of day: 'night' lights windows, signs, shops and street lamps.
let NIGHT = 0;
export const lamps = [];
export async function prepare(opts = {}) {
  NIGHT = opts.night || 0;
  const [p, st] = await Promise.all([img('/ph/plastered_wall_04_diff.jpg'), img('/ph/worn_plaster_wall_diff.jpg')]);
  PLASTER = p; STAIN = st;
  PLASTER_N = tex('/ph/plastered_wall_04_nor_gl.jpg');
  await document.fonts.load('64px Kalpurush');
  AC = await thing('p_ac', 0.85, { byWidth: true });
  SHUTTER = await thing('p_shutter', 3, { byWidth: true });
  // Photo scans of real shopfronts and street clutter (albentan2012, CC BY), front to +z, base at y = 0.
  const scan = async (name, h) => { const o = await thing(name, h, { ry: 90, byHeight: true }); o.traverse(n => { if (n.isMesh) { n.material.side = THREE.DoubleSide; n.castShadow = n.receiveShadow = true; } }); const g = new THREE.Group(); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o, true); o.position.z -= b.max.z; g.add(o); return g; };
  SCAN = { shutter: await scan('x_front', 3.24), store: await scan('x_crates', 2.1), meters: await scan('x_meters', 2.12) };
  M.glass = new THREE.MeshStandardMaterial({ color: 0x1d2a2c, roughness: 0.08, metalness: 0.6 });
  // Lit rooms behind the glass at night: warm tube-light and bulb colours, curtains drawn or not.
  M.glassLit = ['#ffd9a0', '#fff1d6', '#d8ecff', '#ffe7b8', '#f4f8ff'].map(c => new THREE.MeshStandardMaterial({ color: 0x222222, emissive: c, emissiveIntensity: 1.4, roughness: 0.2 }));
  M.dark = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.9 });
  M.shopIn = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.9 });
  M.tank = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55 });
  M.rebar = new THREE.MeshStandardMaterial({ color: 0x4a2e1e, roughness: 0.8, metalness: 0.4 });
  M.slab = new THREE.MeshStandardMaterial({ color: 0x9d988c, roughness: 0.95 });
  M.grills = [0, 1, 2, 3].flatMap(d => ['#f2f2ee', '#1f5f3a', '#222222', '#6b3a1f'].map(c => new THREE.MeshStandardMaterial({ map: grillTexture(d, c), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 })));
  M.tube = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4fbff, emissiveIntensity: NIGHT ? 8 : 3 });
  M.shopWalls = ['#d9d4c4', '#c9e0d2', '#e8d7b0', '#d6dbe6'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.9 }));
  M.shopLit = new THREE.MeshStandardMaterial({ color: 0x8f897c, emissive: 0x6f6a60, emissiveIntensity: NIGHT ? 1.6 : 0.45, roughness: 0.9 });
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
  // Shops 4–5.5 m wide, each a photo scan of a real shopfront: a shutter pulled down, or an open
  // store with its crates and goods out at the front, lit inside. Now and then a wall of
  // electric meters on the pier between two shops.
  const nShops = Math.max(1, Math.round(w / 4.7)), sw = w / nShops;
  for (let b = 0; b < nShops; b++) {
    const x0 = b * sw, cx = x0 + sw / 2, inner = sw - 0.3;
    const pier = wallBox(0.3, groundH, 3.1, wallMat, x0, 0, w, H + 1.1); pier.position.set(x0 + 0.15, groundH / 2, -1.55); g.add(pier);
    const kind = rnd();
    if (kind < 0.62) {
      // Open: a dim, tube-lit room, the shelves and crates scan at its mouth.
      const room = new THREE.Mesh(new THREE.BoxGeometry(inner, groundH - 0.95, 3), [M.shopLit, M.shopLit, M.shopLit, M.shopLit, M.shopIn, M.shopLit]);
      room.material = room.material.map(m => { const c = m.clone(); c.side = THREE.BackSide; return c; });
      room.position.set(cx + 0.15, (groundH - 0.95) / 2, -1.6); g.add(room);
      const tube = box(1.2, 0.04, 0.04, M.tube); tube.position.set(cx + 0.15, groundH - 1.0, -1.0); g.add(tube);
      const sc = SCAN.store.clone(); sc.scale.set(inner / 4.06, (groundH - 1.15) / 2.1, 0.8); sc.position.set(cx + 0.15, 0.02, -0.75); g.add(sc);
      const sh = SHUTTER.clone(); sh.scale.multiplyScalar(inner / 3); sh.scale.y *= 0.06; sh.position.set(cx + 0.15, groundH - 1.08, -0.3); g.add(sh);
    } else {
      const inside = box(inner, groundH - 0.95, 1.2, M.shopIn); inside.position.set(cx + 0.15, (groundH - 0.95) / 2, -2.5); g.add(inside);
      const sc = SCAN.shutter.clone(); sc.scale.set(inner / 5.45, (groundH - 0.95) / 3.0, 0.5); sc.position.set(cx + 0.15, 0, -0.3); g.add(sc);
      // The scan's notice is in English: a Bangla to-let notice pasted over it, or a shop's own notice.
      const n = new THREE.Mesh(new THREE.PlaneGeometry(inner * 0.3, (groundH - 0.95) * 0.38), new THREE.MeshStandardMaterial({ map: noticeTexture(), roughness: 0.8 }));
      // Pasted over the scan's English notice: find the shutter's surface there with a ray.
      g.updateMatrixWorld(true);
      const nx = cx + 0.15 + inner * 0.14, ny = (groundH - 0.95) * 0.72;
      const ray = new THREE.Raycaster(new THREE.Vector3(nx, ny, 2).applyMatrix4(g.matrixWorld), new THREE.Vector3(0, 0, -1).transformDirection(g.matrixWorld));
      const hit = ray.intersectObject(sc, true)[0];
      const nz = hit ? g.worldToLocal(hit.point.clone()).z + 0.06 : -0.5;
      n.position.set(nx + 0.06, ny, nz); g.add(n);
    }
    if (b > 0 && rnd() < 0.25) { const m = SCAN.meters.clone(); m.scale.setScalar(0.55); m.position.set(x0 + 0.15, 0.6, 0.05); g.add(m); }
    // Signboard over the shop.
    const sgn = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.85, 0.06), [M.dark, M.dark, M.dark, M.dark, (() => { const t = signTexture(inner); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissiveMap: NIGHT ? t : null, emissive: NIGHT ? 0xffffff : 0x000000, emissiveIntensity: NIGHT ? (rnd() < 0.75 ? 0.9 : 0) : 0 }); })(), M.dark]);
    sgn.position.set(cx + 0.15, groundH - 0.55, 0.05); sgn.castShadow = true; g.add(sgn);
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
      const glass = box(winW, winH, 0.04, NIGHT && rnd() < 0.45 ? pick(M.glassLit) : M.glass); glass.position.set(xs + winW / 2, ys + winH / 2, -0.3); g.add(glass);
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

// Concrete electricity poles with Dhaka's tangle of cables: many bundles at different sags, coils
// of spare cable hung on the poles, drop lines to the buildings, and the odd transformer.
export async function poles(scene, x, z0, z1, gap, side) {
  const pole = await thing('p_pole2', 10, { byHeight: true });
  const cable = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.45, metalness: 0.1 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x5e5e58, roughness: 0.6, metalness: 0.4 });
  const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 3), r, 5), cable);
  const geos = [];
  const add = m => { m.updateMatrix(); geos.push(m.geometry.applyMatrix4(m.matrix)); };
  const tops = [];
  for (let z = z0; z < z1; z += gap * (0.8 + rnd() * 0.4)) {
    const p = pole.clone(); p.position.set(x, 0.2, z); p.rotation.y = side < 0 ? 0 : Math.PI; scene.add(p);
    tops.push(z);
    // A street lamp on every other pole: an arm out over the road and an LED head.
    if (tops.length % 2) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), grey); arm.rotation.z = Math.PI / 2 - side * 0.12; arm.position.set(x - side * 1.15, 8.1, z); scene.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.25), grey); head.position.set(x - side * 2.3, 8.0, z); scene.add(head);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffe2b0, emissiveIntensity: NIGHT ? 12 : 0 }));
      lens.rotation.x = Math.PI / 2; lens.position.set(x - side * 2.3, 7.94, z); scene.add(lens);
      lamps.push(new THREE.Vector3(x - side * 2.3, 7.9, z));
    }
    // Coils of spare cable hung on the pole, two or three per pole.
    for (let k = 0; k < 1 + rnd() * 3; k++) {
      const r = 0.25 + rnd() * 0.2, y = 5.5 + rnd() * 3;
      for (let t = 0; t < 4; t++) { const c = new THREE.Mesh(new THREE.TorusGeometry(r + t * 0.015, 0.012, 4, 20), cable); c.position.set(x + side * -0.2, y - r, z + (rnd() - 0.5) * 0.1); c.rotation.set(0, Math.PI / 2 + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.3); add(c); }
    }
    // Junction boxes and a transformer now and then.
    if (rnd() < 0.5) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.2), grey); b.position.set(x - side * 0.2, 3.2 + rnd() * 1.5, z); scene.add(b); }
    if (rnd() < 0.2) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 14), grey); t.position.set(x - side * 0.45, 7.2, z); t.castShadow = true; scene.add(t); }
    // Drop lines to the buildings.
    for (let k = 0; k < 3 + rnd() * 4; k++) {
      const y0 = 6 + rnd() * 3, y1 = 4 + rnd() * 6, dz = (rnd() - 0.5) * 14, bx = x + side * (5 + rnd() * 0.6);
      const pts = []; for (let t = 0; t <= 8; t++) { const u = t / 8; pts.push(new THREE.Vector3(x + (bx - x) * u, y0 + (y1 - y0) * u - 0.6 * 4 * u * (1 - u), z + dz * u)); }
      add(tube(pts, 0.008 + rnd() * 0.008));
    }
  }
  // Runs between poles: 15–25 cables, grouped into loose bundles, each sagging its own amount.
  for (let i = 0; i < tops.length - 1; i++) {
    const za = tops[i], zb = tops[i + 1];
    for (let k = 0; k < 15 + rnd() * 10; k++) {
      const bundle = Math.floor(rnd() * 4), y = 9.2 - bundle * 0.7 - rnd() * 0.25, off = -side * (0.05 + bundle * 0.12 + rnd() * 0.1), sag = 0.4 + bundle * 0.3 + rnd() * 0.8;
      const pts = []; for (let t = 0; t <= 12; t++) { const u = t / 12; pts.push(new THREE.Vector3(x + off + Math.sin(u * 9 + k) * 0.02, y - sag * 4 * u * (1 - u), za + u * (zb - za))); }
      add(tube(pts, 0.007 + rnd() * 0.012));
    }
    // A loose loop drooping low from the bundle.
    if (rnd() < 0.5) { const zc = za + (0.2 + rnd() * 0.6) * (zb - za), pts = []; for (let t = 0; t <= 10; t++) { const u = t / 10; pts.push(new THREE.Vector3(x - side * 0.1, 8.2 - 2.2 * Math.sin(u * Math.PI), zc - 1.5 + 3 * u)); } add(tube(pts, 0.01)); }
  }
  const merged = mergeGeometries(geos, false);
  const m = new THREE.Mesh(merged, cable); m.castShadow = true; scene.add(m);
}
