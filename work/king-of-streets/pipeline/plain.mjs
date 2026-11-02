import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,KHRMeshQuantization,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const id of ['A1','A2','A3','A4','A5']){
  const d=await io.read(`/home/user/bdnix/work/king-of-streets/models/bikes/${id}.glb`);
  await d.transform(dequantize());
  for(const e of d.getRoot().listExtensionsUsed()) if(e.extensionName==='EXT_meshopt_compression'||e.extensionName==='KHR_mesh_quantization') e.dispose();
  await io.write(`bikes_plain/${id}.glb`,d);
}
console.log('ok');
