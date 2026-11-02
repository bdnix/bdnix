import http from 'http';import fs from 'fs';import path from 'path';
import {chromium} from 'playwright-core';
const repo='/home/user/bdnix';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.hdr':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.bin':'application/octet-stream'};
const map=(u)=>{u=decodeURIComponent(u.split('?')[0]);if(u.startsWith('/node_modules/')||u.startsWith('/files/'))return path.join('/tmp/claude-0/work',u.replace('/files/',''));return path.join(repo,u)};
const s=http.createServer((q,a)=>{if(q.url.startsWith('/page.html')){a.writeHead(200,{'content-type':'text/html'});return a.end(`<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c></canvas><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type=module>import {createStage,VIEWS} from '/work/king-of-streets/preview/stage.js';window.createStage=createStage;window.ready=1;</script>`)}
 const p=map(q.url);fs.readFile(p,(e,d)=>{if(e){a.writeHead(404);return a.end()}a.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});a.end(d)})}).listen(0);
await new Promise(r=>s.on('listening',r));
const port=s.address().port;
const [,,outdir,...items]=process.argv;fs.mkdirSync(outdir,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
const pg=await b.newPage({viewport:{width:800,height:600}});
pg.on('pageerror',e=>console.log('pageerror',e.message));pg.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
await pg.goto(`http://localhost:${port}/page.html`);await pg.waitForFunction('window.ready');
for(const it of items){
  const [id,url]=it.split('=');
  const res=await pg.evaluate(async([id,url])=>{
    const out={};const c=document.getElementById('c');
    const st=await window.createStage(c,{width:600,height:700,dpr:1,hdrUrl:'/work/king-of-streets/preview/daylight.hdr'});
    await st.load(url);out.stats=st.stats();
    const T=st.THREE;if(id!=='helmet'){const b0=new T.Box3().setFromObject(st.model);st.model.scale.setScalar(1.75/b0.getSize(new T.Vector3()).y);st.model.updateMatrixWorld(true);}const bb=new T.Box3().setFromObject(st.model);const sz=bb.getSize(new T.Vector3()),ct=bb.getCenter(new T.Vector3());
    out.bbox=[sz.x,sz.y,sz.z].map(v=>+v.toFixed(3));
    const d=Math.max(sz.y,sz.x)*1.25/Math.tan(10*Math.PI/180)/1;
    for(const [nm,dir] of [['front',[0,0,1]],['side',[1,0,0]],['back',[0,0,-1]],['q',[0.7,0.2,0.7]]]){
      st.view({pos:[ct.x+dir[0]*d,ct.y+dir[1]*d,ct.z+dir[2]*d],look:[ct.x,ct.y,ct.z],fov:20});st.render();out[nm]=c.toDataURL('image/png')}
    st.dispose();return out;
  },[id,url]);
  console.log(id,JSON.stringify(res.stats),res.bbox);
  for(const k of ['front','side','back','q'])fs.writeFileSync(`${outdir}/${id}_${k}.png`,Buffer.from(res[k].split(',')[1],'base64'));
}
await b.close();s.close();
