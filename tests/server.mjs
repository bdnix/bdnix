// Tiny static file server for the UI tests (and `npm run serve`), so the
// site can be served without Python or extra packages. Every response is
// what the build publishes at that path (respond() in tools/page.mjs): pages
// with their generated parts and ?v= stamps, lang.js with its list of
// languages, the language packs and sitemap.xml made on the spot. The ?v= on
// a URL is ignored, as GitHub Pages ignores it.
// With SERVED_LOG set, it also appends one line per response, as JSON: the
// spec that asked (the x-bdnix-spec header tests/ui/fixtures.mjs adds), the
// path, a digest of the response (scripts/test-deps.mjs) and the source files
// it was made from. The UI result cache (scripts/ui-cache.mjs) keeps each
// spec's result against the digests of what it was served, and the check that
// a module's specs use only what it declares (tests/ui/inputs.mjs) reads the
// source files.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { respond } from '../tools/page.mjs';
import { responseDigest } from '../scripts/test-deps.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 4173;
const log = process.env.SERVED_LOG;

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, 'http://x').pathname;
  const r = respond(root, urlPath);
  if (log) {
    const line = { spec: req.headers['x-bdnix-spec'] || '', path: urlPath, digest: responseDigest(r), from: r.from };
    fs.appendFileSync(log, JSON.stringify(line) + '\n');
  }
  if (r.errors.length) console.error(r.errors.join('\n'));
  res.writeHead(r.status, { 'Content-Type': r.type }).end(r.body);
});
// An idle connection stays open: Playwright reuses its connections, and one
// closed after Node's default five idle seconds can close just as the next
// request goes out on it, which the test sees as ECONNRESET.
server.keepAliveTimeout = 0;
server.listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
