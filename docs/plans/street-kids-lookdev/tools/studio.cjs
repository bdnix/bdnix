// studio.cjs <kind bike|rider> <n> <rider> <out.png>: one racer alone, lit, on a plain backdrop, from three-quarters front.
const { chromium } = require('playwright');
const [kind, n, rider, out, W = 720, H = 450] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H }, bypassCSP: true });
  p.on('pageerror', e => console.log('err', e.message));
  await p.goto('http://localhost:4173/assets/js/street-core.js');
  await p.setContent('<script src="/assets/js/street-core.js"></script>');
  const world = await p.evaluate((bike) => {
    const F = window.bdnixStreet, w = F.create(7, bike);
    w.time = 3000;
    Object.assign(w.player, { z: 200, speed: 0, x: 0 });
    w.rivals.forEach((o) => Object.assign(o, { z: 5, speed: 0, top: 0, cool: 5 }));
    return F.snapshot(w);
  }, +n);
  await p.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await p.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await p.addInitScript(({ world, rider }) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('bdnix_kingofstreets_save', JSON.stringify({ v: 1, data: { mode: 'quick', rider, carry: 0, world } }));
    localStorage.setItem('bdnix_kingofstreets_career', JSON.stringify({ points: 0, owned: [1], done: [], rider, quality: 'high' }));
    let v; Object.defineProperty(window, 'bdnixStreet3d', { configurable: true, get: () => v, set: (x) => { x.draw = false; v = x; } });
  }, { world, rider: +rider });
  await p.goto('http://localhost:4173/king-of-streets/');
  for (let i = 0; i < 300 && await p.evaluate(() => document.getElementById('newBtn').hidden); i++) await p.clock.runFor(100);
  await p.click('#startBtn');
  for (let i = 0; i < 600 && await p.evaluate(() => !document.getElementById('loading').hidden || document.getElementById('hud').hidden); i++) await p.clock.runFor(100);
  await p.keyboard.press('KeyP');
  await p.addStyleTag({ content: 'body *{visibility:hidden!important} #board,.board-wrap,.game{visibility:visible!important}' });
  await p.evaluate(({ kind }) => {
    const v = window.bdnixStreet3d.current, r = v.racers[0], s = v.scene;
    const keep = new Set([r.group]);
    s.children.forEach((c) => { if (!keep.has(c) && !c.isLight) c.visible = false; });
    s.fog = null;
    s.background = s.environment ? null : s.background;
    v.renderer.setClearColor(0x161c28, 1);
    s.environmentIntensity = 0.9;
    v.sun.intensity = 2.6;
    r.group.updateMatrixWorld(true);
    const cam = v.camera;
    // The racer's bounds, fitted in the picture.
    const set = r.sets.hi; set.bike.visible = true; if (r.sets.lo) r.sets.lo.bike.visible = false;
    let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    set.bike.traverse((m) => { if (!m.isMesh || !m.visible || m.isSkinnedMesh || m.isSprite) return; m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { const p = m.localToWorld(set.bike.position.clone().set(x, y, z)); min = [Math.min(min[0], p.x), Math.min(min[1], p.y), Math.min(min[2], p.z)]; max = [Math.max(max[0], p.x), Math.max(max[1], p.y), Math.max(max[2], p.z)]; } });
    const c = { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, z: (min[2] + max[2]) / 2 };
    const at = r.group.position.clone();
    const e = r.group.matrixWorld.elements, fwd = [e[8], e[9], e[10]], left = [e[0], e[1], e[2]];
    const rider = kind === 'rider';
    // For a rider, the top half: from the seat up.
    const top = max[1], bottom = rider ? min[1] + (max[1] - min[1]) * 0.42 : min[1];
    const cy = (top + bottom) / 2, hgt = (top - bottom) * 1.12, wid = Math.max(max[0] - min[0], max[2] - min[2]) * (rider ? 0.62 : 1.02);
    cam.fov = 30; cam.aspect = innerWidth / innerHeight; cam.near = 0.05; cam.up.set(0, 1, 0);
    const t = Math.tan(cam.fov * Math.PI / 360), dist = Math.max(hgt / 2 / t, wid / 2 / (t * cam.aspect)) + 0.6;
    const dir = [-left[0] * 0.62 + fwd[0] * 0.78, 0.18, -left[2] * 0.62 + fwd[2] * 0.78], len = Math.hypot(...dir);
    cam.position.set(c.x + dir[0] / len * dist, cy + dir[1] / len * dist, c.z + dir[2] / len * dist);
    cam.lookAt(c.x, cy, c.z);
    cam.updateProjectionMatrix();
    v.sun.position.set(at.x - left[0] * 6 + fwd[0] * 4, at.y + 9, at.z - left[2] * 6 + fwd[2] * 4);
    v.sun.target.position.copy(at);
    v.renderer.render(s, cam);
  }, { kind });
  await p.locator('#board').screenshot({ path: out, timeout: 300000 });
  await b.close();
})();
