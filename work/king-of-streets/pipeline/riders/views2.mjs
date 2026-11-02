import http from 'http';import fs from 'fs';import path from 'path';
import {chromium} from 'playwright-core';
const repo='/home/user/bdnix';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.hdr':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.bin':'application/octet-stream'};
const map=(u)=>{u=decodeURIComponent(u.split('?')[0]);if(u.startsWith('/node_modules/')||u.startsWith('/files/'))return path.join('/tmp/claude-0/work',u.replace('/files/',''));return path.join(repo,u)};
const s=http.createServer((q,a)=>{if(q.url.startsWith('/page.html')){a.writeHead(200,{'content-type':'text/html'});return a.end(`<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c></canvas><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type=module>import {createStage,VIEWS} from '/work/king-of-streets/preview/stage.js';window.createStage=createStage;window.ready=1;</script>`)}
 const p=map(q.url);fs.readFile(p,(e,d)=>{if(e){a.writeHead(404);return a.end()}a.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});a.end(d)})}).listen(0);
await new Promise(r=>s.on('listening',r));
const port=s.address().port;
const [,,outdir,url,...views]=process.argv;fs.mkdirSync(outdir,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
const pg=await b.newPage({viewport:{width:800,height:600}});
pg.on('pageerror',e=>console.log('pageerror',e.message));
await pg.goto(`http://localhost:${port}/page.html`);await pg.waitForFunction('window.ready');
const res=await pg.evaluate(async([url,views])=>{
  const c=document.getElementById('c');const st=await window.createStage(c,{width:600,height:600,dpr:1,hdrUrl:'/work/king-of-streets/preview/daylight.hdr'});
  await st.load(url);const out=[];const names=[];st.model.traverse(o=>{if(o.isMesh)names.push(o.name)});window.__names=names;
  for(const v of views){let hide=null;let vv=v;if(v.includes('|')){[vv,hide]=v.split('|')}
    st.model.traverse(o=>{if(o.isMesh)o.visible=!hide||o.name.startsWith(hide)});const a=vv.split(',').map(Number);st.view({pos:a.slice(0,3),look:a.slice(3,6),fov:a[6]||20});st.render();out.push(c.toDataURL('image/png'))}
  st.dispose();return out},[url,views]);
console.log(await pg.evaluate('window.__names'));res.forEach((d,i)=>fs.writeFileSync(`${outdir}/v${i}.png`,Buffer.from(d.split(',')[1],'base64')));
await b.close();s.close();
