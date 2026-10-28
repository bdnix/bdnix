import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,quantize,meshopt,textureCompress,flatten,getSceneVertexCount} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const [,,inp,outp,maxTex='2048',q='80']=process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(inp);
await doc.transform(
  dedup(),prune(),
  weld({tolerance:1e-5}),
  textureCompress({encoder:sharp,targetFormat:'webp',resize:[+maxTex,+maxTex],quality:+q}),
  quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}),
  meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(outp,doc);
const root=doc.getRoot();
let tris=0;for(const m of root.listMeshes())for(const p of m.listPrimitives()){const i=p.getIndices();tris+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3}
const tex=root.listTextures().map(t=>t.getSize().join('x'));
console.log(outp,'bytes',fs.statSync(outp).size,'tris',tris,'materials',root.listMaterials().length,'prims',root.listMeshes().reduce((a,m)=>a+m.listPrimitives().length,0),'tex',tex.join(','));
