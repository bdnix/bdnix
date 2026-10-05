# Development

The site is plain HTML, CSS and vanilla JavaScript, hosted on GitHub Pages from `master`. There is no framework, bundler or compile step, and nothing to install at runtime. `package.json` holds development tooling only.

[AGENTS.md](../AGENTS.md) is the authoritative guide to the project's conventions and review requirements. This page covers the practical side.

## Running locally

With Node 22 or later:

```bash
npm install
npm run serve        # http://localhost:4173
```

Or, without Node:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

## Project layout

- Each page lives in its own directory (`falling-blocks/`, `merge-pdf/`, …) as an `index.html`, with its stylesheet in `assets/css/` and its script in `assets/js/`.
- Each game and tool is its own app: a feature of one app only ever changes that app's files. Shared files hold only what every page that links them uses, with nothing about any one app in them.
- Shared styles: `base.css` (what every page uses: colour tokens, the top bar, buttons, panels), `game.css` (game layout), `page.css` (the one-column layout of the tool and profile pages) and `tool.css` (what every tool has). Components used by only some pages have their own small stylesheets (`editor.css`, `settings.css`, `tracks.css`, `profile-chip.css`, `gamepad.css`, …), and a page links only the ones it shows.
- Shared scripts expose one `window.bdnix*` object each: the falling-block backdrop, file helpers (`files.js`), PDF helpers (`pdftools.js`), image-file helpers (`images.js`), the visitor's name, saved games, the sound engine and analytics. Each game adds its own sounds to the engine with `bdnixSound.add()`.
- Pure logic (layout maths, parsing, encoding, game rules) is kept in separate `*-core.js` style files so it can be unit tested without a browser.
- The landing page's search box matches what's typed against each card's name, description and `data-keywords` attribute (`search-core.js`). A new game or tool card needs a few `data-keywords` so it turns up for the words people are likely to try.
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

- **Unit tests** (`tests/unit/`) use Node's built-in test runner. They load the site's scripts into a sandbox and cover pure logic: page-range parsing, the profile, saved games, game sounds, watermark placement, redaction search and geometry, signature placement and image clean-up, PDF decryption (the hashes, ciphers and password checks of Unlock PDF), audio encoding and MP4 parsing, image compression rules, photo collage layouts, where Resize Without Cropping places an image, the Flap, Road Hop, Snake and Brick Bounce game rules, and the rules of chess (checked against the standard perft move counts).
- **UI tests** (`tests/ui/`) use Playwright to drive the real pages in Chromium at desktop and phone size. They check downloaded output (PDFs are opened and inspected, audio and images are decoded), play every game on a frozen clock with fixed randomness so scores are exact, and fail on any uncaught JavaScript error or sideways scrolling on a phone. Test PDFs, audio, video and images are generated in code, so no binary fixtures are committed.
- **Checks every page gets:** [tests/ui/checks.mjs](../tests/ui/checks.mjs) holds them: [axe](https://github.com/dequelabs/axe-core) (any WCAG 2.1 A or AA problem fails), labelled canvases and typed buttons, the security policy, analytics (off locally, asking first on the live site, nothing but bdnix.com contacted until then), the title, description, share tags and structured data, no other games' names outside a credit line, no sideways scrolling, hashed files that load, and the footer. Games also get their mute and pause buttons, the upright note, a short wide window, the gamepad and the credit line checked, and PDF tools pdf-lib fetched on demand. Each app runs them for its own page from its own `tests/ui/<app>.site.spec.mjs`, so no spec keeps a list of pages and adding an app runs only its own specs (and those of the landing and profile pages and the sitemap, which change with it). `tests/ui/a11y.spec.mjs` adds axe on a paused game and on a tool with files in it.
- **Lint:** ESLint checks the site's scripts (as ES5-style browser scripts that mustn't leak globals), the tests and the build scripts (`eslint.config.mjs`); Stylelint checks the stylesheets for mistakes such as unknown properties or duplicate selectors (`.stylelintrc.json`). CI runs both.

The test MP4s carry FLAC audio because the Chromium build Playwright runs can't decode AAC; Chrome, Edge, Firefox and Safari can.

If a UI test fails in CI, the run's **playwright-report** artifact has the HTML report and a trace of each failed test (`npx playwright show-trace trace.zip`).

## Coverage

```bash
npm run coverage     # both suites, combined into coverage/report/index.html
```

