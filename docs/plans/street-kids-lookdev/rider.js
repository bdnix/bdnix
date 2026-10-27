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
    if (opts.grip !== false && !(opts.hands && opts.hands[s]) && !(opts.handsWorld && opts.handsWorld[s])) clasp(rider, b, s, grip, pole, out, fwd, up, bar ? gripFit(bike, grip, out) : 0.017);
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
    const loops = ['ind', 'mid', 'rin', 'pin'].map(k => { const c = f[k].filter(Boolean), e = tipBone(c); return circle(wpos(c[1]), wpos(c[2]), e ? wpos(e) : wpos(c[2])); }).filter(Boolean);
    const c = new THREE.Vector3(); loops.forEach(L => c.add(L.c)); c.divideScalar(loops.length || 1);
    const a = loops[0].c.clone().sub(loops[loops.length - 1].c).normalize();
    const near = loops;
    GRIP[s] = { dirs, centre: F.to(c.clone().sub(F.o)).divideScalar(F.len), axis: F.to(a), n: near.length, r: loops.reduce((t, L) => t + L.r, 0) / loops.length / F.len };
  }
  return GRIP;
}

function clasp(root, b, s, grip, pole, out, fwd, up, R = 0.017) {
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
    }
  };
  shape();
  // 2. The animator held a thicker grip: close all four fingers a little more, together, in the same
  // shares at each joint, until their loops fit ours (a finger's bones run about 9 mm in from its skin).
  const four = ['ind', 'mid', 'rin', 'pin'].map(k => f[k].filter(Boolean));
  const loops = () => four.map(c => { const e = tipBone(c); return circle(wpos(c[1]), wpos(c[2]), e ? wpos(e) : wpos(c[2])); });
  const posed = four.map(c => c.map(j => j.quaternion.clone()));
  const close = k => {
    four.forEach((c, i) => c.forEach((j, n) => j.quaternion.copy(posed[i][n])));
    const F = frame();
    four.forEach(c => c.forEach((j, n) => {
      // Towards the palm: whichever way about the knuckle line brings the fingertip nearer the palm's middle.
      const e = tipBone(c), tip = () => (e ? wpos(e) : wpos(c[c.length - 1]));
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
  const e1 = onTop.clone(), e2 = new THREE.Vector3().crossVectors(out, onTop).normalize();
  const fit = () => {
    root.updateMatrixWorld(true);
    const h = hole();
    const a0 = wpos(f.ind[0]).sub(h.c).dot(out), a1 = wpos(f.pin[0]).sub(h.c).dot(out);
    const lo = Math.min(a0, a1) - 0.006, hi = Math.max(a0, a1) + 0.006;
    const at = new Map(), P = (m, i) => { const k = m.id + ':' + i; let v = at.get(k); if (!v) { const w = m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld).sub(h.c); v = [w.dot(e1), w.dot(e2), w.dot(out)]; at.set(k, v); } return v; };
    const tri2 = [];
    for (const [m, a, bb, c] of tris) { const A = P(m, a), B = P(m, bb), C = P(m, c); if (Math.max(A[2], B[2], C[2]) < lo || Math.min(A[2], B[2], C[2]) > hi) continue; tri2.push([A, B, C]); }
    const segD = (x, y, A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], l = dx * dx + dy * dy; let t = l ? ((x - A[0]) * dx + (y - A[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - A[0] - t * dx, y - A[1] - t * dy); };
    const inTri = (x, y, A, B, C) => { const d1 = (x - B[0]) * (A[1] - B[1]) - (A[0] - B[0]) * (y - B[1]), d2 = (x - C[0]) * (B[1] - C[1]) - (B[0] - C[0]) * (y - C[1]), d3 = (x - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (y - A[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    let best = [0, 0], bestR = -1;
    for (let x = -0.02; x <= 0.02; x += 0.0015) for (let y = -0.02; y <= 0.02; y += 0.0015) {
      let r = Infinity;
      for (const [A, B, C] of tri2) { if (inTri(x, y, A, B, C)) { r = 0; break; } r = Math.min(r, segD(x, y, A, B), segD(x, y, B, C), segD(x, y, C, A)); if (r <= bestR) break; }
      if (r > bestR) { bestR = r; best = [x, y]; }
    }
    // Refine around the best.
    const b0 = best.slice();
    for (let x = b0[0] - 0.0015; x <= b0[0] + 0.0015; x += 0.0003) for (let y = b0[1] - 0.0015; y <= b0[1] + 0.0015; y += 0.0003) {
      let r = Infinity;
      for (const [A, B, C] of tri2) { if (inTri(x, y, A, B, C)) { r = 0; break; } r = Math.min(r, segD(x, y, A, B), segD(x, y, B, C), segD(x, y, C, A)); if (r <= bestR) break; }
      if (r > bestR) { bestR = r; best = [x, y]; }
    }
    return { r: bestR, at: h.c.clone().add(e1.clone().multiplyScalar(best[0])).add(e2.clone().multiplyScalar(best[1])) };
  };
  const snug = R + 0.001;
  let klo = -0.6, khi = 0.8;
  for (let n = 0; n < 11; n++) { const k = (klo + khi) / 2; close(k); align(); if (fit().r > snug) klo = k; else khi = k; }
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
