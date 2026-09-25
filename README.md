# bdnix

The static site behind [www.bdnix.com](https://www.bdnix.com): Tetris and Pac-Man, two PDF tools (merge and watermark), and a profile page for your name and best scores. Everything runs in the browser. Hosted on GitHub Pages; no build step.

## Preview locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Or, with Node installed, `npm run serve` and open http://localhost:4173.

## Files

Both pages share one design system, so they look like the same site:

- [assets/css/base.css](assets/css/base.css): colours, type, header, buttons and panels used by every page
- [assets/js/blocks.js](assets/js/blocks.js): the shared block palette, block renderer and falling-block backdrop
- [assets/css/game.css](assets/css/game.css): board frame, overlay, stat panels and touch buttons shared by both games
- [index.html](index.html), [assets/css/style.css](assets/css/style.css), [assets/js/main.js](assets/js/main.js): landing page
- [play/index.html](play/index.html), [assets/css/tetris.css](assets/css/tetris.css), [assets/js/tetris.js](assets/js/tetris.js): Tetris, served at `/play/`
- [pacman/index.html](pacman/index.html), [assets/css/pacman.css](assets/css/pacman.css), [assets/js/pacman.js](assets/js/pacman.js): Pac-Man, served at `/pacman/`
- [merge-pdf/index.html](merge-pdf/index.html), [assets/css/merge.css](assets/css/merge.css), [assets/js/merge.js](assets/js/merge.js): PDF merger, served at `/merge-pdf/`
- [profile/index.html](profile/index.html), [assets/css/profile.css](assets/css/profile.css), [assets/js/profile-page.js](assets/js/profile-page.js): the visitor's profile, served at `/profile/`
- [assets/js/profile.js](assets/js/profile.js): reads and saves the display name and reads the game scores; fills in the profile chip in the top bar of the landing and tool pages
- [watermark-pdf/index.html](watermark-pdf/index.html), [assets/css/watermark.css](assets/css/watermark.css), [assets/js/watermark.js](assets/js/watermark.js), [assets/js/watermark-layout.js](assets/js/watermark-layout.js): PDF watermark tool, served at `/watermark-pdf/`. The layout file holds the placement maths, kept separate so it can be unit tested.
- [assets/css/tool.css](assets/css/tool.css), [assets/js/pdftools.js](assets/js/pdftools.js): page layout and helpers (page-range parsing, file reading) shared by the PDF tools
- [assets/vendor/pdf-lib.min.js](assets/vendor/pdf-lib.min.js): [pdf-lib](https://pdf-lib.js.org/) 1.17.1 (MIT, see [its licence](assets/vendor/pdf-lib.LICENSE.md)), used by both PDF tools to edit files
- [assets/vendor/fontkit.umd.min.js](assets/vendor/fontkit.umd.min.js): [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) 1.1.1 (MIT, see [its licence](assets/vendor/fontkit.LICENSE.md)), lets pdf-lib embed a font file someone uploads. Only downloaded when they pick "Your own font file".
- [assets/vendor/pdfjs/](assets/vendor/pdfjs/): [PDF.js](https://mozilla.github.io/pdf.js/) 6.3.289 legacy build (Apache 2.0, see [its licence](assets/vendor/pdfjs/LICENSE)), used by the watermark tool to draw its preview. It's only downloaded once someone opens a file there.

## Tests

Tests run on GitHub Actions ([.github/workflows/tests.yml](.github/workflows/tests.yml)) for every pull request and every push to `master`. On `master`, a final job then minifies the scripts and commits them (see [Deploying changes](#deploying-changes)). To run them locally (Node 22+):

```bash
npm install
npx playwright install chromium   # first time only
npm test                          # unit tests, then UI tests
```

- **Unit tests** (`npm run test:unit`, [tests/unit/](tests/unit/)) use Node's built-in test runner. They load the site's scripts in a sandbox, both the readable source and the minified copy, and check the page-range parser, file-size formatting, the profile (name rules, reading the game scores, blocked storage), and the watermark placement maths for every page rotation.
- **UI tests** (`npm run test:ui`, [tests/ui/](tests/ui/)) run the build first, then use Playwright to drive the real pages in Chromium, at desktop and phone size. They cover the landing page, profile, merging (order, page ranges, errors), watermarking (preview, layers, fonts, images, remembered settings; the downloaded PDFs are opened and checked), a start-up check for each game, and that no page scrolls sideways on a phone. Any uncaught JavaScript error fails the test. Test PDFs are generated on the fly, so no binary fixtures are committed.
- `npm run serve` serves the site at http://localhost:4173 with the same small server the UI tests use.

If a UI test fails on GitHub, the run's **playwright-report** artifact has the HTML report and a trace of each failed test (`npx playwright show-trace trace.zip`).

### Coverage

CI measures how much of `assets/js/*.js` each suite runs. Each test job adds a coverage table to the run's summary page (open the workflow run on GitHub, then **Summary**), and uploads the full report as an artifact, **coverage-unit** or **coverage-ui**. The artifact has `index.html`, a browsable report that highlights every line, and `lcov.info` for other tools. Locally:

```bash
npm run coverage        # build, then both suites with coverage
# open coverage/unit/index.html and coverage/ui/index.html
```

- **Unit coverage** counts the files the unit tests load (the page-range parser, profile and watermark layout).
- **UI coverage** counts everything the pages run in Chromium. The pages load the minified scripts, and their source maps put the numbers back on the readable files. This is also why the build doesn't use terser's `compress` step: it would blur those line mappings, and it only saves about 2% once gzipped.
- The two stay separate reports. The coverage tool can't reliably merge source-mapped UI data with the unit data, and a merged report would under-count lines only one suite runs.

### Caching

The workflow caches what it can between runs:
- **`node_modules`:** keyed on `package-lock.json` and the Node version, so `npm ci` only runs after a dependency change. This is set up once in [.github/actions/setup](.github/actions/setup/action.yml) and shared by every job.
- **Playwright's Chromium:** keyed on the Playwright version. On a cache hit, only Chromium's Linux system libraries are installed, since they're apt packages and can't be cached.

## Deploying changes

Pages load minified scripts (`assets/js/*.min.js`), which are generated from the readable `assets/js/*.js` files. Edit the readable files, never the `.min.js` ones.

- **Scripts:** `npm run build` minifies every script, with a source map for debugging, and updates each page's `<script>` tags to load the `.min.js` file with a `?v=` taken from a hash of its contents, so browsers pick up new code straight away. You don't need to run it yourself: when a change lands on `master` and the tests pass, GitHub Actions runs the build and commits any updated files back to `master`. Run it locally to see your changes before then, since the pages load the minified copies. `npm run build:check` reports whether the files are stale without changing anything.
- **Stylesheets:** GitHub Pages lets browsers cache CSS for a while, so when you change a file in `assets/css`, bump the `?v=` number on its `<link>` tags in every page that loads it (`index.html`, `play/index.html`, `pacman/index.html`, `merge-pdf/index.html`, `watermark-pdf/index.html`, `profile/index.html`).

## Tetris controls

| Action     | Keyboard            | Touch      |
|------------|---------------------|------------|
| Move       | ← → (or A / D)      | ◀ ▶        |
| Rotate     | ↑ / X (Z for CCW)   | ⟳ or tap the board |
| Soft drop  | ↓                   | ▼          |
| Hard drop  | Space               | ⤓          |
| Hold       | C / Shift           | HOLD       |
| Pause      | P / Esc             | ❚❚         |

## Pac-Man controls

| Action | Keyboard           | Touch                         |
|--------|--------------------|-------------------------------|
| Move   | Arrow keys or WASD | Swipe anywhere, or the arrow buttons |
| Pause  | P / Esc            | ❚❚                            |

Both games save their best score in the browser's localStorage.

## Profile

The chip in the top right of the landing and tool pages links to `/profile/`. It shows the visitor's name ("User" until they set one, up to 24 characters) and their best Tetris and Pac-Man scores, read straight from the keys the games already save (`bdnix_tetris_best`, `bdnix_pacman_best`). It also shows the visit count kept by the landing page. The name is stored as `bdnix_name`. All of it lives in the browser's localStorage, so it's per device and nothing is uploaded.

## PDF merger

Add PDFs by dropping them on the page or choosing them. Reorder them by dragging or with the arrow buttons, then merge and download `merged.pdf`. Each file has a **Pages** box: leave it empty to include every page, or list pages and ranges separated by commas, e.g. `1-3, 5, 8-` (`8-` means page 8 to the end, `-3` means pages 1 to 3, and `5-3` adds pages 5, 4, 3 in that order). Pages come out in the order you list them. The merge runs in the browser with pdf-lib, so files are never uploaded anywhere. Password-protected PDFs are skipped with a message.

## PDF watermark

Open one PDF, then set up the watermark while a live preview shows it on your pages (use the arrows to flip through them):

- **Text or image.** Text can use Helvetica, Times or Courier (each with bold and italic), or your own `.ttf` / `.otf` font file, in any colour. Text the chosen font can't show properly (non-Latin letters in the built-in fonts, or scripts like Bangla and Arabic that need their letters joined) is drawn as an image instead, so any language works. Your own font is embedded in full, which adds its file size to the PDF. Images can be PNG, JPG, WebP or GIF, and transparency is kept.
- **Size** is the watermark's width as a share of the page's shorter side, so it looks the same on A4, Letter or landscape pages.
- **Opacity**, **rotation** (−90° to 90°, with quick buttons), and **position** on a 3×3 grid, or **Repeat across the page** to tile it.
- **Layer:** on top of the page, or behind its content so text stays readable over the watermark. Behind only shows through blank parts of the page, so it won't show on scanned pages (which are one big picture) or pages with a solid background.
- **Pages** takes the same ranges as the merger (`1-3, 5, 8-`). Empty means every page.

Settings are remembered in the browser for next time: the options in `localStorage`, and the chosen image and font file in IndexedDB. The page list isn't remembered, since it belongs to one file. "Reset to defaults" clears it all.

Rotated pages are handled, so the watermark sits the same way on every page as the reader sees it. The download is named after the original, e.g. `report-watermarked.pdf`. Like the merger, it all runs in the browser.

## Contact

root@bdnix.com
