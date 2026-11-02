import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const d=await io.read(process.argv[2]);
for(const n of d.getRoot().listNodes()){if(n.getMesh()&&n.getName()==='rider')n.dispose();}
await d.transform(prune());
await io.write(process.argv[3],d);
let t=0;for(const m of d.getRoot().listMeshes())for(const p of m.listPrimitives())t+=p.getIndices().getCount()/3;
console.log(process.argv[3],'triangles',t);
