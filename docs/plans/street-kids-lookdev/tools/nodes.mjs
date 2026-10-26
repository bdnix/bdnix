import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue;
  const b = getBounds(n); const sz = b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join(' ');
  const t = m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(n.getName().slice(0, 40).padEnd(40), 'size', sz.padEnd(22), 'min', b.min.map(v=>v.toFixed(2)).join(' ').padEnd(22), Math.round(t), m.listPrimitives().map(p => p.getMaterial()?.getName()).join(',').slice(0,60)); }
