import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importsOf, helpersOf } from '../../scripts/ui-deps.mjs';

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
  // Paths are relative to where it runs (scripts/ui-cache.mjs and the unit
  // tests run from the repository's root).
  assert.deepEqual(helpersOf('tests/unit/ui-deps/spec.mjs'), ['tests/unit/ui-deps/helper.mjs', 'tests/unit/ui-deps/shared.mjs']);
});

test('importsOf: an import written inside a string or comment mid-line isn\'t one', () => {
  assert.deepEqual(importsOf("const s = \"import x from './not.mjs'\"; // export * from './nor.mjs'"), []);
});
