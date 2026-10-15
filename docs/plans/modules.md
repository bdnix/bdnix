# Plan: one folder per app, and tests that follow it

The working plan for the restructure proposed in *One folder per app, and tests that follow it* (October 2026). It is kept in the repository so that any session can pick it up where the last one stopped.

## How to use this plan

- **Start of a session:** read this file top to bottom, then `git log --oneline -20 origin/master` and the open pull requests, and tick anything that has happened since the file was last updated (a pull request merged, a live check done). The first unticked box is the next thing to do.
- **One pull request per numbered item** (1.1, 1.2, ...), opened against `master` as [AGENTS.md](../../AGENTS.md) describes, and driven to green CI. Its description links back to this plan.
- **Tick boxes in the pull request that does the work**, so the plan on `master` always matches what is merged. Boxes that can only be ticked after a merge (the live checks) are ticked in the next pull request, or in a small one of their own if nothing else follows.
- **Every item has a verification step, and every merge has a live check.** The live check is not optional: after the owner merges, load the deployed site, `https://www.bdnix.com`, and confirm it is the merged commit and works (see [Checking the live site](#checking-the-live-site)). Write down what was checked in the item's "Live" box.
- If something here turns out to be wrong, change the plan in the same pull request and say why under [Changes to the plan](#changes-to-the-plan).

## Decisions (owner, 15 October 2026)

1. **Publish with a custom GitHub Actions workflow.** The owner has switched Settings → Pages → Source to GitHub Actions and turned off publishing from the branch. Until 1.1 is merged, merges to `master` do not reach the live site.
2. **Folder names as proposed:** `apps/`, `shared/`, `site/`, `tools/`.
3. **Start with step 1 and the Snake pilot.** This plan is committed to the repository and kept up to date with checkboxes.

## Checking the site, before and after it goes live

`tools/check-site.mjs` (added in 1.1) checks the site in two modes:

- **`npm run check:site`, before a deploy.** Builds `_site/`, serves it locally as www.bdnix.com and opens every page in Chromium at desktop and phone size, in English and Bangla: no error on the page, no failed request, nothing blocked by the security policy, nothing untranslated, the consent banner shown, nothing contacted but bdnix.com before consent. The Pages workflow runs it on every pull request and before every deploy, and a failure stops the deploy. So a broken build shows up on its pull request and never goes live.
- **`npm run check:live`, after a deploy.** Every file of the build is fetched from www.bdnix.com past the CDN cache and must match byte for byte (the live site is exactly this commit), then the same page checks run on the live site. The workflow runs only the file comparison after a deploy; if it fails, the deploy didn't land, and re-running the workflow is the fix.

Screenshots of every page go to `.test-cache/site/`. After each merge, run `npm run check:live` from the merged `master`, look at a few screenshots, and record the result in the plan's "Live" box.

## Step 1: foundations, and Snake as the pilot

The proposal's step 1 is too big for one reviewable pull request, so it is split into four. The site keeps working after each one; apps that haven't moved keep running on the old plumbing.

### 1.1 Publish the site through GitHub Actions

Urgent, because branch publishing is already off. Nothing about the site changes: the published copy is the same files Jekyll published.

- [ ] `tools/site.mjs` (`npm run site`) assembles the published site in `_site/`: the landing page, every page folder listed in `scripts/site.mjs`, `assets/`, `CNAME`, `robots.txt`, `sitemap.xml` and `LICENSE`. Repository tooling (tests, scripts, docs, configs) is left out by not being listed, rather than by an exclude list.
- [ ] `.github/workflows/pages.yml`: builds `_site/` and runs `npm run check:site` on every pull request and push; on `master` only, then deploys the checked build and confirms with `npm run check:live -- --files-only` that it landed. Only `master` ever deploys: the upload and deploy steps are conditioned on `refs/heads/master`, and a unit test fails if that guard goes.
- [ ] `tools/check-site.mjs` (`npm run check:site` and `npm run check:live`), as described above; a unit test keeps the check ahead of the upload in the workflow.
- [ ] `_config.yml` removed (Jekyll no longer runs). The test server can serve `_site/` (`SITE_DIR=_site`), so the UI tests can run against the published copy.
- [ ] Docs: `docs/development.md` (publishing), AGENTS.md (hosting line, `_site/`), `.gitignore`.
- [ ] **Verify:** unit tests for the published file list; `npm run site`, then the full UI suite against `_site/` (`SITE_DIR=_site npm run test:ui`) passes; `npm run check:site` passes, and fails on a page with a deliberate error; `npm run check:live` shows the files in `_site/` are exactly the files the live site serves today, apart from `eslint.config.mjs` (a config file Jekyll published by accident); `npm run lint`, `npm test` pass; CI green.
- [ ] Pull request merged.
- [ ] **Live:** the Pages workflow's check, deploy and confirmation passed on `master`; `npm run check:live` from merged `master` passes locally and the screenshots look right.

### 1.2 Version stamps and generated parts only in the published copy

Source files stop carrying `?v=` stamps and generated blocks, so a change to one file changes only that file in git. Still the old folders; nothing moves yet.

- [ ] One page transform (`tools/page.mjs`), used by both the build and the test server so they can't drift apart: fills the `build:` blocks (head tags, footer, cards, scores) and stamps `?v=<hash>` on the site's own scripts and styles. The translation bundles (`assets/lang/<code>.js`) and the language list in `lang.js` are made the same way.
- [ ] `npm run build` writes the transformed site to `_site/` only; source pages keep the markers but nothing between them, and link `/assets/js/x.js` without a stamp. `assets/lang/bn.js` and `sitemap.xml` stop being committed.
- [ ] `tests/server.mjs` serves the source tree through the same transform, so tests see exactly what visitors get. It logs the *source* files each response was made from (the page, and what its generated parts came from), not the stamps, so a stamp changing no longer reruns a spec (the cascade in PR #82).
- [ ] `npm run build:check` and its CI step removed (nothing generated is committed any more). The Pages workflow publishes `npm run build`'s output.
- [ ] Docs: AGENTS.md "Cache-busting" and "Commands", `docs/development.md`.
- [ ] **Verify:** unit tests for the transform (stamps, blocks, languages list); the HTML the test server serves for every page equals the page in `_site/`; `_site/` equals the `_site/` of 1.1 for every page except where a stamp's hash input legitimately changed (diff reviewed and explained in the pull request); full `npm test` passes; a change to `assets/lang/bn/site.json` alone reruns only the specs that load Bangla (shown with `npm run coverage:ui:cached -- --plan` before and after a test edit); CI green.
- [ ] Pull request merged.
- [ ] **Live:** Pages check, deploy and confirmation green; `npm run check:live` locally passes, screenshots look right, and the stamps on the live pages are the build's.

### 1.3 Modules: `module.json`, the graph, and the shared modules Snake uses

- [ ] The `module.json` format, documented in `docs/development.md`: `name`, `kind` (`app`, `shared`, `site`), `url` (where it's published), `publish` (source file → published path, so `/assets/js/sound.js` stays where it is), `uses` (shared modules), and for an app its page fields (title, description, schema, category) and card fields (name, blurb, keywords, icon, best-score key).
- [ ] `tools/modules.mjs`: finds every `module.json`, checks it, and gives the module graph and the published path of every file. The build and the test server publish module files at their old URLs; `scripts/site.mjs` still lists the pages that haven't moved, and the build merges both.
- [ ] Shared modules moved into `shared/<name>/`, each with its files, its own `lang/bn.json` and its tests: `base` (`base.css`, fonts), `lang` (`lang.js`, `lang.css`, `bangla.css`), `analytics`, `backdrop` (`blocks.js`), `game-shell` (`game.css`, `icon-btn.css`), `sound`, `gamesave`, `upright`, `gamepad` (`gamepad.css`). Published URLs unchanged.
- [ ] Translations per module: the build makes one pack per page from the `lang/` of its module and the modules it uses (pages not yet moved get everything in `assets/lang/`, as today). `lang.js` loads the page's own pack.
- [ ] Coverage paths: `tests/coverage/shared.mjs` maps a published URL back to its source file, so Codecov reports `shared/sound/sound.js`. Note the moved paths on the pull request.
- [ ] **Verify:** unit tests for `modules.mjs` (graph, publish map, errors for a bad `module.json`); `_site/` is identical to before apart from translation packs and stamps (diff reviewed); every page still passes in English and Bangla; full `npm test` and `npm run coverage` pass; CI green.
- [ ] Pull request merged.
- [ ] **Live:** Pages check, deploy and confirmation green; `npm run check:live` locally passes, Snake and one tool checked by hand in both languages, screenshots look right.

### 1.4 Snake in `apps/snake/`, test targets, `affected.mjs` and `boundaries.mjs`

- [ ] Snake moved to `apps/snake/`: `module.json`, `index.html`, `snake.js`, `snake-core.js`, `snake.css`, `lang/bn.json`, and `test/` with the four targets: `logic.test.mjs`, `behaviour.spec.mjs`, `i18n.spec.mjs`, `page.spec.mjs`. Its entry leaves `scripts/site.mjs`. URL `/snake/`, storage keys and saved games unchanged.
- [ ] `tools/affected.mjs`: from the files changed against `master` (git), walks the module graph and lists the targets to run, with each target's inputs as in the proposal's table. Deterministic: no previous run needed.
- [ ] Undeclared inputs fail: the test server's log is checked after a module target runs, and a file it loaded outside its declared inputs fails the run, naming the file.
- [ ] `tools/boundaries.mjs`, run by `npm run lint`: an app links only its own files and the modules in `uses`; a shared module names no app; no file belongs to two modules; every translation string has one owner; every module has its test targets.
- [ ] CI: module targets chosen by `affected.mjs`; everything not yet moved still goes through the old per-spec cache (`scripts/ui-cache.mjs`).
- [ ] Docs: AGENTS.md and `docs/development.md` describe modules for moved apps, alongside the old layout for the rest; `docs/games.md` paths.
- [ ] **Verify:** unit tests for `affected.mjs` (each row of the proposal's "What a change would rerun" table that applies so far, as a test) and `boundaries.mjs` (each rule, failing and passing); a deliberate undeclared file makes a target fail; a one-word change to Snake's Bangla selects only `snake/i18n`; Snake plays, saves and restores in both languages (its existing tests, moved); CI green.
- [ ] Pull request merged.
- [ ] **Live:** Pages check, deploy and confirmation green; `npm run check:live` locally passes; on www.bdnix.com/snake/: a game started, reloaded mid-game and resumed, in English and Bangla, on desktop and phone size; screenshots look right.

## Step 2: the remaining shared modules

Each with contract tests on a fixture page (not an app), its own `lang/`, and published at its old URL. One pull request per group:

- [ ] 2.1 `files`, `pdftools`, `images` (and the components only tools use: `tool.css`, `page.css`, `file.css`, `tracks.css`, `editor.css`, `settings.css`, `seg.css`, `features.css`, `footer.css`). **Verify:** contract tests; every tool page passes unchanged; CI green. **Live:** deploy, `check:live`, one tool of each kind used by hand (a PDF, an image and an audio file).
- [ ] 2.2 `profile`, `avatar.css`, `profile-chip.css`, `search-core`. **Verify:** contract tests; landing and profile pages pass; CI green. **Live:** deploy, `check:live`, name set and shown on the profile page.
- [ ] 2.3 Anything left in `assets/js` or `assets/css` that isn't an app's. **Verify:** `assets/js` and `assets/css` hold only files of apps not yet moved; CI green. **Live:** deploy, `check:live`.

## Step 3: the apps

Two or three per pull request, each moved like Snake in 1.4 (module, four targets, `lang/`, URL and storage keys unchanged). For every pull request: **Verify** that each moved app's moved tests pass, `affected.mjs` selects only its targets for a change inside it, and CI is green; **Live** deploy and `check:live`, then each moved app used by hand on the live site in both languages (a game played, saved and resumed; a tool run on a real file and its download opened).

- [ ] 3.1 Falling Blocks, Maze Chase
- [ ] 3.2 Flap, Road Hop, Brick Bounce
- [ ] 3.3 Chess (with the vendored Stockfish)
- [ ] 3.4 Merge PDFs, Watermark, Redact
- [ ] 3.5 Sign, Unlock
- [ ] 3.6 MP4 to MP3, Compress Images
- [ ] 3.7 Photo Collage, Resize Without Cropping
- [ ] 3.8 The landing and profile pages as `site/` modules, reading the generated catalogue of every app's card fields. **Verify:** changing an app's card reruns the landing and profile targets, changing its rules doesn't.

## Step 4: remove the old plumbing

- [ ] 4.1 Remove `scripts/site.mjs`, `scripts/ui-cache.mjs`, `scripts/ui-deps.mjs` (if nothing uses it), the empty old folders and the old CI cache steps; `tools/boundaries.mjs` replaces the lists in `tests/unit/site.test.mjs`. **Verify:** nothing references the removed files; the full suite passes; CI green. **Live:** deploy, `check:live`.
- [ ] 4.2 Rewrite AGENTS.md and `docs/development.md` around modules. **Verify:** every path and command in them exists and runs. **Live:** deploy, `check:live`.

## Step 5: sharded full runs

- [ ] 5.1 A full run on every push to `master`, and on a pull request that changes a shared module, split across machines with Playwright's `--shard` and the reports merged; coverage still uploaded once. **Verify:** a full run's time and test count against an unsharded one; CI green. **Live:** deploy, `check:live`.

## Changes to the plan

- 15 October 2026: step 1 split into 1.1 to 1.4, with publishing first, since branch publishing was already off.
- 15 October 2026: the browser checks moved from after the deploy to before it (`npm run check:site`), so a broken build fails its pull request instead of going live and needing a follow-up fix. After a deploy, the workflow only confirms the files landed.
