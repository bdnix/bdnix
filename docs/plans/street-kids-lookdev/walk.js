// A walk for any of the Mixamo-rigged figures: the old man's walk (p_old), retargeted onto
// each figure's skeleton by bone name (the rigs share names, give or take a numeric suffix),
// kept in place (his forward travel taken out).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { retargetClip, clone } from 'three/addons/utils/SkeletonUtils.js';

let src = null;
const clips = new Map();
const base = n => n.replace(/^mixamorig:?/, '').replace(/_\d+$/, '');

async function source() {
  if (src) return src;
  const gl = await new GLTFLoader().loadAsync('/models/p_old.glb');
  const root = gl.scene, clip = gl.animations[0].clone();
  // In place: no travel along the ground.
  for (const t of clip.tracks) if (/^Hips.*\.position$/.test(t.name)) {
    const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
  }
  let mesh = null; root.traverse(m => { if (m.isSkinnedMesh && !mesh) mesh = m; });
  src = { root, clip, mesh };
  return src;
}

// A mixer playing the walk on figure `rd` (as returned by rider()), started `phase` of the way through a stride.
export async function walk(rd, name, phase = 0) {
  const s = await source();
  let mesh = null; rd.traverse(m => { if (m.isSkinnedMesh && !mesh) mesh = m; });
  if (!mesh) return null;
  let clip = clips.get(name);
  if (!clip) {
    const byBase = new Map(s.mesh.skeleton.bones.map(b => [base(b.name), b.name]));
    const names = {};
    for (const b of mesh.skeleton.bones) { const m = byBase.get(base(b.name)); if (m) names[b.name] = m; }
    const hip = byBase.get('Hips');
    clip = retargetClip(mesh, s.mesh, s.clip, { names, hip, hipInfluence: new THREE.Vector3(0, 0, 0), useFirstFramePosition: true, preserveBonePositions: true });
    clips.set(name, clip);
  }
  const mixer = new THREE.AnimationMixer(mesh);
  mixer.clipAction(clip).play();
  mixer.setTime(phase * clip.duration);
  return mixer;
}
