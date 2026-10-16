// A module's tests may use only what the module declares: its own files,
// those of the shared modules it uses, and what every page is made from
// (tools/modules.mjs, declared()). The test server logs every file it serves
// and which spec asked (SERVED_LOG, tests/server.mjs); after the run, any
// file a module's spec was served outside that fails the run, naming it.
// That's what keeps the result cache (scripts/ui-cache.mjs) honest about a
// module: what its tests use is what its module.json says.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { undeclared } from '../../tools/modules.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const log = () => process.env.SERVED_LOG;

// The test server's log (tests/server.mjs), one JSON line per response:
// spec → { files (the source files the responses were made from), responses
// (path → digest) }. A response no spec asked for ('') belongs to all of them.
export function readLog(text){
  const bySpec = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const { spec, path, digest, from } = JSON.parse(line);
    if (!bySpec.has(spec)) bySpec.set(spec, { files: new Set(), responses: {} });
    const s = bySpec.get(spec);
    for (const f of from) s.files.add(f);
    s.responses[path] = digest;
  }
  return bySpec;
}

// spec → the repository files served to it.
export function servedBySpec(text){
  return new Map([...readLog(text)].map(([spec, s]) => [spec, s.files]));
}

// Every problem: "<spec> used <file>, which its module doesn't declare".
// filesBySpec is spec → the files it was served (servedBySpec()); the UI
// result cache passes those of every spec, run or cached.
export function problems(filesBySpec){
  const out = [];
  for (const [spec, files] of filesBySpec) {
    for (const f of undeclared(root, spec, [...files])) out.push(`${spec} used ${f}, which its module doesn't declare (its own files, or a module in its uses)`);
  }
  return out;
}

export async function setup(){
  if (!log()) return;
  fs.mkdirSync(path.dirname(log()), { recursive: true });
  fs.writeFileSync(log(), '');
}

export async function teardown(){
  if (!log() || !fs.existsSync(log())) return;
  const found = problems(servedBySpec(fs.readFileSync(log(), 'utf8')));
  if (found.length) throw new Error('Undeclared inputs:\n  ' + found.join('\n  '));
}
