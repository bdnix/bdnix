// Which test helpers a UI spec depends on: the files it imports, and the files
// those import, following relative imports only (packages come in through the
// lock file, which every spec depends on). scripts/ui-cache.mjs keys each
// spec's cached result on these, so changing a helper reruns only the specs
// that use it. Pure functions of the files' sources, so they can be unit tested.
import fs from 'node:fs';
import path from 'node:path';

// The relative paths a module's source imports from, as written: static
// imports and re-exports (each starting a line) and dynamic imports. Package
// imports are left out.
export function importsOf(source){
  const found = [];
  const re = /(?:^[ \t]*import\s+(?:[^'"`;]*?\s+from\s+)?|^[ \t]*export\s+[^'"`;]*?\s+from\s+|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(source))) found.push(m[1]);
  return found;
}

function readFile(file){
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

// Every file a module reaches through relative imports, not counting itself:
// repository-relative paths (as `file` is given), sorted. A file that can't
// be read is still listed, so its appearing later counts as a change.
// read(file) returns a file's source, or null.
export function helpersOf(file, read = readFile){
  const seen = new Set(), todo = [file];
  while (todo.length) {
    const from = todo.pop(), source = read(from);
    if (source === null) continue;
    for (const rel of importsOf(source)) {
      const dep = path.posix.normalize(path.posix.join(path.posix.dirname(from), rel));
      if (dep !== file && !seen.has(dep)) {
        seen.add(dep);
        todo.push(dep);
      }
    }
  }
  return [...seen].sort();
}
