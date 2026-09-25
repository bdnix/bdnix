// Coverage settings shared by the unit tests, the UI tests and the combined
// report (monocart-coverage-reports). Only the site's own scripts count:
// assets/js/*.js, not the vendored libraries.

// Every path is reported as assets/js/<name>.js, whether it came from a
// sandboxed unit test (/abs/path/assets/js/x.js) or a page served over HTTP
// (localhost-4173/assets/js/x.js?v=<hash>). GitHub matches these paths
// against the repository, so they must be relative to its root.
export function sourcePath(filePath){
  // Pages link scripts as x.js?v=<hash>; the report turns that into
  // "x.js-v=<hash>", so drop the version to line up with the file itself.
  const clean = filePath.replace(/\\/g, '/').replace(/[?-]v=[\w.]+$/, '');
  const m = /assets\/js\/([\w-]+)\.js$/.exec(clean);
  return m ? `assets/js/${m[1]}.js` : filePath;
}

// Applied to paths as they arrive (before sourcePath), so normalise first.
export const sourceFilter = (p) => /^assets\/js\/[\w-]+\.js$/.test(sourcePath(p));

// One test suite's coverage: raw data for tests/coverage/report.config.mjs
// to combine, plus a summary table in the log.
export const suite = (name, extra = {}) => ({
  name: `bdnix ${name} test coverage`,
  outputDir: `coverage/${name}`,
  reports: ['raw', 'console-summary'],
  sourcePath,
  sourceFilter,
  ...extra
});
