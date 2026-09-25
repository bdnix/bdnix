// Keeps test coverage from going down.
//
//   node scripts/coverage-check.mjs unit ui   compare with the baseline
//   node scripts/coverage-check.mjs --update  record the current numbers
//
// Reads coverage/<suite>/summary.json (written by `npm run coverage`) and
// tests/coverage/baseline.json (committed). A total more than its
// TOLERANCE below the baseline fails. One more than TOLERANCE above it
// passes with a reminder to raise the baseline, so the gain is locked in.
//
// TOLERANCE absorbs run-to-run noise with no code change. The games use
// random pieces, and some watermark preview paths depend on timing, so UI
// coverage moves slightly between runs and machines. Measured: lines and
// statements within 0.15 points; branches up to 0.4 (local 43.08% vs CI
// 42.69%), so branches get more room. A real untested feature moves these
// by whole points (40 untested lines in merge.js: branches -5.7).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { METRICS } from '../tests/coverage/shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOLERANCE = { lines: 0.5, statements: 0.5, functions: 0.5, branches: 1 };
const SUITES = ['unit', 'ui'];
const baselineFile = path.join(root, 'tests/coverage/baseline.json');
const ci = !!process.env.GITHUB_ACTIONS;

function current(suite){
  const file = path.join(root, `coverage/${suite}/summary.json`);
  if (!fs.existsSync(file)) {
    console.error(`No coverage for "${suite}". Run \`npm run coverage:${suite}\` first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const args = process.argv.slice(2);

if (args.includes('--update')) {
  const baseline = {};
  for (const suite of SUITES) baseline[suite] = current(suite);
  fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n');
  console.log('Updated tests/coverage/baseline.json:');
  for (const suite of SUITES) console.log(`  ${suite}: ` + METRICS.map((m) => `${m} ${baseline[suite][m]}%`).join(', '));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
let failed = false;
for (const suite of args.length ? args : SUITES) {
  const now = current(suite), was = baseline[suite];
  if (!was) { console.error(`tests/coverage/baseline.json has no "${suite}" entry.`); process.exit(1); }
  console.log(`${suite} coverage (baseline → now):`);
  for (const metric of METRICS) {
    const diff = now[metric] - was[metric], tol = TOLERANCE[metric];
    const line = `  ${metric.padEnd(10)} ${was[metric].toFixed(2)}% → ${now[metric].toFixed(2)}%`;
    if (diff < -tol) {
      failed = true;
      console.log(`${line}  ✗ down ${(-diff).toFixed(2)} points`);
      if (ci) console.log(`::error title=${suite} ${metric} coverage dropped::${suite} ${metric} coverage fell from ${was[metric]}% to ${now[metric]}%. Add tests for the new or changed code.`);
    } else if (diff > tol) {
      console.log(`${line}  ↑ up ${diff.toFixed(2)} points: raise the baseline`);
      if (ci) console.log(`::warning title=${suite} ${metric} coverage went up::Run \`npm run coverage\` then \`npm run coverage:baseline\` and commit tests/coverage/baseline.json, so the gain can't be lost later.`);
    } else {
      console.log(`${line}  ✓`);
    }
  }
}
if (failed) {
  console.error('\nCoverage dropped by more than the allowed noise. New and changed code needs tests; see AGENTS.md.');
  process.exit(1);
}
