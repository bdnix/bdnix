import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { importsOf, helpersOf, packagesOf, locked, inputs, keyOf, readFile, testName } from '../../scripts/test-deps.mjs';

// A pretend repository: path -> source (missing paths can't be read).
const repo = (files) => (file) => (file in files ? files[file] : null);

test('importsOf: static imports, re-exports and dynamic imports, relative ones only', () => {
  const source = [
    "import { test, expect } from './fixtures.mjs';",
    "import AxeBuilder from '@axe-core/playwright';",
    "import * as coverage from '../coverage/ui.mjs';",
    'import "./side-effect.mjs";',
    'import {\n  a,\n  b\n} from "./multi.mjs";',
    "export { inNewWindow } from './downloads.mjs';",
    "export * from './everything.mjs';",
    "const lazy = await import('./lazy.mjs');",
    "import fs from 'node:fs';",
    "const text = 'not an import from ./nowhere.mjs';"
  ].join('\n');
  assert.deepEqual(importsOf(source), [
    './fixtures.mjs', '../coverage/ui.mjs', './side-effect.mjs', './multi.mjs',
    './downloads.mjs', './everything.mjs', './lazy.mjs'
  ]);
  assert.deepEqual(importsOf('const x = 1;'), []);
});

test('helpersOf: everything a spec reaches, through imports of imports, as repository paths', () => {
  const read = repo({
    'tests/ui/chess.site.spec.mjs': "import { checkPage } from './checks.mjs';\nimport { checkGame } from './checks-game.mjs';",
    'tests/ui/checks.mjs': "import { test } from './fixtures.mjs';",
    'tests/ui/checks-game.mjs': "import { test } from './fixtures.mjs';\nimport { openGame } from './games.mjs';",
    'tests/ui/fixtures.mjs': "import * as coverage from '../coverage/ui.mjs';",
    'tests/coverage/ui.mjs': "import { suite } from './shared.mjs';",
    'tests/coverage/shared.mjs': '',
    'tests/ui/games.mjs': '',
    'tests/ui/pdfs.mjs': "import { inNewWindow } from './downloads.mjs';",
    'tests/ui/media.mjs': ''
  });
  assert.deepEqual(helpersOf('tests/ui/chess.site.spec.mjs', read), [
    'tests/coverage/shared.mjs', 'tests/coverage/ui.mjs', 'tests/ui/checks-game.mjs',
    'tests/ui/checks.mjs', 'tests/ui/fixtures.mjs', 'tests/ui/games.mjs'
  ]);
  // Helpers it doesn't import aren't its business.
  assert.ok(!helpersOf('tests/ui/chess.site.spec.mjs', read).includes('tests/ui/pdfs.mjs'));
  assert.deepEqual(helpersOf('tests/ui/games.mjs', read), []);
});

test('helpersOf: imports that go round in a circle, and a helper that is missing', () => {
  const read = repo({
    'tests/ui/a.spec.mjs': "import './b.mjs';",
    'tests/ui/b.mjs': "import './c.mjs';\nimport './a.spec.mjs';",
    'tests/ui/c.mjs': "import './b.mjs';\nimport './gone.mjs';"
  });
  // The spec itself isn't one of its helpers; a missing file is still listed,
  // so its appearing later changes the spec's key.
  assert.deepEqual(helpersOf('tests/ui/a.spec.mjs', read), ['tests/ui/b.mjs', 'tests/ui/c.mjs', 'tests/ui/gone.mjs']);
  assert.deepEqual(helpersOf('tests/ui/missing.spec.mjs', read), []);
});

test('helpersOf: reads the files on disk by default', () => {
  // Paths are relative to where it runs (scripts/ui-cache.mjs, scripts/unit-cache.mjs and the unit
  // tests run from the repository's root).
  assert.deepEqual(helpersOf('tests/unit/test-deps/spec.mjs'), ['tests/unit/test-deps/helper.mjs', 'tests/unit/test-deps/shared.mjs']);
});

test('importsOf: an import written inside a string or comment mid-line isn\'t one', () => {
  assert.deepEqual(importsOf("const s = \"import x from './not.mjs'\"; // export * from './nor.mjs'"), []);
});

