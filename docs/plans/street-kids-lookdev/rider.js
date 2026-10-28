// Seating a Renderpeople rig on a bike with two-bone IK.
import * as THREE from 'three';

const V = () => new THREE.Vector3();
const Q = () => new THREE.Quaternion();

const HIK = { Hips: 'hip', Spine: 'spine_01', Spine1: 'spine_02', Spine2: 'spine_03', Neck: 'neck', Head: 'head',
  LeftShoulder: 'shoulder_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'shoulder_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'upperleg_l', LeftLeg: 'lowerleg_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'upperleg_r', RightLeg: 'lowerleg_r', RightFoot: 'foot_r', RightToeBase: 'ball_r' };

// Character Creator names (CC_Base_L_Upperarm_050 and so on).
const CC = { Hip: 'hip', Waist: 'spine_01', Spine01: 'spine_02', Spine02: 'spine_03', NeckTwist01: 'neck', Head: 'head',
  L_Clavicle: 'shoulder_l', L_Upperarm: 'upperarm_l', L_Forearm: 'lowerarm_l', L_Hand: 'hand_l',
  R_Clavicle: 'shoulder_r', R_Upperarm: 'upperarm_r', R_Forearm: 'lowerarm_r', R_Hand: 'hand_r',
  L_Thigh: 'upperleg_l', L_Calf: 'lowerleg_l', L_Foot: 'foot_l', L_ToeBase: 'ball_l',
  R_Thigh: 'upperleg_r', R_Calf: 'lowerleg_r', R_Foot: 'foot_r', R_ToeBase: 'ball_r' };

const MIX = Object.assign({}, HIK, { Spine: 'spine_01', Spine1: 'spine_02', Spine2: 'spine_03', HeadTop: 'head_end' });

// The common name of a bone in any of the rigs used (Renderpeople, HumanIK, Character Creator), or null.
export function canonical(name) {
  const m = /(?:^|_)((?:hip|spine_0\d|neck|head|shoulder_[lr]|upperarm_[lr]|lowerarm_[lr]|hand_[lr]|upperleg_[lr]|lowerleg_[lr]|foot_[lr]|ball_[lr]|foot_end_[lr]|head_end))_\d+$/.exec(name);
  if (m) return m[1];
  const h = /^Character\d_([A-Za-z0-9]+)_\d+(_0)?$/.exec(name);
  if (h) return h[2] ? (h[1] === 'Head' ? 'head_end' : null) : HIK[h[1]] || null;
  if (/^(?:mixamorig:?)?HeadTop_End_\d+$/.test(name)) return 'head_end';
  // Mixamo names, with or without the mixamorig: prefix (Hips_01, mixamorig:LeftForeArm_010).
  const x = /^(?:mixamorig:?)?([A-Za-z0-9]+)_\d+$/.exec(name);
  if (x && MIX[x[1]]) return MIX[x[1]];
  const c = /^CC_Base_([A-Za-z0-9_]+?)_\d+$/.exec(name);
  if (c) return CC[c[1]] || null;
  return null;
}

export function bones(root) {
  const b = {};
  root.traverse(n => {
    if (!n.isBone) return;
    const k = canonical(n.name);
    if (k && !b[k]) b[k] = n;
  });
  return b;
}

function wpos(o) { return o.getWorldPosition(V()); }

// Turn bone so that the world direction from it to `child` becomes the direction to `target`.
export function aim(bone, child, target) {
  bone.updateWorldMatrix(true, true);
  const a = wpos(bone), c = wpos(child);
  const from = c.sub(a).normalize(), to = target.clone().sub(a).normalize();
  const q = Q().setFromUnitVectors(from, to);
  const wq = bone.getWorldQuaternion(Q());
  const pq = bone.parent.getWorldQuaternion(Q());
  bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
  bone.updateWorldMatrix(false, true);
}

// Rotate a bone about a world axis.
export function turn(bone, axis, angle) {
  bone.updateWorldMatrix(true, true);
  const q = Q().setFromAxisAngle(axis, angle);
  const wq = bone.getWorldQuaternion(Q());
  const pq = bone.parent.getWorldQuaternion(Q());
  bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
  bone.updateWorldMatrix(false, true);
}

export function ik(a, b, c, target, pole) {
  a.updateWorldMatrix(true, true);
  const A = wpos(a), B = wpos(b), C = wpos(c);
  const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
  const toT = target.clone().sub(A);
  const d = Math.min(toT.length(), (l1 + l2) * 0.999);
  const dir = toT.normalize();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const p = pole.clone().sub(A); p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
  const knee = A.clone().add(dir.clone().multiplyScalar(along)).add(p.multiplyScalar(h));
  aim(a, b, knee);
  aim(b, c, target);
}

// Seat a rider (already scaled, its root at the origin of `bike` space) on a bike.
// fit: { seat, grip, peg } in bike space (metres; +z forward, +x is the rider's left), lean (radians).
export function seat(rider, bike, fit, opts = {}) {
  const b = bones(rider);
  rider.updateMatrixWorld(true);
  const toWorld = v => bike.localToWorld(new THREE.Vector3(...v));
  // Hips onto the seat.
  const hip = wpos(b.hip), want = toWorld(fit.seat);
  rider.position.add(rider.parent.worldToLocal(want.clone()).sub(rider.parent.worldToLocal(hip.clone())));
  rider.updateMatrixWorld(true);
  const side = new THREE.Vector3(1, 0, 0).transformDirection(bike.matrixWorld);
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(bike.matrixWorld);
  const up = new THREE.Vector3(0, 1, 0).transformDirection(bike.matrixWorld);
  // Stand the back, neck and head straight first, whatever pose the scan was taken in.
  for (const [a, c] of [['spine_01', 'spine_02'], ['spine_02', 'spine_03'], ['spine_03', 'neck'], ['neck', 'head'], ['head', 'head_end']]) {
    if (!b[a] || !b[c]) continue;
    const A = wpos(b[a]); aim(b[a], b[c], A.clone().add(up.clone().multiplyScalar(A.distanceTo(wpos(b[c])))));
  }
  // Lean the back forward over the tank, spread over the spine.
  const lean = fit.lean ?? 0.7;
  b.hip && turn(b.hip, side, lean * 0.62);
  for (const s of ['spine_01', 'spine_02', 'spine_03']) b[s] && turn(b[s], side, lean * 0.38 / 3);
  if (opts.twist) for (const s of ['spine_02', 'spine_03']) b[s] && turn(b[s], up, opts.twist / 2);
  // Head back up to look down the road.
  b.neck && turn(b.neck, side, -lean * 0.5);
  b.head && turn(b.head, side, -lean * 0.3);
  // Legs to the pegs, knees forward and out.
  for (const s of ['l', 'r']) {
    const sx = s === 'l' ? 1 : -1;
    const peg = toWorld([fit.peg[0] * sx, fit.peg[1], fit.peg[2]]);
    const pole = toWorld([fit.peg[0] * sx * 2.2, fit.peg[1] + 0.3, fit.peg[2] + 1.2]);
    ik(b['upperleg_' + s], b['lowerleg_' + s], b['foot_' + s], peg, pole);
    // Toes forward and a little down.
    if (b['ball_' + s]) aim(b['foot_' + s], b['ball_' + s], peg.clone().add(fwd.clone().multiplyScalar(0.2)).add(up.clone().multiplyScalar(-0.05)));
  }
  // Arms to the grips (or wherever opts.hands says), elbows out and down.
  for (const s of ['l', 'r']) {
    const sx = s === 'l' ? 1 : -1;
    // The grip's own line (fit.bar: its inner and outer ends, rider's left), else a point.
    const m = v => [v[0] * sx, v[1], v[2]];
    const bar = fit.bar && [toWorld(m(fit.bar[0])), toWorld(m(fit.bar[1]))];
    const out = bar ? bar[1].clone().sub(bar[0]).normalize() : side.clone().multiplyScalar(sx);
    // The palm's middle sits 5.5 cm out from the switch block, the index finger beside it.
    const g = (opts.hands && opts.hands[s]) || (bar ? null : m(fit.grip));
    const grip = (opts.handsWorld && opts.handsWorld[s]) || (g ? toWorld(g) : bar[0].clone().add(out.clone().multiplyScalar(0.055)));
    const gl = bike.worldToLocal(grip.clone());
    const pole = toWorld([gl.x + sx * 0.6, gl.y - 0.5, gl.z - 0.6]);
    ik(b['upperarm_' + s], b['lowerarm_' + s], b['hand_' + s], grip, pole);
    if (opts.grip !== false && !(opts.hands && opts.hands[s]) && !(opts.handsWorld && opts.handsWorld[s])) clasp(rider, b, s, grip, pole, out, fwd, up, bar ? gripFit(bike, grip, out) : 0.017, bar && [bar[0].clone().sub(grip).dot(out), bar[1].clone().sub(grip).dot(out)]);
  }
  b._fwd = fwd;
  return b;
}

// A hand's finger bones, { thumb: [1, 2, 3], index: [...], ... }, in any of the rigs used.
export function fingers(root, side) {
  const S = side === 'l' ? '(?:Left|L_)' : '(?:Right|R_)';
  const re = new RegExp(S + '(?:Hand)?(Thumb|Index|Mid(?:dle)?|Ring|Pinky)([1-3])_\\d+$');
  const f = {};
  root.traverse(n => {
    const m = n.isBone && re.exec(n.name);
    if (!m) return;
    const k = m[1].slice(0, 3).toLowerCase();
    (f[k] = f[k] || [])[m[2] - 1] = n;
  });
  return f;
}

// Close a hand round a grip: the palm on its top and back, the fingers across it, over the top
// and round underneath, the index finger at the inner end; `out` runs along the grip outwards.
// The arm reaches so that the palm, not the wrist, is on the grip.
// A grip's real line and radius at `at`: rays cast at the measured line from all round
// (skinned figures ignored); the hits' middle is the true centre, their spread the radius.
// Moves `at` onto the centre and returns the radius.
function gripFit(bike, at, out) {
  const rc = new THREE.Raycaster(), side = new THREE.Vector3(0, 1, 0).cross(out).normalize(), up2 = out.clone().cross(side);
  const meshes = []; bike.traverse(m => { if (m.isMesh && !m.isSkinnedMesh && m.visible) meshes.push(m); });
  for (let round = 0; round < 2; round++) {
    const hits = [];
    for (let n = 0; n < 16; n++) {
      const a = n / 16 * Math.PI * 2, dir = side.clone().multiplyScalar(Math.cos(a)).add(up2.clone().multiplyScalar(Math.sin(a)));
      rc.set(at.clone().add(dir.clone().multiplyScalar(0.05)), dir.clone().negate()); rc.far = 0.05;
      const h = rc.intersectObjects(meshes, false)[0];
      // Only near hits: a lever or switch caught first lies further out.
      if (h && h.distance > 0.022) hits.push(h.point);
    }
    if (hits.length < 8) return 0.017;
    const c = new THREE.Vector3(); hits.forEach(p => c.add(p)); c.divideScalar(hits.length);
    const d = c.clone().sub(at); at.add(d.sub(out.clone().multiplyScalar(d.dot(out))));
    if (round === 1) {
      const r = hits.map(p => { const v = p.clone().sub(at); return v.sub(out.clone().multiplyScalar(v.dot(out))).length(); }).sort((x, y) => x - y);
      return Math.min(0.025, Math.max(0.012, r[Math.floor(r.length / 2)]));
    }
  }
}

// An animator's grip: a hand holding a motorcycle grip, taken from a rigged rider ("Animated Supermodel
// Riding Motorcycle Loop" by LasquetiSpice, CC BY): each finger joint's direction, and the grip's line,
// in a frame made from the hand itself (wrist, knuckles), so it fits any rig.
let GRIP = null;
// The circle through three points: its centre and radius, or null if they're in a line.
function circle(A, B, C) {
  const ab = B.clone().sub(A), ac = C.clone().sub(A), n = new THREE.Vector3().crossVectors(ab, ac), n2 = n.lengthSq();
  if (n2 < 1e-12) return null;
  const cc = new THREE.Vector3().crossVectors(n, ab).multiplyScalar(ac.lengthSq()).add(new THREE.Vector3().crossVectors(ac, n).multiplyScalar(ab.lengthSq())).divideScalar(2 * n2);
  return { c: A.clone().add(cc), r: cc.length() };
}
const handFrame = (wrist, ind, mid, pin) => {
  const x = ind.clone().sub(pin).normalize();
  const y = mid.clone().sub(wrist); y.sub(x.clone().multiplyScalar(y.dot(x))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return { o: wrist.clone(), x, y, z, len: mid.distanceTo(wrist), to: v => new THREE.Vector3(v.dot(x), v.dot(y), v.dot(z)), from: v => x.clone().multiplyScalar(v.x).add(y.clone().multiplyScalar(v.y)).add(z.clone().multiplyScalar(v.z)) };
};
const tipBone = c => c[c.length - 1].children.find(x => x.isBone);
// Where a finger's tip is: its end bone, or, in a rig without one, one more segment carrying on
// the finger's curve (turned from the last segment as the last was from the one before).
const tipPos = c => {
  const e = tipBone(c); if (e) return wpos(e);
  const n = c.length, p2 = wpos(c[n - 1]), p1 = wpos(c[n - 2]), p0 = n > 2 ? wpos(c[n - 3]) : null;
  const d2 = p2.clone().sub(p1);
  if (!p0) return p2.clone().add(d2.multiplyScalar(0.8));
  const d1 = p1.clone().sub(p0).normalize(), q = new THREE.Quaternion().setFromUnitVectors(d1, d2.clone().normalize());
  return p2.clone().add(d2.applyQuaternion(q).multiplyScalar(0.8));
};
export async function loadGrip(url) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gl = await new GLTFLoader().loadAsync(url);
  if (gl.animations[0]) { const mx = new THREE.AnimationMixer(gl.scene); mx.clipAction(gl.animations[0]).play(); mx.setTime(0); }
  gl.scene.updateMatrixWorld(true);
  const solid = []; gl.scene.traverse(m => { if (m.isMesh && !m.isSkinnedMesh) solid.push(m); });
  GRIP = {};
  for (const s of ['l', 'r']) {
    const hb = bones(gl.scene)['hand_' + s], f = fingers(gl.scene, s);
    const F = handFrame(wpos(hb), wpos(f.ind[0]), wpos(f.mid[0]), wpos(f.pin[0]));
    const dirs = {};
    for (const k of ['thu', 'ind', 'mid', 'rin', 'pin']) {
      const c = f[k].filter(Boolean), e = tipBone(c), pts = c.concat(e ? [e] : []).map(wpos);
      dirs[k] = pts.slice(1).map((p, n) => F.to(p.clone().sub(pts[n]).normalize()));
    }
    // The grip runs through the fist's hole: the line through the centres of the four fingers' loops
    // (each the circle through a finger's middle joint, end joint and tip).
    const loops = ['ind', 'mid', 'rin', 'pin'].map(k => { const c = f[k].filter(Boolean); return circle(wpos(c[1]), wpos(c[2]), tipPos(c)); }).filter(Boolean);
    const c = new THREE.Vector3(); loops.forEach(L => c.add(L.c)); c.divideScalar(loops.length || 1);
    const a = loops[0].c.clone().sub(loops[loops.length - 1].c).normalize();
    const near = loops;
    GRIP[s] = { dirs, centre: F.to(c.clone().sub(F.o)).divideScalar(F.len), axis: F.to(a), n: near.length, r: loops.reduce((t, L) => t + L.r, 0) / loops.length / F.len };
  }
  return GRIP;
}

function clasp(root, b, s, grip, pole, out, fwd, up, R = 0.017, ends = null) {
  (globalThis.CLASP_GRIPS = globalThis.CLASP_GRIPS || []).push({ root, grip, out: out.clone(), R, ends });
  const f = fingers(root, s), hand = b['hand_' + s], G = GRIP && GRIP[s];
  if (!G || ['thu', 'ind', 'mid', 'rin', 'pin'].some(k => !f[k] || !f[k][0] || !f[k][1])) return;
  const flat = v => v.sub(out.clone().multiplyScalar(v.dot(out))).normalize();
  const inward = out.clone().negate();
  const onTop = flat(up.clone().multiplyScalar(0.8).sub(fwd.clone().multiplyScalar(0.6)));
  ik(b['upperarm_' + s], b['lowerarm_' + s], hand, grip, pole);
  // 1. The animator's finger shape: each segment turned to its direction in the hand's frame.
  const frame = () => handFrame(wpos(hand), wpos(f.ind[0]), wpos(f.mid[0]), wpos(f.pin[0]));
  const shape = () => {
    const F = frame();
    for (const k of ['thu', 'ind', 'mid', 'rin', 'pin']) {
      const c = f[k].filter(Boolean), e = tipBone(c), seq = c.concat(e ? [e] : []);
      for (let n = 0; n < seq.length - 1 && n < G.dirs[k].length; n++) {
        const at = wpos(seq[n]), len = at.distanceTo(wpos(seq[n + 1]));
        aim(seq[n], seq[n + 1], at.add(F.from(G.dirs[k][n]).multiplyScalar(len)));
      }
      // No end bone to aim the last joint by: bend it by the animator's angle between the last two segments.
      const n = c.length - 1, d = G.dirs[k];
      if (!e && n >= 1 && d.length > n) {
        const q = new THREE.Quaternion().setFromUnitVectors(F.from(d[n - 1]).normalize(), F.from(d[n]).normalize());
        const last = c[n]; last.parent.updateWorldMatrix(true, false);
        const wq = q.multiply(last.getWorldQuaternion(new THREE.Quaternion()));
        last.quaternion.copy(last.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq)); last.updateWorldMatrix(false, true);
      }
    }
  };
  shape();
  // 2. The animator held a thicker grip: close all four fingers a little more, together, in the same
  // shares at each joint, until their loops fit ours (a finger's bones run about 9 mm in from its skin).
  const four = ['ind', 'mid', 'rin', 'pin'].map(k => f[k].filter(Boolean));
  const loops = () => four.map(c => circle(wpos(c[1]), wpos(c[2]), tipPos(c)));
  const posed = four.map(c => c.map(j => j.quaternion.clone()));
  const close = k => {
    four.forEach((c, i) => c.forEach((j, n) => j.quaternion.copy(posed[i][n])));
    const F = frame();
    four.forEach(c => c.forEach((j, n) => {
      // Towards the palm: whichever way about the knuckle line brings the fingertip nearer the palm's middle.
      const tip = () => tipPos(c);
      const palmPt = F.o.clone().add(F.y.clone().multiplyScalar(F.len * 0.5));
      const d0 = tip().distanceTo(palmPt); turn(j, F.x, 0.05); const sg = tip().distanceTo(palmPt) < d0 ? 1 : -1; turn(j, F.x, -0.05);
      turn(j, F.x, sg * k * [1, 1.15, 0.75][n]);
    }));
  };
  // 3. The fist's hole runs along the line through the loops' centres: turn the whole hand so that
  // line runs along the grip (index finger inward), the knuckles on top.
  const setWorldQ = (bone, q) => { bone.parent.updateWorldMatrix(true, false); bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q)); bone.updateWorldMatrix(false, true); };
  const hole = () => {
    const L = loops(), ok = L.filter(Boolean);
    const c = new THREE.Vector3(); ok.forEach(x => c.add(x.c)); c.divideScalar(ok.length || 1);
    const a = (L[0] || { c: wpos(four[0][0]) }).c.clone().sub((L[3] || { c: wpos(four[3][0]) }).c).normalize();
    return { c, a };
  };
  const align = () => {
    for (let n = 0; n < 2; n++) {
      setWorldQ(hand, new THREE.Quaternion().setFromUnitVectors(hole().a, inward).multiply(hand.getWorldQuaternion(new THREE.Quaternion())));
      const kn = flat(wpos(f.mid[0]).sub(hole().c));
      const roll = Math.atan2(inward.dot(new THREE.Vector3().crossVectors(kn, onTop)), kn.dot(onTop));
      setWorldQ(hand, new THREE.Quaternion().setFromAxisAngle(inward, roll).multiply(hand.getWorldQuaternion(new THREE.Quaternion())));
    }
  };
  // 4. Fit by the skin. Seen end-on along the grip, the palm and fingers (all four, every bone) leave
  // a hole; the biggest circle that fits in it is where the grip goes. Close or open the fingers,
  // together, until that circle is just bigger than the grip.
  const tris = handTriangles(root, four, hand);
  if (globalThis.CLASP_DEBUG && tris.length) { const [m, i] = tris[0]; root.updateMatrixWorld(true); const v = m.getVertexPosition(i, new THREE.Vector3()); console.error('vertex', root.name, m.bindMode, 'local->world dist to hand', (v.clone().applyMatrix4(m.matrixWorld).distanceTo(wpos(hand)) * 1000).toFixed(0), 'raw dist', (v.distanceTo(wpos(hand)) * 1000).toFixed(0), 'mesh scale', m.matrixWorld.getMaxScaleOnAxis().toFixed(3)); }
  if (globalThis.CLASP_DEBUG) { let sk = 0, nm = []; root.traverse(m => { if (m.isSkinnedMesh) { sk++; nm.push(m.name + (m.visible ? '' : '(hidden)') + ':' + m.skeleton.bones.includes(hand)); } }); console.error('tris', root.name, s, tris.length, 'hand', hand.name, 'meshes', nm.join(' ')); }
  const e1 = onTop.clone(), e2 = new THREE.Vector3().crossVectors(out, onTop).normalize();
  const fit = () => {
    root.updateMatrixWorld(true);
    const h = hole();
    const a0 = wpos(f.ind[0]).sub(h.c).dot(out), a1 = wpos(f.pin[0]).sub(h.c).dot(out);
    const lo = Math.min(a0, a1) - 0.03, hi = Math.max(a0, a1) + 0.03;   // the whole hand: the heel and the thumb's root reach past the fingers
    const at = new Map(), P = (m, i) => { const k = m.id + ':' + i; let v = at.get(k); if (!v) { const w = m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld).sub(h.c); v = [w.dot(e1), w.dot(e2), w.dot(out)]; at.set(k, v); } return v; };
    const tri2 = [];
    for (const [m, a, bb, c] of tris) { const A = P(m, a), B = P(m, bb), C = P(m, c); if (Math.max(A[2], B[2], C[2]) < lo || Math.min(A[2], B[2], C[2]) > hi) continue; tri2.push([A, B, C]); }
    const segD = (x, y, A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], l = dx * dx + dy * dy; let t = l ? ((x - A[0]) * dx + (y - A[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - A[0] - t * dx, y - A[1] - t * dy); };
    const inTri = (x, y, A, B, C) => { const d1 = (x - B[0]) * (A[1] - B[1]) - (A[0] - B[0]) * (y - B[1]), d2 = (x - C[0]) * (B[1] - C[1]) - (B[0] - C[0]) * (y - C[1]), d3 = (x - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (y - A[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    let best = [0, 0], bestR = -1;
    // Only near the middle of the fingers' own curl: the grip goes through the fingers, not into a
    // gap beside them (between the fist and the thumb, say).
    const W2 = globalThis.CLASP_WIN ?? 0.02;
    // A spot counts only if the hand closes round it: skin within a centimetre of the circle there on
    // at least 60% of the way round (36 bins of 10°).
    const verts = []; for (const [A, B, C] of tri2) verts.push(A, B, C);
    const enclosed = (x, y, r) => {
      const bins = new Uint8Array(36);
      for (const V of verts) { const dx = V[0] - x, dy = V[1] - y, d = Math.hypot(dx, dy); if (d < r + 0.01) bins[Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 36) % 36] = 1; }
      let n = 0; for (const v of bins) n += v; return n >= 22;
    };
    for (let x = -W2; x <= W2; x += 0.0015) for (let y = -W2; y <= W2; y += 0.0015) {
      let r = Infinity;
      for (const [A, B, C] of tri2) { if (inTri(x, y, A, B, C)) { r = 0; break; } r = Math.min(r, segD(x, y, A, B), segD(x, y, B, C), segD(x, y, C, A)); if (r <= bestR) break; }
      if (r > bestR && enclosed(x, y, r)) { bestR = r; best = [x, y]; }
    }
    // Refine around the best.
    const b0 = best.slice();
    for (let x = b0[0] - 0.0015; x <= b0[0] + 0.0015; x += 0.0003) for (let y = b0[1] - 0.0015; y <= b0[1] + 0.0015; y += 0.0003) {
      let r = Infinity;
      for (const [A, B, C] of tri2) { if (inTri(x, y, A, B, C)) { r = 0; break; } r = Math.min(r, segD(x, y, A, B), segD(x, y, B, C), segD(x, y, C, A)); if (r <= bestR) break; }
      if (r > bestR && enclosed(x, y, r)) { bestR = r; best = [x, y]; }
    }
    if (globalThis.CLASP_DEBUG && globalThis.FIT_LOG) {
      let ur = -1, ub = [0, 0];
      for (let x = -W2; x <= W2; x += 0.002) for (let y = -W2; y <= W2; y += 0.002) { let r = Infinity; for (const [A, B, C] of tri2) { if (inTri(x, y, A, B, C)) { r = 0; break; } r = Math.min(r, segD(x, y, A, B), segD(x, y, B, C), segD(x, y, C, A)); } if (r > ur) { ur = r; ub = [x, y]; } }
      const bins = new Uint8Array(36); for (const V of verts) { const dx = V[0] - ub[0], dy = V[1] - ub[1], d = Math.hypot(dx, dy); if (d < ur + 0.01) bins[Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 36) % 36] = 1; }
      console.error('fit', root.name, s, 'tris', tri2.length, 'free best r', (ur * 1000).toFixed(1), 'at', ub.map(v => (v * 1000).toFixed(0)).join(','), 'cover', bins.reduce((t, v) => t + v, 0), 'enclosed best', (bestR * 1000).toFixed(1));
    }
    return { r: bestR, at: h.c.clone().add(e1.clone().multiplyScalar(best[0])).add(e2.clone().multiplyScalar(best[1])) };
  };
  const snug = R + 0.001;
  if (globalThis.CLASP_DEBUG) { globalThis.FIT_LOG = 1; close(0); align(); fit(); close(0.5); align(); fit(); globalThis.FIT_LOG = 0; }
  // The tightest curl whose enclosed hole still takes the grip (opening the fingers too far loses
  // the enclosure, so this is a scan, not a halving search), then refined between its neighbours.
  let klo = null, khi = 0.8;
  let roomiest = [0, -1];
  for (let k = 0.8; k >= -1.0; k -= 0.05) { close(k); align(); const r = fit().r; if (r > roomiest[1]) roomiest = [k, r]; if (r > snug) { klo = k; break; } khi = k; }
  if (klo === null) klo = roomiest[0];
  else for (let n = 0; n < 5; n++) { const k = (klo + khi) / 2; close(k); align(); if (fit().r > snug) klo = k; else khi = k; }
  close(klo); align();
  const spot = fit();
  // 5. Move the hand so the grip runs through that circle, its middle on the grip point; the arm
  // follows and the hand keeps its turn.
  const handQ = hand.getWorldQuaternion(new THREE.Quaternion());
  const target = wpos(hand).add(grip.clone().sub(spot.at));
  const goal = target.clone();
  for (let n = 0; n < 6; n++) {
    ik(b['upperarm_' + s], b['lowerarm_' + s], hand, target, pole);
    setWorldQ(hand, handQ);
    target.add(goal.clone().sub(wpos(hand)));
  }
  const meanR = () => spot.r, want = snug;
  if ((globalThis.CLASP_STOP || 99) < 5) return;
  // 5a. All four fingers on the grip itself, between the switch block and the bar end: slide the
  // hand along the grip until no finger's skin lies past either end (the little finger may reach
  // the bar end's lip); if the hand is wider than the grip, centre it.
  let slid = 0;
  if (ends) {
    const fingersSkin = fingerSkin(root, four, null, false);
    const extent = () => { root.updateMatrixWorld(true); let lo = Infinity, hi = -Infinity; for (const [m, i] of fingersSkin) { const a = m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld).sub(grip).dot(out); lo = Math.min(lo, a); hi = Math.max(hi, a); } return [lo, hi]; };
    const [lo, hi] = extent(), inner = ends[0] + 0.003, outer = ends[1] + 0.006;
    slid = hi - lo > outer - inner ? (inner + outer) / 2 - (lo + hi) / 2 : lo < inner ? inner - lo : hi > outer ? outer - hi : 0;
    if (slid) {
      goal.add(out.clone().multiplyScalar(slid)); target.copy(goal);
      for (let n = 0; n < 6; n++) { ik(b['upperarm_' + s], b['lowerarm_' + s], hand, target, pole); setWorldQ(hand, handQ); target.add(goal.clone().sub(wpos(hand))); }
    }
    if (globalThis.CLASP_DEBUG) { const e2 = extent(); console.error('along', root.name, s, 'grip', (ends[0] * 1000).toFixed(0) + '..' + (ends[1] * 1000).toFixed(0), 'fingers', (lo * 1000).toFixed(0) + '..' + (hi * 1000).toFixed(0), 'slid', (slid * 1000).toFixed(0), 'now', (e2[0] * 1000).toFixed(0) + '..' + (e2[1] * 1000).toFixed(0)); }
  }
  if (globalThis.CLASP_DEBUG) console.error('reach', root.name, s, 'hand off', (wpos(hand).distanceTo(goal) * 1000).toFixed(0) + 'mm', 'shoulder to grip', (wpos(b['upperarm_' + s]).distanceTo(grip) * 1000).toFixed(0) + 'mm', 'arm', ((wpos(b['upperarm_' + s]).distanceTo(wpos(b['lowerarm_' + s])) + wpos(b['lowerarm_' + s]).distanceTo(wpos(hand))) * 1000).toFixed(0) + 'mm', 'fit r', (spot.r * 1000).toFixed(1), 'k', klo.toFixed(2));
  if ((globalThis.CLASP_STOP || 99) < 6) return;
  // 5b. Fingers side by side: a grip is held with the fingers touching. Each finger's skin is kept
  // about half a millimetre from its neighbour's: the index, ring and little fingers swing sideways
  // at their base knuckle (about the back of the hand's normal) towards the middle finger, each
  // after the one nearer it has settled, no more than 0.25 rad.
  const sideGap = (A, B) => {
    root.updateMatrixWorld(true);
    const P = pts => pts.map(([m, i]) => m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld));
    const a = P(A), bb = P(B); let d = Infinity;
    for (const p of a) for (const q of bb) { const x = p.distanceToSquared(q); if (x < d) d = x; }
    return Math.sqrt(d);
  };
  const thin = pts => pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 160)) === 0);
  const fSkin = four.map(c => thin(fingerSkin(root, [[c[1]]], null, true)));
  const gripGap = pts => { root.updateMatrixWorld(true); let m = Infinity; for (const [mm, i] of pts) { const v = mm.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mm.matrixWorld).sub(grip); m = Math.min(m, v.sub(out.clone().multiplyScalar(v.dot(out))).length()); } return m - R; };
  const wholeSkin = four.map(c => thin(fingerSkin(root, [c], null, true)));
  const sideBefore = [sideGap(fSkin[0], fSkin[1]), sideGap(fSkin[1], fSkin[2]), sideGap(fSkin[2], fSkin[3])];
  const normalAt = () => new THREE.Vector3().crossVectors(wpos(f.mid[0]).sub(wpos(hand)), wpos(f.ind[0]).sub(wpos(f.pin[0]))).normalize();
  const closeSides = () => { if (!globalThis.CLASP_NOSIDE) for (const [i, nb] of [[0, 1], [2, 1], [3, 2]]) {
    const c = four[i], q0 = c[0].quaternion.clone(), nrm = normalAt();
    const kx = wpos(f.ind[0]).sub(wpos(f.pin[0])).normalize();
    const at = (t, u = 0) => { c[0].quaternion.copy(q0); turn(c[0], nrm, t); if (u) turn(c[0], kx, u); };
    // Search the swing both ways for the turn that brings it to rest against its neighbour
    // (0.4–0.8 mm), the smallest turn that does; if none does, the one that comes closest.
    // The knuckle may also tilt a little up or down, so a finger sitting lower round the grip than
    // its neighbour can meet it rather than slide past.
    const g0in = gripGap(wholeSkin[i]);
    let best = [0, 0], bestS = Infinity;
    for (let u = -0.2; u <= 0.2001; u += 0.05) for (let t = -0.45; t <= 0.4501; t += 0.015) {
      at(t, u); const g = sideGap(fSkin[i], fSkin[nb]);
      if (gripGap(wholeSkin[i]) < Math.min(0.0002, g0in)) continue;   // never into the grip
      const sc = (g < 0.0004 ? 1 + (0.0004 - g) * 1000 : Math.max(0, g - 0.0008) * 100) + Math.abs(t) * 0.01 + Math.abs(u) * 0.02;
      if (sc < bestS) { bestS = sc; best = [t, u]; }
    }
    at(best[0], best[1]);
  } };
  closeSides();
  const sideAfter = [sideGap(fSkin[0], fSkin[1]), sideGap(fSkin[1], fSkin[2]), sideGap(fSkin[2], fSkin[3])];
  if (globalThis.CLASP_DEBUG) console.error('side', root.name, s, 'before', sideBefore.map(x => (x * 1000).toFixed(1)).join('/'), 'after', sideAfter.map(x => (x * 1000).toFixed(1)).join('/'));
  if ((globalThis.CLASP_STOP || 99) < 7) return;
  // 6. Each finger closes the rest of the way on its own until its skin rests on the grip (within
  // half a millimetre), the end joints most, as fingers tighten round a bar.
  const gap = pts => { root.updateMatrixWorld(true); let m = Infinity; for (const [mm, i] of pts) { const v = mm.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mm.matrixWorld).sub(grip); m = Math.min(m, v.sub(out.clone().multiplyScalar(v.dot(out))).length()); } return m - R; };
  const kax = () => wpos(f.ind[0]).sub(wpos(f.pin[0])).normalize();
  const tipSkins = four.map(c => fingerSkin(root, [[c[1]]], null, true));
  const fullSkins = four.map(c => thin(fingerSkin(root, [c], null, true)));
  const handSkin = fingerSkin(root, four, hand, true);
  const fitted = four.map(c => c.map(j => j.quaternion.clone()));
  const settle = () => {
    const gaps = [];
    for (const [i, c] of four.entries()) {
      c.forEach((j, n) => j.quaternion.copy(fitted[i][n]));
      const tipSkin = tipSkins[i], base = c.map(j => j.quaternion.clone());
      const palmPt = wpos(hand).lerp(wpos(f.mid[0]), 0.5), tip = () => tipPos(c);
      const sg = (() => { const d0 = tip().distanceTo(palmPt); turn(c[1], kax(), 0.05); const r = tip().distanceTo(palmPt) < d0 ? 1 : -1; turn(c[1], kax(), -0.05); return r; })();
      const bend = t => { c.forEach((j, n) => j.quaternion.copy(base[n])); const ax = kax(); c.forEach((j, n) => turn(j, ax, sg * t * [0.25, 1, 0.8][n])); };
      if (gap(tipSkin) > 0.0005) {
        // Step the bend up to the first touch (bending on past it would curl the finger back into
        // the palm, away from the grip again), then home in on it; if it never touches, keep the
        // bend that came closest.
        let lo = 0, hi = null, bestT = 0, bestG = gap(tipSkin);
        for (let t = 0.05; t <= 1.8; t += 0.05) { bend(t); const g = gap(tipSkin); if (g <= 0.0005 || gap(fullSkins[i]) < 0.0002) { hi = t; break; } if (g < bestG) { bestG = g; bestT = t; } lo = t; }
        if (hi !== null) { for (let n = 0; n < 8; n++) { const t = (lo + hi) / 2; bend(t); if (gap(tipSkin) > 0.0005 && gap(fullSkins[i]) >= 0.0002) lo = t; else hi = t; } bend(lo); }
        else bend(bestT);
      } else if (gap(tipSkin) < 0.0005) {
        // Already sinking in: open it, a step at a time, until it rests on the grip.
        let t = 0;
        while (t > -1.2 && gap(tipSkin) < 0.0005) { t -= 0.03; bend(t); }
      }
      gaps.push(gap(tipSkin));
    }
    return gaps;
  };
  // Wrap each finger round the grip segment by segment, about the hand's own knuckle hinge (so the
  // fingers stay parallel): the base joint bends until the first segment's skin rests on the grip,
  // then the middle joint until the middle segment does, then the end joint until the tip does.
  // Each segment lies on the grip, so the fingers go over, down the front and round underneath.
  const segSkin = bone => { const out2 = []; root.traverse(m => { if (!m.isSkinnedMesh || !m.visible) return; const bi = m.skeleton.bones.indexOf(bone); if (bi < 0) return; const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; for (let v = 0; v < si.count; v++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === bi) w += sw.getComponent(v, k); if (w > 0.5) out2.push([m, v]); } }); return thin(out2); };
  const wrapAll = () => { const wrapGaps = [];
  for (const [i, c] of four.entries()) {
    for (let n = 0; n < 3; n++) {
      const j = c[n], below = c.slice(n).map(segSkin).flat(), seg = segSkin(j);
      const palmPt = wpos(hand).lerp(wpos(f.mid[0]), 0.5), tip = () => tipPos(c);
      const ax = kax(), q0 = j.quaternion.clone();
      const sg = (() => { const d0 = tip().distanceTo(palmPt); turn(j, ax, 0.05); const r = tip().distanceTo(palmPt) < d0 ? 1 : -1; j.quaternion.copy(q0); j.updateWorldMatrix(false, true); return r; })();
      const at = t => { j.quaternion.copy(q0); j.updateWorldMatrix(false, true); turn(j, ax, sg * t); };
      // Bend in until this segment touches, or open if anything from here on is already inside.
      let t = 0;
      if (gap(below) < 0.0003) { while (t > -0.6 && gap(below) < 0.0003) { t -= 0.02; at(t); } }
      else { while (t < 1.7) { at(t + 0.02); if (gap(seg) <= 0.0005 || gap(below) < 0.0003) { at(t); break; } t += 0.02; } }
    }
    wrapGaps.push(gap(fullSkins[i]));
  }
  return wrapGaps; };
  wrapAll(); closeSides();
  let gapsNow = wrapAll(), best = [null, 0];
  const gaps = Object.fromEntries(['ind', 'mid', 'rin', 'pin'].map((k, i) => [k, gapsNow[i]]));
  if (globalThis.CLASP_DEBUG) console.error('final side', root.name, s, [sideGap(fSkin[0], fSkin[1]), sideGap(fSkin[1], fSkin[2]), sideGap(fSkin[2], fSkin[3])].map(x => (x * 1000).toFixed(1)).join('/'));
  if ((globalThis.CLASP_STOP || 99) < 8) return;
  // 7. The thumb wraps round the grip from the inner side and underneath, its tip resting across the
  // index finger's middle segment, as in a power grip (and as in the owner's photos). Its joints
  // bend, base to tip, a little at a time, to bring the tip there (cyclic coordinate descent); if its
  // skin would sink into the grip or the index finger, the spot moves out a little and it tries again.
  let thumbGap = null, thumbStart = null, thumbMiss = null;
  const palmBeforeThumb = globalThis.CLASP_DEBUG ? (() => { root.updateMatrixWorld(true); return gap(thin(fingerSkin(root, [], hand, true))); })() : null;
  const tipAt = () => tipPos(f.thu.filter(Boolean));
  if (!globalThis.CLASP_NOTHUMB && f.thu && f.thu[1] && f.thu[2]) {
    const tb = f.thu.filter(Boolean);
    const thumbSkin = thin(fingerSkin(root, [tb.slice(1)], null, true));
    const indexSkin = thin(fingerSkin(root, [four[0]], null, true));
    thumbStart = gap(thumbSkin);
    const rest = tb.map(j => j.quaternion.clone());
    if (globalThis.CLASP_DEBUG) { const ax = p => { const v = p.clone().sub(grip); return [v.sub(out.clone().multiplyScalar(v.dot(out))).length(), p.clone().sub(grip).dot(out)]; }; console.error('thumbjoints', root.name, s, tb.map(j => ax(wpos(j)).map(x => (x * 1000).toFixed(0)).join('@')).join(' '), 'R', (R * 1000).toFixed(1), 'ends', ends ? ends.map(e => (e * 1000).toFixed(0)).join('..') : '-'); }
    const rotWorld = (j, q) => { const wq = q.multiply(j.getWorldQuaternion(new THREE.Quaternion())); j.parent.updateWorldMatrix(true, false); j.quaternion.copy(j.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq)); j.updateWorldMatrix(false, true); };
    // The index finger's middle segment, seen from the grip's line: the thumb crosses it on the outside.
    const seg = wpos(four[0][2]).lerp(tipPos(four[0]), +(globalThis.CLASP_THUMBAT ?? 0.2));
    const radial = seg.clone().sub(grip); radial.sub(out.clone().multiplyScalar(radial.dot(out)));
    const rad0 = radial.length(); radial.normalize();
    const along = seg.clone().sub(grip).dot(out);
    // CCD: bring `end()` to `to` by turning `joints`, a little at a time, the base least.
    const ccd = (joints, end, to, iters = 30) => {
      for (let it = 0; it < iters; it++) for (const j of joints.slice().reverse()) {
        const J = wpos(j), a = end().sub(J).normalize(), bq = to.clone().sub(J).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(a, bq);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w))), cap = j === tb[0] ? 0.08 : 0.15;
        if (ang > cap) q.slerp(new THREE.Quaternion(), 1 - cap / ang);
        rotWorld(j, q);
      }
    };
    // The thumb goes round the grip, not through it: its middle (interphalangeal) joint is put on the
    // grip's surface (radius plus half a thumb) somewhere round it, then the tip curls on to the
    // spot under the index finger. Every place round the grip is tried; the one that keeps the thumb
    // out of the grip and the index finger and brings the tip nearest wins.
    // Under the grip, a little to the front, beside the index finger: the thumb closes the fist from below.
    const underDir = up.clone().negate().sub(out.clone().multiplyScalar(-up.dot(out))).normalize();
    const frontDir = new THREE.Vector3().crossVectors(out, underDir).normalize(); if (frontDir.dot(fwd) < 0) frontDir.negate();
    const goal2 = grip.clone().add(out.clone().multiplyScalar(along)).add(underDir.clone().multiplyScalar(R + 0.0075).applyAxisAngle(out, 0).add(frontDir.clone().multiplyScalar(0.006)));
    // All three joints together: small random turns (seeded, so the pose is the same every time),
    // each kept only if it scores better: the tip nearer its spot, no thumb skin inside the grip or
    // the index finger, and not far from the animator's thumb. The turns shrink as it settles.
    const thumbAll = thin(fingerSkin(root, [tb], null, true));
    // The skin at the thumb's root hangs partly from the thumb, so moving the thumb moves it too: the
    // palm (anything the hand bone carries much of) counts as the thumb's for staying out of the grip.
    const palmAll = (() => { const out2 = []; root.traverse(m => { if (!m.isSkinnedMesh || !m.visible) return; const hi = m.skeleton.bones.indexOf(hand); if (hi < 0) return; const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; for (let v = 0; v < si.count; v++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === hi) w += sw.getComponent(v, k); if (w > 0.25) out2.push([m, v]); } }); return thin(out2); })();
    const palm0 = gap(palmAll);
    const devOf = () => tb.reduce((t, j, n) => t + 2 * Math.acos(Math.min(1, Math.abs(j.quaternion.dot(rest[n])))), 0);
    const score = () => {
      const g1 = Math.min(gap(thumbAll), gap(palmAll) + 0.0015 - Math.min(0, palm0)), g2 = sideGap(thumbSkin, indexSkin), miss = tipAt().distanceTo(goal2);
      // Round underneath, not over the top: the thumb's middle joint below the grip's middle.
      const ipLow = wpos(tb[2]).sub(grip).dot(underDir);
      return [miss + Math.max(0, 0.0003 - g1) * 40 + Math.max(0, 0.0003 - g2) * 40 + Math.max(0, g1 - 0.0008) * 0.5 + Math.max(0, R * 0.5 - ipLow) * 3 + devOf() * 0.002, miss, g1, g2];
    };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Several starts: the animator's thumb, and its base swung round the grip either way.
    let bestStart = null, bestStartSc = Infinity;
    for (const a0 of [0, 0.5, -0.5, 1.0, -1.0]) {
      tb.forEach((j, n) => j.quaternion.copy(rest[n]));
      if (a0) rotWorld(tb[0], new THREE.Quaternion().setFromAxisAngle(out, a0));
      const sc = score()[0]; if (sc < bestStartSc) { bestStartSc = sc; bestStart = tb.map(j => j.quaternion.clone()); }
    }
    tb.forEach((j, n) => j.quaternion.copy(bestStart[n])); tb.forEach(j => j.updateWorldMatrix(false, true));
    let cur = score();
    for (let it = 0; it < 1500; it++) {
      const step = 0.35 * Math.pow(0.02 / 0.35, it / 1500);
      const j = tb[Math.floor(rnd() * tb.length)], q0 = j.quaternion.clone();
      const ax = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      rotWorld(j, new THREE.Quaternion().setFromAxisAngle(ax, (rnd() * 2 - 1) * step));
      const sc = score();
      if (sc[0] < cur[0]) cur = sc; else { j.quaternion.copy(q0); j.updateWorldMatrix(false, true); }
    }
    const bestPose = tb.map(j => j.quaternion.clone()), bestInfo = [0, cur[1], cur[2], cur[3], 0];
    tb.forEach((j, n) => j.quaternion.copy(bestPose[n])); tb.forEach(j => j.updateWorldMatrix(false, true));
    thumbMiss = bestInfo[1];
    const lift = 0;
    if (globalThis.CLASP_DEBUG) console.error('thumbbest', root.name, s, 'angle', (bestInfo[0] * 57.3).toFixed(0) + '/' + (bestInfo[4] * 57.3).toFixed(0), 'miss', (bestInfo[1] * 1000).toFixed(1), 'grip', (bestInfo[2] * 1000).toFixed(1), 'index', (bestInfo[3] * 1000).toFixed(1));
    thumbGap = gap(thumbSkin);
    if (globalThis.CLASP_DEBUG) { const t = tipAt().sub(grip); console.error('thumb', root.name, s, 'tip up', (t.dot(onTop) * 1000).toFixed(0) + 'mm', 'along', (t.dot(out) * 1000).toFixed(0) + 'mm', 'miss', (thumbMiss * 1000).toFixed(1) + 'mm', 'lift', (lift * 1000).toFixed(0), 'to index', (sideGap(thumbSkin, indexSkin) * 1000).toFixed(1)); }
  }
  if (globalThis.CLASP_DEBUG) console.error('pen', root.name, s, 'palm before thumb', palmBeforeThumb === null ? '-' : (palmBeforeThumb * 1000).toFixed(1), wholeSkin.map(w => (gripGap(w) * 1000).toFixed(1)).join('/'), 'palm', (gripGap(thin(fingerSkin(root, [], hand, true))) * 1000).toFixed(1));
  if (globalThis.CLASP_DEBUG) console.error('contact', root.name, (root.parent && root.parent.name) || '', s, 'tilt', (best ? best[1] : 0).toFixed(2), 'palm gap', (gap(handSkin) * 1000).toFixed(1), Object.entries(gaps).map(([k, v]) => k + ' ' + (v * 1000).toFixed(1) + 'mm').join(' '), 'thumb', thumbGap === null ? '-' : (thumbGap * 1000).toFixed(1) + 'mm', 'thumb before', thumbStart === null ? '-' : (thumbStart * 1000).toFixed(1) + 'mm');
  if (globalThis.CLASP_DEBUG) {
    console.error('placed', s, 'fit r', (meanR() * 1000).toFixed(1), 'want', (want * 1000).toFixed(1), 'hand off target', (wpos(hand).distanceTo(goal) * 1000).toFixed(1) + 'mm', 'k', klo.toFixed(2));
    gripReport(root, s, ['ind', 'mid', 'rin', 'pin'].map(k => f[k]), grip, out, onTop, R, wpos(f.ind[0]), wpos(f.pin[0]));
  }
}

