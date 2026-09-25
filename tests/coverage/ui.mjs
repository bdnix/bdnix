// UI test coverage: Chromium records which parts of each page's scripts
// ran; tests/ui/fixtures.mjs hands it over after every test. Setup clears
// the previous run and teardown writes the report to coverage/ui.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoverageReport } from 'monocart-coverage-reports';
import { report } from './shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OWN = /\/assets\/js\/([\w-]+)\.min\.js(?:\?|$)/;

export const enabled = !!process.env.COVERAGE;
export const options = report('ui', {
  entryFilter: (entry) => OWN.test(entry.url),
  // Scripts no test loaded still show up, at 0%.
  all: { dir: ['assets/js'], filter: { '**/*.min.js': false, '**/*.js': true } }
});

// Keeps the site's own scripts and attaches each one's source map from disk,
// so coverage is reported against the readable source, not the .min.js.
export async function save(entries){
  const own = entries.filter((e) => OWN.test(e.url));
  for (const entry of own) {
    const map = path.join(root, 'assets/js', OWN.exec(entry.url)[1] + '.min.js.map');
    if (!fs.existsSync(map)) continue;
    // The published maps leave out the source text to stay small; the
    // coverage report needs it, so fill it in from the files on disk.
    const sourceMap = JSON.parse(fs.readFileSync(map, 'utf8'));
    // Maps name their sources relative to the map ("merge.js"); name them
    // by repo path instead, matching the unit test coverage.
    sourceMap.sources = sourceMap.sources.map((s) => 'assets/js/' + path.basename(s));
    sourceMap.sourcesContent = sourceMap.sources.map((s) => fs.readFileSync(path.join(root, s), 'utf8'));
    entry.sourceMap = sourceMap;
  }
  if (own.length) await new CoverageReport(options).add(own);
}

export async function setup(){
  if (enabled) new CoverageReport(options).cleanCache();
}

export async function teardown(){
  if (enabled) await new CoverageReport(options).generate();
}
