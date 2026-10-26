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
    const g = (opts.hands && opts.hands[s]) || [fit.grip[0] * sx, fit.grip[1], fit.grip[2]];
    const grip = (opts.handsWorld && opts.handsWorld[s]) || toWorld(g);
    const gl = bike.worldToLocal(grip.clone());
    const pole = toWorld([gl.x + sx * 0.6, gl.y - 0.5, gl.z - 0.6]);
    ik(b['upperarm_' + s], b['lowerarm_' + s], b['hand_' + s], grip, pole);
  }
  b._fwd = fwd;
  return b;
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
