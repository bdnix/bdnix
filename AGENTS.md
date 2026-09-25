# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository. Read this before changing anything. [README.md](README.md) has the user-facing details.

## What this is

The static site behind [www.bdnix.com](https://www.bdnix.com), hosted on GitHub Pages from `master`. There's no framework and no compile step: pages are plain HTML, CSS and vanilla JavaScript, served as they are in the repo.

| Page | Files |
|---|---|
| Landing `/` | `index.html`, `assets/css/style.css`, `assets/js/main.js` |
| Tetris `/play/` | `play/index.html`, `assets/css/tetris.css`, `assets/js/tetris.js` |
| Pac-Man `/pacman/` | `pacman/index.html`, `assets/css/pacman.css`, `assets/js/pacman.js` |
| Merge PDFs `/merge-pdf/` | `merge-pdf/index.html`, `assets/css/merge.css`, `assets/js/merge.js` |
| Watermark `/watermark-pdf/` | `watermark-pdf/index.html`, `assets/css/watermark.css`, `assets/js/watermark.js`, `assets/js/watermark-layout.js` |
| Redact `/redact-pdf/` | `redact-pdf/index.html`, `assets/css/redact.css`, `assets/js/redact.js`, `assets/js/redact-core.js` |
| Profile `/profile/` | `profile/index.html`, `assets/css/profile.css`, `assets/js/profile-page.js` |

Shared across pages:
- `assets/css/base.css`: colour tokens and shared components (header, buttons, panels, profile chip).
- `assets/css/game.css`: the game pages' shared layout.
- `assets/css/tool.css`: the tool and profile pages' shared layout, including the preview-and-settings editor used by the watermark and redact pages.
- `assets/js/blocks.js`: the falling-block backdrop (`window.bdnix`).
- `assets/js/pdftools.js`: page-range parsing, file helpers, dropping files on the page, and the on-demand PDF.js loader (`window.bdnixPdf`).
- `assets/js/profile.js`: the visitor's name and scores (`window.bdnixProfile`).

Third-party libraries are vendored in `assets/vendor/` (pdf-lib, PDF.js, fontkit), each with its licence file.

## Ground rules

- **Everything runs in the browser.** Files the visitor opens are never uploaded; there is no server. Don't add anything that sends user data anywhere, including analytics, and don't add external scripts. Load libraries from `assets/vendor/`, not a CDN.
- **Keep it dependency-free at runtime.** No frameworks and no bundler. `package.json` holds dev tooling only (tests, coverage, the cache-busting script).
- **Match the existing code.** Each script is one IIFE, `(function(){ ... })();`, in ES5-style `var`/`function` code. A script that other scripts use exposes one `window.bdnix*` object. Comment density, naming and CSS style should match the file you're in.
- **Reuse, don't duplicate.** Use the tokens in `base.css`, the layout in `tool.css`, and the helpers in `pdftools.js` / `profile.js`. If two pages need the same logic, move it into a shared file.
- **Pure logic goes in its own file** (as in `watermark-layout.js`, `redact-core.js` and `pdftools.js`), so it can be unit tested without a browser. Keep DOM code in the page scripts.
- **Phone-sized screens matter.** Every page must work at 390 px wide with no sideways scrolling, and with touch as well as mouse and keyboard.
- **Browser storage is optional.** Wrap every `localStorage` / IndexedDB access in `try/catch`; pages must work without it (private browsing). The keys in use are `bdnix_visits`, `bdnix_name`, `bdnix_tetris_best`, `bdnix_pacman_best` and `bdnix_watermark_v1` (localStorage), and the `bdnix-tools` database (IndexedDB). Don't rename them, since visitors' saved data would be lost.

## Tests are required

**Every new feature and every bug fix must come with tests in the same change.** A pull request that adds or changes behaviour without tests isn't done.

- **Unit tests** (`tests/unit/*.test.mjs`, Node's built-in `node:test`) are for pure logic: parsing, maths, data rules. They load a script into a sandbox with `load()` from `tests/unit/load.mjs`, which also provides fake `localStorage` and `document`. New pure logic needs unit tests covering its normal cases, edge cases and errors.
- **UI tests** (`tests/ui/*.spec.mjs`, Playwright) are for what a visitor sees and does. Import `test` and `expect` from `tests/ui/fixtures.mjs`, not from `@playwright/test`: the fixture fails the test on any uncaught page error, keeps the tests offline and records coverage. Each test runs at desktop and phone size. Build test files in code (see `tests/ui/pdfs.mjs`) rather than committing binaries, and check real output: open downloaded PDFs and assert on their contents.
- **A bug fix needs a test that fails without the fix.** Check that it does before relying on it.
- **Tests must be deterministic.** Don't assert on values that vary between runs (file sizes that include dates, timings, random game pieces); wait for the state you need with `expect(...).toBe...` instead of fixed sleeps. Never skip, disable or loosen a test to get CI green. Find the cause instead; "flaky" isn't a cause.

## Coverage must not drop

CI combines the unit and UI test coverage of `assets/js/*.js` into one report and publishes it to GitHub (a Cobertura XML upload with `actions/upload-code-coverage`). GitHub compares each pull request's line coverage with `master` and posts the result on the pull request, with a per-file breakdown. The repository's ruleset can block pull requests that fall below its coverage thresholds.

- **A pull request must not lower line coverage.** Check GitHub's coverage comment on your pull request: overall coverage and every file you touched should be the same or higher than on `master`. If a file lost coverage, add tests for the new or changed lines. Coverage moves a little between runs because the games use random pieces, but untested new code shows up clearly in the per-file breakdown.
- Deleting code can lower coverage without anything being wrong. Say so in the pull request.
- To see exactly which lines are uncovered, run `npm run coverage` and open `coverage/report/index.html`. On GitHub, the run's **Summary** page has the per-file table, and the full report is the **coverage-report** artifact.

## Cache-busting

Pages link the site's own scripts and stylesheets with `?v=<hash of the file>`, so browsers fetch new versions as soon as they change. **After editing anything in `assets/js` or `assets/css`, run `npm run build` and commit the updated HTML.** CI fails a pull request whose hashes are stale. When adding a new script or stylesheet, link it as `/assets/js/name.js` (or `/assets/css/name.css`) and run `npm run build` to add the hash. Vendored files keep their library version as `?v=`; bump it by hand when upgrading one.

## Commands

Node 22 or later.

```bash
npm install
npx playwright install chromium   # first time only
npm run build          # update ?v= cache-busting hashes in every page
npm run build:check    # fail if any hash is stale (what CI runs)
npm test               # unit tests, then UI tests
npm run test:unit
npm run test:ui
npm run coverage       # both suites with coverage, combined into coverage/report
npm run serve          # the site at http://localhost:4173
```

## Before you open a pull request

1. `npm run build` if you touched `assets/js` or `assets/css`.
2. `npm run coverage` passes, and `coverage/report/index.html` shows your new and changed lines as covered.
3. New or changed behaviour has tests, and a bug fix has a test that failed before the fix.
4. The page works at phone width without sideways scrolling.
5. `README.md` is updated if you added a page or feature, or changed how something is used or developed.

## CI

`.github/workflows/tests.yml` runs on every pull request and push to `master`:

- **Unit tests:** hash check, then the unit tests with coverage.
- **UI tests:** Playwright in Chromium with coverage. On failure it uploads the HTML report and a trace of each failed test (**playwright-report** artifact).
- **Code coverage:** once both pass, combines their coverage into one report, adds the table to the run's Summary page, and publishes it to GitHub. The upload on `master` is what pull requests are compared against.

`node_modules` and Playwright's Chromium are cached; see `.github/actions/setup`.

## Commit messages

Never write GitHub's skip keywords literally in a commit message, even when describing them: `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`, or a `skip-checks: true` trailer. GitHub honours them anywhere in the message, so the tests silently won't run for that push, and after a squash-merge not on `master` either.
