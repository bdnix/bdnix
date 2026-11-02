import {open} from './render.mjs';
const [,,url]=process.argv;
const {pg,close}=await open(300,300);
await pg.evaluate(u=>window.load(u),url);
const r=await pg.evaluate(()=>{
 const out={};
 for(const nme of ['wheel_f','wheel_r']){
  const w=window.model.getObjectByName(nme); window.spin(0); window.model.updateMatrixWorld(true);
  const inv=w.matrixWorld.clone().invert(); const pts=[];
  w.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;const m=o.matrixWorld.clone().premultiply(inv).elements;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);pts.push([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]])}});
  // tyre = points far from the pivot axis; take the outer 6% by radius
  const rad=pts.map(p=>Math.hypot(p[1],p[2])); const sr=[...rad].sort((a,b)=>a-b); const Rt=sr[Math.floor(sr.length*0.985)];
  const ring=pts.filter((p,i)=>rad[i]>0.9*Rt&&rad[i]<=Rt*1.001);
  // convex hull in (y,z), then least squares circle on the hull
  const P=ring.map(p=>[p[1],p[2]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[];for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
  const up=[];for(const p of [...P].reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  const H=lo.slice(0,-1).concat(up.slice(0,-1));
  // algebraic circle fit
  let sx=0,sy=0,sxx=0,syy=0,sxy=0,sxz=0,syz=0,sz=0;const n=H.length;
  for(const [x,y] of H){const z=x*x+y*y;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;sxz+=x*z;syz+=y*z;sz+=z}
  const A=[[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]],B=[sxz,syz,sz];
  const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D=det(A);const sol=[0,1,2].map(k=>det(A.map((row,i)=>row.map((x,j)=>j===k?B[i]:x)))/D);
  const cy=sol[0]/2,cz=sol[1]/2,R=Math.sqrt(sol[2]+cy*cy+cz*cz);
  // tilt of the crown ring plane vs spin axis: fit x = a*y+b*z+c on ring points
  let S=[[0,0,0],[0,0,0],[0,0,0]],T=[0,0,0];
  for(const p of ring){const f=[p[1],p[2],1];for(let i=0;i<3;i++){T[i]+=f[i]*p[0];for(let j=0;j<3;j++)S[i][j]+=f[i]*f[j]}}
  const D2=det(S);const s2=[0,1,2].map(k=>det(S.map((row,i)=>row.map((x,j)=>j===k?T[i]:x)))/D2);
  out[nme]={'orbit radius mm (centre of tyre vs pivot)':+(Math.hypot(cy,cz)*1000).toFixed(1),'centre offset mm (y,z)':[+(cy*1000).toFixed(1),+(cz*1000).toFixed(1)],'tyre R mm':+(R*1000).toFixed(0),'tilt deg':+(Math.atan(Math.hypot(s2[0],s2[1]))*180/Math.PI).toFixed(2),'hull pts':n};
 }
 return out});
console.log(JSON.stringify(r));
await close();