// How well a hand holds a grip, for checking by eye in the log: what share of the grip, across the
// hand's width, has finger skin wrapped round its front and underneath (no gaps between fingers), and
// how deep any skin sinks into the grip.
function gripReport(root, s, four, grip, out, onTop, R, indK, pinK) {
  const skin = fingerSkin(root, four, null, true);
  root.updateMatrixWorld(true);
  const pts = skin.map(([m, i]) => m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld).sub(grip));
  const a0 = indK.clone().sub(grip).dot(out), a1 = pinK.clone().sub(grip).dot(out);
  const lo = Math.min(a0, a1) + 0.004, hi = Math.max(a0, a1) - 0.004;
  let slices = 0, covered = 0, deepest = 0;
  for (let a = lo; a <= hi; a += 0.002) {
    slices++;
    const near = pts.filter(p => Math.abs(p.dot(out) - a) < 0.0015);
    // Skin in front of and under the grip (away from the knuckles), close to its surface.
    const wrap = near.filter(p => { const v = p.clone().sub(out.clone().multiplyScalar(p.dot(out))); return v.dot(onTop) < 0 && v.length() < R + 0.012; });
    if (wrap.length) covered++;
  }
  let who = '';
  pts.forEach((p, n) => { const v = p.clone().sub(out.clone().multiplyScalar(p.dot(out))); if (R - v.length() > deepest) { deepest = R - v.length(); const [m, i] = skin[n]; const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; let bi = 0, bw = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); bi = si.getComponent(i, k); } who = m.skeleton.bones[bi].name + ' axial ' + (p.dot(out) * 1000).toFixed(0) + 'mm'; } });
  let inside = 0; pts.forEach(p => { const v = p.clone().sub(out.clone().multiplyScalar(p.dot(out))); if (v.length() < R - 0.002) inside++; });
  console.error('deepest at', who, 'points >2mm inside', inside, 'of', pts.length);
  console.error('grip', s, 'covered', covered + '/' + slices, 'deepest into grip', (deepest * 1000).toFixed(1) + 'mm');
}

