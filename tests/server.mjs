// Tiny static file server for the UI tests (and `npm run serve`), so the
// site can be served without Python or extra packages. Mirrors GitHub Pages
// closely enough: /dir/ serves /dir/index.html, and .mjs is JavaScript.
// Every response is what the build publishes at that path (tools/page.mjs):
// pages with their generated parts and ?v= stamps, lang.js with its list of
// languages, the language packs and sitemap.xml made on the spot. The ?v= on
// a URL is ignored, as GitHub Pages ignores it.
// With SERVED_LOG set, it also appends one line per source file a response
// was made from (or the file it looked for, if there was none): the spec that
// asked (the x-bdnix-spec header tests/ui/fixtures.mjs adds), a tab, and the
// repository path. The UI result cache (scripts/ui-cache.mjs) reads it to
// learn which files each spec uses. A page's ?v= stamps aren't among them, so
// a stamp changing reruns nothing by itself.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/page.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 4173;
const log = process.env.SERVED_LOG;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  let rel = path.relative(root, file).split(path.sep).join('/');
  // A folder serves its index.html, whether it's in the repository or a
  // module publishes it.
  if (url.endsWith('/') || (fs.existsSync(file) && fs.statSync(file).isDirectory())) rel = path.posix.join(rel, 'index.html');
  let served = serve(root, rel);
  const page = !served && !rel.endsWith('.html') && serve(root, rel + '/index.html');
  if (page) { served = page; rel += '/index.html'; }
  if (log) fs.appendFileSync(log, (served ? served.from : [rel]).map((f) => `${req.headers['x-bdnix-spec'] || ''}\t${f}\n`).join(''));
  if (!served) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
  if (served.errors.length) {
    console.error(served.errors.join('\n'));
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(served.errors.join('\n'));
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(rel)] || 'application/octet-stream' }).end(served.body);
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
