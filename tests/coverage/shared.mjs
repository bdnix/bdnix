// Coverage settings shared by the unit tests, the UI tests and the combined
// report (monocart-coverage-reports). Only the site's own scripts count: the
// modules' (apps/, shared/, site/) and those still in assets/js, not the
// vendored libraries or anyone's tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules } from '../../tools/modules.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const OWN = /^((apps|shared|site)\/[\w-]+|assets\/js)\/[\w-]+\.js$/;
// Where a module publishes each of its scripts: assets/js/sound.js → shared/sound/sound.js.
let published;
const sourceOf = (rel) => {
  published ||= modules(root).published;
  const from = published.get(rel);
  return from ? from.source : rel;
};

// Every path is reported as the script's place in the repository, whether
// it came from a sandboxed unit test (/abs/path/shared/sound/sound.js) or a
// page served over HTTP (localhost-4173/assets/js/sound.js?v=<hash>, which a
// module publishes from shared/sound/sound.js). GitHub matches these paths
// against the repository, so they must be relative to its root.
export function sourcePath(filePath){
  // Pages link scripts as x.js?v=<hash>; the report turns that into
  // "x.js-v=<hash>", so drop the version to line up with the file itself.
  const clean = filePath.replace(/\\/g, '/').replace(/[?-]v=[\w.]+$/, '');
  const mod = /(?:^|\/)((?:apps|shared|site)\/[\w-]+\/[\w-]+\.js)$/.exec(clean);
  if (mod) return mod[1];
  const m = /assets\/js\/([\w-]+)\.js$/.exec(clean);
  return m ? sourceOf(`assets/js/${m[1]}.js`) : filePath;
}

// Applied to paths as they arrive (before sourcePath), so normalise first.
export const sourceFilter = (p) => OWN.test(sourcePath(p));

// Every script of the site's own, for the scripts no test loads.
export const all = {
  dir: ['assets/js', 'apps', 'shared', 'site'].filter((d) => fs.existsSync(path.join(root, d))),
  filter: (p) => OWN.test(path.relative(root, path.resolve(root, p)).split(path.sep).join('/'))
};

// One test suite's coverage: lcov.info for CI to upload to Codecov (which
// combines the suites), raw data for tests/coverage/report.config.mjs to
// combine locally, and a summary table in the log.
export const suite = (name, extra = {}) => ({
  name: `bdnix ${name} test coverage`,
  outputDir: `coverage/${name}`,
  reports: ['raw', 'lcovonly', 'console-summary'],
  // Scripts the suite never loads still appear, at 0%, so a new script
  // without tests counts against the total.
  all,
  sourcePath,
  sourceFilter,
  ...extra
});