// The skin triangles of a hand (palm and four fingers, not the thumb): [mesh, a, b, c] vertex indices.
function handTriangles(root, chains, palm) {
  const bonesOf = new Set([palm]); chains.forEach(c => c[0].traverse(b => { if (b.isBone) bonesOf.add(b); }));
  const thumbBones = new Set(); palm.children.forEach(c => { if (/thumb/i.test(c.name)) c.traverse(b => thumbBones.add(b)); });
  const out = [];
  root.traverse(m => {
    if (!m.isSkinnedMesh || !m.visible) return;
    const idx = m.skeleton.bones.map(b => bonesOf.has(b) && !thumbBones.has(b));
    if (!idx.some(Boolean)) return;
    const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    const ok = v => { let w = 0; for (let k = 0; k < 4; k++) if (idx[si.getComponent(v, k)]) w += sw.getComponent(v, k); return w > 0.5; };
    const ix = m.geometry.index, n = ix ? ix.count : si.count;
    for (let t = 0; t < n; t += 3) {
      const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2;
      if (ok(a) && ok(b) && ok(c)) out.push([m, a, b, c]);
    }
  });
  return out;
}

// The vertices of a hand's skin that hang mostly from its fingers: [mesh, index] pairs.
function fingerSkin(root, chains, palm, all) {
  const bonesOf = new Set(); chains.forEach(c => c[0].traverse(b => { if (b.isBone) bonesOf.add(b); }));
  if (palm) bonesOf.add(palm);
  const out = [];
  root.traverse(m => {
    if (!m.isSkinnedMesh || !m.visible) return;
    const hit = new Set(m.skeleton.bones.map((b, i) => bonesOf.has(b) ? i : -1).filter(i => i >= 0));
    if (!hit.size) return;
    const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    for (let v = 0; v < si.count; v += 1) {
      let w = 0; for (let k = 0; k < 4; k++) if (hit.has(si.getComponent(v, k))) w += sw.getComponent(v, k);
      if (w > 0.6) out.push([m, v]);
    }
  });
  // A few hundred points are plenty.
  const step = all ? 1 : Math.max(1, Math.floor(out.length / 400));
  return out.filter((_, i) => i % step === 0);
}

