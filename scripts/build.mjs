// Keeps browsers from using stale scripts and styles.
//
// Every <script src="/assets/js/foo.js?v=..."> and
// <link href="/assets/css/foo.css?v=..."> in the pages gets ?v= set to a
// hash of that file's contents, so the URL changes exactly when the file
// does. Run it after editing anything in assets/js or assets/css and commit
// the result; CI runs `npm run build:check` and fails a PR whose hashes are
// out of date. Vendored libraries keep their version number as ?v=.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);

// Pages: every .html file outside tooling folders.
function pages(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || ['node_modules', 'tests', 'scripts', 'assets', 'coverage'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? pages(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

const changed = [];
const missing = [];
for (const page of pages(root)) {
  const html = fs.readFileSync(page, 'utf8');
  const next = html.replace(/\/assets\/(js|css)\/([\w-]+)\.(js|css)(?:\?v=[\w.-]*)?(?=["'])/g, (match, dir, name, ext) => {
    const file = path.join(root, 'assets', dir, `${name}.${ext}`);
    if (!fs.existsSync(file)) { missing.push(`${path.relative(root, page)}: ${match}`); return match; }
    return `/assets/${dir}/${name}.${ext}?v=${hash(file)}`;
  });
  if (next !== html) {
    changed.push(path.relative(root, page));
    if (!check) fs.writeFileSync(page, next);
  }
}

if (missing.length) {
  console.error('Pages link to files that do not exist:\n  ' + missing.join('\n  '));
  process.exit(1);
}
if (!changed.length) {
  console.log('Everything is up to date.');
} else if (check) {
  console.error(`Cache-busting hashes are out of date in:\n  ${changed.join('\n  ')}\nRun \`npm run build\` and commit the changes.`);
  process.exit(1);
} else {
  console.log(`Updated ${changed.length} page(s):\n  ${changed.join('\n  ')}`);
}
