# bdnix

The static site behind [www.bdnix.com](https://www.bdnix.com): Tetris and Pac-Man, three PDF tools (merge, watermark and redact), an MP4 to MP3 converter, and a profile page for your name and best scores. Everything runs in the browser. Hosted on GitHub Pages; no build step.

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
- [tetris/index.html](tetris/index.html), [assets/css/tetris.css](assets/css/tetris.css), [assets/js/tetris.js](assets/js/tetris.js): Tetris, served at `/tetris/`.
- [pacman/index.html](pacman/index.html), [assets/css/pacman.css](assets/css/pacman.css), [assets/js/pacman.js](assets/js/pacman.js): Pac-Man, served at `/pacman/`
- [merge-pdf/index.html](merge-pdf/index.html), [assets/css/merge.css](assets/css/merge.css), [assets/js/merge.js](assets/js/merge.js): PDF merger, served at `/merge-pdf/`
- [profile/index.html](profile/index.html), [assets/css/profile.css](assets/css/profile.css), [assets/js/profile-page.js](assets/js/profile-page.js): the visitor's profile, served at `/profile/`
- [assets/js/profile.js](assets/js/profile.js): reads and saves the display name and reads the game scores; fills in the profile chip in the top bar of the landing and tool pages
- [watermark-pdf/index.html](watermark-pdf/index.html), [assets/css/watermark.css](assets/css/watermark.css), [assets/js/watermark.js](assets/js/watermark.js), [assets/js/watermark-layout.js](assets/js/watermark-layout.js): PDF watermark tool, served at `/watermark-pdf/`. The layout file holds the placement maths, kept separate so it can be unit tested.
- [redact-pdf/index.html](redact-pdf/index.html), [assets/css/redact.css](assets/css/redact.css), [assets/js/redact.js](assets/js/redact.js), [assets/js/redact-core.js](assets/js/redact-core.js): PDF redaction tool, served at `/redact-pdf/`. The core file holds the text search and box geometry, kept separate so it can be unit tested.
- [mp4-to-mp3/index.html](mp4-to-mp3/index.html), [assets/css/audio.css](assets/css/audio.css), [assets/js/audio.js](assets/js/audio.js), [assets/js/audio-core.js](assets/js/audio-core.js): audio converter, served at `/mp4-to-mp3/`. The core file holds the channel mixing and the MP3 and WAV encoding, kept separate so it can be unit tested.
- [assets/css/tool.css](assets/css/tool.css), [assets/js/pdftools.js](assets/js/pdftools.js): page layout (including the preview-and-settings editor) and helpers (page-range parsing, file reading, dropping files on the page, loading PDF.js) shared by the tools
- [assets/vendor/pdf-lib.min.js](assets/vendor/pdf-lib.min.js): [pdf-lib](https://pdf-lib.js.org/) 1.17.1 (MIT, see [its licence](assets/vendor/pdf-lib.LICENSE.md)), used by the PDF tools to edit files
- [assets/vendor/fontkit.umd.min.js](assets/vendor/fontkit.umd.min.js): [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) 1.1.1 (MIT, see [its licence](assets/vendor/fontkit.LICENSE.md)), lets pdf-lib embed a font file someone uploads. Only downloaded when they pick "Your own font file".
- [assets/vendor/pdfjs/](assets/vendor/pdfjs/): [PDF.js](https://mozilla.github.io/pdf.js/) 6.3.289 legacy build (Apache 2.0, see [its licence](assets/vendor/pdfjs/LICENSE)), used by the watermark tool to draw its preview, and by the redact tool to show pages, search their text and redraw redacted pages. It's only downloaded once someone opens a file.
- [assets/vendor/lame.min.js](assets/vendor/lame.min.js): [lamejs](https://github.com/zhuker/lamejs) 1.2.1, a JavaScript port of [LAME](https://lame.sourceforge.io/) (LGPL, see [its licence](assets/vendor/lame.LICENSE.md)), used by the audio converter to encode MP3. Included unmodified as its own file.

## Tests

Every new feature and bug fix needs tests, and a pull request must not lower code coverage. [AGENTS.md](AGENTS.md) has the full rules and conventions for working on this repo.


Tests run on GitHub Actions ([.github/workflows/tests.yml](.github/workflows/tests.yml)) for every pull request and every push to `master`. A pull request also fails if its cache-busting hashes are out of date (see [Deploying changes](#deploying-changes)). To run them locally (Node 22+):

```bash
npm install
npx playwright install chromium   # first time only
npm test                          # unit tests, then UI tests
```

- **Unit tests** (`npm run test:unit`, [tests/unit/](tests/unit/)) use Node's built-in test runner. They load the site's scripts in a sandbox and check the page-range parser, file-size formatting, the profile (name rules, reading the game scores, blocked storage), the watermark placement maths for every page rotation, the redact tool's text search and box geometry, and the audio converter's channel mixing and MP3 and WAV encoding (the MP3 frames are read back to check bitrate and channels).
- **UI tests** (`npm run test:ui`, [tests/ui/](tests/ui/)) use Playwright to drive the real pages in Chromium, at desktop and phone size. They cover the landing page, profile, merging (order, page ranges, errors), watermarking (preview, layers, fonts, images, remembered settings; the downloaded PDFs are opened and checked), redacting (search, drawing, undo; the downloaded PDFs are read back to check the text is gone and the areas are black), converting video and audio to MP3 and WAV (the downloads are decoded to check their length, channels and pitch), gameplay in both games (Tetris: moving, rotating, holding, clearing a line, pausing, touch buttons and game over; Pac-Man: steering a route to a power pellet, pausing, touch buttons and swipes, and losing every life), run on a frozen clock with fixed randomness so the scores are exact, and that no page scrolls sideways on a phone. Any uncaught JavaScript error fails the test. Test PDFs, MP4s and WAVs are generated on the fly, so no binary fixtures are committed. The test MP4s carry FLAC audio, because the Chromium that Playwright runs can't decode AAC, the usual MP4 audio; real Chrome, Edge, Firefox and Safari can.
- `npm run serve` serves the site at http://localhost:4173 with the same small server the UI tests use.

If a UI test fails on GitHub, the run's **playwright-report** artifact has the HTML report and a trace of each failed test (`npx playwright show-trace trace.zip`).

### Coverage

CI combines what the unit and UI tests cover in `assets/js/*.js` into one report (a line counts as covered if either suite runs it). Each workflow run shows it as a per-file table on the run's **Summary** page, and uploads the full report as the **coverage-report** artifact: `index.html`, a browsable report that highlights every line, plus `cobertura-coverage.xml` and `lcov.info` for other tools. Locally:

```bash
npm run coverage        # both suites with coverage, combined
# open coverage/report/index.html
```

### Caching

The workflow caches what it can between runs:
- **`node_modules`:** keyed on `package-lock.json` and the Node version, so `npm ci` only runs after a dependency change. This is set up once in [.github/actions/setup](.github/actions/setup/action.yml) and shared by every job.
- **Playwright's Chromium:** keyed on the Playwright version. On a cache hit, only Chromium's Linux system libraries are installed, since they're apt packages and can't be cached.

## Deploying changes

Anything pushed to `master` is live once GitHub Pages rebuilds; there's nothing to compile. The one thing to remember is cache-busting.

GitHub Pages lets browsers cache scripts and stylesheets for a while. So every page links the site's own files with a `?v=` taken from a hash of the file's contents, e.g. `/assets/js/merge.js?v=d07a831b04`, and the URL changes whenever the file does. **After editing anything in `assets/js` or `assets/css`, run `npm run build`** to update those hashes in every page, and commit the result. If you forget, the pull request's tests fail and say so. `npm run build:check` runs the same check locally without changing anything.

The vendored libraries in `assets/vendor` keep their version number as `?v=`; bump it by hand if you ever upgrade one.

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

## PDF redaction

Open one PDF, then mark what to black out:

- **Find text** marks every place a word or phrase appears, on every page. Capitals don't matter, and neither does the spacing between words, so `jane doe` also finds `Jane  Doe`. If there's no match on the page you're looking at, it jumps to the first one.
- **Draw** by dragging across the page (mouse, pen or finger) to cover anything else: signatures, photos, or text on scanned pages, which have no text to search.
- Each box has a × to remove it. **Undo** takes back the last search or box, and **Clear all** starts over.

**Redact PDF** makes the file. Every page with a mark is redrawn as an image (144 dpi) with the marked areas filled solid black, so the text under them is really gone: it can't be selected, copied, or uncovered by moving the box. The rest of the text on those pages can't be selected any more either. Pages with no marks are copied as they are. The result is a new file, so the original's title, author, bookmarks and attachments aren't carried over. The download is named after the original, e.g. `report-redacted.pdf`. Like the other tools, it all runs in the browser.

Search places boxes using the PDF's own text, estimating where each letter sits, so the boxes are padded slightly. Check the marks in the preview before redacting, and draw extra boxes if anything peeks out.

## MP4 to MP3

Drop in videos or audio files (MP4, MOV, WebM, M4A, MKV, WAV, FLAC, Ogg, MP3 and the like), pick the output, and convert:

- **Convert to** MP3 or WAV (16-bit, uncompressed).
- **Quality** for MP3: 320, 256, 192 (the default), 128, 96 or 64 kbps. At 96 kbps and below, the encoder lowers a stereo file's sample rate, as LAME always does, to keep the sound clean.
- **Channels:** stereo keeps the left and right channels (the front pair of a surround file); mono mixes every channel into one. A mono file stays mono.

Several files can be converted at once, and each gets its own download, named after the original (`clip.mp4` becomes `clip.mp3`). Changing a setting clears earlier results so they can be converted again.

The browser decodes the audio itself (at 44.1 kHz), and [lamejs](https://github.com/zhuker/lamejs) encodes the MP3, so nothing is uploaded. That means the formats it can read depend on the browser: a file whose audio the browser can't decode is marked on the list with a message. Each file is decoded whole in memory, so very long videos (hours) may be too big for a phone.

## Contact

root@bdnix.com
