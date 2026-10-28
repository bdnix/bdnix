// Bakes each rider's seat on each bike (and a CNG driver at the wheel): the rider's place and
// every bone's turn that seat() and its grip fitting give, for the game to put back as they are.
import * as THREE from 'three';
globalThis.MODEL_DIR = '/opt/';
import { bike, rider, thing, CHARACTERS } from './common.js';
import { dress, uniform } from './gear.js';
import { seat, loadGrip } from './rider.js';
await loadGrip('/models/h_moto.glb');
const q = new URLSearchParams(location.search);
const scene = new THREE.Scene();
const r4 = v => Math.round(v * 1e5) / 1e5;
function record(rd) {
  rd.updateMatrixWorld(true);
  const rest = {}, out = { at: rd.position.toArray().map(r4), q: rd.quaternion.toArray().map(r4), s: r4(rd.scale.x), bones: {} };
  rd.traverse(n => { if (n.isBone) out.bones[n.name] = n.quaternion.toArray().map(r4); });
  const o = rd.children[0]; out.inner = { at: o.position.toArray().map(r4), s: r4(o.scale.x) };
  return out;
}
const result = {};
const CNG_FIT = { seat: [0, 0.66, 0.2], grip: [0.34, 0.88, 0.72], bar: [[0.272, 0.862, 0.70], [0.365, 0.858, 0.672]], peg: [0.14, 0.34, 0.6], lean: 0.12 };
for (const job of q.get('jobs').split(',')) {
  const [b, r] = job.split(':');
  let bk;
  if (b === 'cng') bk = await thing('cng', 2.6, { ry: -90, hide: /tree_small/ });
  else bk = await bike(b);
  scene.add(bk); bk.updateMatrixWorld(true);
  const rd = await rider(r);
  const ch = CHARACTERS.find(c => c.id === r);
  if (ch) dress(rd, ch);
  if (b === 'cng') { uniform(rd); rd.scale.multiplyScalar(0.96); }
  bk.add(rd); bk.updateMatrixWorld(true);
  seat(rd, bk, b === 'cng' ? CNG_FIT : bk.userData.fit);
  result[b + ':' + r] = record(rd);
  const o = bk.children[0]; result[b] = { at: o.position.toArray().map(r4), q: o.quaternion.toArray().map(r4), s: r4(o.scale.x) };
  scene.remove(bk);
}
window.RESULT = result;
document.title = 'ok';