test('packagesOf: the npm packages a module imports, by name', () => {
  const source = [
    "import { test, expect } from '@playwright/test';",
    "import AxeBuilder from '@axe-core/playwright';",
    "import { CoverageReport } from 'monocart-coverage-reports';",
    "import x from 'some-lib/deep/file.js';",
    "export { y } from 'other-lib';",
    "const z = await import('lazy-lib');",
    "import fs from 'node:fs';",
    "import path from 'path';",
    "import { helper } from './helper.mjs';"
  ].join('\n');
  assert.deepEqual(packagesOf(source), ['@axe-core/playwright', '@playwright/test', 'lazy-lib', 'monocart-coverage-reports', 'other-lib', 'some-lib']);
  assert.deepEqual(packagesOf("import fs from 'node:fs';"), []);
});

// A lock file: a uses b and c; c is nested under a at another version than
// the top-level one, which d uses.
const LOCK = { lockfileVersion: 3, packages: {
  '': { devDependencies: { a: '1', d: '1', eslint: '9' } },
  'node_modules/a': { version: '1.0.0', integrity: 'sha-a', dependencies: { b: '^2', c: '^1' } },
  'node_modules/b': { version: '2.0.0', integrity: 'sha-b' },
  'node_modules/a/node_modules/c': { version: '1.0.0', integrity: 'sha-c1' },
  'node_modules/c': { version: '3.0.0', integrity: 'sha-c3' },
  'node_modules/d': { version: '1.0.0', integrity: 'sha-d', dependencies: { c: '^3' }, peerDependencies: { b: '*' } },
  'node_modules/eslint': { version: '9.0.0', integrity: 'sha-e' }
} };

test('locked: a package and everything it needs, where Node would find them', () => {
  assert.deepEqual(locked(LOCK, ['a']), ['a@1.0.0 sha-a', 'b@2.0.0 sha-b', 'c@1.0.0 sha-c1']);
  assert.deepEqual(locked(LOCK, ['d']), ['b@2.0.0 sha-b', 'c@3.0.0 sha-c3', 'd@1.0.0 sha-d']);
  assert.deepEqual(locked(LOCK, []), []);
  // One that isn't installed still counts, so installing it is a change.
  assert.deepEqual(locked(LOCK, ['gone']), ['gone@missing']);
});

// A pretend repository for the keys: two UI specs and a unit test, the
// helpers they import, and package.json and the lock file.
function project(){
  return {
    'package.json': JSON.stringify({ scripts: { test: 'x' }, devDependencies: { '@playwright/test': '1.0.0', eslint: '9.0.0' } }),
    'package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: {
      'node_modules/@playwright/test': { version: '1.0.0', integrity: 'sha-pt', dependencies: { playwright: '1.0.0' } },
      'node_modules/playwright': { version: '1.0.0', integrity: 'sha-p' },
      'node_modules/eslint': { version: '9.0.0', integrity: 'sha-e' }
    } }),
    'playwright.config.mjs': "import { defineConfig } from '@playwright/test';",
    'tests/ui/fixtures.mjs': "import { test } from '@playwright/test';",
    'tests/ui/games.mjs': 'export const openGame = 1;',
    'tests/ui/a.spec.mjs': "import { test } from './fixtures.mjs';",
    'tests/ui/b.spec.mjs': "import { test } from './fixtures.mjs';\nimport { openGame } from './games.mjs';",
    'tests/unit/x.test.mjs': "import { test } from 'node:test';\nimport { load } from './load.mjs';",
    'tests/unit/load.mjs': "import fs from 'node:fs';",
    'snake/index.html': '<html>',
    'assets/js/snake.js': 'var x;',
    'assets/lang/': 'bn',
    '?assets/vendor/lib.js': 'file'
  };
}
const TESTS = [
  ['tests/ui/a.spec.mjs', ['snake/index.html']],
  ['tests/ui/b.spec.mjs', ['assets/js/snake.js']],
  ['tests/unit/x.test.mjs', ['assets/js/snake.js', 'assets/lang/', '?assets/vendor/lib.js']]
];
// Every test's key in a repository.
const keys = (files, node = '22') => Object.fromEntries(TESTS.map(([t, deps]) => [t, keyOf(inputs(t, deps, {
  global: t.startsWith('tests/ui/') ? ['playwright.config.mjs'] : [], read: (f) => (f in files ? files[f] : null), node
}))]));
// Which tests' keys differ between two repositories.
const rerun = (before, after) => { const a = keys(before), b = keys(after); return Object.keys(a).filter((t) => a[t] !== b[t]); };

test('keys: a script or a lint tool in package.json and the lock file reruns nothing', () => {
  const before = project(), after = project();
  after['package.json'] = JSON.stringify({ scripts: { test: 'x', site: 'node tools/site.mjs' }, devDependencies: { '@playwright/test': '1.0.0', eslint: '9.9.9' } });
  const lock = JSON.parse(after['package-lock.json']);
  lock.packages['node_modules/eslint'] = { version: '9.9.9', integrity: 'sha-e2' };
  after['package-lock.json'] = JSON.stringify(lock);
  assert.deepEqual(rerun(before, after), []);
});

