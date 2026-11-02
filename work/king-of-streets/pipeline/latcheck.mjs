import {open,shot} from './render.mjs';
import fs from 'fs';
const [,,tag,url]=process.argv;
const {pg,close}=await open(400,400);
await pg.evaluate(u=>window.load(u),url);
const out={};
for(const wn of ['wheel_f','wheel_r']){
  await pg.evaluate(wn=>{window.model.traverse(o=>{if(!o.isMesh)return;let p=o,w=false;while(p){if(p.name===wn)w=true;p=p.parent}o.visible=w;if(w)o.material=new window.model.constructor().constructor===Object?o.material:o.material});},wn);
  await pg.evaluate(()=>window.tint&&0);
  const v=await pg.evaluate(wn=>{const v=new (window.model.position.constructor)();window.model.getObjectByName(wn).getWorldPosition(v);return v.toArray()},wn);
  const sgn=wn==='wheel_f'?1:-1;
  let i=0;
  for(const a of [0,0.7,1.4,2.1,2.8,3.5,4.2,5.0]){
    await pg.evaluate(a=>window.spin(a),a);
    await shot(pg,[0,v[1],v[2]+sgn*2.2],[0,v[1],v[2]],12,`views/${tag}_${wn}_${i}.png`);
    i++;
  }
}
await close();
