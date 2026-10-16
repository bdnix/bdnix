// `npm run build`: makes the published site in _site/, which the Pages
// workflow (.github/workflows/pages.yml) deploys to www.bdnix.com.
//
// What's published is listed, not excluded: the landing page, every page in
// scripts/site.mjs (its folder's index.html), what each module publishes
// (its module.json's publish), assets/, the few files the site's root needs,
// and the files only the build makes (sitemap.xml and the language packs). Anything else in the repository (tests, tooling, docs,
// configs) stays out because it isn't on the list. Each file is written as
// tools/page.mjs serves it: pages with their generated parts and ?v= stamps,
// lang.js with its list of languages. Nothing generated is committed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, generated, check, sitePages } from './page.mjs';
import { modules } from './modules.mjs';

export const ROOT_FILES = ['CNAME', 'LICENSE', 'robots.txt'];

// Every file under dir, as paths relative to root with forward slashes.
// Dotfiles are left out.
function walk(root, dir){
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const rel = dir ? `${dir}/${e.name}` : e.name;
    return e.isDirectory() ? walk(root, rel) : [rel];
  });
}

// The paths of the published site, sorted. Fails if a page or a root file
// is missing.
export function publishedFiles(root, list = sitePages(root)){
  const files = [...ROOT_FILES];
  const fromModules = modules(root).published;
  for (const p of list) files.push(p.path.slice(1) + 'index.html');
  files.push(...walk(root, 'assets'));
  for (const f of files) if (!fromModules.has(f) && !fs.existsSync(path.join(root, f))) throw new Error(`${f} is published but doesn't exist`);
  files.push(...fromModules.keys());
  files.push(...generated(root));
  return [...new Set(files)].sort();
}

// Writes the published site to out, replacing what was there. Fails, naming
// every problem, if a page or translation is broken.
export function build(root, out, list){
  const files = publishedFiles(root, list || sitePages(root));
  const errors = check(root, list);
  const made = files.map((f) => {
    const served = serve(root, f, list || sitePages(root));
    errors.push(...served.errors);
    return [f, served.body];
  });
  if (errors.length) throw new Error('The site can\'t be built:\n  ' + [...new Set(errors)].join('\n  '));
  fs.rmSync(out, { recursive: true, force: true });
  for (const [f, body] of made) {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.writeFileSync(path.join(out, f), body);
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const files = build(root, path.join(root, '_site'));
    console.log(`Wrote ${files.length} files to _site/.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
