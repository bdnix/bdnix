// `npm run coverage:ui:cached`: the UI tests with coverage, skipping every
// spec whose result is already known. CI runs this; locally, `npm run
// coverage:ui` still runs everything.
//
// A spec's result is kept against what it depends on (uiInputs() in
// scripts/test-deps.mjs): its own code and the test helpers it imports, what
// every spec runs on (GLOBAL), the npm packages those use, the Node version,
// and every response the test server gave it, as a digest of its status,
// type and body (the test server logs them, tests/server.mjs). Not the code
// that made the responses: to see whether a cached spec still holds, this
// answers each path it fetched again, with the same code the test server
// answers with (respond() in tools/page.mjs), and compares. So a change to
// the build or the server that serves the same bytes reruns nothing, and one
// that changes a page reruns exactly the specs that fetched it. The cache
// keeps each passing spec's responses, the source files they came from (for
// the check that a module's specs use only what it declares,
// tests/ui/inputs.mjs) and its coverage, and a spec whose key still matches
// isn't run: its coverage is used instead. A spec that fails is never kept.
//
//   node scripts/ui-cache.mjs            run what's needed, then check and merge
//   node scripts/ui-cache.mjs --plan     only say which specs would run
//   node scripts/ui-cache.mjs --plan --shards=4
//                                        and share them out between four
//                                        machines (in CI, as the step outputs
//                                        run and shards, a JSON list of each
//                                        machine's specs)
//   node scripts/ui-cache.mjs --run a.spec.mjs b.spec.mjs
//                                        run just these specs, and keep the
//                                        results of those that pass; nothing
//                                        else (one machine's share)
//   node scripts/ui-cache.mjs --merge    after the shares have run (their
//                                        caches put together): check every
//                                        spec has a result, check the declared
//                                        inputs, and merge the coverage
//
// The cache lives in .test-cache/ui (UI_CACHE_DIR overrides it); CI saves
// and restores that folder with actions/cache. UI_CACHE=off runs everything.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { uiInputs, keyOf, testName, responseDigest } from './test-deps.mjs';
import { share } from './share.mjs';
import { respond } from '../tools/page.mjs';
import { readLog, problems } from '../tests/ui/inputs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const CACHE = path.resolve(process.env.UI_CACHE_DIR || '.test-cache/ui');
const OFF = process.env.UI_CACHE === 'off';
const TMP = path.resolve('.test-cache/run');
const SERVED = path.join(TMP, 'served.log');
const RESULTS = path.join(TMP, 'results.json');
const COVERAGE = path.join(TMP, 'coverage');
// Entries no run has used for this long are dropped, so the cache stays small.
const MAX_AGE = 14 * 24 * 3600 * 1000;
// What every spec runs on, whatever it imports: Playwright's settings and the
// fixture every spec's tests come from. Their imports and the packages they
// use come along (scripts/test-deps.mjs). A change to any of it runs every
// spec again. Nothing else is global: not the test server, the build, the
// coverage merge or the checks run around the specs.
export const GLOBAL = ['playwright.config.mjs', 'tests/ui/fixtures.mjs'];

const args = process.argv.slice(2);
const shards = Number((/^--shards=(\d+)$/.exec(args.find((a) => a.startsWith('--shards=')) || '') || [])[1] || 1);
const only = args.includes('--run') ? args.filter((a) => !a.startsWith('--')) : null;