// Put a helmet (front +z, bottom at y 0) on the head, then hang it off the head bone.
export function helmet(b, model, size = 0.31, adj = {}) {
  const H = wpos(b.head);
  let E = b.head_end ? wpos(b.head_end) : null;
  const nd = H.clone().sub(wpos(b.neck)).normalize();
  if (!E || E.distanceTo(H) < 0.08 || E.distanceTo(H) > 0.35 || E.clone().sub(H).normalize().dot(nd) < 0.6) E = H.clone().add(nd.multiplyScalar(0.2));
  let up = E.clone().sub(H); const hl = up.length(); up.normalize();
  if (adj.up) up = adj.up.clone().normalize();
  b.head.updateWorldMatrix(true, false);
  // The face points along the head's own forward axis: find it from the eyes' side of the skull.
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(model.userData.faceQ || b.head.getWorldQuaternion(new THREE.Quaternion()));
  if (b._fwd) fwd.copy(b._fwd);
  fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
  const x = new THREE.Vector3().crossVectors(up, fwd);
  const m = new THREE.Matrix4().makeBasis(x, up, fwd);
  const box = new THREE.Box3().setFromObject(model); const sz = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(size / sz.z);
  model.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(model); const c = b2.getCenter(new THREE.Vector3());
  const holder = new THREE.Group(); holder.add(model); model.position.sub(c);
  holder.quaternion.setFromRotationMatrix(m);
  holder.position.copy(H).add(up.clone().multiplyScalar(adj.lift ?? hl * 0.42)).add(fwd.clone().multiplyScalar(adj.push ?? 0.015));
  b.head.parent.updateWorldMatrix(true, false);
  b.head.attach(holder);
  b._helmet = holder;
  return holder;
}

// Put a weapon in a hand, its long axis (model axis `along`) pointing along world `dir`.
export function hold(b, side, model, dir, along = new THREE.Vector3(1, 0, 0), grip = 0.1) {
  const hand = b['hand_' + side];
  const P = wpos(hand);
  const box = new THREE.Box3().setFromObject(model); const sz = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group(); holder.add(model); model.position.sub(c);
  const len = Math.abs(along.dot(sz));
  // The grip sits at `grip` of the length from one end.
  model.position.add(along.clone().multiplyScalar(len * (0.5 - grip)));
  holder.quaternion.setFromUnitVectors(along, dir.clone().normalize());
  holder.position.copy(P).add(dir.clone().normalize().multiplyScalar(0.04));
  hand.attach(holder);
  return holder;
}
