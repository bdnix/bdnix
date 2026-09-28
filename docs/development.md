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
- Shared styles: `base.css` (colour tokens and common components), `game.css` (game layout) and `tool.css` (tool and profile layout).
- Shared scripts expose one `window.bdnix*` object each: the falling-block backdrop, PDF and file helpers, the profile, saved games, game sounds and analytics.
- Pure logic (layout maths, parsing, encoding, game rules) is kept in separate `*-core.js` style files so it can be unit tested without a browser.
- Third-party libraries are vendored in `assets/vendor/`, each with its licence file.

## Tests

Every new feature and bug fix needs tests, and a pull request must not lower code coverage.

```bash
npx playwright install chromium   # first time only
npm test                          # unit tests, then UI tests
npm run test:unit
npm run test:ui
```

- **Unit tests** (`tests/unit/`) use Node's built-in test runner. They load the site's scripts into a sandbox and cover pure logic: page-range parsing, the profile, saved games, game sounds, watermark placement, redaction search and geometry, audio encoding and MP4 parsing, image compression rules, and the Flap, Road Hop, Snake and Brick Bounce game rules.
- **UI tests** (`tests/ui/`) use Playwright to drive the real pages in Chromium at desktop and phone size. They check downloaded output (PDFs are opened and inspected, audio and images are decoded), play every game on a frozen clock with fixed randomness so scores are exact, and fail on any uncaught JavaScript error or sideways scrolling on a phone. Test PDFs, audio, video and images are generated in code, so no binary fixtures are committed.

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

## Deploying

Anything merged to `master` goes live once GitHub Pages rebuilds.

### Cache-busting

Browsers may cache scripts and stylesheets, so every page links the site's own files with a `?v=` hash of their contents, for example `/assets/js/merge.js?v=d07a831b04`. **After editing anything in `assets/js` or `assets/css`, run `npm run build`** and commit the updated HTML. CI fails a pull request with stale hashes; `npm run build:check` runs the same check locally.

Vendored libraries keep their version number as `?v=`; bump it by hand when upgrading one.

## Adding a page

A new page needs:

- The analytics script linked in `<head>` (listed in `tests/ui/analytics.spec.mjs`).
- A title, description, canonical URL on `https://www.bdnix.com`, Open Graph and Twitter tags, and [schema.org](https://schema.org) structured data (checked by `tests/ui/seo.spec.mjs`).
- An entry in [sitemap.xml](../sitemap.xml).
- A mention in the [README](../README.md) and the relevant guide in this directory.

The share image (`assets/img/og.png`, 1200×630) and `assets/img/apple-touch-icon.png` are drawn by [scripts/og-image.mjs](../scripts/og-image.mjs). To change them, edit the script, run `npm run og-image` and commit the PNGs.

## Third-party libraries

| Library | Version | Licence | Used for |
|---|---|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | MIT | Editing PDFs in all three PDF tools |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | 1.1.1 | MIT | Embedding uploaded fonts in watermarks (loaded only when needed) |
| [PDF.js](https://mozilla.github.io/pdf.js/) (legacy build) | 6.3.289 | Apache 2.0 | Previews, text search and page rendering (loaded once a file is opened) |
| [lamejs](https://github.com/zhuker/lamejs) | 1.2.1 | LGPL | MP3 encoding, included unmodified as its own file |

Each library's licence file sits beside it in [assets/vendor/](../assets/vendor/).
