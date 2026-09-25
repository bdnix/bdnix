// Coverage settings shared by the unit and UI tests
// (monocart-coverage-reports). Only the site's own readable scripts
// count: assets/js/*.js. Vendored libraries and the .min.js copies are left
// out; the UI tests load the .min.js files, and their source maps map the
// coverage back onto the readable files.

// Every path is reported as assets/js/<name>.js, whether it came from a
// sandboxed unit test (/abs/path/assets/js/x.js) or a page served over HTTP
// and mapped through a source map (localhost-4173/assets/js/x.js).
export function sourcePath(filePath){
  const m = /assets\/js\/([\w-]+)\.js$/.exec(filePath.replace(/\\/g, '/'));
  return m ? `assets/js/${m[1]}.js` : filePath;
}

// Applied to paths as they arrive (before sourcePath), so normalise first.
export const sourceFilter = (p) => /^assets\/js\/[\w-]+\.js$/.test(sourcePath(p));

// The report for one test suite: an HTML page (index.html), lcov.info for
// other tools, a table in the log, and coverage-details.md for the GitHub
// job summary. Unit and UI coverage stay separate reports: the UI numbers
// come through source maps, and merging them with the unit numbers would
// under-count lines that only one suite runs.
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
