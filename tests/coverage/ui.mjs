// UI test coverage: Chromium records which parts of each page's scripts
// ran; tests/ui/fixtures.mjs hands it over after every test. Each spec's
// data is kept apart, in coverage/ui/specs/<spec>/.cache, so the UI result
// cache (scripts/ui-cache.mjs) can store it with the spec's result and bring
// it back when the spec is skipped. Setup clears the previous run and
// teardown merges every spec's data into coverage/ui.
import fs from 'node:fs';
import path from 'node:path';
import { CoverageReport } from 'monocart-coverage-reports';
import { suite } from './shared.mjs';

const OWN = /\/assets\/js\/[\w-]+\.js(?:\?|$)/;
const OUT = 'coverage/ui';
const SPECS = `${OUT}/specs`;

// COVERAGE=record keeps each spec's data but leaves the merge to the caller.
export const enabled = !!process.env.COVERAGE;
export const options = suite('ui', { entryFilter: (entry) => OWN.test(entry.url) });

// Where a spec's raw data goes: tests/ui/snake.spec.mjs -> coverage/ui/specs/snake/.cache
export const specDir = (file) => `${SPECS}/${path.basename(file).replace(/\.spec\.mjs$/, '')}/.cache`;

export async function save(file, entries){
  const own = entries.filter((e) => OWN.test(e.url));
  if (own.length) await new CoverageReport({ ...options, outputDir: path.dirname(specDir(file)) }).add(own);
}

// Gathers every spec's data into coverage/ui/.cache (file names are unique)
// and writes the reports from there, raw data included.
export async function merge(){
  const report = new CoverageReport(options);
  report.cleanCache();
  for (const name of fs.existsSync(SPECS) ? fs.readdirSync(SPECS) : []) {
    const dir = `${SPECS}/${name}/.cache`;
    if (fs.existsSync(dir)) fs.cpSync(dir, `${OUT}/.cache`, { recursive: true });
  }
  fs.rmSync(SPECS, { recursive: true, force: true });
  await report.generate();
}

export async function setup(){
  if (enabled) fs.rmSync(OUT, { recursive: true, force: true });
}

export async function teardown(){
  if (enabled && process.env.COVERAGE !== 'record') await merge();
}
