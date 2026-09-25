// Coverage settings shared by the unit and UI tests
// (monocart-coverage-reports). Only the site's own scripts count:
// assets/js/*.js, not the vendored libraries.
import fs from 'node:fs';
import path from 'node:path';

// Every path is reported as assets/js/<name>.js, whether it came from a
// sandboxed unit test (/abs/path/assets/js/x.js) or a page served over HTTP
// (localhost-4173/assets/js/x.js?v=<hash>).
export function sourcePath(filePath){
  // Pages link scripts as x.js?v=<hash>; the report turns that into
  // "x.js-v=<hash>", so drop the version to line up with the file itself.
  const clean = filePath.replace(/\\/g, '/').replace(/[?-]v=[\w.]+$/, '');
  const m = /assets\/js\/([\w-]+)\.js$/.exec(clean);
  return m ? `assets/js/${m[1]}.js` : filePath;
}

// Applied to paths as they arrive (before sourcePath), so normalise first.
export const sourceFilter = (p) => /^assets\/js\/[\w-]+\.js$/.test(sourcePath(p));

// The report for one test suite: an HTML page (index.html), lcov.info for
// other tools, a table in the log, coverage-details.md for the GitHub job
// summary, and summary.json with the totals. Unit and UI coverage stay separate reports: each shows what
// its own suite runs.
export const report = (suite, extra = {}) => ({
  name: `bdnix ${suite} test coverage`,
  outputDir: `coverage/${suite}`,
  reports: [
    'v8',
    'lcovonly',
    'console-details',
    ['markdown-details', { baseUrl: '', color: 'Unicode' }]
  ],
  sourcePath,
  sourceFilter,
  // Totals for scripts/coverage-check.mjs, which compares them with
  // tests/coverage/baseline.json.
  onEnd: (results) => {
    const totals = {};
    for (const metric of METRICS) totals[metric] = results.summary[metric].pct;
    fs.writeFileSync(path.join(`coverage/${suite}`, 'summary.json'), JSON.stringify(totals, null, 2) + '\n');
  },
  ...extra
});

export const METRICS = ['lines', 'statements', 'branches', 'functions'];