test('keys: upgrading a package reruns the tests that import it, and only those', () => {
  const before = project(), after = project();
  const lock = JSON.parse(after['package-lock.json']);
  lock.packages['node_modules/playwright'] = { version: '1.1.0', integrity: 'sha-p2' };
  after['package-lock.json'] = JSON.stringify(lock);
  assert.deepEqual(rerun(before, after), ['tests/ui/a.spec.mjs', 'tests/ui/b.spec.mjs']);
});

test('keys: a helper, a site file or the Node version reruns only the tests that use it', () => {
  const change = (file, text) => { const after = project(); after[file] = text; return rerun(project(), after); };
  assert.deepEqual(change('tests/ui/games.mjs', 'export const openGame = 2;'), ['tests/ui/b.spec.mjs']);
  assert.deepEqual(change('snake/index.html', '<html lang="en">'), ['tests/ui/a.spec.mjs']);
  assert.deepEqual(change('assets/js/snake.js', 'var y;'), ['tests/ui/b.spec.mjs', 'tests/unit/x.test.mjs']);
  assert.deepEqual(change('tests/unit/load.mjs', '// changed'), ['tests/unit/x.test.mjs']);
  // What every UI spec runs on reruns every UI spec, but no unit test.
  assert.deepEqual(change('playwright.config.mjs', '// changed'), ['tests/ui/a.spec.mjs', 'tests/ui/b.spec.mjs']);
  // A file nobody uses reruns nothing.
  assert.deepEqual(change('assets/css/snake.css', 'body{}'), []);
  assert.deepEqual(change('tools/site.mjs', '// new'), []);
  const a = keys(project()), b = keys(project(), '24');
  assert.ok(TESTS.every(([t]) => a[t] !== b[t]), 'a new Node version reruns everything');
});

test('keys: a folder listed counts by its names, a file checked for by whether it exists', () => {
  const change = (file, text) => { const after = project(); after[file] = text; return rerun(project(), after); };
  assert.deepEqual(change('assets/lang/', 'bn\nfr'), ['tests/unit/x.test.mjs']);
  assert.deepEqual(change('?assets/vendor/lib.js', null), ['tests/unit/x.test.mjs']);
  // Its contents changing is no business of a test that only checked it exists.
  assert.deepEqual(change('assets/vendor/lib.js', 'changed'), []);
});

test('track.mjs: notes what a test reads, imports, lists and checks for', () => {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bdnix-track-')), 'deps.log');
  const run = spawnSync(process.execPath, ['--import', './tests/unit/track.mjs', 'tests/unit/test-deps/tracked.mjs'], { env: { ...process.env, UNIT_DEPS_LOG: log } });
  assert.equal(run.status, 0, String(run.stderr));
  assert.deepEqual(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).sort(), [
    '?tests/unit/test-deps/nowhere.mjs', 'package.json', 'tests/unit/test-deps/',
    'tests/unit/test-deps/helper.mjs', 'tests/unit/test-deps/shared.mjs', 'tests/unit/test-deps/tracked.mjs'
  ]);
});

test('readFile: a file, a folder\'s names, whether a path exists, or null', () => {
  assert.match(readFile('tests/unit/test-deps/shared.mjs'), /export const shared/);
  assert.equal(readFile('tests/unit/test-deps/'), 'helper.mjs\nshared.mjs\nspec.mjs\ntracked.mjs');
  assert.equal(readFile('?tests/unit/test-deps/shared.mjs'), 'file');
  assert.equal(readFile('?tests/unit/test-deps'), 'folder');
  assert.equal(readFile('?tests/unit/test-deps/nowhere.mjs'), null);
  assert.equal(readFile('tests/unit/test-deps/nowhere.mjs'), null);
});

test('testName: a short name for each test file, unique among them', () => {
  assert.equal(testName('tests/ui/merge.spec.mjs'), 'merge');
  assert.equal(testName('tests/ui/merge.site.spec.mjs'), 'merge.site');
  assert.equal(testName('tests/unit/files.test.mjs'), 'files');
  assert.equal(testName('apps/snake/test/page.spec.mjs'), 'snake--page');
  assert.equal(testName('/abs/repo/shared/files/test/files.test.mjs'), 'files--files');
  assert.equal(testName('site\\landing\\test\\i18n.spec.mjs'), 'landing--i18n');
});
