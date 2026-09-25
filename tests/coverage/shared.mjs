// Coverage settings shared by the unit and UI tests
// (monocart-coverage-reports). Only the site's own scripts count:
// assets/js/*.js, not the vendored libraries.

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
// other tools, a table in the log, and coverage-details.md for the GitHub
// job summary. Unit and UI coverage stay separate reports: each shows what
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
  ...extra
});
