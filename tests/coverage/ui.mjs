// UI test coverage: Chromium records which parts of each page's scripts
// ran; tests/ui/fixtures.mjs hands it over after every test. Setup clears
// the previous run and teardown writes the report to coverage/ui.
import { CoverageReport } from 'monocart-coverage-reports';
import { report } from './shared.mjs';

const OWN = /\/assets\/js\/[\w-]+\.js(?:\?|$)/;

export const enabled = !!process.env.COVERAGE;
export const options = report('ui', {
  entryFilter: (entry) => OWN.test(entry.url),
  // Scripts no test loaded still show up, at 0%.
  all: { dir: ['assets/js'], filter: '**/*.js' }
});

export async function save(entries){
  const own = entries.filter((e) => OWN.test(e.url));
  if (own.length) await new CoverageReport(options).add(own);
}

export async function setup(){
  if (enabled) new CoverageReport(options).cleanCache();
}

export async function teardown(){
  if (enabled) await new CoverageReport(options).generate();
}
