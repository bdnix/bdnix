// Writes what the pages share, and keeps browsers from using stale scripts
// and styles.
//
// The parts of the pages that come from scripts/site.mjs are written between
// their markers: each page's title, description and share tags
// (<!-- build:meta -->), the footer (<!-- build:footer -->), the landing
// page's cards (<!-- build:cards games|tools -->) and the profile page's
// scores (<!-- build:scores -->). sitemap.xml is written from it too.
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
import { pages as site } from './site.mjs';
import { meta, footer, cards, scores, fill, sitemap } from './parts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);

// Pages: every .html file outside tooling folders.
function pages(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || ['node_modules', 'tests', 'scripts', 'tools', 'assets', 'coverage', '_site'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? pages(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

const changed = [];
const missing = [];

// Languages: each folder in assets/lang/ is one, with its name and digits in
// language.json and its translations (English text → translation) in its
// other .json files. They're bundled into assets/lang/<code>.js, which
// assets/js/lang.js loads for a visitor who reads that language, and listed
// in lang.js between its build:languages markers.
const LANG_DIR = path.join(root, 'assets', 'lang');
const languages = [{ code: 'en', name: 'English' }];
for (const code of fs.readdirSync(LANG_DIR).filter((f) => fs.statSync(path.join(LANG_DIR, f)).isDirectory()).sort()) {
  const dir = path.join(LANG_DIR, code);
  const about = JSON.parse(fs.readFileSync(path.join(dir, 'language.json'), 'utf8'));
  const words = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'language.json').sort()) {
    for (const [en, to] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')))) {
      if (en in words && JSON.stringify(words[en]) !== JSON.stringify(to)) missing.push(`assets/lang/${code}/${file}: "${en}" is translated differently elsewhere`);
      words[en] = to;
    }
  }
  const bundle = `// Made by scripts/build.mjs from assets/lang/${code}/*.json. Don't edit it here.\nwindow.bdnixLang.pack(${JSON.stringify(Object.fromEntries(Object.keys(words).sort().map((k) => [k, words[k]])), null, 1)});\n`;
  const out = path.join(LANG_DIR, `${code}.js`);
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== bundle) {
    changed.push(path.relative(root, out));
    if (!check) fs.writeFileSync(out, bundle);
  }
  const entry = { code, name: about.name };
  if (about.digits) entry.digits = about.digits;
  entry.file = `/assets/lang/${code}.js?v=${crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 10)}`;
  if (about.style) entry.style = `${about.style}?v=${hash(path.join(root, about.style))}`;
  languages.push(entry);
}
const langJs = path.join(root, 'assets', 'js', 'lang.js');
const langSrc = fs.readFileSync(langJs, 'utf8');
const langNext = langSrc.replace(/( *)\/\/ build:languages\n[\s\S]*?\1\/\/ \/build:languages/, (all, indent) =>
  `${indent}// build:languages\n${indent}var LANGUAGES = [\n${languages.map((l) => indent + '  ' + JSON.stringify(l)).join(',\n')}\n${indent}];\n${indent}// /build:languages`);
if (langNext !== langSrc) {
  changed.push('assets/js/lang.js');
  if (!check) fs.writeFileSync(langJs, langNext);
}
for (const page of pages(root)) {
  const html = fs.readFileSync(page, 'utf8');
  const route = '/' + path.relative(root, path.dirname(page)).split(path.sep).join('/') + '/';
  const entry = site.find((p) => p.path === route.replace('//', '/'));
  let next = html;
  if (entry) next = fill(next, 'meta', () => meta(entry));
  else if (next.includes('<!-- build:meta')) missing.push(`${path.relative(root, page)}: not in scripts/site.mjs`);
  next = fill(next, 'footer', footer);
  next = fill(next, 'cards', (list) => cards(site, list));
  next = fill(next, 'scores', () => scores(site));
  next = next.replace(/\/assets\/(js|css)\/([\w-]+)\.(js|css)(?:\?v=[\w.-]*)?(?=["'])/g, (match, dir, name, ext) => {
    const file = path.join(root, 'assets', dir, `${name}.${ext}`);
    if (!fs.existsSync(file)) { missing.push(`${path.relative(root, page)}: ${match}`); return match; }
    return `/assets/${dir}/${name}.${ext}?v=${hash(file)}`;
  });
  if (next !== html) {
    changed.push(path.relative(root, page));
    if (!check) fs.writeFileSync(page, next);
  }
}
for (const p of site) {
  const file = path.join(root, p.path, 'index.html');
  if (!fs.existsSync(file)) missing.push(`scripts/site.mjs: ${p.path} has no index.html`);
  else if (!fs.readFileSync(file, 'utf8').includes('<!-- build:meta -->')) missing.push(`${path.relative(root, file)}: no <!-- build:meta --> markers`);
}
const map = path.join(root, 'sitemap.xml');
if (!fs.existsSync(map) || fs.readFileSync(map, 'utf8') !== sitemap(site)) {
  changed.push('sitemap.xml');
  if (!check) fs.writeFileSync(map, sitemap(site));
}

if (missing.length) {
  console.error('Pages and scripts/site.mjs don\'t match up:\n  ' + missing.join('\n  '));
  process.exit(1);
}
if (!changed.length) {
  console.log('Everything is up to date.');
} else if (check) {
  console.error(`Generated parts or cache-busting hashes are out of date in:\n  ${changed.join('\n  ')}\nRun \`npm run build\` and commit the changes.`);
  process.exit(1);
} else {
  console.log(`Updated ${changed.length} page(s):\n  ${changed.join('\n  ')}`);
}
