import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const r = doc.getRoot();
  const b = getBounds(r.listScenes()[0]);
  const size = b.max.map((v, i) => (v - b.min[i]).toFixed(2));
  let tris = 0; for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
  const tex = r.listTextures().map(t => (t.getSize() || []).join('x'));
  console.log(f.split('/').pop(), 'size', size.join(' '), 'tris', Math.round(tris/1000)+'k', 'mats', r.listMaterials().length, 'tex', tex.length, [...new Set(tex)].join(','), 'skins', r.listSkins().length, 'joints', r.listSkins().map(s => s.listJoints().length).join(','), 'anims', r.listAnimations().map(a => a.getName()).join('|'));
}
