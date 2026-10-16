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

- The site is moving to one folder per module (see [Modules](#modules) and [the plan](plans/modules.md)). What several apps use is already in `shared/<module>/`, each published at the URL it always had. The apps haven't moved yet: each page lives in its own directory (`falling-blocks/`, `merge-pdf/`, …) as an `index.html`, with its stylesheet in `assets/css/` and its script in `assets/js/`.
- Each game and tool is its own app: a feature of one app only ever changes that app's files. Shared files hold only what every page that links them uses, with nothing about any one app in them.
- Shared styles: `base.css` (what every page uses: colour tokens, the top bar, buttons, panels; `shared/base/`), `game.css` (game layout; `shared/game-shell/`), `page.css` (the one-column layout of the tool and profile pages) and `tool.css` (what every tool has). Components used by only some pages have their own small stylesheets (`editor.css`, `settings.css`, `tracks.css`, `profile-chip.css`, `gamepad.css`, …), and a page links only the ones it shows.
- Shared scripts expose one `window.bdnix*` object each: the falling-block backdrop, file helpers (`files.js`), PDF helpers (`pdftools.js`), image-file helpers (`images.js`), the visitor's name, saved games, the sound engine and analytics. Each game adds its own sounds to the engine with `bdnixSound.add()`.
- Pure logic (layout maths, parsing, encoding, game rules) is kept in separate `*-core.js` style files so it can be unit tested without a browser.
- The landing page's search box matches what's typed against each card's name, description and `data-keywords` attribute (`search-core.js`). A new game or tool card needs a few `data-keywords` so it turns up for the words people are likely to try.
- Every page is translated in the browser into the visitor's language (see [Languages](#languages)).
- Third-party libraries are vendored in `assets/vendor/`, each with its licence file, and fetched only when a tool first needs one (`bdnixFiles.loadScript()`), never linked from a page.

## Tests

Every new feature and bug fix needs tests, and a pull request must not lower code coverage.

```bash
npx playwright install chromium   # first time only
npm test                          # unit tests, then UI tests
npm run test:unit
npm run test:ui
npm run lint                      # ESLint and Stylelint
```

- **Where tests are.** Site-wide tests are in `tests/unit/` and `tests/ui/`; a module's own are in its `test/` folder (`shared/sound/test/sound.test.mjs`, `shared/sound/test/sound.spec.mjs`). The runners, the test caches and coverage find both.
- **Unit tests** (`tests/unit/` and the modules' `*.test.mjs`) use Node's built-in test runner. They load the site's scripts into a sandbox and cover pure logic: page-range parsing, the profile, saved games, game sounds, watermark placement, redaction search and geometry, signature placement and image clean-up, PDF decryption (the hashes, ciphers and password checks of Unlock PDF), audio encoding and MP4 parsing, image compression rules, photo collage layouts, where Resize Without Cropping places an image, the Flap, Road Hop, Snake and Brick Bounce game rules, and the rules of chess (checked against the standard perft move counts).
- **UI tests** (`tests/ui/` and the modules' `*.spec.mjs`) use Playwright to drive the real pages in Chromium at desktop and phone size. They check downloaded output (PDFs are opened and inspected, audio and images are decoded), play every game on a frozen clock with fixed randomness so scores are exact, and fail on any uncaught JavaScript error or sideways scrolling on a phone. Test PDFs, audio, video and images are generated in code, so no binary fixtures are committed.
- **Checks every page gets:** [tests/ui/checks.mjs](../tests/ui/checks.mjs) holds them (games' are in `checks-game.mjs`, PDF tools' in `checks-pdf.mjs`): [axe](https://github.com/dequelabs/axe-core) (any WCAG 2.1 A or AA problem fails), labelled canvases and typed buttons, the security policy, analytics (off locally, asking first on the live site, nothing but bdnix.com contacted until then), the title, description, share tags and structured data, no other games' names outside a credit line, no sideways scrolling, hashed files that load, and the footer. Games also get their mute button and language switch, pausing when the page is left, the upright note, a short wide window, the gamepad and the credit line checked, and PDF tools pdf-lib fetched on demand. Each app runs them for its own page from its own `tests/ui/<app>.site.spec.mjs`, so no spec keeps a list of pages and adding an app runs only its own specs (and those of the landing and profile pages and the sitemap, which change with it). `tests/ui/a11y.spec.mjs` adds axe on a paused game and on a tool with files in it.
- **Lint:** ESLint checks the site's scripts (as ES5-style browser scripts that mustn't leak globals), the tests and the build scripts (`eslint.config.mjs`); Stylelint checks the stylesheets for mistakes such as unknown properties or duplicate selectors (`.stylelintrc.json`). CI runs both.

The test MP4s carry FLAC audio because the Chromium build Playwright runs can't decode AAC; Chrome, Edge, Firefox and Safari can.

If a UI test fails in CI, the run's **playwright-report** artifact has the HTML report and a trace of each failed test (`npx playwright show-trace trace.zip`).

## Modules

A module is a folder with a `module.json`: `apps/<name>/` for a game or tool with its own page, `shared/<name>/` for what several apps use, and `site/<name>/` for the site's own pages (the landing and profile pages, later). [tools/modules.mjs](../tools/modules.mjs) finds and checks them all, and the build and the test server publish each module's files at the paths its `module.json` gives, so a file can move into its module without its URL changing.

```json
{
  "name": "sound",
  "kind": "shared",
  "publish": { "sound.js": "/assets/js/sound.js" },
  "uses": ["game-shell", "lang"]
}
```

- **`name`**: the folder's name. **`kind`**: `app`, `shared` or `site`, matching the folder it's in.
- **`publish`**: each of the module's files, mapped to the path it's published at. A folder (ending in `/`) maps to a folder, file by file: `"fonts/": "/assets/fonts/"`. Two modules can't publish the same path, and a module can't publish at a path that's still a file outside the modules. Every file in a module is published, apart from its `module.json`, its `lang/` and its `test/` (`tests/unit/modules.test.mjs` checks this).
- **`uses`**: the shared modules it needs. A page's language pack is made from its own module's translations and those of everything it uses, directly or through another module.
- **`url`** (an app or site module): where its page is. Its page is its `index.html`, published there.
- **`page`** (an app or site module): `title`, `description`, `schema` and `category`, as in `scripts/site.mjs` (and `fullName`, `noindex`).
- **`card`** (an app module): the landing page's card, `type` (`game` or `tool`), `name`, `blurb`, `keywords`, `icon` and, for a game, `best`, the key of its best score (and `bestLabel`).
- **Translations**: `lang/<code>.json` in the module's folder, English text to its translation, like the files in `assets/lang/<code>/`.
- **Tests**: in its `test/` folder, `*.test.mjs` (unit) and `*.spec.mjs` (UI).

An app or site module's page goes in `scripts/site.mjs`'s list as `{ module: '<name>' }`, where its card belongs; the build fills it in from the module's `module.json`. A module page with no place in the list, or a place naming no module, fails the build.

The shared modules so far: `base` (`base.css` and the Inter and JetBrains Mono fonts), `lang` (`lang.js`, `lang.css`, `bangla.css` and the Hind Siliguri font), `analytics`, `backdrop` (`blocks.js`), `game-shell` (`game.css`, `icon-btn.css`), `sound`, `gamesave`, `upright` and `gamepad` (`gamepad.css`).

## Coverage

```bash
npm run coverage     # both suites, combined into coverage/report/index.html
```

[Codecov](https://codecov.io/gh/bdnix/bdnix) combines unit and UI coverage of `assets/js/*.js` (a line counts as covered if either suite runs it) and comments on each pull request. Its checks are configured in [codecov.yml](../codecov.yml):

- **codecov/project** fails if overall line coverage drops more than 0.1% below `master`.
- **codecov/patch** fails if less than 90% of new or changed lines are covered.

## Continuous integration

[.github/workflows/tests.yml](../.github/workflows/tests.yml) runs on every pull request and push to `master`: lint and the unit tests, the UI tests, then a combined coverage upload. The upload fetches Codecov's CLI from `cli.codecov.io`; if that fails it tries once more with the CLI from PyPI, and if that fails too the **Coverage** job fails, rather than passing with nothing uploaded and no Codecov checks. `node_modules` (keyed on `package-lock.json` and the Node version) and Playwright's Chromium (keyed on the Playwright version) are cached; see [.github/actions/setup](../.github/actions/setup/action.yml).

Tests that can't have changed aren't run again. A test's inputs are exactly what it uses ([scripts/test-deps.mjs](../scripts/test-deps.mjs)): its own file, the test helpers it imports (and theirs), the repository files it used while it ran, the npm packages those import at the versions the lock file pins, and the Node version. `package.json`, the rest of the lock file and the runners aren't inputs, so adding a script or bumping a lint tool reruns nothing, while upgrading Playwright reruns the UI specs; `tests/unit/test-deps.test.mjs` checks this. The unit tests are cached file by file by [scripts/unit-cache.mjs](../scripts/unit-cache.mjs): each test file runs in its own process with [tests/unit/track.mjs](../tests/unit/track.mjs) loaded first, which records every repository file it reads, imports, lists or checks for. The UI tests are cached spec by spec by [scripts/ui-cache.mjs](../scripts/ui-cache.mjs): the test server logs, for each spec, the source files every response it served was made from (a page and `scripts/site.mjs`, a language pack and its translations; never the files behind a page's `?v=` stamps, which the spec fetches in their own right if it uses them), and Playwright's settings, its coverage setup and the test server count for every spec. When a test passes, the cache keeps what it used and its coverage; on the next run, a test whose inputs are all unchanged is skipped and its coverage copied back, so Codecov still gets the full picture. Keep a helper that only some tests need in its own file, so changing it reruns only those. When no spec needs to run, Chromium isn't even installed. For this to be safe, UI tests read repository files through the test server (`request.get('/path')`), never with `fs`. To ignore the cache, run the workflow by hand with **full** ticked; `npm run coverage:unit:cached` and `npm run coverage:ui:cached` do the same thing locally, keeping their cache in `.test-cache/`.

## Deploying

Anything merged to `master` goes live through [.github/workflows/pages.yml](../.github/workflows/pages.yml) (Settings → Pages → Source is **GitHub Actions**). It runs on every push to `master` and does two things: `npm run build` makes the published site in `_site/` (see [Building](#building)), and that folder is deployed to GitHub Pages.

The code is tested on its pull request (see [Continuous integration](#continuous-integration)) before it reaches `master`, so the deploy runs no tests of its own. Only `master` is ever published: a run started by hand on any other branch does nothing (`tests/unit/publish.test.mjs` checks this). For a second lock, keep the `github-pages` environment's deployment branches (Settings → Environments) limited to `master`.

### Building

`npm run build` ([tools/site.mjs](../tools/site.mjs)) makes the published site in `_site/`: the landing page, the folder of every page in [scripts/site.mjs](../scripts/site.mjs), `assets/`, `CNAME`, `LICENSE` and `robots.txt`, plus what only the build makes, `sitemap.xml` and the language packs. What's published is a list, so test tooling, scripts and docs stay out without an exclude list. `_site/` is never committed, and neither is anything generated: a change to one source file changes only that file in git.

Each file is written as [tools/page.mjs](../tools/page.mjs) serves it, the same code the test server answers with, so the tests see exactly what visitors get:

- A page's parts that come from [scripts/site.mjs](../scripts/site.mjs) (head tags, footer, landing page cards, profile page scores) are filled in between its `<!-- build:... -->` markers, which in the source have nothing between them.
- Browsers may cache scripts and stylesheets, so the site's own files are linked with `?v=` and a hash of what's served there, for example `/assets/js/merge.js?v=d07a831b04`. In the source, a page links them plainly, as `/assets/js/merge.js`. Vendored libraries keep their version number as `?v=`, written by hand; bump it when upgrading one.
- `lang.js` gets its list of languages, and each language its pack (see [Languages](#languages)).

The build fails, naming each problem, if a page links a file that doesn't exist, a page and `scripts/site.mjs` don't match up, or a string is translated two ways. `tests/unit/page.test.mjs` checks the transform, that the sources carry nothing generated, and that the test server serves exactly what `_site/` has.

## Adding a page

A new page needs:

- The analytics script linked in `<head>`.
- A title and description (in `scripts/site.mjs`), from which the build writes its canonical URL on `https://www.bdnix.com`, Open Graph and Twitter tags and [schema.org](https://schema.org) structured data.
- An entry in [scripts/site.mjs](../scripts/site.mjs), and `<!-- build:meta -->` / `<!-- /build:meta -->` markers in its `<head>` (plus `<!-- build:footer -->` markers around a footer). The build writes its head tags and its `sitemap.xml` entry; a game or tool gets its landing page card, and a game its profile page score row, the same way.
- A `role="img"` and an `aria-label` on every canvas but the backdrop, and a `type` on every button.
- Its own `tests/ui/<app>.site.spec.mjs`, calling `checkPage(url, { schema, category, footer })` from [tests/ui/checks.mjs](../tests/ui/checks.mjs), which checks all of the above, plus `checkGame(url, { credit, gamepad })` from `checks-game.mjs` for a game or `checkPdfLib(url, isOpen)` from `checks-pdf.mjs` for a PDF tool. `tests/unit/site.test.mjs` fails until it's there. Nothing else in `tests/` needs to change.
- A mention in the [README](../README.md) and the relevant guide in this directory.

The share image (`assets/img/og.png`, 1200×630) and `assets/img/apple-touch-icon.png` are drawn by [scripts/og-image.mjs](../scripts/og-image.mjs). To change them, edit the script, run `npm run og-image` and commit the PNGs.

## Languages

The site is written in English and shown in the visitor's language by [shared/lang/lang.js](../shared/lang/lang.js) (published at `/assets/js/lang.js`), which every page loads first, from translations in `assets/lang/<code>/` and in each module's `lang/<code>.json`. Adding a language is adding a folder of translations; no page or script changes.

- **Which language.** The one the visitor picked with the switch in the top bar (`lang.css`), kept in `localStorage` as `bdnix_lang`; else their browser's language, if the site has it; else English. Every page, games included, follows it. The page's `<html lang>` says which it is.
- **The translations.** `assets/lang/<code>/language.json` has the language's `name` (as the switch shows it), its `digits` if it has its own, and its `style`, a stylesheet for its font (Bangla's is `bangla.css`, which serves Hind Siliguri, Bengali letters only, OFL, from `shared/lang/fonts/` at `/assets/fonts/`, after Inter in the font stacks). Every other `.json` file there maps English text, exactly as it's written in a page or script, to its translation: `site.json` for the landing and profile pages and what every page shares, one file per tool or game. A module's own strings are in its `lang/<code>.json` instead (the sound module's mute button, the upright note, the cookie banner). A translation can be `{ "one": ..., "other": ... }` (and `few`, `many` and so on) for a language with more plural forms than English.
- **The build.** [tools/languages.mjs](../tools/languages.mjs) bundles each language into packs: one served at `assets/lang/<code>.js` with every translation, for the pages that haven't moved into modules, and one for each module's page, at `<its url>lang/<code>.js`, with the translations of the modules it needs. A module's page names its packs on its `lang.js` tag (`data-pack`); the others get the pack `lang.js` lists. It also fills in the list of languages, with their packs' hashes, between the `build:languages` markers in `lang.js` (on one line, so the script's lines stay where they are in the source). Neither is committed. The build fails if one English string is translated two ways in the same language.
- **Pages.** While the page is read, and whenever a script changes it later, `lang.js` swaps text, `aria-label`, `title`, `placeholder`, `alt`, a text box's value, the title and the description for their translations, and writes standalone numbers in the language's digits. A paragraph with a link, bold words or a line break inside is translated whole: the key is its HTML with the elements' attributes left out (`Read the code on <a>GitHub</a>.`), and the page's own elements are put back in the translation's places. Text marked `translate="no"` is left alone. Search on the landing page finds a card by its translated words as well as its English ones.
- **Scripts.** Scripts are written in English. Text with something put into it goes through `bdnixLang.t('{n} of {total}', { n, total })`; counts through `bdnixLang.count(n, '{n} page', '{n} pages')`; a number drawn on a canvas through `bdnixLang.num(n)`. A word that means two things gets a bar and a hint (`t('Draw|result')`, shown as "Draw"). Where English counts something (`'{areas} on {pages}'`), scripts also pass the bare number as `{count}`, for languages that word it differently.
- **Tests.** `bdnixLang.missing` lists English shown with no translation. `checkPage()` opens each page in every language and expects it empty, along with the page's `lang`, a translated title, axe and phone width; `checkGame()` plays each game in every language. `tests/unit/languages.test.mjs` checks every language has every string scripts pass to `t()` and `count()`, and that translations keep their English's elements and `{values}`. Specs for behaviour in a language (`tests/ui/<app>-bn.spec.mjs`) use `inLanguage()` and `expectTranslated()` from `tests/ui/languages.mjs`; `shared/lang/test/languages.spec.mjs` tests the switch and choosing a language.
- **Reviewing.** The site's owner reviews each language's translations, before they ship or after, as they choose.

## Third-party libraries

| Library | Version | Licence | Used for |
|---|---|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | MIT | Editing PDFs in all four PDF tools (loaded with the first PDF or image) |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | 1.1.1 | MIT | Embedding uploaded fonts in watermarks (loaded only when needed) |
| [PDF.js](https://mozilla.github.io/pdf.js/) (legacy build) | 6.3.289 | Apache 2.0 | Previews, text search and page rendering (loaded once a file is opened) |
| [lamejs](https://github.com/zhuker/lamejs) | 1.2.1 | LGPL | MP3 encoding, included unmodified as its own file (loaded with the first MP3) |
| [Stockfish.js](https://github.com/nmrugg/stockfish.js) (lite, single-threaded WebAssembly build) | 19.0.0 | GPL 3 | The chess opponent, included unmodified and run as its own web worker (started with the first game) |
| [Inter](https://rsms.me/inter/) (from [Fontsource](https://fontsource.org/)) | 5.3.0 | OFL 1.1 | The site's text, weights 400, 600 and 800 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (from Fontsource) | 5.3.0 | OFL 1.1 | Labels and code-style text, weights 400 and 600 |
| Mrs Saint Delafield, Herr Von Muellerhoff, Mr De Haviland and Mr Dafoe (from Fontsource) | 5.3.0 | OFL 1.1 | Typed signatures in Sign PDF, weight 400 |

Each library's licence file sits beside it in [assets/vendor/](../assets/vendor/); the fonts, Latin and Latin Extended subsets as WOFF2, are in [shared/base/fonts/](../shared/base/fonts/) (Inter, JetBrains Mono), [shared/lang/fonts/](../shared/lang/fonts/) (Hind Siliguri) and [assets/fonts/](../assets/fonts/) (the handwriting fonts), each with its licence, and all published at `/assets/fonts/`. `base.css` declares Inter and JetBrains Mono, and every page preloads Inter 400 and 800; the handwriting fonts are declared in `sign.css` and only load on the signing page.
