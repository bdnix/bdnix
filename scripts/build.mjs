// Minifies the site's own scripts and points the pages at the results.
//
//   assets/js/foo.js  ->  assets/js/foo.min.js (+ foo.min.js.map)
//
// Every <script src="/assets/js/foo.js?v=..."> or "foo.min.js?v=..." in the
// HTML is rewritten to "/assets/js/foo.min.js?v=<hash of the minified file>",
// so browsers pick up new code as soon as it changes. Edit the plain .js
// files; the .min.js files are generated (CI rebuilds and commits them on
// master). Output is deterministic, so a rebuild with no source changes
// leaves every file untouched.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = path.join(root, 'assets/js');
const check = process.argv.includes('--check');

const sources = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js')).sort();
const versions = {};
const changed = [];

function write(file, content){
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old === content) return;
  changed.push(path.relative(root, file));
  if (!check) fs.writeFileSync(file, content);
}

for (const file of sources) {
  const name = file.replace(/\.js$/, '');
  const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
  // Every script is wrapped in its own function, so local names can be
  // shortened safely; anything shared goes through window.* properties.
  const out = await minify({ [file]: code }, {
    ecma: 2017,
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
    sourceMap: { filename: `${name}.min.js`, url: `${name}.min.js.map` }
  });
  write(path.join(jsDir, `${name}.min.js`), out.code + '\n');
  write(path.join(jsDir, `${name}.min.js.map`), out.map + '\n');
  versions[name] = crypto.createHash('sha256').update(out.code).digest('hex').slice(0, 10);
}

// Pages: every index.html outside tooling folders.
function pages(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || ['node_modules', 'tests', 'scripts', 'assets'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? pages(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

const missing = new Set();
for (const page of pages(root)) {
  const html = fs.readFileSync(page, 'utf8');
  const next = html.replace(/\/assets\/js\/([\w-]+?)(?:\.min)?\.js(?:\?v=[\w.-]*)?(?=["'])/g, (match, name) => {
    if (!versions[name]) { missing.add(`${path.relative(root, page)}: ${match}`); return match; }
    return `/assets/js/${name}.min.js?v=${versions[name]}`;
  });
  write(page, next);
}

if (missing.size) {
  console.error('Pages load scripts that have no source in assets/js:\n  ' + [...missing].join('\n  '));
  process.exit(1);
}
const verb = check ? 'out of date' : 'updated';
console.log(changed.length ? `${changed.length} file(s) ${verb}:\n  ${changed.join('\n  ')}` : 'Everything is up to date.');
if (check && changed.length) process.exit(1);
