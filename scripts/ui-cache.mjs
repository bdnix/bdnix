// `npm run coverage:ui:cached`: the UI tests with coverage, skipping every
// spec whose result is already known. CI runs this; locally, `npm run
// coverage:ui` still runs everything.
//
// A spec's result depends on the spec itself, the shared test code (see
// SHARED), and the site files it fetched from the test server. When a spec
// passes, the server's log (tests/server.mjs) says which files those were;
// the cache keeps that list, a hash of all those files' contents, and the
// spec's coverage. On the next run, a spec whose hash still matches isn't
// run: its coverage is copied back instead, and coverage/ui ends up the same
// as if every spec had run. A spec that fails, or any change to a file it
// used, means it runs again.
//
//   node scripts/ui-cache.mjs          run what's needed, update the cache
//   node scripts/ui-cache.mjs --plan   only say which specs would run
//
// The cache lives in .test-cache/ui (UI_CACHE_DIR overrides it); CI saves
// and restores that folder with actions/cache. UI_CACHE=off runs everything.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const CACHE = path.resolve(process.env.UI_CACHE_DIR || '.test-cache/ui');
const OFF = process.env.UI_CACHE === 'off';
const TMP = path.resolve('.test-cache/run');
const SERVED = path.join(TMP, 'served.log');
const RESULTS = path.join(TMP, 'results.json');
// Entries no run has used for this long are dropped, so the cache stays small.
const MAX_AGE = 14 * 24 * 3600 * 1000;

// Test code every spec shares: a change to any of it runs every spec again.
const SHARED = [
  'package-lock.json', 'package.json', 'playwright.config.mjs', 'tests/server.mjs', 'scripts/ui-cache.mjs',
  ...list('tests/coverage'), ...list('tests/ui').filter((f) => !f.endsWith('.spec.mjs'))
];

function list(dir){
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => `${dir}/${f}`).sort();
}

function fileHash(file){
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
  catch (e) { return 'missing'; }   // a file that appears later must still count as a change
}

const shared = crypto.createHash('sha256')
  .update(`node ${process.versions.node.split('.')[0]}\n`)
  .update(SHARED.map((f) => `${f} ${fileHash(f)}\n`).join(''))
  .digest('hex');

// The cache key of a spec, given the site files it used.
function key(spec, deps){
  const h = crypto.createHash('sha256').update(`${shared}\n${spec} ${fileHash(spec)}\n`);
  for (const dep of deps) h.update(`${dep} ${fileHash(dep)}\n`);
  return h.digest('hex').slice(0, 32);
}

const specs = list('tests/ui').filter((f) => f.endsWith('.spec.mjs'));
const name = (spec) => path.basename(spec, '.spec.mjs');

function entries(spec){
  const dir = path.join(CACHE, name(spec));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((id) => {
    try { return [{ id, dir: path.join(dir, id), ...JSON.parse(fs.readFileSync(path.join(dir, id, 'entry.json'), 'utf8')) }]; }
    catch (e) { return []; }
  });
}

// The cache entry that still matches a spec as it is now, if any.
function hit(spec){
  if (OFF) return null;
  return entries(spec).find((e) => e.spec === spec && e.id === key(spec, e.deps)) || null;
}

const plan = specs.map((spec) => ({ spec, hit: hit(spec) }));
const run = plan.filter((p) => !p.hit).map((p) => p.spec);
for (const p of plan) console.log(`${p.hit ? 'cached' : 'run   '} ${p.spec}`);
console.log(`${run.length} of ${specs.length} specs to run.`);

if (process.argv.includes('--plan')) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${run.length}\n`);
  process.exit(0);
}

const { specDir, merge } = await import('../tests/coverage/ui.mjs');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
fs.rmSync('coverage/ui', { recursive: true, force: true });

let status = 0;
if (run.length) {
  const result = spawnSync('npx', ['playwright', 'test', ...run], {
    stdio: 'inherit',
    env: { ...process.env, COVERAGE: 'record', SERVED_LOG: SERVED, UI_RESULTS: RESULTS }
  });
  status = result.status === null ? 1 : result.status;
  store(run);
}

// Bring back the coverage of every spec that was skipped, then merge.
for (const p of plan) {
  if (!p.hit) continue;
  fs.cpSync(path.join(p.hit.dir, 'coverage'), specDir(p.spec), { recursive: true });
  touch(p.hit);
}
await merge();
prune();
process.exit(status);

// Stores a cache entry for every spec that passed in this run.
function store(ran){
  const passed = passedSpecs();
  const served = readServed();
  // A request that didn't say which spec made it could belong to any of them.
  const anyone = served.get('') || new Set();
  for (const spec of ran) {
    if (!passed.has(spec)) continue;
    const deps = [...new Set([...(served.get(spec) || []), ...anyone])].sort();
    const id = key(spec, deps);
    const dir = path.join(CACHE, name(spec), id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(specDir(spec))) fs.cpSync(specDir(spec), path.join(dir, 'coverage'), { recursive: true });
    else fs.mkdirSync(path.join(dir, 'coverage'));
    fs.writeFileSync(path.join(dir, 'entry.json'), JSON.stringify({ spec, used: Date.now(), deps }, null, 1));
  }
  console.log(`Cached the results of ${[...passed].filter((s) => ran.includes(s)).length} passing specs.`);
}

// Specs where every test, at every screen size, passed (Playwright's JSON report).
function passedSpecs(){
  const passed = new Set();
  let report;
  try { report = JSON.parse(fs.readFileSync(RESULTS, 'utf8')); }
  catch (e) { return passed; }
  if (report.errors && report.errors.length) return passed;
  // Each top-level suite is a spec file. A test's own `file` can be a helper
  // that declared it (checkPage in tests/ui/checks.mjs), so it counts for the
  // spec it's in.
  const tests = new Map();
  (function walk(suites, file){
    for (const suite of suites || []) {
      const spec = file || `tests/ui/${suite.file}`;
      for (const s of suite.specs || []) {
        const ok = s.tests.length > 0 && s.tests.every((t) => t.status === 'expected');
        tests.set(spec, (tests.get(spec) ?? true) && ok);
      }
      walk(suite.suites, spec);
    }
  })(report.suites);
  for (const [file, ok] of tests) if (ok) passed.add(file);
  return passed;
}

// spec -> the repository files the test server served to it.
function readServed(){
  const served = new Map();
  let text = '';
  try { text = fs.readFileSync(SERVED, 'utf8'); } catch (e) {}
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [spec, file] = line.split('\t');
    if (!served.has(spec)) served.set(spec, new Set());
    served.get(spec).add(file);
  }
  return served;
}

function touch(entry){
  const { id, dir, ...data } = entry;
  fs.writeFileSync(path.join(dir, 'entry.json'), JSON.stringify({ ...data, used: Date.now() }, null, 1));
}

// Drops entries of specs that no longer exist and entries unused for a while.
function prune(){
  if (!fs.existsSync(CACHE)) return;
  const names = new Set(specs.map(name));
  for (const dir of fs.readdirSync(CACHE)) {
    if (!names.has(dir)) { fs.rmSync(path.join(CACHE, dir), { recursive: true, force: true }); continue; }
    for (const e of entries(`tests/ui/${dir}.spec.mjs`)) {
      if (!(Date.now() - e.used < MAX_AGE)) fs.rmSync(e.dir, { recursive: true, force: true });
    }
  }
}