[Codecov](https://codecov.io/gh/bdnix/bdnix) combines unit and UI coverage of `assets/js/*.js` (a line counts as covered if either suite runs it) and comments on each pull request. Its checks are configured in [codecov.yml](../codecov.yml):

- **codecov/project** fails if overall line coverage drops more than 0.1% below `master`.
- **codecov/patch** fails if less than 90% of new or changed lines are covered.

## Continuous integration

[.github/workflows/tests.yml](../.github/workflows/tests.yml) runs on every pull request and push to `master`: the cache-busting check and unit tests, the UI tests, then a combined coverage upload. `node_modules` (keyed on `package-lock.json` and the Node version) and Playwright's Chromium (keyed on the Playwright version) are cached; see [.github/actions/setup](../.github/actions/setup/action.yml).

Tests that can't have changed aren't run again. The unit tests are cached as a whole, keyed on the scripts and tests they read (including the site specs and `sitemap.xml`, which `site.test.mjs` checks). The UI tests are cached spec by spec by [scripts/ui-cache.mjs](../scripts/ui-cache.mjs): the test server logs every file it serves to each spec, and when a spec passes, the cache keeps that list with a hash of the files and the spec's coverage. On the next run, a spec whose spec file, served files and shared test code are all unchanged is skipped and its coverage copied back, so Codecov still gets the full picture. When no spec needs to run, Chromium isn't even installed. For this to be safe, UI tests read repository files through the test server (`request.get('/path')`), never with `fs`. To ignore the cache, run the workflow by hand with **full** ticked; `npm run coverage:ui:cached` does the same thing locally, keeping its cache in `.test-cache/`.

## Deploying

Anything merged to `master` goes live once GitHub Pages rebuilds. Pages builds the site from the branch with Jekyll: [_config.yml](../_config.yml) holds its settings and lists what isn't published (test tooling, `node_modules` and the repository docs). The build shows up in the Actions tab as **pages build and deployment**.

### Cache-busting

`npm run build` also writes the parts of the pages that come from [scripts/site.mjs](../scripts/site.mjs) (head tags, footer, landing page cards, profile page scores and `sitemap.xml`), between `<!-- build:... -->` markers that shouldn't be edited by hand.

Browsers may cache scripts and stylesheets, so every page links the site's own files with a `?v=` hash of their contents, for example `/assets/js/merge.js?v=d07a831b04`. **After editing anything in `assets/js` or `assets/css`, run `npm run build`** and commit the updated HTML. CI fails a pull request with stale hashes; `npm run build:check` runs the same check locally.

Vendored libraries keep their version number as `?v=`; bump it by hand when upgrading one.

## Adding a page

A new page needs:

- The analytics script linked in `<head>`.
- A title and description (in `scripts/site.mjs`), from which the build writes its canonical URL on `https://www.bdnix.com`, Open Graph and Twitter tags and [schema.org](https://schema.org) structured data.
- An entry in [scripts/site.mjs](../scripts/site.mjs), and `<!-- build:meta -->` / `<!-- /build:meta -->` markers in its `<head>` (plus `<!-- build:footer -->` markers around a footer). `npm run build` writes its head tags and its [sitemap.xml](../sitemap.xml) entry; a game or tool gets its landing page card, and a game its profile page score row, the same way.
- A `role="img"` and an `aria-label` on every canvas but the backdrop, and a `type` on every button.
- Its own `tests/ui/<app>.site.spec.mjs`, calling `checkPage(url, { schema, category, footer })` from [tests/ui/checks.mjs](../tests/ui/checks.mjs), which checks all of the above, plus `checkGame(url, { credit, gamepad })` for a game or `checkPdfLib(url, isOpen)` for a PDF tool. `tests/unit/site.test.mjs` fails until it's there. Nothing else in `tests/` needs to change.
- A mention in the [README](../README.md) and the relevant guide in this directory.

The share image (`assets/img/og.png`, 1200×630) and `assets/img/apple-touch-icon.png` are drawn by [scripts/og-image.mjs](../scripts/og-image.mjs). To change them, edit the script, run `npm run og-image` and commit the PNGs.

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

Each library's licence file sits beside it in [assets/vendor/](../assets/vendor/); the fonts, Latin and Latin Extended subsets as WOFF2, are in [assets/fonts/](../assets/fonts/) with theirs. `base.css` declares Inter and JetBrains Mono, and every page preloads Inter 400 and 800; the handwriting fonts are declared in `sign.css` and only load on the signing page.
