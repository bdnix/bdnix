// What a test depends on, besides the site files it reads: the test helpers it
// imports (and those they import), and the npm packages those import, at the
// versions the lock file pins. scripts/ui-cache.mjs and scripts/unit-cache.mjs
// key each test's cached result on these, so changing a helper reruns only the
// tests that use it, and upgrading a package reruns only the tests that import
// it. Anything else in package.json or the lock file (a script, a lint tool)
// is nobody's input. Pure functions of the files' sources, so they can be unit
// tested.
import { builtinModules } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// The relative paths a module's source imports from, as written: static
// imports and re-exports (each starting a line), dynamic imports and
// require() calls. Package imports are left out.
export function importsOf(source){
  const found = [];
  const re = /(?:^[ \t]*import\s+(?:[^'"`;]*?\s+from\s+)?|^[ \t]*export\s+[^'"`;]*?\s+from\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(source))) found.push(m[1]);
  return found;
}

// A repository file's contents, or null if it can't be read. A path ending in
// '/' is a folder, read as its sorted list of names, so a file appearing in
// it, or leaving, is a change to whoever listed it. A path starting with '?'
// is only checked for: it reads as what it is ('file' or 'folder'), whatever
// is in it.
export function readFile(file){
  try {
    if (file.startsWith('?')) return fs.statSync(file.slice(1)).isDirectory() ? 'folder' : 'file';
    return file.endsWith('/') ? fs.readdirSync(file).sort().join('\n') : fs.readFileSync(file, 'utf8');
  } catch (e) { return null; }
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

// The npm packages a module's source imports, by package name ('@scope/name'
// or 'name'): static imports, re-exports and dynamic imports of bare
// specifiers. Node's own modules are left out.
export function packagesOf(source){
  const found = new Set();
  const re = /(?:^[ \t]*import\s+(?:[^'"`;]*?\s+from\s+)?|^[ \t]*export\s+[^'"`;]*?\s+from\s+|\bimport\s*\(\s*)['"]([^'"./][^'"]*)['"]/gm;
  let m;
  while ((m = re.exec(source))) {
    const spec = m[1];
    if (spec.startsWith('node:') || builtinModules.includes(spec.split('/')[0])) continue;
    const parts = spec.split('/');
    found.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
  }
  return [...found].sort();
}

// Every package the named ones need, as the lock file (package-lock.json,
// version 2 or 3) pins them: 'name@version integrity', sorted. A package is
// found where Node would find it: nested under the package that needs it, or
// further up. One that isn't installed is listed as missing, so installing it
// later counts as a change.
export function locked(lock, names){
  const packages = lock.packages || {};
  const seen = new Map();
  const todo = names.map((name) => ({ name, from: '' }));
  while (todo.length) {
    const { name, from } = todo.pop();
    let at = from;
    let key;
    for (;;) {
      const here = (at ? at + '/' : '') + 'node_modules/' + name;
      if (packages[here]) { key = here; break; }
      if (!at) break;
      const up = at.lastIndexOf('/node_modules/');
      at = up < 0 ? '' : at.slice(0, up);
    }
    if (!key) { seen.set('missing ' + name, `${name}@missing`); continue; }
    if (seen.has(key)) continue;
    const p = packages[key];
    seen.set(key, `${name}@${p.version} ${p.integrity || ''}`.trim());
    for (const dep of Object.keys({ ...p.dependencies, ...p.optionalDependencies, ...p.peerDependencies })) {
      todo.push({ name: dep, from: key });
    }
  }
  return [...new Set(seen.values())].sort();
}

// The packages a file and its helpers import, as the lock file pins them.
export function packagesUsed(files, lock, read = readFile){
  const names = new Set();
  for (const file of files) {
    const source = read(file);
    if (source !== null) for (const n of packagesOf(source)) names.add(n);
  }
  return locked(lock, [...names].sort());
}

// Everything a test's result depends on, one line each: the Node version it
// runs on; its own file, the helpers it imports (and the global files every
// test of its kind runs on, with theirs), and the repository files it read
// while it ran (deps), each with a hash of its contents; and the packages all
// of those import, as the lock file pins them. Nothing else: not package.json,
// not the rest of the lock file, not the runner that picks which tests run.
export function inputs(test, deps, { global = [], read = readFile, node = process.versions.node.split('.')[0] } = {}){
  const hash = (f) => { const c = read(f); return c === null ? 'missing' : crypto.createHash('sha256').update(c).digest('hex'); };
  const code = [...new Set([...global, test, ...[...global, test].flatMap((f) => helpersOf(f, read))])];
  const lock = JSON.parse(read('package-lock.json') || '{}');
  return [
    `node ${node}`,
    ...[...new Set([...code, ...deps])].sort().map((f) => `${f} ${hash(f)}`),
    ...packagesUsed(code, lock, read).map((p) => `package ${p}`)
  ];
}

// A test's cache key: a hash of its inputs.
export const keyOf = (lines) => crypto.createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 32);

// A test file's short name, unique among the tests, for the folders its
// cached result and coverage are kept in: tests/ui/snake.spec.mjs → snake,
// tests/unit/files.test.mjs → files, a module's
// apps/snake/test/page.spec.mjs → snake--page.
export function testName(file){
  const rel = file.replace(/\\/g, '/');
  const m = /(?:^|\/)(?:apps|shared|site)\/([\w-]+)\/test\/([\w.-]+?)\.(?:spec|test)\.mjs$/.exec(rel);
  return m ? `${m[1]}--${m[2]}` : path.posix.basename(rel).replace(/\.(spec|test)\.mjs$/, '');
}

// A digest of a response as a UI test saw it: its status, its content type
// and its body. The site's ?v= stamps (ten hex digits, tools/page.mjs) are
// left out of text: a stamp only names another file, which the test fetches,
// and so has as a response of its own, if it uses it. Vendored libraries'
// stamps are their version numbers, and stay.
export function responseDigest({ status, type, body }){
  let bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  if (/^(text\/|application\/(json|xml))/.test(type)) bytes = Buffer.from(bytes.toString('utf8').replace(/\?v=[0-9a-f]{10}(?![0-9a-f])/g, '?v='));
  return crypto.createHash('sha256').update(`${status} ${type}\n`).update(bytes).digest('hex').slice(0, 32);
}

// Everything a UI spec's result depends on, one line each: its code and what
// every spec runs on (inputs(), with no files of the site), and each path it
// fetched with a digest of the response it gets now (responses: { path:
// digest }). Not the code that made the responses: if the build or the test
// server changes but answers the same, the spec's result can't change.
export function uiInputs(spec, responses, options){
  return [...inputs(spec, [], options), ...Object.keys(responses).sort().map((p) => `GET ${p} ${responses[p]}`)];
}
