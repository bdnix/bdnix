// node views3.mjs <outdir> <bikeUrl> <riderUrl|-> <viewsJson>   (views: [{name,pos,look,fov,w,h,dpr}])
import http from 'http';import fs from 'fs';import path from 'path';
import {chromium} from 'playwright-core';
const repo='/home/user/bdnix';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.hdr':'application/octet-stream'};
const map=(u)=>{u=decodeURIComponent(u.split('?')[0]);if(u.startsWith('/node_modules/')||u.startsWith('/files/'))return path.join('/tmp/claude-0/work',u.replace('/files/',''));return path.join(repo,u)};
const s=http.createServer((q,a)=>{if(q.url.startsWith('/page.html')){a.writeHead(200,{'content-type':'text/html'});return a.end(`<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c></canvas><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type=module>import {createStage} from '/work/king-of-streets/preview/stage.js';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';window.createStage=createStage;window.GLTFLoader=GLTFLoader;window.MeshoptDecoder=MeshoptDecoder;window.ready=1;</script>`)}
 const p=map(q.url);fs.readFile(p,(e,d)=>{if(e){a.writeHead(404);return a.end()}a.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});a.end(d)})}).listen(0);
await new Promise(r=>s.on('listening',r));
const port=s.address().port;
const [,,outdir,bikeUrl,riderUrl,viewsFile]=process.argv;fs.mkdirSync(outdir,{recursive:true});
const views=JSON.parse(fs.readFileSync(viewsFile,'utf8'));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
const pg=await b.newPage({viewport:{width:800,height:600}});
pg.on('pageerror',e=>console.log('pageerror',e.message));pg.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
await pg.goto(`http://localhost:${port}/page.html`);await pg.waitForFunction('window.ready');
const res=await pg.evaluate(async([bikeUrl,riderUrl,views])=>{
  const c=document.getElementById('c');
  const st=await window.createStage(c,{width:786,height:540,dpr:1,hdrUrl:'/work/king-of-streets/preview/daylight.hdr'});
  if(bikeUrl!=='-')await st.load(bikeUrl);
  let stats=bikeUrl!=='-'?st.stats():null;
  if(riderUrl!=='-'){const l=new window.GLTFLoader();l.setMeshoptDecoder(window.MeshoptDecoder);const g=await l.loadAsync(riderUrl);g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});st.scene.add(g.scene);
    let t=0;g.scene.traverse(o=>{if(o.isMesh){const i=o.geometry.index;t+=(i?i.count:o.geometry.attributes.position.count)/3}});window.__rt=Math.round(t);window.__riderScene=g.scene;const nm=[];g.scene.traverse(o=>{if(o.isMesh)nm.push(o.name+'|'+(o.parent?o.parent.name:''))});window.__nm=nm;}
  const out={};
  for(const v of views){if(window.__riderScene)window.__riderScene.traverse(o=>{if(o.isMesh)o.visible=!v.only||o.name.toLowerCase().includes(v.only)});st.resize(v.w||786,v.h||540,v.dpr||1);st.view({pos:v.pos,look:v.look,fov:v.fov||24});st.render();out[v.name]=c.toDataURL('image/jpeg',0.9)}
  return {out,rt:window.__rt,nm:window.__nm};
},[bikeUrl,riderUrl,views]);
for(const k of Object.keys(res.out))fs.writeFileSync(`${outdir}/${k}.jpg`,Buffer.from(res.out[k].split(',')[1],'base64'));
console.log('rider tris',res.rt,JSON.stringify(res.nm));
await b.close();s.close();
