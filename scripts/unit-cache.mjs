// `npm run coverage:unit:cached`: the unit tests with coverage, skipping every
// test file whose result is already known. CI runs this; locally, `npm run
// coverage:unit` still runs everything.
//
// Each test file runs in its own Node process, with tests/unit/track.mjs
// recording every repository file it reads, imports, lists or checks for.
// When it passes, the cache keeps that list, the file's coverage, and a key
// made from its inputs (scripts/test-deps.mjs): the test file, the helpers it
// imports, the files it used, the npm packages it imports as the lock file pins
// them, and the Node version. On the next run, a test file whose key still
// matches isn't run: its coverage is copied back instead, and coverage/unit
// ends up the same as if every test had run. So a change reruns exactly the
// test files that used what changed, and nothing else (not a line of
// package.json, not this runner). A test file that fails is never cached.
//
//   node scripts/unit-cache.mjs          run what's needed, update the cache
//   node scripts/unit-cache.mjs --plan   only say which test files would run
//
// The cache lives in .test-cache/unit (UNIT_CACHE_DIR overrides it); CI saves
// and restores that folder with actions/cache. UNIT_CACHE=off runs everything.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inputs, keyOf, testFiles, testName } from './test-deps.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const CACHE = path.resolve(process.env.UNIT_CACHE_DIR || '.test-cache/unit');
const OFF = process.env.UNIT_CACHE === 'off';
const TMP = path.resolve('.test-cache/run-unit');
const TRACK = pathToFileURL(path.resolve('tests/unit/track.mjs')).href;
// Entries no run has used for this long are dropped, so the cache stays small.
const MAX_AGE = 14 * 24 * 3600 * 1000;
// Coverage counts only the site's own scripts (tests/coverage/shared.mjs).
const OWN = /(assets\/js|(apps|shared|site)\/[\w-]+)\/[\w-]+\.js$/;
// Where the repository is, in stored coverage, so it can come back elsewhere.
const ROOT_MARK = '<repository>';

const tests = testFiles('unit');
const name = testName;
const key = (test, deps) => keyOf(inputs(test, deps));

function entries(test){
  const dir = path.join(CACHE, name(test));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((id) => {
    try { return [{ id, dir: path.join(dir, id), ...JSON.parse(fs.readFileSync(path.join(dir, id, 'entry.json'), 'utf8')) }]; }
    catch (e) { return []; }
  });
}

// The cache entry that still matches a test file as it is now, if any.
function hit(test){
  if (OFF) return null;
  return entries(test).find((e) => e.test === test && e.id === key(test, e.deps)) || null;
}

const plan = tests.map((test) => ({ test, hit: hit(test) }));
const run = plan.filter((p) => !p.hit).map((p) => p.test);
for (const p of plan) console.log(`${p.hit ? 'cached' : 'run   '} ${p.test}`);
console.log(`${run.length} of ${tests.length} test files to run.`);

if (process.argv.includes('--plan')) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${run.length}\n`);
  process.exit(0);
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// Runs one test file in its own process, recording what it used and its
// coverage. Resolves to whether it passed.
function runOne(test){
  const deps = path.join(TMP, `${name(test)}.deps`);
  const v8 = path.join(TMP, name(test), 'v8');
  fs.mkdirSync(v8, { recursive: true });
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', TRACK, test], {
      env: { ...process.env, UNIT_DEPS_LOG: deps, NODE_V8_COVERAGE: v8 },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      const passed = code === 0;
      const count = /^# pass (\d+)/m.exec(out);
      console.log(`${passed ? 'ok  ' : 'FAIL'} ${test}${count ? ` (${count[1]} tests)` : ''}`);
      if (!passed) console.log(out);
      resolve(passed);
    });
  });
}

let failed = 0;
const queue = [...run];
await Promise.all(Array.from({ length: Math.min(os.availableParallelism(), queue.length) }, async () => {
  while (queue.length) {
    const test = queue.shift();
    if (await runOne(test)) store(test);
    else failed++;
  }
}));

// Coverage of every test file, run now or cached, then the reports.
const ALL = path.join(TMP, 'all');
fs.mkdirSync(ALL, { recursive: true });
for (const p of plan) {
  const dir = p.hit ? path.join(p.hit.dir, 'coverage') : path.join(CACHE, name(p.test), key(p.test, readDeps(p.test)), 'coverage');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8').split(ROOT_MARK).join(JSON.stringify(root).slice(1, -1));
    fs.writeFileSync(path.join(ALL, `${name(p.test)}-${f}`), text);
  }
  if (p.hit) touch(p.hit);
}
const { CoverageReport } = await import('monocart-coverage-reports');
const { default: options } = await import('../tests/coverage/unit.config.mjs');
const report = new CoverageReport(options);
report.cleanCache();
await report.addFromDir(ALL);
await report.generate();
prune();
if (failed) console.error(`${failed} test file(s) failed.`);
process.exit(failed ? 1 : 0);

// The repository files a test file used in this run.
function readDeps(test){
  let text = '';
  try { text = fs.readFileSync(path.join(TMP, `${name(test)}.deps`), 'utf8'); } catch (e) {}
  return [...new Set(text.split('\n').filter(Boolean))].sort();
}

// Keeps a passing test file's result: what it used, and its coverage of the
// site's scripts (the rest of V8's data is dropped).
function store(test){
  const deps = readDeps(test);
  const id = key(test, deps);
  const dir = path.join(CACHE, name(test), id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'coverage'), { recursive: true });
  const v8 = path.join(TMP, name(test), 'v8');
  for (const f of fs.readdirSync(v8)) {
    const data = JSON.parse(fs.readFileSync(path.join(v8, f), 'utf8'));
    const result = (data.result || []).filter((r) => OWN.test(r.url));
    if (!result.length) continue;
    const text = JSON.stringify({ result }).split(JSON.stringify(root).slice(1, -1)).join(ROOT_MARK);
    fs.writeFileSync(path.join(dir, 'coverage', f), text);
  }
  fs.writeFileSync(path.join(dir, 'entry.json'), JSON.stringify({ test, used: Date.now(), deps }, null, 1));
}

function touch(entry){
  const { id, dir, ...data } = entry;
  fs.writeFileSync(path.join(dir, 'entry.json'), JSON.stringify({ ...data, used: Date.now() }, null, 1));
}

// Drops entries of test files that no longer exist and entries unused for a while.
function prune(){
  if (!fs.existsSync(CACHE)) return;
  const names = new Set(tests.map(name));
  for (const dir of fs.readdirSync(CACHE)) {
    if (!names.has(dir)) fs.rmSync(path.join(CACHE, dir), { recursive: true, force: true });
  }
  for (const test of tests) {
    for (const e of entries(test)) {
      if (!(Date.now() - e.used < MAX_AGE)) fs.rmSync(e.dir, { recursive: true, force: true });
    }
  }
}
