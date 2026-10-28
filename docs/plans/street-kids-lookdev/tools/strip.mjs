// strip.mjs <in.glb> <out.glb>: a rider without what the helmet hides (hair, scalp,
// eyes, lashes, teeth, tongue, mouth), which the game never draws.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const hidden = /hair|scalp|eyelash|eye|teeth|tongue|mouth/i;
let n = 0;
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  const m = p.getMaterial();
  if (m && hidden.test(m.getName() || '')) { mesh.removePrimitive(p); p.dispose(); n++; }
}
for (const mesh of doc.getRoot().listMeshes()) if (!mesh.listPrimitives().length) {
  for (const node of mesh.listParents()) if (node.propertyType === 'Node') node.setMesh(null);
  mesh.dispose();
}
await doc.transform(prune({ keepLeaves: true }));
await io.write(out, doc);
console.log(src.split('/').pop(), 'dropped', n);