function list(dir){
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.spec.mjs')).map((f) => `${dir}/${f}`).sort() : [];
}
// The modules' test folders: apps/snake/test, shared/files/test, ...
function moduleTests(){
  return ['apps', 'shared', 'site'].filter((top) => fs.existsSync(top)).flatMap((top) =>
    fs.readdirSync(top).sort().map((m) => `${top}/${m}/test`));
}
const specs = [...list('tests/ui'), ...moduleTests().flatMap(list)];
// The folder the fixture writes a spec's raw coverage in (tests/ui/fixtures.mjs).
const coverageFolder = (spec) => spec.replace(/\//g, '~');
const name = testName;

// The digest of the answer to a path now, asked once per run.
const now = new Map();
function digestNow(p){
  if (!now.has(p)) now.set(p, responseDigest(respond(root, p)));
  return now.get(p);
}
const key = (spec, responses) => keyOf(uiInputs(spec, responses, { global: GLOBAL }));

function entries(spec){
  const dir = path.join(CACHE, name(spec));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((id) => {
    try { return [{ id, dir: path.join(dir, id), ...JSON.parse(fs.readFileSync(path.join(dir, id, 'entry.json'), 'utf8')) }]; }
    catch (e) { return []; }
  });
}

// The cache entry that still matches a spec as it is now, if any: its code is
// the same, and every path it fetched answers as it did.
function hit(spec){
  if (OFF) return null;
  return entries(spec).find((e) => e.spec === spec && e.responses && e.id === key(spec, Object.fromEntries(Object.keys(e.responses).map((p) => [p, digestNow(p)])))) || null;
}

function plan(){
  return specs.map((spec) => ({ spec, hit: hit(spec) }));
}

// How long each spec last took, from any entry it has.
function durations(){
  return Object.fromEntries(specs.map((spec) => [spec, Math.max(0, ...entries(spec).map((e) => e.ms || 0))]));
}

if (args.includes('--merge')) process.exit(await merge());

let mine;
if (only) {
  const unknown = only.filter((s) => !specs.includes(s));
  if (unknown.length) { console.error(`Not specs: ${unknown.join(', ')}`); process.exit(1); }
  mine = only;
  console.log(`${mine.length} specs to run.`);
} else {
  const current = plan();
  mine = current.filter((p) => !p.hit).map((p) => p.spec);
  for (const p of current) console.log(`${p.hit ? 'cached' : 'run   '} ${p.spec}`);
  console.log(`${mine.length} of ${specs.length} specs to run.`);
  if (args.includes('--plan')) {
    const shares = share(mine, durations(), shards);
    if (shards > 1) shares.forEach((list, i) => console.log(`Machine ${i + 1} of ${shards}: ${list.length} specs.`));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${mine.length}\nshards=${JSON.stringify(shares.map((l) => l.join(' ')))}\n`);
    process.exit(0);
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

let status = 0;
if (mine.length) {
  const result = spawnSync('npx', ['playwright', 'test', ...mine], {
    stdio: 'inherit',
    env: { ...process.env, COVERAGE: 'record', UI_COVERAGE: COVERAGE, SERVED_LOG: SERVED, UI_RESULTS: RESULTS }
  });
  status = result.status === null ? 1 : result.status;
  store(mine);
}
if (!only) {
  const merged = await merge();
  status = status || merged;
}
process.exit(status);

// Stores a cache entry for every spec that passed in this run.
function store(ran){
  const { passed, ms } = report();
  const log = readLog(fs.existsSync(SERVED) ? fs.readFileSync(SERVED, 'utf8') : '');
  // A response no spec asked for could belong to any of them.
  const anyone = log.get('') || { files: new Set(), responses: {} };
  let kept = 0;
  for (const spec of ran) {
    if (!passed.has(spec)) continue;
    const own = log.get(spec) || { files: new Set(), responses: {} };
    const responses = { ...anyone.responses, ...own.responses };
    const files = [...new Set([...own.files, ...anyone.files])].sort();
    const id = key(spec, responses);
    const dir = path.join(CACHE, name(spec), id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'coverage'), { recursive: true });
    const cov = path.join(COVERAGE, coverageFolder(spec));
    if (fs.existsSync(cov)) fs.cpSync(cov, path.join(dir, 'coverage'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'entry.json'), JSON.stringify({ spec, used: Date.now(), ms: ms.get(spec) || 0, responses, files }, null, 1));
    kept++;
  }
  console.log(`Cached the results of ${kept} passing specs.`);
}

// Which specs passed every test at every screen size, and how long each
// took (Playwright's JSON report).
function report(){
  const passed = new Set(), ms = new Map();
  let data;
  try { data = JSON.parse(fs.readFileSync(RESULTS, 'utf8')); }
  catch (e) { return { passed, ms }; }
  // An error outside any test (the setup or teardown) means nothing passed.
  if (data.errors && data.errors.length) return { passed, ms };
  // Each top-level suite is a spec file. A test's own `file` can be a helper
  // that declared it (checkPage in tests/ui/checks.mjs), so it counts for the
  // spec it's in.
  const ok = new Map();
  (function walk(suites, file){
    for (const suite of suites || []) {
      const spec = file || suite.file;
      for (const s of suite.specs || []) {
        ok.set(spec, (ok.get(spec) ?? true) && s.tests.length > 0 && s.tests.every((t) => t.status === 'expected'));
        for (const t of s.tests) for (const r of t.results || []) ms.set(spec, (ms.get(spec) || 0) + (r.duration || 0));
      }
      walk(suite.suites, spec);
    }
  })(data.suites);
  for (const [spec, good] of ok) if (good) passed.add(spec);
  return { passed, ms };
}

// After the specs have run (here, or in shards whose caches were put
// together): every spec must now have a matching cache entry, every spec's
// served files must be declared by its module, and coverage/ui is made from
// every spec's coverage. Returns the exit status.
async function merge(){
  const all = plan();
  const missing = all.filter((p) => !p.hit).map((p) => p.spec);
  if (missing.length) console.error(`No passing result for ${missing.length} specs:\n  ${missing.join('\n  ')}`);
  const found = problems(new Map(all.filter((p) => p.hit).map((p) => [p.spec, p.hit.files])));
  if (found.length) console.error('Undeclared inputs:\n  ' + found.join('\n  '));
  const { merge: mergeCoverage } = await import('../tests/coverage/ui.mjs');
  fs.rmSync('coverage/ui', { recursive: true, force: true });
  await mergeCoverage(all.filter((p) => p.hit).map((p) => path.join(p.hit.dir, 'coverage')));
  for (const p of all) if (p.hit) touch(p.hit);
  prune();
  return missing.length || found.length ? 1 : 0;
}

function touch(entry){
  const { id, dir, ...data } = entry;
  fs.writeFileSync(path.join(dir, 'entry.json'), JSON.stringify({ ...data, used: Date.now() }, null, 1));
}

// Drops entries of specs that no longer exist and entries unused for a while.
function prune(){
  if (!fs.existsSync(CACHE)) return;
  const byName = new Map(specs.map((s) => [name(s), s]));
  for (const dir of fs.readdirSync(CACHE)) {
    if (!byName.has(dir)) { fs.rmSync(path.join(CACHE, dir), { recursive: true, force: true }); continue; }
    for (const e of entries(byName.get(dir))) {
      if (!(Date.now() - e.used < MAX_AGE)) fs.rmSync(e.dir, { recursive: true, force: true });
    }
  }
}
