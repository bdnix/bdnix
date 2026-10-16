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

// spec → the repository files served to it, from the log's lines.
export function servedBySpec(text){
  const served = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [spec, file] = line.split('\t');
    if (!served.has(spec)) served.set(spec, new Set());
    served.get(spec).add(file);
  }
  return served;
}

// Every problem: "<spec> used <file>, which <module> doesn't declare".
export function problems(text){
  const out = [];
  for (const [spec, files] of servedBySpec(text)) {
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
  const found = problems(fs.readFileSync(log(), 'utf8'));
  if (found.length) throw new Error('Undeclared inputs:\n  ' + found.join('\n  '));
}
