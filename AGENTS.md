# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository. Read this before changing anything. [README.md](README.md) is the project overview; [docs/](docs/) has the detailed guides to the tools, games, privacy and development.

## What this is

The static site behind [www.bdnix.com](https://www.bdnix.com), hosted on GitHub Pages from `master`. There's no framework and no compile step: pages are plain HTML, CSS and vanilla JavaScript, served as they are in the repo.

| Page | Files |
|---|---|
| Landing `/` | `index.html`, `assets/css/style.css`, `assets/js/main.js`, `assets/js/search-core.js` |
| Falling Blocks `/falling-blocks/` | `falling-blocks/index.html`, `assets/css/tetris.css`, `assets/js/tetris.js` |
| Maze Chase `/maze-chase/` | `maze-chase/index.html`, `assets/css/pacman.css`, `assets/js/pacman.js` |
| Flap `/flap/` | `flap/index.html`, `assets/css/flappy.css`, `assets/js/flappy.js`, `assets/js/flappy-core.js` |
| Road Hop `/road-hop/` | `road-hop/index.html`, `assets/css/hop.css`, `assets/js/hop.js`, `assets/js/hop-core.js` |
| Snake `/snake/` | `snake/index.html`, `assets/css/snake.css`, `assets/js/snake.js`, `assets/js/snake-core.js` |
| Brick Bounce `/brick-bounce/` | `brick-bounce/index.html`, `assets/css/bricks.css`, `assets/js/bricks.js`, `assets/js/bricks-core.js` |
| Merge PDFs `/merge-pdf/` | `merge-pdf/index.html`, `assets/css/merge.css`, `assets/js/merge.js` |
| Watermark `/watermark-pdf/` | `watermark-pdf/index.html`, `assets/css/watermark.css`, `assets/js/watermark.js`, `assets/js/watermark-layout.js` |
| Redact `/redact-pdf/` | `redact-pdf/index.html`, `assets/css/redact.css`, `assets/js/redact.js`, `assets/js/redact-core.js` |
| MP4 to MP3 `/mp4-to-mp3/` | `mp4-to-mp3/index.html`, `assets/css/audio.css`, `assets/js/audio.js`, `assets/js/audio-core.js` |
| Compress Images `/compress-image/` | `compress-image/index.html`, `assets/css/image.css`, `assets/js/image.js`, `assets/js/image-core.js` |
| Photo Collage `/photo-collage/` | `photo-collage/index.html`, `assets/css/collage.css`, `assets/js/collage.js`, `assets/js/collage-core.js` |
| Resize Without Cropping `/fit-to-frame/` | `fit-to-frame/index.html`, `assets/css/frame.css`, `assets/js/frame.js`, `assets/js/frame-core.js` |
| Profile `/profile/` | `profile/index.html`, `assets/css/profile.css`, `assets/js/profile-page.js` |

Shared files hold only what is truly common (see [Keep apps modular](#keep-apps-modular)). Each is one concern, and a page links only the ones it uses.

Stylesheets:
- `assets/css/base.css`: what every page uses: colour tokens, the backdrop, the top bar, buttons, panels and the analytics consent banner.
- `assets/css/game.css`: the layout every game page uses.
- `assets/css/page.css`: the one-column layout of the tool pages and the profile page.
- `assets/css/tool.css`: what every tool page has: the lede, the drop zone, fields, the files area and the action buttons.
- Components, linked only by the pages that show them: `icon-btn.css` (square icon buttons), `avatar.css` (the visitor's initial), `profile-chip.css` (the name chip in the top bar), `footer.css`, `features.css` (the feature list under a tool's lede), `file.css` (a file's name and details), `editor.css` (a preview beside a settings panel), `settings.css` (a panel of settings), `seg.css` (a two-way switch), `tracks.css` (a list of files, each with its own download) and `gamepad.css` (the on-screen D-pad and action buttons of the games played with buttons on a phone).

Scripts, each exposing one `window.bdnix*` object:
- `assets/js/blocks.js`: the falling-block backdrop (`window.bdnix`).
- `assets/js/analytics.js`: Google Analytics page views and the cookie consent banner (`window.bdnixAnalytics`). Every page links it in `<head>` (not `async`: the profile page reads it). It only runs on `www.bdnix.com` / `bdnix.com`, so local previews and tests show no banner and send nothing; `tests/ui/analytics.spec.mjs` serves the site as `www.bdnix.com` to test it. Google's script loads only after the visitor accepts; they can change their choice on the profile page.
- `assets/js/profile.js`: the visitor's display name and the profile chip (`window.bdnixProfile`). The list of games and their best scores belongs to the profile page (`profile-page.js`).
- `assets/js/files.js`: reading the files a visitor opens, dropping files on the page, and file sizes and plurals (`window.bdnixFiles`). Every tool uses it.
- `assets/js/pdftools.js`: page-range parsing, spotting a PDF and the on-demand PDF.js loader, for the PDF tools (`window.bdnixPdf`). Needs `files.js`.
- `assets/js/images.js`: image files for the image tools: which files are images, the formats a canvas saves, the canvas size limit and result file names (`window.bdnixImages`).
- `assets/js/gamesave.js`: saves a game in progress and loads it back paused (`window.bdnixSave`). Each game snapshots its own state, checks a loaded save before using it, and throws away one that doesn't make sense.
- `assets/js/upright.js`: games are played with the phone upright (`window.bdnixUpright`). On a phone turned sideways it covers the page with a note asking for it to be turned back, and calls what each game passed to `bdnixUpright.onTurn()`, so the game pauses. Screens with a mouse are never covered, however short the window. Its styles are in `game.css`.
- `assets/js/sound.js`: the sound engine for the games (`window.bdnixSound`), made with the Web Audio API from short recipes, so there are no audio files. It has only the sounds every game plays (`start`, `over` and `best`); each game adds its own with `bdnixSound.add({ name: [tones] })`, made with `bdnixSound.tone()` and `bdnixSound.notes()`. `bdnixSound.play('<name>')` plays one unless sound is muted. It also runs the mute button (`#soundBtn` in a game's top bar, beside pause) and the M key.

Third-party libraries are vendored in `assets/vendor/` (pdf-lib, PDF.js, fontkit, lamejs), each with its licence file.

## Every change ends in a pull request with green CI

When the owner asks for a feature, a fix or any other change to this repo, the work isn't done until a pull request is open and all its CI checks pass. Don't ask whether to open one, and don't stop at a pushed branch.

1. Work on a branch: the one the session assigns, or a new one off `master`. Never push to `master`.
2. Do everything in [Before you open a pull request](#before-you-open-a-pull-request), then commit and push.
3. Open a pull request against `master` right away, without asking for confirmation. If the branch already has an open pull request, push to it instead. If its pull request was already merged, start the branch again from the latest `master` and open a new one. The description says what changed, why, and how it was tested, and mentions anything that lowered coverage (see [Coverage must not drop](#coverage-must-not-drop)).
4. Watch the pull request until every check in `.github/workflows/tests.yml` has finished. When one fails, read its log, find the cause, fix it, run the checks locally, push, and wait again. Repeat until everything passes. [Tests are required](#tests-are-required) still applies: never skip, disable or loosen a test to get green, and "flaky" isn't a cause.
5. Handle review comments the same way: make the fix, push, and see CI through again.
6. Report back only when the pull request is green and meets everything that was asked: give its link, what changed, and how it was tested. If something can't be fixed from the branch (it fails on `master` too, or needs access or a decision only the owner has), say so on the pull request and to the owner, with exactly what's needed.

Leave merging to the owner: don't merge the pull request yourself.

## Keep apps modular

Each game and tool is its own app. **Adding or changing a feature of one app must never mean editing a file another app loads.**

- A shared file holds only what every page that links it uses, and nothing about any one app: no app's names, data, sounds, colours or special cases. A shared component (a stylesheet, a helper script) is one concern; a page links it only if it uses it.
- Something only some apps use gets its own shared file (a component), linked by just those apps, not a corner of a bigger shared file.
- Anything specific to one app lives in that app's own files: its sounds (added with `bdnixSound.add`), its rules, its styles and its words. Two apps that happen to want the same small thing (the same sound recipe, say) each keep their own copy rather than sharing a file that then couples them.
- `scripts/site.mjs` lists every page and app: titles, descriptions, card names, search keywords, icons and best-score keys. `npm run build` writes the landing page's cards, the profile page's scores, `sitemap.xml` and every page's head tags from it, so adding an app means adding it there. The tests that list every page (SEO, analytics, a11y, ...) keep their own lists on purpose, as an independent check.
- Before editing a shared file for a feature, ask whether every page that links it needs the change. If not, the change belongs in the app, or in a new component.

## Ground rules

- **Everything runs in the browser.** Files the visitor opens are never uploaded; there is no server. Don't send the visitor's files, or anything they type into a tool, anywhere. Load libraries from `assets/vendor/`, not a CDN. The site uses Google Analytics (`assets/js/analytics.js`); a new page must link it in `<head>` (the UI test in `tests/ui/analytics.spec.mjs` lists every page). A new page also needs an entry in `scripts/site.mjs` and `<!-- build:meta -->` markers in its `<head>` (and `<!-- build:footer -->` around a footer), from which `npm run build` writes its title, description, canonical URL, Open Graph, Twitter and structured data and its `sitemap.xml` entry; `tests/ui/seo.spec.mjs` lists every page. Never edit between `build:` markers by hand. Every canvas but the backdrop is `role="img"` with an `aria-label`, and every button has a `type`; `tests/ui/a11y.spec.mjs` lists every page.
- **Every page has a content security policy.** `npm run build` writes it into each page's `build:meta` block from `CSP` in `scripts/parts.mjs`: the site's own files, Google Analytics, and nothing inline. So no inline `<script>`, `on...=` handlers or `style="..."` attributes (set styles from a script or a stylesheet), and a new outside origin has to be added there deliberately. The UI test fixture fails any test in which the policy blocks something; `tests/ui/csp.spec.mjs` checks the policy itself.
- **Keep it dependency-free at runtime.** No frameworks and no bundler. `package.json` holds dev tooling only (tests, coverage, the cache-busting script).
- **Match the existing code.** Each script is one IIFE, `(function(){ ... })();`, in ES5-style `var`/`function` code. A script that other scripts use exposes one `window.bdnix*` object. Comment density, naming and CSS style should match the file you're in.
- **Reuse what's truly shared.** Use the tokens in `base.css`, the layouts in `page.css`, `tool.css` and `game.css`, the components, and the helpers in `files.js`, `pdftools.js`, `images.js` and `profile.js`. When several apps need the same general-purpose logic (not a feature of one of them), give it its own shared file, as `files.js` and `images.js` are, and link it only from those apps.
- **Pure logic goes in its own file** (as in `watermark-layout.js`, `redact-core.js`, `flappy-core.js`, `hop-core.js`, `snake-core.js`, `bricks-core.js`, `audio-core.js`, `image-core.js`, `collage-core.js`, `frame-core.js`, `search-core.js`, `images.js`, `files.js` and `pdftools.js`), so it can be unit tested without a browser. Keep DOM code in the page scripts.
- **Every game keeps a game in progress.** A game must survive a reload or a later visit and come back paused exactly where it was, as Falling Blocks, Maze Chase, Flap, Road Hop, Snake and Brick Bounce do. Use `window.bdnixSave` from `assets/js/gamesave.js`:
  - Save through `bdnixSave.keep('<game>', snapshot)`. `snapshot()` returns the whole state as plain JSON, or `null` when no game is in progress. Call the function `keep()` returns when the game pauses, starts a new game or ends.
  - Restore at startup. Check every field of the loaded save before using it. Clear a save that doesn't make sense and show the normal start screen.
  - Come back paused with "Picked up where you left off." The pause screen has **Resume** and a **New game** button (`#newBtn`).
  - Remove the save at game over.
  - The key is `bdnix_<game>_save`. Add it to the list of storage keys below.
  - UI tests must cover reloading mid-game and carrying on from the same spot, New game from the pause screen, discarding an invalid save, and the save being gone after game over (see the reload tests in `tests/ui/tetris.spec.mjs`).
- **Every game has sound.** Link `assets/js/sound.js`, put the `#soundBtn` mute button beside pause in the top bar (add the page to `tests/ui/sound.spec.mjs`), and call `window.bdnixSound.play()` for starting a game, the main moves, scoring, crashing and game over (`best` for a new best score, otherwise `over`). `start`, `over` and `best` come from `sound.js`; add the game's other sounds in its own script with `bdnixSound.add()`, never in `sound.js`. UI tests record what plays with `listen()` and `heard()` from `tests/ui/games.mjs`, and each game's spec checks its sounds with `soundProblems()`.
- **Don't use other games' trademarks as our own.** Titles, headings, URLs, SEO tags, structured data and docs use the site's own names: Falling Blocks, Maze Chase, Flap, Road Hop, Snake and Brick Bounce, never Tetris, Pac-Man, Flappy Bird, Crossy Road, Blockade or Breakout. ("Snake" is the name of the genre, not a trademark.) New games get original names and artwork too. The exceptions are the credit line on each game's start screen (`<p class="credit">` in the overlay) and the Credits section of `docs/games.md`, which say which classic inspired the game and who created it, and state that the name is a trademark of its owner and bdnix isn't affiliated with or endorsed by them. A new game inspired by another needs both. `tests/ui/seo.spec.mjs` checks the credit lines. The old names also survive as internal identifiers (file names such as `tetris.js`, `bdnixSave` ids and storage keys), which stay as they are so visitors' saved data isn't lost.
- **Every game is played upright on a phone.** Link `assets/js/upright.js` and pause the game in `window.bdnixUpright.onTurn()`, as you would on `blur`. Add the page to `tests/ui/upright.spec.mjs`.
- **Phone-sized screens matter.** Every page must work at 390 px wide with no sideways scrolling, and with touch as well as mouse and keyboard.
- **Browser storage is optional.** Wrap every `localStorage` / IndexedDB access in `try/catch`; pages must work without it (private browsing). The keys in use are `bdnix_visits`, `bdnix_name`, `bdnix_tetris_best`, `bdnix_pacman_best`, `bdnix_flappy_best`, `bdnix_hop_best`, `bdnix_snake_best`, `bdnix_bricks_best`, `bdnix_tetris_save`, `bdnix_pacman_save`, `bdnix_flappy_save`, `bdnix_hop_save`, `bdnix_snake_save`, `bdnix_bricks_save`, `bdnix_sound`, `bdnix_watermark_v1` and `bdnix_analytics` (localStorage), and the `bdnix-tools` database (IndexedDB). Don't rename them, since visitors' saved data would be lost.

## Tests are required

**Every new feature and every bug fix must come with tests in the same change.** A pull request that adds or changes behaviour without tests isn't done.

- **Unit tests** (`tests/unit/*.test.mjs`, Node's built-in `node:test`) are for pure logic: parsing, maths, data rules. They load a script into a sandbox with `load()` from `tests/unit/load.mjs`, which also provides fake `localStorage` and `document`. New pure logic needs unit tests covering its normal cases, edge cases and errors.
- **UI tests** (`tests/ui/*.spec.mjs`, Playwright) are for what a visitor sees and does. Import `test` and `expect` from `tests/ui/fixtures.mjs`, not from `@playwright/test`: the fixture fails the test on any uncaught page error, keeps the tests offline and records coverage and which files each spec loads. Read repository files through the test server (`request.get('/path')`), not `fs`, so the CI result cache (see [CI](#ci)) notices when they change. Each test runs at desktop and phone size. Build test files in code (see `tests/ui/pdfs.mjs`, `tests/ui/media.mjs` and `tests/ui/images.mjs`) rather than committing binaries, and check real output: open downloaded PDFs and assert on their contents.
- **A bug fix needs a test that fails without the fix.** Check that it does before relying on it.
- **Tests must be deterministic.** Don't assert on values that vary between runs (file sizes that include dates, real timings); wait for the state you need with `expect(...).toBe...` instead of fixed sleeps. Never skip, disable or loosen a test to get CI green. Find the cause instead; "flaky" isn't a cause.
- **Games and anything animated:** open the page with `openGame()` from `tests/ui/games.mjs`. It fixes `Math.random` (Falling Blocks then deals O, T, J, L, S, Z, I every bag) and freezes the clock *before* the page loads, so time only moves when the test calls `page.clock.runFor()`, and scores and positions come out exact. Don't install a clock after the page has loaded and then pause it: that races with the clock's real-time updates and occasionally steps time backwards, which stalls the game loops.

## Coverage must not drop

CI uploads the unit and UI tests' coverage of `assets/js/*.js` to [Codecov](https://codecov.io/gh/bdnix/bdnix) in one upload. Codecov combines them (a line counts as covered if either suite runs it), comments on the pull request with a per-file table, and draws the README badge.

- **A pull request must not lower line coverage.** Codecov checks this on every pull request (settings in `codecov.yml`): **codecov/project** fails if overall line coverage drops more than 0.1% below `master`, and **codecov/patch** fails if less than 90% of the lines the pull request adds or changes are covered. Both must pass. Codecov's pull request comment shows which files lost coverage; add tests for the new or changed lines.
- Deleting code can lower coverage without anything being wrong. Say so in the pull request.
- To see exactly which lines are uncovered, open the file on Codecov, or run `npm run coverage` and open `coverage/report/index.html`.

## Cache-busting

Pages link the site's own scripts and stylesheets with `?v=<hash of the file>`, so browsers fetch new versions as soon as they change. **After editing anything in `assets/js` or `assets/css`, run `npm run build` and commit the updated HTML.** CI fails a pull request whose hashes are stale. When adding a new script or stylesheet, link it as `/assets/js/name.js` (or `/assets/css/name.css`) and run `npm run build` to add the hash. Vendored files keep their library version as `?v=`; bump it by hand when upgrading one. The same command writes the parts of the pages generated from `scripts/site.mjs` (see [Keep apps modular](#keep-apps-modular)), and CI fails a pull request where those are stale too.

## Commands

Node 22 or later.

```bash
npm install
npx playwright install chromium   # first time only
npm run build          # write the parts generated from scripts/site.mjs and the ?v= hashes
npm run build:check    # fail if any of those is stale (what CI runs)
npm test               # unit tests, then UI tests
npm run test:unit
npm run test:ui
npm run coverage       # both suites with coverage, combined into coverage/report
npm run serve          # the site at http://localhost:4173
```

## Before you open a pull request

1. `npm run build` if you touched `assets/js`, `assets/css` or `scripts/site.mjs`.
2. `npm run coverage` passes, and `coverage/report/index.html` shows your new and changed lines as covered.
3. New or changed behaviour has tests, and a bug fix has a test that failed before the fix.
4. The page works at phone width without sideways scrolling.
5. The docs are updated if you added a page or feature, or changed how something is used or developed: a brief entry in `README.md` for a new tool or game, and the details in the matching guide in `docs/` (`tools.md`, `games.md`, `privacy.md` or `development.md`).

## CI

`.github/workflows/tests.yml` runs on every pull request and push to `master`:

- **Unit tests:** hash check, then the unit tests with coverage.
- **UI tests:** Playwright in Chromium with coverage. On failure it uploads the HTML report and a trace of each failed test (**playwright-report** artifact).
- **Coverage:** once both pass, uploads their coverage to Codecov together.

Codecov then posts **codecov/project** and **codecov/patch** (see [Coverage must not drop](#coverage-must-not-drop)). `node_modules` and Playwright's Chromium are cached; see `.github/actions/setup`.

Tests whose inputs haven't changed since they last passed don't run again; CI reuses their cached result and coverage:

- **Unit tests** are cached as a whole, keyed on `assets/js`, `assets/vendor`, `tests/unit`, `tests/coverage`, `package.json` and `package-lock.json`.
- **UI tests** are cached spec by spec by `scripts/ui-cache.mjs` (`npm run coverage:ui:cached`). The test server logs every file it serves and which spec asked for it (`tests/ui/fixtures.mjs` adds an `x-bdnix-spec` header to each request), so a spec runs again only when it, a file it loaded, or the shared test code (`tests/ui/*.mjs` helpers, `tests/coverage`, `tests/server.mjs`, `playwright.config.mjs`, the lock file) changes. A spec that fails is never cached.
- So a UI test must get every repository file it depends on **through the test server** (`page.goto`, `request.get`, ...), never by reading it with `fs`, or the cache won't see a change to it.
- Run the workflow by hand with **full** ticked to ignore the cache. Locally, `npm test` and `npm run coverage` always run everything.

## Commit messages

Never write GitHub's skip keywords literally in a commit message, even when describing them: `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`, or a `skip-checks: true` trailer. GitHub honours them anywhere in the message, so the tests silently won't run for that push, and after a squash-merge not on `master` either.
