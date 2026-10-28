// joinbike.mjs <in> <out> [drop]: drop parts whose name has `drop` in it (any case), flatten and join the rest
// (fewer draw calls; every vertex stays where it was).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, prune, dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const [src, out, drop] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
if (drop) { const re = { test: (s) => s.toLowerCase().includes(drop.toLowerCase()) }; for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (m && (re.test(n.getName()) || re.test(m.getName()) || m.listPrimitives().some(p => re.test(p.getMaterial()?.getName() || '')))) { console.log('drop', n.getName()); n.dispose(); } } }
await doc.transform(dequantize(), flatten(), join({ keepNamed: false }), prune());
let prims = 0; for (const m of doc.getRoot().listMeshes()) prims += m.listPrimitives().length;
console.log(src.split('/').pop(), 'prims', prims);
await io.write(out, doc);
