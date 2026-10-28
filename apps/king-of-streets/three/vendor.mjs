// Vendors three.js for King of Streets: `node apps/king-of-streets/three/vendor.mjs <three package dir>`
// (an npm install of three@0.170.0). Copies the minified module build and the
// add-ons the game uses into vendor/three/, flat, with their imports of
// 'three' and of each other rewritten to the copies beside them, so the game
// can import() them with no import map (a page's inline import map would need
// an inline script, which its security policy forbids). Every import names the
// version as ?v=, as the game's own import() does: one URL for each file, or
// the browser would load three.js twice.
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '0.170.0';
const src = process.argv[2];
if (!src) throw new Error('usage: node vendor.mjs <path to node_modules/three>');
const pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
if (pkg.version !== VERSION) throw new Error(`three ${pkg.version}, expected ${VERSION}`);
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'vendor', 'three');
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(src, 'build/three.module.min.js'), path.join(out, 'three.module.min.js'));
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(out, 'LICENSE'));
const addons = ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js', 'libs/meshopt_decoder.module.js', 'loaders/RGBELoader.js'];
for (const a of addons) {
  const text = fs.readFileSync(path.join(src, 'examples/jsm', a), 'utf8')
    .replace(/from 'three'/g, `from './three.module.min.js?v=${VERSION}'`)
    .replace(/from '\.\.\/(utils|libs|loaders)\/([\w.]+)'/g, `from './$2?v=${VERSION}'`);
  if (/^(import|export|\})[^\n]*from '(?!\.\/[\w.]+\?v=)/m.test(text)) throw new Error(`${a} imports something not vendored`);
  fs.writeFileSync(path.join(out, path.basename(a)), text);
}
console.log('three', VERSION, '→', out);
