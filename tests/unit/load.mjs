// Runs the site's browser scripts inside a Node sandbox so their pure
// functions can be unit tested without a browser. Each script attaches
// itself to `window`, which here is the sandbox itself.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function load(files, globals = {}){
  const sandbox = { console, ...globals };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of [].concat(files)) {
    // An absolute filename lets coverage tools attribute the code to the file.
    const abs = path.join(root, file);
    vm.runInContext(fs.readFileSync(abs, 'utf8'), sandbox, { filename: abs });
  }
  return sandbox;
}

// Each script is tested twice: the source, and the minified copy the site
// actually serves (built by scripts/build.mjs), to catch minifier breakage.
export const variants = (file) => [
  ['source', file],
  ['minified', file.replace(/\.js$/, '.min.js')]
];

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
