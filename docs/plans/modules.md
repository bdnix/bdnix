# Plan: one folder per app, and tests that follow it

The working plan for the restructure proposed in *One folder per app, and tests that follow it* (October 2026). It is kept in the repository so that any session can pick it up where the last one stopped.

## How to use this plan

- **Start of a session:** read this file top to bottom, then `git log --oneline -20 origin/master` and the open pull requests, and tick anything that has happened since the file was last updated (a pull request merged). The first unticked box is the next thing to do.
- **One pull request per numbered item** (1.1, 1.2, then one each for steps 2, 3 and 4), opened against `master` as [AGENTS.md](../../AGENTS.md) describes, and driven to green CI. Its description links back to this plan.
- **Tick boxes in the pull request that does the work**, so the plan on `master` always matches what is merged. The "Pull request merged" box is ticked in the next pull request.
- **Every item has a verification step, and it is never skipped.** See [Verification rules](#verification-rules). There are no checks of the live site after a deploy (decision 4); verification is of the code and CI, before and after the merge.
- If something here turns out to be wrong, change the plan in the same pull request and say why under [Changes to the plan](#changes-to-the-plan).

## Verification rules

These hold for every item, with no exceptions. An item that hasn't met all of them is not done, however green its pull request looks.

1. **A Verify box is ticked only with its evidence written next to it:** the command run or the CI run's link, and the exact result (a log line such as `0 of 53 specs to run.`, a test count, a diff). A tick without evidence doesn't count; untick it. The boxes describing the work are ticked by the pull request that does it, and that pull request is their evidence.
2. **An item is done when its pull request is merged and the merge commit's own Tests run on `master` has passed.** Its "Pull request merged" box records both, with the run's link. Any further check on `master` (a run started by hand, say) is done only where that item's Verify asks for it, and says what it proves.
3. **Never start the next item before the current one is done.**
4. **Never skip, weaken or replace a verification step**: not because it's slow, not because a related check passed, not because the change "can't" affect it. If a step can't be done as written, stop and tell the owner exactly what's blocking; don't substitute something else.
5. **Never change how the site is built, tested or deployed beyond what the item says** (a new check, a different workflow, another tool) without the owner's explicit approval first. Propose it, with the reason, and wait.

## Decisions (owner, 15 October 2026)

1. **Publish with a custom GitHub Actions workflow.** The owner switched Settings → Pages → Source to GitHub Actions and turned off publishing from the branch; since 1.1, `.github/workflows/pages.yml` publishes every push to `master`.
2. **Folder names as proposed:** `apps/`, `shared/`, `site/`, `tools/`.
3. **Start with step 1 and the Snake pilot.** This plan is committed to the repository and kept up to date with checkboxes.
4. **The deploy is just a deploy.** The Pages workflow runs only on pushes to `master`: it copies the published files and deploys them, nothing else. It has no checks of its own, doesn't run on pull requests, and nothing checks the live site after a deploy, by tool or by hand. The Tests workflow on each pull request is the safeguard.

## Step 1: publishing and the build

The site keeps working after each item; nothing moves yet.

### 1.1 Publish the site through GitHub Actions

Urgent, because branch publishing is already off. Nothing about the site changes: the published copy is the same files Jekyll published.

- [x] `tools/site.mjs` (`npm run site`) assembles the published site in `_site/`: the landing page, every page folder listed in `scripts/site.mjs`, `assets/`, `CNAME`, `robots.txt`, `sitemap.xml` and `LICENSE`. Repository tooling (tests, scripts, docs, configs) is left out by not being listed, rather than by an exclude list.
- [x] `.github/workflows/pages.yml`: on a push to `master` (or by hand), one job copies the files with `npm run site` and deploys `_site/` to GitHub Pages. Only `master` ever deploys: the job is conditioned on `refs/heads/master`, and a unit test fails if that guard goes.
- [x] `_config.yml` removed (Jekyll no longer runs).
- [x] Tests rerun only for what they use (this pull request changed one line of `package.json`, and that reran all 53 UI spec files). A test's cache key is exactly its inputs (`scripts/test-deps.mjs`, renamed from `ui-deps.mjs`): its file, its helpers, the files it used, the npm packages those import at their locked versions, and the Node version. Not `package.json`, not the rest of the lock file, not the runners. Unit tests are cached file by file (`scripts/unit-cache.mjs`, with `tests/unit/track.mjs` recording what each reads), not as one block.
- [x] Docs: `docs/development.md` (publishing, the test caches), AGENTS.md (hosting line, `_site/`, CI), `.gitignore`.
- [x] **Verify:** unit tests for the published file list and the `master`-only guard (which fails without the guard); unit tests for the keys (a `package.json` script or lint-tool bump reruns nothing, a Playwright upgrade reruns only the UI specs, a changed file reruns only the tests that used it; the first fails if `package.json` is put back into the keys); the unit cache gives the same covered lines as the old runner; in CI, a follow-up commit touching only `package.json` and the plan ran 0 of 53 UI specs and 0 of 28 unit test files ([run 38789195519](https://github.com/bdnix/bdnix/actions/runs/38789195519), UI tests in 21 s instead of about 13 minutes); the files in `_site/` are exactly the files the live site serves today, apart from `eslint.config.mjs` (a config file Jekyll published by accident), checked once by comparing every file with www.bdnix.com; `npm run lint`, `npm test` pass; CI green.
- [x] Pull request merged: #83, merge commit `1e0738c`, whose Tests run passed ([38811426969](https://github.com/bdnix/bdnix/actions/runs/38811426969); a full run, since `master` had no cache in the new key format yet).
- [x] **Verified on master** (asked for 1.1, whose merge run was a forced full run: it proves `master`'s new-format cache is complete): Tests started by hand on `master` at `1e0738c`, [run 38814083754](https://github.com/bdnix/bdnix/actions/runs/38814083754): `0 of 53 specs to run.` and `0 of 28 test files to run.` (Chromium not even installed).

### 1.2 Version stamps and generated parts only in the published copy

Source files stop carrying `?v=` stamps and generated blocks, so a change to one file changes only that file in git. Still the old folders; nothing moves yet.

- [x] One page transform (`tools/page.mjs`), used by both the build and the test server so they can't drift apart: fills the `build:` blocks (head tags, footer, cards, scores) and stamps `?v=<hash>` on the site's own scripts and styles. The translation bundles (`assets/lang/<code>.js`) and the language list in `lang.js` are made the same way (`tools/languages.mjs`, which the unit tests' `load()` also uses, so they run `lang.js` as it's served).
- [x] `npm run build` writes the transformed site to `_site/` only; source pages keep the markers but nothing between them, and link `/assets/js/x.js` without a stamp. `assets/lang/bn.js` and `sitemap.xml` stop being committed.
- [x] `tests/server.mjs` serves the source tree through the same transform, so tests see exactly what visitors get. It logs the *source* files each response was made from (the page, and what its generated parts came from), not the stamps, so a stamp changing no longer reruns a spec (the cascade in PR #82).
- [x] `npm run build:check` and its CI step removed (nothing generated is committed any more). `npm run build` takes over from `npm run site` (`tools/site.mjs` becomes part of it), so there's one command that makes `_site/`, and the Pages workflow runs it.
- [x] Docs: AGENTS.md "Cache-busting" and "Commands", `docs/development.md`.
- [x] **Verify:** unit tests for the transform (stamps, blocks, languages list); the HTML the test server serves for every page equals the page in `_site/`; `_site/` is byte for byte the `_site/` that 1.1's `npm run site` makes from the same commit, and any difference is explained in the pull request; full `npm test` passes; with the cache filled, changing one string in `assets/lang/bn/site.json` makes `npm run coverage:ui:cached -- --plan` list only specs that load the Bangla pack (every spec that stays in English is cached); CI green.
  - Evidence: `tests/unit/page.test.mjs` (stamps, blocks, the languages list on its one line, what each response is made from, errors; the sources carry nothing generated; and the test server, started on its own port, serves every one of the 166 files in `_site/` byte for byte). `_site/` against the one 1.1's `npm run site` made from `14011e8`: the same 166 files, and `diff -r` finds three kinds of difference, all expected: `assets/lang/bn.js`'s header comment names `tools/languages.mjs` instead of `scripts/build.mjs` (so its stamp in `lang.js` changes); `lang.js` has its list of languages on one line instead of four (see [Changes to the plan](#changes-to-the-plan)); and so every page's `lang.js?v=` stamp changes (`1d081b7228` → `c45ed9b369`). Nothing else differs. Locally, `npm test`: 369 unit tests and 910 UI tests passed; `npm run coverage` passed. With the UI cache filled (`0 of 53 specs to run.`), one string changed in `assets/lang/bn/site.json` made `--plan` list `27 of 53 specs to run.`: exactly the 27 specs whose cached inputs include `assets/lang/bn/site.json` (the 18 site specs, which check every language, the seven `-bn` specs, `languages` and `fonts`), and every other spec cached. Before this change, the same edit reran all 53 (PR #82). CI green on the pull request: Tests [run 38822208579](https://github.com/bdnix/bdnix/actions/runs/38822208579) (Unit tests, UI tests and Coverage passed; codecov/patch passed).
- [ ] Pull request merged, and its merge commit's Tests run passed (rule 2).

## Step 2: modules, every shared module, and Snake as the pilot

One pull request (old items 1.3, 1.4 and 2.1 to 2.3). The module format, the graph and the boundary checks arrive together with every shared file moved into `shared/`, and Snake moves first to prove the format before the other apps follow in step 3. The site keeps working: apps that haven't moved keep running on the old plumbing.

Modules and the graph:

- [ ] The `module.json` format, documented in `docs/development.md`: `name`, `kind` (`app`, `shared`, `site`), `url` (where it's published), `publish` (source file → published path, so `/assets/js/sound.js` stays where it is), `uses` (shared modules), and for an app its page fields (title, description, schema, category) and card fields (name, blurb, keywords, icon, best-score key).
- [ ] `tools/modules.mjs`: finds every `module.json`, checks it, and gives the module graph and the published path of every file. The build and the test server publish module files at their old URLs; `scripts/site.mjs` still lists the pages that haven't moved, and the build merges both.

Every shared module, each in `shared/<name>/` with its files, its own `lang/bn.json` and its tests (contract tests on a fixture page, not an app), published at its old URL:

- [ ] What the games use: `base` (`base.css`, fonts), `lang` (`lang.js`, `lang.css`, `bangla.css`), `analytics`, `backdrop` (`blocks.js`), `game-shell` (`game.css`, `icon-btn.css`), `sound`, `gamesave`, `upright`, `gamepad` (`gamepad.css`).
- [ ] What the tools use: `files`, `pdftools`, `images`, and the components only tools use (`tool.css`, `page.css`, `file.css`, `tracks.css`, `editor.css`, `settings.css`, `seg.css`, `features.css`, `footer.css`).
- [ ] The rest: `profile`, `avatar.css`, `profile-chip.css`, `search-core`, and anything else left in `assets/js` or `assets/css` that isn't an app's.
- [ ] Translations per module: the build makes one pack per page from the `lang/` of its module and the modules it uses (pages not yet moved get everything in `assets/lang/`, as today). `lang.js` loads the page's own pack.
- [ ] Coverage paths: `tests/coverage/shared.mjs` maps a published URL back to its source file, so Codecov reports `shared/sound/sound.js`. Note the moved paths on the pull request.

Snake, and the checks every moved app gets:

- [ ] Snake moved to `apps/snake/`: `module.json`, `index.html`, `snake.js`, `snake-core.js`, `snake.css`, `lang/bn.json`, and `test/` with the four targets: `logic.test.mjs`, `behaviour.spec.mjs`, `i18n.spec.mjs`, `page.spec.mjs`. Its entry leaves `scripts/site.mjs`. URL `/snake/`, storage keys and saved games unchanged.
- [ ] Undeclared inputs fail: the test server's log is checked after a module target runs, and a file it loaded outside its declared inputs fails the run, naming the file.
- [ ] `tools/boundaries.mjs`, run by `npm run lint`: an app links only its own files and the modules in `uses`; a shared module names no app; no file belongs to two modules; every translation string has one owner; every module has its test targets.
- [ ] CI: Snake's targets and the shared modules' tests go through the same content-keyed cache as every other test (`scripts/unit-cache.mjs`, `scripts/ui-cache.mjs`); there is one way tests are picked.
- [ ] Docs: AGENTS.md and `docs/development.md` describe modules and `shared/`, with the old layout for the apps not yet moved; `docs/games.md` paths.

- [ ] **Verify:**
  - unit tests for `modules.mjs` (graph, publish map, errors for a bad `module.json`) and for `boundaries.mjs` (each rule, failing and passing);
  - contract tests for every shared module;
  - `_site/` is identical to 1.2's from the same pages apart from translation packs and stamps (diff reviewed, every difference explained in the pull request), and `assets/js` and `assets/css` hold only files of apps not yet moved;
  - every page still passes in English and Bangla, every tool page unchanged, the landing and profile pages included;
  - a deliberate undeclared file makes a target fail;
  - with the cache filled, a one-word change to Snake's Bangla makes the cache's plan list only Snake's `i18n` target, and a change to `snake-core.js` only Snake's `logic`, `behaviour` and `i18n`;
  - Snake plays, saves and restores in both languages (its existing tests, moved);
  - full `npm test` and `npm run coverage` pass; CI green.
- [ ] Pull request merged, and its merge commit's Tests run passed (rule 2).

## Step 3: every other app, and the landing and profile pages

One pull request (old items 3.1 to 3.8). Each app moved like Snake in step 2 (module, four targets, `lang/`, URL and storage keys unchanged), one commit per app so the diff can be read app by app:

- [ ] Falling Blocks, Maze Chase, Flap, Road Hop, Brick Bounce.
- [ ] Chess, with the vendored Stockfish.
- [ ] Merge PDFs, Watermark, Redact, Sign, Unlock.
- [ ] MP4 to MP3, Compress Images, Photo Collage, Resize Without Cropping.
- [ ] The landing and profile pages as `site/` modules, reading the generated catalogue of every app's card fields.
- [ ] **Verify:** each moved app's moved tests pass; with the cache filled, a change inside each moved app reruns only its own targets; changing an app's card reruns the landing and profile targets, changing its rules doesn't; `_site/` is identical to step 2's apart from stamps (diff reviewed); full `npm test` and `npm run coverage` pass; CI green.
- [ ] Pull request merged, and its merge commit's Tests run passed (rule 2).

## Step 4: remove the old plumbing, and tests split across machines

One pull request (old items 4.1, 4.2 and 5.1).

- [ ] Remove `scripts/site.mjs` and the empty old folders; `tools/boundaries.mjs` replaces the lists in `tests/unit/site.test.mjs`. The test caches (`scripts/test-deps.mjs`, `scripts/unit-cache.mjs`, `scripts/ui-cache.mjs`) stay: they're how tests are picked.
- [ ] Rewrite AGENTS.md and `docs/development.md` around modules.
- [ ] The UI tests always run split across several machines, however many specs a run has to run: the cache's plan picks the specs, Playwright's `--shard` splits them, and the shards' results, caches and coverage are merged (coverage still uploaded once). The unit tests are not split: they stay on one machine (the owner's decision; they take seconds). No full run on `master`: a push reruns only what its change touched, as on a pull request.
- [ ] **Verify:** nothing references the removed files; every path and command in AGENTS.md and `docs/development.md` exists and runs; a run started by hand with **full** ticked, split across machines, against the same on one machine (time and test count); a pull request run with only a few specs to run splits them too and passes; every shard's results come back from the cache on the next run; the full suite passes; CI green.
- [ ] Pull request merged, and its merge commit's Tests run passed (rule 2).

## Changes to the plan

- 15 October 2026: step 1 split into 1.1 to 1.4, with publishing first, since branch publishing was already off.
- 15 October 2026: [Verification rules](#verification-rules) added. A check on `master` after the merge is required only where an item's Verify names it (1.1 needed one, since its merge run was a forced full run); it isn't a generic rule.
- 15 October 2026: `tools/affected.mjs` dropped from 1.4: since 1.1 the content-keyed cache already reruns only what a change touches, so tests are picked one way. The cache runners stay in step 4.
- 15 October 2026: step 5 is no longer a full run on every push to `master` (that reruns unrelated tests); instead the UI tests are always split across machines.
- 15 October 2026: test caching made exact in 1.1 rather than later: a one-line `package.json` change reran every test, which the restructure exists to stop.
- 15 October 2026: no checks in the deploy and none after it (decision 4). Browser checks of the published copy, a pull-request build and a post-deploy check were tried in 1.1 and dropped: the pull request's tests already cover the code, the build is a plain copy covered by unit tests, and a check after the deploy could only report problems nobody can fix in code.
- 15 October 2026 (1.2): the list of languages in `lang.js` is filled in on one line, replacing the one line between its markers, rather than on one line per language: the served script keeps every line where the source has it, so coverage (which Codecov matches against the source) stays on the right lines. The source has English alone on that line.
- 15 October 2026 (1.2): `scripts/site.mjs` and `scripts/parts.mjs` are now inputs of every UI spec, since the test server imports them to fill in pages. Before, a change to one page's entry reran only the specs of the pages whose committed HTML changed. This lasts until the pages' fields move into each app's `module.json` (step 2 onwards).
- 15 October 2026: the remaining work regrouped into three pull requests, at the owner's request (the small items made too many): step 2 is the module format, every shared module and the Snake pilot (old 1.3, 1.4 and 2.1 to 2.3); step 3 is every other app and the landing and profile pages (old 3.1 to 3.8); step 4 removes the old plumbing, rewrites the docs and splits the UI tests across machines (old 4.1, 4.2 and 5.1). Nothing was dropped: every box and every Verify of the old items is in the new ones.
