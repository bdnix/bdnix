// Loaded before a unit test (node --import) by scripts/unit-cache.mjs: writes
// every repository file the test reads, imports or requires to the file named
// by UNIT_DEPS_LOG, one path a line, so the cache knows what the test's result
// depends on. A folder it lists is written with a trailing '/' (its list of
// names counts, not what's in them), and a path it only checks for (existsSync,
// statSync) with a leading '?' (whether it exists counts, not what's in it).
// Packages (node_modules) are left out: they come in through the lock file.
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOG = process.env.UNIT_DEPS_LOG;
const SKIP = /^(node_modules|\.test-cache|coverage|\.git)(\/|$)/;

if (LOG) {
  const { appendFileSync } = fs;
  const seen = new Set();
  const note = (p, kind = '') => {
    if (typeof p !== 'string' && !(p instanceof URL)) return;
    const abs = path.resolve(p instanceof URL ? fileURLToPath(p) : p);
    if (!abs.startsWith(root + path.sep)) return;
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (SKIP.test(rel)) return;
    const line = kind === '?' ? '?' + rel : kind === '/' ? rel + '/' : rel;
    if (seen.has(line)) return;
    seen.add(line);
    appendFileSync(LOG, line + '\n');
  };
  const wrap = (obj, name, kind) => {
    const original = obj[name];
    obj[name] = function(p, ...rest){
      note(p, kind);
      return original.call(this, p, ...rest);
    };
  };
  wrap(fs, 'readFileSync');
  wrap(fs, 'readFile');
  wrap(fs.promises, 'readFile');
  wrap(fs, 'readdirSync', '/');
  wrap(fs, 'readdir', '/');
  wrap(fs.promises, 'readdir', '/');
  wrap(fs, 'existsSync', '?');
  // Asking what a path is (a folder?) is an existence check too.
  wrap(fs, 'statSync', '?');
  registerHooks({
    load(url, context, next){
      if (url.startsWith('file:')) note(new URL(url));
      return next(url, context);
    }
  });
}
