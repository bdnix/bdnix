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

function clasp(root, b, s, grip, pole, out, fwd, up, R = 0.017) {
  const f = fingers(root, s), hand = b['hand_' + s];
  if (!f.ind || !f.pin || !f.mid || !f.ind[0] || !f.pin[0] || !f.mid[0]) return;
  const flat = v => v.sub(out.clone().multiplyScalar(v.dot(out))).normalize();
  const inward = out.clone().negate();
  // The fingers' bones run through their middle: wrapped round the grip they make a circle of
  // radius ρ (the grip's radius plus about 2 cm), and the middle knuckle sits on it.
  const RHO = R + (globalThis.CLASP_PAD || 0.021);
  // The wrist is kept straight: the hand carries on along the forearm (looking along the grip), and
  // meets the grip where that line touches the circle, on top, the back of the hand facing away.
  const backOf = up.clone().multiplyScalar(0.75).sub(fwd.clone().multiplyScalar(0.65));
  let ahead = null, onTop = null;
  // Over the top of the grip and forward (as before), turned partway towards the forearm's own line:
  // on swept-back bars the forearm runs nearly along the grip, so following it fully hangs the hand down.
  const over = flat(fwd.clone().multiplyScalar(0.9).add(up.clone().multiplyScalar(0.25)));
  const line = () => {
    const arm = flat(wpos(hand).sub(wpos(b['lowerarm_' + s])));
    ahead = flat(over.clone().multiplyScalar(1 - (globalThis.CLASP_ARM ?? 0.35)).add(arm.multiplyScalar(globalThis.CLASP_ARM ?? 0.35)));
    onTop = new THREE.Vector3().crossVectors(out, ahead).normalize();
    if (onTop.dot(backOf) < 0) onTop.negate();
  };
  const orient = () => {
    aim(hand, f.mid[0], wpos(hand).add(ahead));
    const axis = wpos(f.mid[0]).sub(wpos(hand)).normalize();
    const across = wpos(f.ind[0]).sub(wpos(f.pin[0]));
    const want = inward.clone();
    across.sub(axis.clone().multiplyScalar(across.dot(axis))).normalize();
    want.sub(axis.clone().multiplyScalar(want.dot(axis))).normalize();
    const ang = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(across, want)), across.dot(want));
    turn(hand, axis, ang);
  };
  const wrist = grip.clone();
  for (let i = 0; i < 8; i++) {
    ik(b['upperarm_' + s], b['lowerarm_' + s], hand, wrist, pole);
    line(); orient();
    wrist.add(grip.clone().add(onTop.clone().multiplyScalar(RHO)).sub(wpos(f.mid[0])));
  }
  // Fingers side by side, as round a grip, not spread: each turned about the back of the hand's
  // normal to lie parallel to the middle finger.
  const normal = onTop.clone();
  const inPlane = v => v.sub(normal.clone().multiplyScalar(v.dot(normal))).normalize();
  const midDir = inPlane(wpos(f.mid[1] || f.mid[0]).sub(wpos(f.mid[0])));
  for (const k of ['ind', 'rin', 'pin']) {
    const c = f[k]; if (!c || !c[0] || !c[1]) continue;
    const d = inPlane(wpos(c[1]).sub(wpos(c[0])));
    if (globalThis.CLASP_DEBUG) (globalThis.CLASP_ANG = globalThis.CLASP_ANG || []).push(s + k + 'spread:' + Math.atan2(normal.dot(new THREE.Vector3().crossVectors(d, midDir)), d.dot(midDir)).toFixed(2));
    // Only a little: a full turn twists the knuckle's skin; real fingers fan slightly anyway.
    const sp = Math.atan2(normal.dot(new THREE.Vector3().crossVectors(d, midDir)), d.dot(midDir));
    turn(c[0], normal, Math.max(-0.08, Math.min(0.08, sp)));
  }
  // Wrap each finger round the grip, joint by joint: each joint turns about the grip's line just
  // enough that the next joint lands on a circle hugging the grip (its radius plus half a finger),
  // going round the way the fingers wrap (over the top, forward, down and back underneath).
  const perp = p => { const v = p.clone().sub(grip); return v.sub(out.clone().multiplyScalar(v.dot(out))); };
  const wrapSign = Math.sign(out.dot(new THREE.Vector3().crossVectors(onTop, ahead))) || 1;
  const hug = R + (globalThis.CLASP_HUG || 0.0105);
  const solve = (J, C, sign = wrapSign) => {
    const v = C.clone().sub(J), rel = perp(J);
    let best = 0, bestErr = Infinity;
    for (let n = 0; n <= 360; n++) {
      const th = (n / 360 - 0.5) * 4.8;
      const p2 = perp(J.clone().add(v.clone().applyAxisAngle(out, th)));
      const goesRound = sign * out.dot(new THREE.Vector3().crossVectors(rel, p2)) > 0;
      const err = Math.abs(p2.length() - hug) + (goesRound ? 0 : 1) + Math.abs(th) * 0.002;
      if (err < bestErr) { bestErr = err; best = th; }
    }
    return best;
  };
  // The ring and little fingers curl in step with the middle finger, halfway to their own fit, so the
  // hand closes as one fist rather than each finger bending its own way.
  const midAng = [];
  for (const k of ['mid', 'ind', 'rin', 'pin']) {
    const chain = f[k]; if (!chain || !chain[0] || !chain[2]) continue;
    const end = chain[2].children.find(c => c.isBone);
    let last = 0;
    for (let n = 0; n < 3; n++) {
      const C = n < 2 ? wpos(chain[n + 1]) : end ? wpos(end) : null;
      last = C ? solve(wpos(chain[n]), C) : last * 0.8;
      if (k === 'mid') midAng[n] = last;
      else if ((k === 'rin' || k === 'pin') && midAng[n] !== undefined) last = (last + midAng[n] * (k === 'pin' ? 1.05 : 1)) / 2;
      turn(chain[n], out, last);
      if (globalThis.CLASP_DEBUG) (globalThis.CLASP_ANG = globalThis.CLASP_ANG || []).push(s + k + n + ':' + last.toFixed(2));
    }
  }
  // The thumb round under the grip from behind, the other way round, its tip towards the fingers.
  if (f.thu && f.thu[1] && f.thu[2]) {
    const end = f.thu[2].children.find(c => c.isBone);
    let last = 0;
    for (let n = 1; n < 3; n++) {
      const C = n < 2 ? wpos(f.thu[n + 1]) : end ? wpos(end) : null;
      last = C ? solve(wpos(f.thu[n]), C, -wrapSign) : last * 0.8;
      turn(f.thu[n], out, last);
    }
  }
  if (globalThis.CLASP_DEBUG) {
    const skin = fingerSkin(root, ['ind', 'mid', 'rin', 'pin'].map(k => f[k]).filter(c => c && c[0]));
    root.updateMatrixWorld(true);
    const d = skin.map(([m, i]) => { const p = m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld).sub(grip); return p.sub(out.clone().multiplyScalar(p.dot(out))).length(); });
    d.sort((x, y) => x - y);
    console.error('angles', (globalThis.CLASP_ANG || []).join(' ')); globalThis.CLASP_ANG = [];
    console.error('clasp', s, 'R', R.toFixed(4), 'skin-to-axis min', d[0].toFixed(3), 'p10', d[Math.floor(d.length * 0.1)].toFixed(3), 'median', d[Math.floor(d.length / 2)].toFixed(3), 'max', d[d.length - 1].toFixed(3));
  }
}

// The vertices of a hand's skin that hang mostly from its fingers: [mesh, index] pairs.
function fingerSkin(root, chains) {
  const bonesOf = new Set(); chains.forEach(c => c[0].traverse(b => { if (b.isBone) bonesOf.add(b); }));
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
  const step = Math.max(1, Math.floor(out.length / 400));
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
