# Development

The site is plain HTML, CSS and vanilla JavaScript, hosted on GitHub Pages, deployed from `master` by a workflow (see [Deploying](#deploying)). There is no framework, bundler or compile step, and nothing to install at runtime. `package.json` holds development tooling only.

[AGENTS.md](../AGENTS.md) is the authoritative guide to the project's conventions and review requirements. This page covers the practical side.

## Running locally

With Node 22 or later:

```bash
npm install
npm run serve        # http://localhost:4173
```

`npm run serve` is the test server ([tests/server.mjs](../tests/server.mjs)): it serves the source tree as the build publishes it, so an edit shows on the next reload. The source pages can't be opened as they are, since their head tags and stamps are only filled in when they're served (see [Building](#building)). To look at the published copy itself, `npm run build` and serve `_site/` with any static server, such as `python3 -m http.server -d _site 8000`.

## Project layout

Everything the site is made of is in modules, one folder each ([the plan that got it there](plans/modules.md)); see [Modules](#modules).

- **Apps**, `apps/<name>/`: each game and tool, with its page, scripts and stylesheet, its translations (`lang/`), its tests (`test/`), any library or font only it uses (`vendor/`, `fonts/`) and its `module.json`, which says where each file is published. A feature of one app only ever changes that app's folder.
- **Site pages**, `site/<name>/`: the landing page (`site/landing`, which lists the apps' cards) the profile page (`site/profile-page`, with each game's best score) and the about page (`site/about`, what bdnix is and why, linked from every page's footer and the landing page's top bar).
- **Shared modules**, `shared/<name>/`: what the apps share, each one concern, published at its old URL (`/assets/js/sound.js` comes from `shared/sound/sound.js`). They hold only what every page that links them uses, with nothing about any one app in them.
- Shared styles: `base` (what every page uses: colour tokens, the top bar, buttons, panels), `game-shell` (game layout), `page` (the one-column layout of the tool and profile pages) and `tool` (what every tool has). Components used by only some pages are modules of their own (`editor`, `settings`, `tracks`, `profile-chip`, `gestures`, …), and a page uses only the ones it shows.
- Shared scripts expose one `window.bdnix*` object each: the falling-block backdrop (`backdrop`), file helpers (`files`), PDF helpers and the PDF libraries (`pdftools`), image-file helpers (`images`), the rules of chess (`chess-core`), the visitor's name (`profile`), saved games (`gamesave`), the sound engine (`sound`) and analytics. The Stockfish engine is a module of its own (`stockfish`). Each game adds its own sounds to the engine with `bdnixSound.add()`.
- Pure logic (layout maths, parsing, encoding, game rules) is kept in separate `*-core.js` style files so it can be unit tested without a browser.
- The landing page's search box matches what's typed against each card's name, description and keywords (`search-core.js`, the `search` module). A new game or tool's card needs a few `keywords` so it turns up for the words people are likely to try.
- Every page is translated in the browser into the visitor's language (see [Languages](#languages)).
- Third-party libraries are vendored in the module that loads them, each with its licence file, and fetched only when a tool first needs one (`bdnixFiles.loadScript()`), never linked from a page.
- `assets/` holds only what belongs to no module: the share images (`assets/img/`) and each language's `language.json` (`assets/lang/<code>/`).
- The build and its checks are in `tools/` (`site.mjs`, `page.mjs`, `modules.mjs`, `languages.mjs`, `boundaries.mjs`), what the build fills into every page in `scripts/parts.mjs`, and the test caches in `scripts/`.

## Tests

Every new feature and bug fix needs tests, and a pull request must not lower code coverage.

```bash
npx playwright install chromium   # first time only
npm test                          # unit tests, then UI tests
npm run test:unit
npm run test:ui
npm run lint                      # ESLint, Stylelint and tools/boundaries.mjs
```

- **Unit tests** (each module's `test/*.test.mjs`, and `tests/unit/` for the build and test tooling) use Node's built-in test runner. They load the site's scripts into a sandbox and cover pure logic: page-range parsing, the profile, saved games, game sounds, watermark placement, redaction search and geometry, signature placement and image clean-up, PDF decryption (the hashes, ciphers and password checks of Unlock PDF), audio encoding and MP4 parsing, image compression rules, photo collage layouts, where Resize Without Cropping places an image, the Flap, Road Hop, Snake, Brick Bounce and King of Streets game rules (and King of Streets' road laid out in 3D, its camera and its engines' revs), the rules of chess (checked against the standard perft move counts), and Learn Chess's courses (every move legal and explained, every note translated) and the rules of its progress.
- **UI tests** (each module's `test/*.spec.mjs`; `tests/ui/` has the helpers, and `seo.spec.mjs` for robots.txt, the sitemap and the share images) use Playwright to drive the real pages in Chromium at desktop and phone size. They check downloaded output (PDFs are opened and inspected, audio and images are decoded), play every game on a frozen clock with fixed randomness so scores are exact, and fail on any uncaught JavaScript error or sideways scrolling on a phone. Test PDFs, audio, video and images are generated in code, so no binary fixtures are committed.
- **Checks every page gets:** [tests/ui/checks.mjs](../tests/ui/checks.mjs) holds them (games' are in `checks-game.mjs`, PDF tools' in `checks-pdf.mjs`): [axe](https://github.com/dequelabs/axe-core) (any WCAG 2.1 A or AA problem fails), labelled canvases and typed buttons, the security policy, analytics (off locally, asking first on the live site, nothing but bdnix.com contacted until then), the title, description, share tags and structured data, no other games' names outside a credit line, no sideways scrolling, hashed files that load, and the footer. Games also get their mute button and language switch, pausing when the page is left, the upright note, a short wide window, their start card fitting whole on a small phone (on a phone it covers the game area under the top bar, and scrolls rather than spill if it ever can't fit), their touch gestures (and tapping the score to pause) and the credit line checked, and PDF tools pdf-lib fetched on demand. Every page runs them for itself from its page and i18n targets (see [Modules](#modules)), so no spec keeps a list of pages and adding an app runs only its own specs (and those of the landing and profile pages and the sitemap, which change with it).
- **Lint:** ESLint checks the site's scripts (as ES5-style browser scripts that mustn't leak globals), the tests and the build scripts (`eslint.config.mjs`); Stylelint checks the stylesheets for mistakes such as unknown properties or duplicate selectors (`.stylelintrc.json`); [tools/boundaries.mjs](../tools/boundaries.mjs) checks the modules keep to their own files (see [Modules](#modules)). CI runs all three.

The test MP4s carry FLAC audio because the Chromium build Playwright runs can't decode AAC; Chrome, Edge, Firefox and Safari can.

If a UI test fails in CI, the run's **playwright-report** artifact has the HTML report and a trace of each failed test (`npx playwright show-trace trace.zip`).

## Coverage

```bash
npm run coverage     # both suites, combined into coverage/report/index.html
```

[Codecov](https://codecov.io/gh/bdnix/bdnix) combines unit and UI coverage of the site's own scripts (a line counts as covered if either suite runs it), each reported at its place in the repository: a module's script at `shared/sound/sound.js`, say, though pages load it as `/assets/js/sound.js` ([tests/coverage/shared.mjs](../tests/coverage/shared.mjs) maps one to the other), and comments on each pull request. Its checks are configured in [codecov.yml](../codecov.yml):

- **codecov/project** fails if overall line coverage drops more than 0.1% below `master`.
- **codecov/patch** fails if less than 90% of new or changed lines are covered.

## Continuous integration

[.github/workflows/tests.yml](../.github/workflows/tests.yml) runs on every pull request and push to `master`, and once a week on its own: lint and the unit tests, and the UI tests, each on one machine, then a combined coverage upload. The upload fetches Codecov's CLI from `cli.codecov.io`; if that fails it tries once more with the CLI from PyPI, and if that fails too the **Coverage** job fails, rather than passing with nothing uploaded and no Codecov checks. `node_modules` (keyed on `package-lock.json` and the Node version) and Playwright's Chromium (keyed on the Playwright version) are cached; see [.github/actions/setup](../.github/actions/setup/action.yml).

Tests that can't have changed aren't run again; CI uses their cached result and coverage, so Codecov still gets the full picture.

- **Unit tests** are cached file by file by [scripts/unit-cache.mjs](../scripts/unit-cache.mjs). A test file's inputs are what it uses ([scripts/test-deps.mjs](../scripts/test-deps.mjs)): its own file, the test helpers it imports (and theirs), every repository file it read, imported, listed or checked for while it ran (each test file runs in its own process with [tests/unit/track.mjs](../tests/unit/track.mjs) recording them), the npm packages those import at the versions the lock file pins, and the Node version.
- **UI tests** are cached spec by spec by [scripts/ui-cache.mjs](../scripts/ui-cache.mjs), on what each spec was *served*. A spec's inputs are its own code and the test helpers it imports, what every spec runs on (`playwright.config.mjs` and `tests/ui/fixtures.mjs`, and what they import), the npm packages and the Node version, and every response the test server gave it: the path, its status, type and a digest of its body, with the site's own `?v=` stamps left out (the test server logs them, [tests/server.mjs](../tests/server.mjs)). To see whether a cached spec still holds, the cache answers each path it fetched again with the same code the test server answers with (`respond()` in [tools/page.mjs](../tools/page.mjs)) and compares. So a change to the build or the server that serves the same bytes reruns nothing, a change to a page reruns exactly the specs that fetched it, and a change to a module's file reruns exactly the specs that were served it. A spec that fails is never cached.
- **One machine.** The **UI tests** job restores the cache, runs the specs that have to run, fails unless every spec now has a passing result and each module's specs used only what it declares, merges the coverage and saves the cache. It sets up Chromium every time, whether or not a spec has to run.
- **Every week**, the scheduled run ignores both caches and runs everything, so a cached result can't hide a problem for long. Run the workflow by hand with **full** ticked to do the same. `tests/unit/workflow.test.mjs` holds the workflow to all this.
- For the cache to be right, a UI test gets every repository file it depends on through the test server (`page.goto`, `request.get('/path')`), never with `fs`, and a helper that only some tests need goes in its own file, so changing it reruns only those.

Locally, `npm test` and `npm run coverage` always run everything; `npm run coverage:unit:cached` and `npm run coverage:ui:cached` run what CI runs, keeping their cache in `.test-cache/` (`npm run coverage:unit:cached -- --plan` says which unit test files would run).

## Deploying

Anything merged to `master` goes live through [.github/workflows/pages.yml](../.github/workflows/pages.yml) (Settings → Pages → Source is **GitHub Actions**). It runs on every push to `master` and does two things: `npm run build` makes the published site in `_site/` (see [Building](#building)), and that folder is deployed to GitHub Pages.

The code is tested on its pull request (see [Continuous integration](#continuous-integration)) before it reaches `master`, so the deploy runs no tests of its own. Only `master` is ever published: a run started by hand on any other branch does nothing (`tests/unit/publish.test.mjs` checks this). For a second lock, keep the `github-pages` environment's deployment branches (Settings → Environments) limited to `master`.

### Building

`npm run build` ([tools/site.mjs](../tools/site.mjs)) makes the published site in `_site/`: what each module publishes (its `module.json`), `assets/`, `CNAME`, `LICENSE` and `robots.txt`, plus what only the build makes, `sitemap.xml` and the language packs. What's published is a list, so test tooling, scripts and docs stay out without an exclude list. `_site/` is never committed, and neither is anything generated: a change to one source file changes only that file in git.

Each file is written as [tools/page.mjs](../tools/page.mjs) serves it, the same code the test server answers with, so the tests see exactly what visitors get:

- A file a module publishes is served at its URL from the module's folder.
- A page's parts that come from the modules' `module.json` and [scripts/parts.mjs](../scripts/parts.mjs) (head tags, footer, landing page cards, profile page scores) are filled in between its `<!-- build:... -->` markers, which in the source have nothing between them.
- Browsers may cache scripts and stylesheets, so the site's own files are linked with `?v=` and a hash of what's served there, for example `/assets/js/merge.js?v=d07a831b04`. In the source, a page links them plainly, as `/assets/js/merge.js`. Vendored libraries keep their version number as `?v=`, written by hand; bump it when upgrading one.
- `lang.js` gets its list of languages, and each language its pack (see [Languages](#languages)).

The build fails, naming each problem, if a page links a file that doesn't exist, a page has no `module.json` (or a `module.json` no page), a `module.json` is wrong, or a string is translated two ways in one pack. `tests/unit/page.test.mjs` checks the transform, that the sources carry nothing generated, and that the test server serves exactly what `_site/` has.

## Modules

[tools/modules.mjs](../tools/modules.mjs) finds every `module.json` under `apps/`, `shared/` and `site/` and checks it:

```json
{
  "name": "snake",
  "kind": "app",
  "url": "/snake/",
  "publish": { "index.html": "/snake/index.html", "snake.js": "/assets/js/snake.js", "snake.css": "/assets/css/snake.css" },
  "uses": ["base", "lang", "analytics", "backdrop", "game-shell", "icon-btn", "gestures", "sound", "gamesave", "upright"],
  "page": { "title": "…", "description": "…", "schema": "WebApplication", "category": "GameApplication" },
  "card": { "kind": "game", "name": "Snake", "blurb": "…", "keywords": "…", "icon": ["…"], "best": "bdnix_snake_best" }
}
```

- `name` is the folder's name and `kind` its parent's (`app`, `shared` or `site`). An app or site page has a `url` and its `page` fields (title, description, structured data, `noindex`; what the build makes its head tags from), and an app its `card` (the landing page's card and, for a game, the profile page's best score).
- The landing page's `cards` lists the apps, `{ "games": [...], "tools": [...] }`, in the order the landing page shows them; that's also the order of the pages in `sitemap.xml`. A site page with `"scores": true` (the profile page) gets every game's best-score row.
- `publish` maps each of its files to the URL it's published at. A folder (`"fonts/": "/assets/fonts/"`) publishes every file in it. Nothing else is published: not its tests, its translations or `module.json`. URLs stay as they were, so visitors' caches and saved data are untouched.
- `uses` names the shared modules it uses; theirs come with them.
- `inputs` names any other repository file its tests may read (the landing page's footer links to the issue template, say).
- Its translations are `lang/<code>.json`, and its tests are in `test/`.

**Translations.** Each app and site page names its pack (`data-pack="snake"` on its `lang.js` script, written by the build) and gets `/assets/lang/snake.<code>.js`: its translations and those of the shared modules it uses, and nothing else ([tools/languages.mjs](../tools/languages.mjs)). A page that shows the apps' cards or scores also gets those words, as each app's own pack translates them. A page that names no pack (a test's made-up page) gets `/assets/lang/<code>.js`, with every shared module's translations.

**Tests.** An app or site page has these targets in its `test/`:

- `logic.test.mjs`: unit tests of its pure logic, loading its scripts by their place in the repository (`load('apps/snake/snake-core.js')`). An app with a single script (its page's) has none.
- `behaviour.spec.mjs`: playing or using it.
- `page.spec.mjs`: `checkPage()` and, for a game, `checkGame()` (and `checkPdfLib()` for a PDF tool), in English (`languages: false`).
- `i18n.spec.mjs`: everything in the other languages: `checkPageLanguages()`, `checkGameLanguages()` for a game, `checkStrings()` ([tests/ui/strings.mjs](../tests/ui/strings.mjs)), which checks its pack has every word its page's scripts ask for, and its behaviour in Bangla (`inLanguage()` and `expectTranslated()` from [tests/ui/languages.mjs](../tests/ui/languages.mjs)).

A shared module's tests are contract tests: unit tests of its logic, and specs on a page made up for it with `openFixture()` ([tests/ui/fixture.mjs](../tests/ui/fixture.mjs)), never through an app.

**Declared inputs.** A module's tests may use only its own files, those of the modules it uses (and theirs), its `inputs`, and what every page is made from (`scripts/parts.mjs`, every app and site page's `module.json`, which make the head tags and the sitemap, `assets/img/`, each `language.json`, and test helpers and build tools); a page with the apps' cards or scores may also read their translations. After the UI tests, [tests/ui/inputs.mjs](../tests/ui/inputs.mjs) reads the test server's log and fails the run, naming the file, if a module's spec was served anything else; `scripts/unit-cache.mjs` does the same for a module's unit tests. So a module's `module.json` is the whole truth about what its tests depend on.

**Boundaries.** [tools/boundaries.mjs](../tools/boundaries.mjs), run by `npm run lint`, fails unless every `module.json` is right; a module's page and stylesheets link only its own files and its `uses`' (and `assets/img/` and the language packs); a shared module names no app (its URL, files, storage keys or name, in any file, tests included); no file belongs to two modules; every translation has one owner (no English twice in one module's pack, or in two shared modules); every page's title and description are its own and fit search results, in the site's own names, and every card has what the landing page needs; the landing page lists every app once; and every module has its tests (an app or site page its targets, calling the checks above).

## Adding a page

A new game or tool is a new module, `apps/<name>/` (a page that's neither, `site/<name>/`). It needs:

- Its `module.json`: its `url`, what it publishes where, the shared modules it uses, its `page` fields (title and description, from which the build writes its canonical URL on `https://www.bdnix.com`, Open Graph and Twitter tags, [schema.org](https://schema.org) structured data and its `sitemap.xml` entry) and its `card`; and its place in the landing page's `cards` (`site/landing/module.json`). A game's profile page row comes from its card.
- Its page, `index.html`, with `<!-- build:meta -->` / `<!-- /build:meta -->` markers in its `<head>` (plus `<!-- build:footer -->` markers around a footer), linking only its own files and its `uses`'. The build adds `lang.js`, the security policy and the head tags.
- A `role="img"` and an `aria-label` on every canvas but the backdrop, and a `type` on every button.
- Its translations in `lang/<code>.json` for every language, its name and card included.
- Its test targets (see [Modules](#modules)): `checkPage(url, { languages: false, schema, category, footer })` from [tests/ui/checks.mjs](../tests/ui/checks.mjs) in its page target, which checks all of the above, plus `checkGame(url, { credit, gestures })` from `checks-game.mjs` for a game or `checkPdfLib(url, isOpen)` from `checks-pdf.mjs` for a PDF tool; the language checks in its i18n target. `npm run lint` fails until they're there. Nothing in `tests/` needs to change.
- A mention in the [README](../README.md) and the relevant guide in this directory.

The share image (`assets/img/og.png`, 1200×630) and `assets/img/apple-touch-icon.png` are drawn by [scripts/og-image.mjs](../scripts/og-image.mjs). To change them, edit the script, run `npm run og-image` and commit the PNGs.

The audio converter's MP3 encoder, `apps/mp4-to-mp3/vendor/lame.wasm`, is LAME compiled to WebAssembly by [apps/mp4-to-mp3/lame/build.mjs](../apps/mp4-to-mp3/lame/build.mjs). It's committed, so neither the build nor CI makes it. To change it (its calls, in `glue.c`, or a new LAME version), install Zig's C compiler (`pip install ziglang==0.17.0`), run `npm run build:lame`, bump the `?v=` on `LAME` in `audio.js` and commit the file; the build is reproducible. See [its README](../apps/mp4-to-mp3/lame/README.md).

## Languages

The site is written in English and shown in the visitor's language by [lang.js](../shared/lang/lang.js), which every page loads first, from each module's `lang/<code>.json`. Adding a language is adding its `assets/lang/<code>/language.json` and each module's translations; no page or script changes.

- **Which language.** The one the visitor picked with the switch in the top bar (`lang.css`), kept in `localStorage` as `bdnix_lang`; else their browser's language, if the site has it; else English. Every page, games included, follows it. The page's `<html lang>` says which it is.
- **The translations.** `assets/lang/<code>/language.json` has the language's `name` (as the switch shows it), its `digits` if it has its own, and its `style`, a stylesheet for its font (Bangla's is `bangla.css`, in the `lang` module, which serves Kalpurush, from Avro (OmicronLab), for the Bengali letters only, OFL 1.0, from `/assets/fonts/`, after Inter in the font stacks; it is the unmodified TTF, since OFL 1.0 lets only an unmodified copy keep its name, and has one weight, so bold Bangla is the browser's). Each module's `lang/<code>.json` maps English text, exactly as it's written in its page or scripts, to its translation. A translation can be `{ "one": ..., "other": ... }` (and `few`, `many` and so on) for a language with more plural forms than English.
- **The build.** [tools/languages.mjs](../tools/languages.mjs) bundles each language into packs: one for each app and site page, served at `assets/lang/<name>.<code>.js`, and one of the shared modules' words, at `assets/lang/<code>.js` (see [Modules](#modules)). It fills in the list of languages, with their packs' hashes, between the `build:languages` markers in `lang.js` (on one line, so the script's lines stay where they are in the source). Neither is committed. The build fails if one English string is translated two ways in the same pack.
- **Pages.** While the page is read, and whenever a script changes it later, `lang.js` swaps text, `aria-label`, `title`, `placeholder`, `alt`, a text box's value, the title and the description for their translations, and writes standalone numbers in the language's digits. A paragraph with a link, bold words or a line break inside is translated whole: the key is its HTML with the elements' attributes left out (`Read the code on <a>GitHub</a>.`), and the page's own elements are put back in the translation's places. Text marked `translate="no"` is left alone. Search on the landing page finds a card by its translated words as well as its English ones.
- **Scripts.** Scripts are written in English. Text with something put into it goes through `bdnixLang.t('{n} of {total}', { n, total })`; counts through `bdnixLang.count(n, '{n} page', '{n} pages')`; a number drawn on a canvas through `bdnixLang.num(n)`. A word that means two things gets a bar and a hint (`t('Draw|result')`, shown as "Draw"). Where English counts something (`'{areas} on {pages}'`), scripts also pass the bare number as `{count}`, for languages that word it differently.
- **Tests.** `bdnixLang.missing` lists English shown with no translation. `checkPage()` opens each page in every language and expects it empty, along with the page's `lang`, a translated title, axe and phone width; `checkGame()` plays each game in every language. `tests/unit/languages.test.mjs` checks every language has every string the shared modules' scripts pass to `t()` and `count()`, and that translations keep their English's elements and `{values}`; each page's i18n target checks the same of its own pack (`checkStrings()`) and its behaviour in other languages, with `inLanguage()` and `expectTranslated()` from `tests/ui/languages.mjs`. The `lang` module's own specs test the switch and choosing a language.
- **Reviewing.** The site's owner reviews each language's translations, before they ship or after, as they choose.

## Third-party libraries

| Library | Version | Licence | Used for |
|---|---|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | MIT | Editing PDFs in all four PDF tools (loaded with the first PDF or image) |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | 1.1.1 | MIT | Embedding uploaded fonts in watermarks (loaded only when needed) |
| [PDF.js](https://mozilla.github.io/pdf.js/) (legacy build) | 6.3.289 | Apache 2.0 | Previews, text search and page rendering (loaded once a file is opened) |
| [LAME](https://lame.sourceforge.io/) | 3.100 | LGPL | MP3 encoding: its unmodified source compiled to WebAssembly, with a small file of calls of the site's own, by `apps/mp4-to-mp3/lame/build.mjs` (`npm run build:lame`, needing Zig; see that folder's README). Fetched with the first MP3 and handed to the web workers that encode |
| [Stockfish.js](https://github.com/nmrugg/stockfish.js) (lite, single-threaded WebAssembly build) | 19.0.0 | GPL 3 | The chess opponent in Chess and Learn Chess, included unmodified and run as its own web worker (started with the first game, or when a learner plays on) |
| [Inter](https://rsms.me/inter/) (from [Fontsource](https://fontsource.org/)) | 5.3.0 | OFL 1.1 | The site's text, weights 400, 600 and 800 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (from Fontsource) | 5.3.0 | OFL 1.1 | Labels and code-style text, weights 400 and 600 |
| Mrs Saint Delafield, Herr Von Muellerhoff, Mr De Haviland and Mr Dafoe (from Fontsource) | 5.3.0 | OFL 1.1 | Typed signatures in Sign PDF, weight 400 |
| [three.js](https://threejs.org/) (the minified module build, and its GLTFLoader, RGBELoader, SkeletonUtils, BufferGeometryUtils and meshopt decoder) | 0.170.0 | MIT | King of Streets' 3D, fetched when the game page opens; copied in by `apps/king-of-streets/three/vendor.mjs`, which points their imports at each other so the game can `import()` them with no import map |

Each library sits with its licence file in the module that loads it, published at `/assets/vendor/`: pdf-lib and PDF.js in [shared/pdftools/vendor/](../shared/pdftools/vendor/), fontkit in [apps/watermark-pdf/vendor/](../apps/watermark-pdf/vendor/), LAME in [apps/mp4-to-mp3/vendor/](../apps/mp4-to-mp3/vendor/), three.js in [apps/king-of-streets/vendor/](../apps/king-of-streets/vendor/) and Stockfish in [shared/stockfish/vendor/](../shared/stockfish/vendor/) (the `stockfish` module, used by Chess and Learn Chess). The fonts, Latin and Latin Extended subsets as WOFF2, are published in `/assets/fonts/` with theirs: Inter and JetBrains Mono from [shared/base/fonts/](../shared/base/fonts/), Kalpurush (a TTF, as distributed) from [shared/lang/fonts/](../shared/lang/fonts/), and the handwriting fonts from [apps/sign-pdf/fonts/](../apps/sign-pdf/fonts/). `base.css` declares Inter and JetBrains Mono, and every page preloads Inter 400 and 800; the handwriting fonts are declared in `sign.css` and only load on the signing page.

King of Streets' models, textures and skies are its own too, published under `/assets/street/`: 3D artists' models from Sketchfab under CC BY 4.0, each credited in [apps/king-of-streets/models/CREDITS.md](../apps/king-of-streets/models/CREDITS.md), and Poly Haven's CC0 photo textures and skies ([apps/king-of-streets/textures/CREDITS.md](../apps/king-of-streets/textures/CREDITS.md)). They were simplified and compressed (gltf-transform with meshoptimizer, WebP textures), each with a lower-detail copy (`*_lo.glb`) for drawing at a distance. The riders' seats on each bike, both hands closed round its grips, were worked out once by the look-test code in [docs/plans/street-kids-lookdev/](plans/street-kids-lookdev/) (`rider.js`) and kept in `apps/king-of-streets/data/poses.json`, every bone's turn, so the game only has to put them back.
