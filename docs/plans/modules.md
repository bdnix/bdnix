# Plan: one folder per app, and tests that follow it

The working plan for the restructure proposed in *One folder per app, and tests that follow it* (October 2026). It is kept in the repository so that any session can pick it up where the last one stopped.

## How to use this plan

- **Start of a session:** read this file top to bottom, then `git log --oneline -20 origin/master` and the open pull requests, and tick anything that has happened since the file was last updated (a pull request merged). The first unticked box is the next thing to do.
- **One pull request per numbered item** (1.1, 1.2, ...), opened against `master` as [AGENTS.md](../../AGENTS.md) describes, and driven to green CI. Its description links back to this plan.
- **Tick boxes in the pull request that does the work**, so the plan on `master` always matches what is merged. The "Pull request merged" box is ticked in the next pull request.
- **Every item has a verification step, and it is never skipped.** See [Verification rules](#verification-rules). There are no checks of the live site after a deploy (decision 4); verification is of the code and CI, before and after the merge.
- If something here turns out to be wrong, change the plan in the same pull request and say why under [Changes to the plan](#changes-to-the-plan).

## Verification rules

These hold for every item, with no exceptions. An item that hasn't met all of them is not done, however green its pull request looks.

1. **Each box is ticked only with its evidence written next to it:** the command run or the CI run's link, and the exact result (a log line such as `0 of 53 specs to run.`, a test count, a diff). A tick without evidence doesn't count; untick it.
2. **An item is done only when its "Verified on master" box is ticked.** After the owner merges its pull request, wait for the merge commit's own **Tests** run on `master` to pass. Then start **Tests** on `master` by hand (Actions → Tests → Run workflow, branch `master`, **full** not ticked) and read both jobs' logs: they must say that no test ran (`0 of N specs to run.` and `0 of N test files to run.`, with the counts as they are then). Write the run's link and those two lines in the box. This proves that `master`'s cache holds a passing result for every test, so the next pull request reruns only what it changes. If anything runs, the cache is broken: stop, find out why and fix it before anything else.
3. **Never start the next item before the current one is done**, including its "Verified on master" box.
4. **Never skip, weaken or replace a verification step**: not because it's slow, not because a related check passed, not because the change "can't" affect it. If a step can't be done as written, stop and tell the owner exactly what's blocking; don't substitute something else.
5. **Never change how the site is built, tested or deployed beyond what the item says** (a new check, a different workflow, another tool) without the owner's explicit approval first. Propose it, with the reason, and wait.

## Decisions (owner, 15 October 2026)

1. **Publish with a custom GitHub Actions workflow.** The owner has switched Settings → Pages → Source to GitHub Actions and turned off publishing from the branch. Until 1.1 is merged, merges to `master` do not reach the live site.
2. **Folder names as proposed:** `apps/`, `shared/`, `site/`, `tools/`.
3. **Start with step 1 and the Snake pilot.** This plan is committed to the repository and kept up to date with checkboxes.
4. **The deploy is just a deploy.** The Pages workflow runs only on `master`: it copies the published files and deploys them, nothing else. No checks in it, none on pull requests, and none after a deploy, by tool or by hand. The tests on each pull request are the safeguard.

## Step 1: foundations, and Snake as the pilot

The proposal's step 1 is too big for one reviewable pull request, so it is split into four. The site keeps working after each one; apps that haven't moved keep running on the old plumbing.

### 1.1 Publish the site through GitHub Actions

Urgent, because branch publishing is already off. Nothing about the site changes: the published copy is the same files Jekyll published.

- [x] `tools/site.mjs` (`npm run site`) assembles the published site in `_site/`: the landing page, every page folder listed in `scripts/site.mjs`, `assets/`, `CNAME`, `robots.txt`, `sitemap.xml` and `LICENSE`. Repository tooling (tests, scripts, docs, configs) is left out by not being listed, rather than by an exclude list.
- [x] `.github/workflows/pages.yml`: on a push to `master` (or by hand), one job copies the files with `npm run site` and deploys `_site/` to GitHub Pages. Only `master` ever deploys: the job is conditioned on `refs/heads/master`, and a unit test fails if that guard goes.
- [x] `_config.yml` removed (Jekyll no longer runs).
- [x] Tests rerun only for what they use (this pull request changed one line of `package.json`, and that reran all 53 UI spec files). A test's cache key is exactly its inputs (`scripts/test-deps.mjs`, renamed from `ui-deps.mjs`): its file, its helpers, the files it used, the npm packages those import at their locked versions, and the Node version. Not `package.json`, not the rest of the lock file, not the runners. Unit tests are cached file by file (`scripts/unit-cache.mjs`, with `tests/unit/track.mjs` recording what each reads), not as one block.
- [x] Docs: `docs/development.md` (publishing, the test caches), AGENTS.md (hosting line, `_site/`, CI), `.gitignore`.
- [x] **Verify:** unit tests for the published file list and the `master`-only guard (which fails without the guard); unit tests for the keys (a `package.json` script or lint-tool bump reruns nothing, a Playwright upgrade reruns only the UI specs, a changed file reruns only the tests that used it; the first fails if `package.json` is put back into the keys); the unit cache gives the same covered lines as the old runner; in CI, a follow-up commit touching only `package.json` and the plan ran 0 of 53 UI specs and 0 of 28 unit test files (run 38789195519, UI tests in 21 s instead of about 13 minutes); the files in `_site/` are exactly the files the live site serves today, apart from `eslint.config.mjs` (a config file Jekyll published by accident), checked once by comparing every file with www.bdnix.com; `npm run lint`, `npm test` pass; CI green.
- [x] Pull request merged: #83, merge commit `1e0738c`, whose Tests run passed ([38811426969](https://github.com/bdnix/bdnix/actions/runs/38811426969); a full run, since `master` had no cache in the new key format yet).
- [x] **Verified on master:** Tests started by hand on `master` at `1e0738c`, [run 38814083754](https://github.com/bdnix/bdnix/actions/runs/38814083754): `0 of 53 specs to run.` and `0 of 28 test files to run.` (Chromium not even installed).

### 1.2 Version stamps and generated parts only in the published copy

Source files stop carrying `?v=` stamps and generated blocks, so a change to one file changes only that file in git. Still the old folders; nothing moves yet.

- [ ] One page transform (`tools/page.mjs`), used by both the build and the test server so they can't drift apart: fills the `build:` blocks (head tags, footer, cards, scores) and stamps `?v=<hash>` on the site's own scripts and styles. The translation bundles (`assets/lang/<code>.js`) and the language list in `lang.js` are made the same way.
- [ ] `npm run build` writes the transformed site to `_site/` only; source pages keep the markers but nothing between them, and link `/assets/js/x.js` without a stamp. `assets/lang/bn.js` and `sitemap.xml` stop being committed.
- [ ] `tests/server.mjs` serves the source tree through the same transform, so tests see exactly what visitors get. It logs the *source* files each response was made from (the page, and what its generated parts came from), not the stamps, so a stamp changing no longer reruns a spec (the cascade in PR #82).
- [ ] `npm run build:check` and its CI step removed (nothing generated is committed any more). The Pages workflow publishes `npm run build`'s output.
- [ ] Docs: AGENTS.md "Cache-busting" and "Commands", `docs/development.md`.
- [ ] **Verify:** unit tests for the transform (stamps, blocks, languages list); the HTML the test server serves for every page equals the page in `_site/`; `_site/` equals the `_site/` of 1.1 for every page except where a stamp's hash input legitimately changed (diff reviewed and explained in the pull request); full `npm test` passes; a change to `assets/lang/bn/site.json` alone reruns only the specs that load Bangla (shown with `npm run coverage:ui:cached -- --plan` before and after a test edit); CI green.
- [ ] Pull request merged.
- [ ] **Verified on master** (rule 2).

### 1.3 Modules: `module.json`, the graph, and the shared modules Snake uses

- [ ] The `module.json` format, documented in `docs/development.md`: `name`, `kind` (`app`, `shared`, `site`), `url` (where it's published), `publish` (source file → published path, so `/assets/js/sound.js` stays where it is), `uses` (shared modules), and for an app its page fields (title, description, schema, category) and card fields (name, blurb, keywords, icon, best-score key).
- [ ] `tools/modules.mjs`: finds every `module.json`, checks it, and gives the module graph and the published path of every file. The build and the test server publish module files at their old URLs; `scripts/site.mjs` still lists the pages that haven't moved, and the build merges both.
- [ ] Shared modules moved into `shared/<name>/`, each with its files, its own `lang/bn.json` and its tests: `base` (`base.css`, fonts), `lang` (`lang.js`, `lang.css`, `bangla.css`), `analytics`, `backdrop` (`blocks.js`), `game-shell` (`game.css`, `icon-btn.css`), `sound`, `gamesave`, `upright`, `gamepad` (`gamepad.css`). Published URLs unchanged.
- [ ] Translations per module: the build makes one pack per page from the `lang/` of its module and the modules it uses (pages not yet moved get everything in `assets/lang/`, as today). `lang.js` loads the page's own pack.
- [ ] Coverage paths: `tests/coverage/shared.mjs` maps a published URL back to its source file, so Codecov reports `shared/sound/sound.js`. Note the moved paths on the pull request.
- [ ] **Verify:** unit tests for `modules.mjs` (graph, publish map, errors for a bad `module.json`); `_site/` is identical to before apart from translation packs and stamps (diff reviewed); every page still passes in English and Bangla; full `npm test` and `npm run coverage` pass; CI green.
- [ ] Pull request merged.
- [ ] **Verified on master** (rule 2).

### 1.4 Snake in `apps/snake/`, test targets, `affected.mjs` and `boundaries.mjs`

- [ ] Snake moved to `apps/snake/`: `module.json`, `index.html`, `snake.js`, `snake-core.js`, `snake.css`, `lang/bn.json`, and `test/` with the four targets: `logic.test.mjs`, `behaviour.spec.mjs`, `i18n.spec.mjs`, `page.spec.mjs`. Its entry leaves `scripts/site.mjs`. URL `/snake/`, storage keys and saved games unchanged.
- [ ] `tools/affected.mjs`: from the files changed against `master` (git), walks the module graph and lists the targets to run, with each target's inputs as in the proposal's table. Deterministic: no previous run needed.
- [ ] Undeclared inputs fail: the test server's log is checked after a module target runs, and a file it loaded outside its declared inputs fails the run, naming the file.
- [ ] `tools/boundaries.mjs`, run by `npm run lint`: an app links only its own files and the modules in `uses`; a shared module names no app; no file belongs to two modules; every translation string has one owner; every module has its test targets.
- [ ] CI: module targets chosen by `affected.mjs`; everything not yet moved still goes through the old per-spec cache (`scripts/ui-cache.mjs`).
- [ ] Docs: AGENTS.md and `docs/development.md` describe modules for moved apps, alongside the old layout for the rest; `docs/games.md` paths.
- [ ] **Verify:** unit tests for `affected.mjs` (each row of the proposal's "What a change would rerun" table that applies so far, as a test) and `boundaries.mjs` (each rule, failing and passing); a deliberate undeclared file makes a target fail; a one-word change to Snake's Bangla selects only `snake/i18n`; Snake plays, saves and restores in both languages (its existing tests, moved); CI green.
- [ ] Pull request merged.
- [ ] **Verified on master** (rule 2).

## Step 2: the remaining shared modules

Each with contract tests on a fixture page (not an app), its own `lang/`, and published at its old URL. One pull request per group, each done only when verified on master (rule 2):

- [ ] 2.1 `files`, `pdftools`, `images` (and the components only tools use: `tool.css`, `page.css`, `file.css`, `tracks.css`, `editor.css`, `settings.css`, `seg.css`, `features.css`, `footer.css`). **Verify:** contract tests; every tool page passes unchanged; CI green.
- [ ] 2.2 `profile`, `avatar.css`, `profile-chip.css`, `search-core`. **Verify:** contract tests; landing and profile pages pass; CI green.
- [ ] 2.3 Anything left in `assets/js` or `assets/css` that isn't an app's. **Verify:** `assets/js` and `assets/css` hold only files of apps not yet moved; CI green.

## Step 3: the apps

Two or three per pull request, each moved like Snake in 1.4 (module, four targets, `lang/`, URL and storage keys unchanged). For every pull request: **Verify** that each moved app's moved tests pass, `affected.mjs` selects only its targets for a change inside it, and CI is green; and it's done only when verified on master (rule 2).

- [ ] 3.1 Falling Blocks, Maze Chase
- [ ] 3.2 Flap, Road Hop, Brick Bounce
- [ ] 3.3 Chess (with the vendored Stockfish)
- [ ] 3.4 Merge PDFs, Watermark, Redact
- [ ] 3.5 Sign, Unlock
- [ ] 3.6 MP4 to MP3, Compress Images
- [ ] 3.7 Photo Collage, Resize Without Cropping
- [ ] 3.8 The landing and profile pages as `site/` modules, reading the generated catalogue of every app's card fields. **Verify:** changing an app's card reruns the landing and profile targets, changing its rules doesn't.

## Step 4: remove the old plumbing

Each done only when verified on master (rule 2).


- [ ] 4.1 Remove `scripts/site.mjs`, `scripts/ui-cache.mjs`, `scripts/test-deps.mjs` (if nothing uses it), the empty old folders and the old CI cache steps; `tools/boundaries.mjs` replaces the lists in `tests/unit/site.test.mjs`. **Verify:** nothing references the removed files; the full suite passes; CI green.
- [ ] 4.2 Rewrite AGENTS.md and `docs/development.md` around modules. **Verify:** every path and command in them exists and runs.

## Step 5: sharded full runs

Done only when verified on master (rule 2).


- [ ] 5.1 A full run on every push to `master`, and on a pull request that changes a shared module, split across machines with Playwright's `--shard` and the reports merged; coverage still uploaded once. **Verify:** a full run's time and test count against an unsharded one; CI green.

## Changes to the plan

- 15 October 2026: step 1 split into 1.1 to 1.4, with publishing first, since branch publishing was already off.
- 15 October 2026: [Verification rules](#verification-rules) added, with a "Verified on master" box for every item, after an item was nearly closed without checking that `master` itself reran nothing.
- 15 October 2026: test caching made exact in 1.1 rather than later: a one-line `package.json` change reran every test, which the restructure exists to stop.
- 15 October 2026: no checks in the deploy and none after it (decision 4). Browser checks of the published copy, a pull-request build and a post-deploy check were tried in 1.1 and dropped: the pull request's tests already cover the code, the build is a plain copy covered by unit tests, and a check after the deploy could only report problems nobody can fix in code.
