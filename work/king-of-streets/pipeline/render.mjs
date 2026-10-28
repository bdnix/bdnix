import http from 'http';import fs from 'fs';import path from 'path';
import {chromium} from 'playwright-core';
const root=process.cwd();
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
export function serve(){return new Promise(res=>{const s=http.createServer((q,a)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){a.writeHead(404);a.end();return}a.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});a.end(d)})}).listen(0,()=>res(s))})}
export async function open(w=800,h=500){
  const s=await serve();const port=s.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:w,height:h}});
  pg.on('pageerror',e=>console.log('pageerror',e.message));pg.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
  await pg.goto(`http://localhost:${port}/viewer.html?w=${w}&h=${h}`);await pg.waitForFunction('window.ready');
  return {pg,close:async()=>{await b.close();s.close()}};
}
export async function shot(pg,pos,target,fov,file){const d=await pg.evaluate(([p,t,f])=>window.shot(p,t,f),[pos,target,fov]);fs.writeFileSync(file,Buffer.from(d.split(',')[1],'base64'))}
