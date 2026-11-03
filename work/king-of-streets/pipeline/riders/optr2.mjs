import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,quantize,meshopt,textureCompress,flatten,getSceneVertexCount} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const [,,inp,outp,maxTex='2048',q='80',maxOther]=process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(inp);
// remember each wheel's true axle position (compression moves node origins to the mesh centre)
const axle={};
for(const n of doc.getRoot().listNodes()){if(/^wheel_[fr]$/.test(n.getName()))axle[n.getName()]=n.getWorldTranslation().slice();}
await doc.transform(


  ...(maxOther?[textureCompress({encoder:sharp,targetFormat:'webp',slots:/^(?!baseColor)/,resize:[+maxOther,+maxOther],quality:+q}),
                textureCompress({encoder:sharp,targetFormat:'webp',slots:/^baseColor/,resize:[+maxTex,+maxTex],quality:+q})]
              :[textureCompress({encoder:sharp,targetFormat:'webp',resize:[+maxTex,+maxTex],quality:+q})]),
  ...(process.env.NOQUANT?[]:[quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12})]),
  meshopt({encoder:MeshoptEncoder,level:'high'}));
for(const n of doc.getRoot().listNodes()){
  const nm=n.getName(); if(!axle[nm]||!n.getMesh())continue;
  const parent=n.getParentNode(); const wt=n.getWorldTranslation(); const hub=axle[nm];
  const pivot=doc.createNode(nm).setTranslation(parent?[hub[0]-parent.getWorldTranslation()[0],hub[1]-parent.getWorldTranslation()[1],hub[2]-parent.getWorldTranslation()[2]]:hub);
  n.setName(nm+'_mesh');
  const t=n.getTranslation(); const pt=pivot.getTranslation();
  n.setTranslation([t[0]-pt[0],t[1]-pt[1],t[2]-pt[2]]);
  if(parent){parent.removeChild(n);parent.addChild(pivot)}else{for(const sc of doc.getRoot().listScenes()){if(sc.listChildren().includes(n)){sc.removeChild(n);sc.addChild(pivot)}}}
  pivot.addChild(n);
}
await io.write(outp,doc);
const root=doc.getRoot();
let tris=0;for(const m of root.listMeshes())for(const p of m.listPrimitives()){const i=p.getIndices();tris+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3}
const tex=root.listTextures().map(t=>t.getSize().join('x'));
console.log(outp,'bytes',fs.statSync(outp).size,'tris',tris,'materials',root.listMaterials().length,'prims',root.listMeshes().reduce((a,m)=>a+m.listPrimitives().length,0),'tex',tex.join(','));
