// `npm run site`: assembles the published site in _site/, which the Pages
// workflow (.github/workflows/pages.yml) deploys to www.bdnix.com.
//
// What's published is listed, not excluded: the landing page, every page in
// scripts/site.mjs (its folder), assets/, and the few files the site's root
// needs. A page is its folder's index.html. Anything else in the repository (tests, tooling, docs, configs)
// stays out because it isn't on the list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from '../scripts/site.mjs';

export const ROOT_FILES = ['CNAME', 'LICENSE', 'robots.txt', 'sitemap.xml'];

// Every file under dir, as paths relative to root with forward slashes.
// Dotfiles are left out.
function walk(root, dir){
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const rel = dir ? `${dir}/${e.name}` : e.name;
    return e.isDirectory() ? walk(root, rel) : [rel];
  });
}

// The repository files that make up the published site, sorted. Fails if a
// page or a root file is missing.
export function publishedFiles(root, list = pages){
  const files = [...ROOT_FILES];
  for (const p of list) files.push(p.path.slice(1) + 'index.html');
  files.push(...walk(root, 'assets'));
  for (const f of files) if (!fs.existsSync(path.join(root, f))) throw new Error(`${f} is published but doesn't exist`);
  return [...new Set(files)].sort();
}

export function build(root, out, list = pages){
  fs.rmSync(out, { recursive: true, force: true });
  const files = publishedFiles(root, list);
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.copyFileSync(path.join(root, f), path.join(out, f));
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = build(root, path.join(root, '_site'));
  console.log(`Wrote ${files.length} files to _site/.`);
}
