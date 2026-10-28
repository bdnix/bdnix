// mid.mjs <in.glb> <out.glb> <target triangles>: the detailed model made light
// enough for a phone. Each primitive is simplified towards the same share of
// its triangles, keeping UV seams, never past a small error, so
// small parts (hands, faces, badges) keep their shape. Names, skins and
// materials kept.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const [src, out, target] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
let total = 0; const prims = [];
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); if (!i || p.getMode() !== 4) continue; prims.push(p); total += i.getCount() / 3; }
const share = Math.min(1, +target / total);
let after = 0;
for (const p of prims) {
  const idx = p.getIndices(), pos = p.getAttribute('POSITION');
  const n = pos.getCount(), P = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { pos.getElement(i, v); P[i * 3] = v[0]; P[i * 3 + 1] = v[1]; P[i * 3 + 2] = v[2]; }
  const I = new Uint32Array(idx.getArray());
  const want = Math.max(3, Math.floor(I.length * share / 3) * 3);
  let res = I;
  if (share < 1 && I.length > 300) {
    let err = 0.002;
    // Loosen the error a step at a time until the share is reached, up to 5%.
    for (; err <= 0.05; err *= 1.6) { [res] = MeshoptSimplifier.simplify(I, P, 3, want, err, []); if (res.length <= want * 1.15) break; }
  }
  const map = new Int32Array(n).fill(-1), keep = [];
  for (const k of res) if (map[k] < 0) { map[k] = keep.length; keep.push(k); }
  const ni = new Uint32Array(res.length); for (let k = 0; k < res.length; k++) ni[k] = map[res[k]];
  for (const sem of p.listSemantics()) {
    const a = p.getAttribute(sem), sz = a.getElementSize(), arr = a.getArray(), C = arr.constructor, na = new C(keep.length * sz);
    for (let k = 0; k < keep.length; k++) for (let c = 0; c < sz; c++) na[k * sz + c] = arr[keep[k] * sz + c];
    p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(na).setNormalized(a.getNormalized()).setBuffer(a.getBuffer()));
  }
  for (const t of p.listTargets()) p.removeTarget(t);
  p.setIndices(doc.createAccessor().setType('SCALAR').setArray(keep.length < 65535 ? new Uint16Array(ni) : ni).setBuffer(idx.getBuffer()));
  after += res.length / 3;
}
for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
await io.write(out, doc);
console.log(src.split('/').pop().padEnd(14), String(Math.round(total)).padStart(7), '->', String(Math.round(after)).padStart(7));
