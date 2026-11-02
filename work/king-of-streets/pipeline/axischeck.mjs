import {open} from './render.mjs';
const [,,url]=process.argv;
const {pg,close}=await open(300,300);
await pg.evaluate(u=>window.load(u),url);
const r=await pg.evaluate(()=>{const out={};
 for(const nme of ['wheel_f','wheel_r']){
  const w=window.model.getObjectByName(nme); window.spin(0); window.model.updateMatrixWorld(true);
  const e=w.matrixWorld.elements; const ax=[e[0],e[1],e[2]]; const hub=[e[12],e[13],e[14]];
  const nrm=Math.hypot(...ax); ax[0]/=nrm;ax[1]/=nrm;ax[2]/=nrm;
  const pts=[];w.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;const m=o.matrixWorld.elements;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);pts.push([m[0]*x+m[4]*y+m[8]*z+m[12]-hub[0],m[1]*x+m[5]*y+m[9]*z+m[13]-hub[1],m[2]*x+m[6]*y+m[10]*z+m[14]-hub[2]])}});
  // build an orthonormal basis (u,v) perpendicular to the spin axis
  const t=Math.abs(ax[1])<0.9?[0,1,0]:[1,0,0];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  let u=cross(ax,t);const un=Math.hypot(...u);u=u.map(c=>c/un);const v=cross(ax,u);
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const rows=pts.map(p=>({a:dot(p,ax),pu:dot(p,u),pv:dot(p,v)})).map(q=>({...q,r:Math.hypot(q.pu,q.pv)}));
  const rs=rows.map(q=>q.r).sort((a,b)=>a-b);const R=rs[Math.floor(rs.length*0.985)];
  const edge=rows.filter(q=>q.r>0.90*R&&q.r<1.0*R);
  // least squares axial = c + A*cos + B*sin using pu,pv components
  let n=edge.length,S=[[0,0,0],[0,0,0],[0,0,0]],T=[0,0,0];
  for(const q of edge){const f=[1,q.pu/q.r,q.pv/q.r];for(let i=0;i<3;i++){T[i]+=f[i]*q.a;for(let j=0;j<3;j++)S[i][j]+=f[i]*f[j]}}
  // solve 3x3
  const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D=det(S);const sol=[0,1,2].map(k=>{const M=S.map((row,i)=>row.map((x,j)=>j===k?T[i]:x));return det(M)/D});
  const amp=Math.hypot(sol[1],sol[2]);
  out[nme]={R:+R.toFixed(3),n,'tilt of tyre vs spin axis (deg)':+(Math.atan2(amp,R)*180/Math.PI).toFixed(2)};}
 return out});
console.log(JSON.stringify(r));
await close();
