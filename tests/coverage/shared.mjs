// Coverage settings shared by the unit tests, the UI tests and the combined
// report (monocart-coverage-reports). Only the site's own scripts count:
// assets/js/*.js and the modules' scripts (shared/<module>/*.js), not the
// vendored libraries or the tests.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules, publishMap } from '../../tools/modules.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Published path → the module file it's served from (shared/sound/sound.js
// is served at assets/js/sound.js).
const published = publishMap(root, modules(root).list);

// Every path is reported as the script's path in the repository, whether it
// came from a sandboxed unit test (/abs/path/assets/js/x.js,
// /abs/path/shared/sound/sound.js) or a page served over HTTP
// (localhost-4173/assets/js/x.js?v=<hash>, which may be served from a
// module). GitHub matches these paths against the repository, so they must
// be relative to its root.
export function sourcePath(filePath){
  // Pages link scripts as x.js?v=<hash>; the report turns that into
  // "x.js-v=<hash>", so drop the version to line up with the file itself.
  const clean = filePath.replace(/\\/g, '/').replace(/[?-]v=[\w.]+$/, '');
  const own = /(?:^|\/)((?:apps|shared|site)\/[\w-]+\/[\w-]+\.js)$/.exec(clean);
  if (own) return own[1];
  const m = /assets\/js\/([\w-]+)\.js$/.exec(clean);
  if (!m) return filePath;
  return published.get(`assets/js/${m[1]}.js`) || `assets/js/${m[1]}.js`;
}

// Applied to paths as they arrive (before sourcePath), so normalise first.
export const sourceFilter = (p) => /^(assets\/js|(apps|shared|site)\/[\w-]+)\/[\w-]+\.js$/.test(sourcePath(p));

// One test suite's coverage: lcov.info for CI to upload to Codecov (which
// combines the suites), raw data for tests/coverage/report.config.mjs to
// combine locally, and a summary table in the log.
export const suite = (name, extra = {}) => ({
  name: `bdnix ${name} test coverage`,
  outputDir: `coverage/${name}`,
  reports: ['raw', 'lcovonly', 'console-summary'],
  // Scripts the suite never loads still appear, at 0%, so a new script
  // without tests counts against the total.
  all: { dir: ['assets/js', 'shared'], filter: '**/*.js' },
  sourcePath,
  sourceFilter,
  ...extra
});
