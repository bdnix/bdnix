// Draw stills of one or more models with the preview stage: node stills.mjs <outdir> <id=path.glb>...
import http from 'http';import fs from 'fs';import path from 'path';
import {chromium} from 'playwright-core';
const repo='/home/user/bdnix';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.hdr':'application/octet-stream'};
const map=(u)=>{u=decodeURIComponent(u.split('?')[0]);if(u.startsWith('/node_modules/'))return path.join(process.cwd(),u);return path.join(repo,u)};
const s=http.createServer((q,a)=>{if(q.url.startsWith('/page.html')){a.writeHead(200,{'content-type':'text/html'});return a.end(`<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c></canvas><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type=module>import {createStage,VIEWS} from '/work/king-of-streets/preview/stage.js';window.createStage=createStage;window.VIEWS=VIEWS;window.ready=1;</script>`)}
 const p=map(q.url);fs.readFile(p,(e,d)=>{if(e){a.writeHead(404);return a.end()}a.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});a.end(d)})}).listen(0);
await new Promise(r=>s.on('listening',r));
const port=s.address().port;
const [,,outdir,...items]=process.argv;
fs.mkdirSync(outdir,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
const pg=await b.newPage({viewport:{width:800,height:600}});
pg.on('pageerror',e=>console.log('pageerror',e.message));pg.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
await pg.goto(`http://localhost:${port}/page.html`);await pg.waitForFunction('window.ready');
const sizes={wide:[786,540],tall:[786,1704]};
for(const it of items){
  const [id,url]=it.split('=');
  const res=await pg.evaluate(async([id,url,sizes])=>{
    const out={};
    const c=document.getElementById('c');
    const st=await window.createStage(c,{width:sizes.wide[0],height:sizes.wide[1],dpr:1,hdrUrl:'/work/king-of-streets/preview/daylight.hdr'});
    await st.load(url);
    out.stats=st.stats();
    for(const v of ['side','front34','rear34','rear','close']){st.view(v);st.render();out[v]=c.toDataURL('image/png')}
    const wr=st.model.getObjectByName('wheel_r').position, wf=st.model.getObjectByName('wheel_f').position;
    st.view({pos:[2.6,wr.y+0.25,wr.z-0.45],look:[0,wr.y,wr.z],fov:17});st.render();out.wheelR=c.toDataURL('image/png');
    st.view({pos:[-2.6,wf.y+0.25,wf.z+0.45],look:[0,wf.y,wf.z],fov:17});st.render();out.wheelF=c.toDataURL('image/png');
    st.spin(0.9);st.view({pos:[2.6,wr.y+0.25,wr.z-0.45],look:[0,wr.y,wr.z],fov:17});st.render();out.wheelR_turned=c.toDataURL('image/png');
    st.view({pos:[-2.6,wf.y+0.25,wf.z+0.45],look:[0,wf.y,wf.z],fov:17});st.render();out.wheelF_turned=c.toDataURL('image/png');st.spin(0);
    st.resize(393,852,3);   // phone upright, as the game draws it
    st.view('race');st.render();out.race=c.toDataURL('image/png');
    st.dispose();return out;
  },[id,url,sizes]);
  for(const k of Object.keys(res)){if(k==='stats'){console.log(id,JSON.stringify(res.stats));continue}
    fs.writeFileSync(`${outdir}/${id}_${k}.png`,Buffer.from(res[k].split(',')[1],'base64'))}
}
await b.close();s.close();
