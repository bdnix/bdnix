// Runs the site's browser scripts inside a Node sandbox so their pure
// functions can be unit tested without a browser. Each script attaches
// itself to `window`, which here is the sandbox itself. Scripts are named by
// their place in the repository (shared/files/files.js). lang.js runs first
// for the scripts that use it, as every page loads it first, with its list
// of languages filled in as the site serves it (tools/languages.mjs), but
// without the packs' stamps, so only each language's language.json is read. A module's translations
// (lang/<code>.json files, in a row) are loaded as one pack.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillLanguages, list } from '../../tools/languages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LANG_JS = 'shared/lang/lang.js';

// Whether a script may count on lang.js: one still in assets/js may (every
// page loads it), and a module's if its module uses the lang module, or
// one that does. Reads only those modules' module.json.
function usesLang(file){
  const m = /^(apps|shared|site)\/([\w-]+)\//.exec(file);
  if (!m) return true;
  const seen = new Set(), todo = [`${m[1]}/${m[2]}`];
  while (todo.length) {
    const dir = todo.pop();
    if (dir === 'shared/lang') return true;
    if (seen.has(dir)) continue;
    seen.add(dir);
    const uses = JSON.parse(fs.readFileSync(path.join(root, dir, 'module.json'), 'utf8')).uses || [];
    todo.push(...uses.map((u) => `shared/${u}`));
  }
  return false;
}

export function load(files, globals = {}){
  const sandbox = { console, ...globals };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  // Every page loads lang.js first (the visitor's language), so the scripts
  // that use it can count on it. In English, as here, it leaves their words
  // as they are.
  const given = [].concat(files);
  const all = !given.length || given.some((f) => f !== LANG_JS && !f.endsWith('.json') && usesLang(f)) ? [LANG_JS].concat(given) : given;
  for (let i = 0; i < all.length; i++) {
    // An absolute filename lets coverage tools attribute the code to the file.
    const abs = path.join(root, all[i]);
    if (all[i].endsWith('.json')) {
      const words = {};
      for (; i < all.length && all[i].endsWith('.json'); i++) Object.assign(words, JSON.parse(fs.readFileSync(path.join(root, all[i]), 'utf8')));
      i--;
      vm.runInContext(`window.bdnixLang.pack(${JSON.stringify(words)});`, sandbox);
      continue;
    }
    const source = fs.readFileSync(abs, 'utf8');
    vm.runInContext(all[i] === LANG_JS ? fillLanguages(source, list(root, { stamps: false })) : source, sandbox, { filename: abs });
  }
  return sandbox;
}

// Values made inside the sandbox have that realm's Array/Object prototypes,
// which assert.deepStrictEqual treats as different. This copies them over.
export const plain = (value) => JSON.parse(JSON.stringify(value));

export function fakeStorage(initial = {}){
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    get length(){ return map.size; },
    map
  };
}

// Just enough `document` for profile.js: elements found by attribute selector.
export function fakeDocument(){
  const bySelector = { '[data-profile-name]': [{ textContent: '' }], '[data-profile-initial]': [{ textContent: '' }] };
  return {
    querySelectorAll: (sel) => bySelector[sel] || [],
    elements: bySelector
  };
}
