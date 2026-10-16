// UI test coverage: Chromium records which parts of each page's scripts
// ran, and tests/ui/fixtures.mjs writes it raw, one file per test, in a
// folder per spec under UI_COVERAGE. The UI result cache (scripts/ui-cache.mjs)
// keeps each spec's folder with its result and brings it back when the spec
// is skipped. merge() turns any set of those folders into coverage/ui. With
// `npm run coverage:ui`, setup clears the last run and teardown merges.
import fs from 'node:fs';
import path from 'node:path';
import { CoverageReport } from 'monocart-coverage-reports';
import { suite } from './shared.mjs';

const OUT = 'coverage/ui';
// COVERAGE=record keeps each spec's data but leaves the merge to the caller.
export const enabled = !!process.env.COVERAGE;
export const options = suite('ui', { entryFilter: (entry) => /\/assets\/js\/[\w-]+\.js(?:\?|$)/.test(entry.url) });

// Writes coverage/ui from every raw file in the given folders.
export async function merge(folders){
  const report = new CoverageReport(options);
  report.cleanCache();
  for (const dir of folders) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      await report.add(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    }
  }
  await report.generate();
}

const raw = () => process.env.UI_COVERAGE;
// The folders of every spec that wrote coverage in this run.
const specFolders = () => (raw() && fs.existsSync(raw()) ? fs.readdirSync(raw()).map((d) => path.join(raw(), d)) : []);

export async function setup(){
  if (!enabled || process.env.COVERAGE === 'record') return;
  fs.rmSync(OUT, { recursive: true, force: true });
  if (raw()) fs.rmSync(raw(), { recursive: true, force: true });
}

export async function teardown(){
  if (enabled && process.env.COVERAGE !== 'record') await merge(specFolders());
}
