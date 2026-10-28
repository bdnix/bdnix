# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository. Read this before changing anything. [README.md](README.md) is the project overview; [docs/](docs/) has the detailed guides to the tools, games, privacy and development.

## What this is

The static site behind [www.bdnix.com](https://www.bdnix.com), hosted on GitHub Pages. There's no framework and no compile step: pages are plain HTML, CSS and vanilla JavaScript. On every push to `master` (and from no other branch), `.github/workflows/pages.yml` makes the published site in `_site/` with `npm run build` and deploys it; nothing generated is committed (see [Cache-busting](#cache-busting) and [docs/development.md](docs/development.md#building)).

Everything the site is made of is in modules, one folder each: [docs/plans/modules.md](docs/plans/modules.md) is the plan that got it there. Read it before working on the build, the tests or CI, and keep its checkboxes up to date while it's open. Its [Verification rules](docs/plans/modules.md#verification-rules) are not optional: every Verify box is ticked only with its evidence, and an item is done only once it's merged and its merge commit's Tests run has passed.

A module is a folder with everything it is and a `module.json` (where its files are published, which shared modules it uses, its page and card fields): its page, scripts and styles, its translations in `lang/` and its tests in `test/`. Every file is published at its old URL (`/assets/js/sound.js` comes from `shared/sound/sound.js`), so moving a file changes nothing for visitors. See [Modules](#modules).

| Page | Module |
|---|---|
| Landing `/` | `site/landing/` (`index.html`, `main.js`, `style.css`), with `shared/search/` |
| Profile `/profile/` | `site/profile-page/` (`index.html`, `profile-page.js`, `profile.css`) |
| About `/about/` | `site/about/` (`index.html`, `about.css`) |
| Falling Blocks `/falling-blocks/` | `apps/falling-blocks/` (`tetris.js`, `tetris-core.js`, `tetris.css`) |
| Maze Chase `/maze-chase/` | `apps/maze-chase/` (`pacman.js`, `pacman-core.js`, `pacman.css`) |
| Flap `/flap/` | `apps/flap/` (`flappy.js`, `flappy-core.js`, `flappy.css`) |
| Road Hop `/road-hop/` | `apps/road-hop/` (`hop.js`, `hop-core.js`, `hop.css`) |
| Snake `/snake/` | `apps/snake/` (`snake.js`, `snake-core.js`, `snake.css`) |
| Brick Bounce `/brick-bounce/` | `apps/brick-bounce/` (`bricks.js`, `bricks-core.js`, `bricks.css`) |
| King of Streets `/king-of-streets/` | `apps/king-of-streets/` (`street.js`, `street-core.js`, `street-scene-core.js`, `street-3d.js`, `street-city.js`, `street-rider.js`, `street-engine.js`, `street.css`, `vendor/` three.js, `models/`, `textures/`, `data/`) |
| Chess `/chess/` | `apps/chess/` (`chess.js`, `chess.css`), with `shared/chess-core/` and `shared/stockfish/` |
| Merge PDFs `/merge-pdf/` | `apps/merge-pdf/` (`merge.js`, `merge.css`) |
| Watermark `/watermark-pdf/` | `apps/watermark-pdf/` (`watermark.js`, `watermark-layout.js`, `watermark.css`, `vendor/` fontkit) |
| Redact `/redact-pdf/` | `apps/redact-pdf/` (`redact.js`, `redact-core.js`, `redact.css`) |
| Sign `/sign-pdf/` | `apps/sign-pdf/` (`sign.js`, `sign-core.js`, `sign.css`, `fonts/`) |
| Unlock `/unlock-pdf/` | `apps/unlock-pdf/` (`unlock.js`, `unlock-core.js`, `unlock.css`) |
| MP4 to MP3 `/mp4-to-mp3/` | `apps/mp4-to-mp3/` (`audio.js`, `audio-core.js`, `audio.css`, `vendor/` LAME, built by `lame/`) |
| Compress Images `/compress-image/` | `apps/compress-image/` (`image.js`, `image-core.js`, `image.css`) |
| Photo Collage `/photo-collage/` | `apps/photo-collage/` (`collage.js`, `collage-core.js`, `collage.css`) |
| Resize Without Cropping `/fit-to-frame/` | `apps/fit-to-frame/` (`frame.js`, `frame-core.js`, `frame.css`) |
| Learn Chess `/learn-chess/` | `apps/learn-chess/` (`learn.js`, `learn-core.js`, `lessons.js`, `learn.css`), with `shared/chess-core/` and `shared/stockfish/` |

Each app's page is its `index.html`, and its scripts and stylesheet are published at `/assets/js/` and `/assets/css/` under their old names. `assets/` itself holds only what belongs to no module: the share images (`assets/img/`) and each language's `language.json` (`assets/lang/<code>/`).

Shared modules hold only what is truly common (see [Keep apps modular](#keep-apps-modular)). Each is one concern, in `shared/<name>/`, and a page links only the ones it uses. Below, each is named by its folder, and its files by the URL they're published at.

Stylesheets:
- `base` (`/assets/css/base.css`, and the fonts Inter and JetBrains Mono): what every page uses: colour tokens, the backdrop, the top bar, buttons, panels and the analytics consent banner.
- `game-shell` (`game.css`): the layout every game page uses.
- `page` (`page.css`): the one-column layout of the tool pages and the profile page.
- `tool` (`tool.css`): what every tool page has: the lede, the drop zone, fields, the files area and the action buttons.
- Components, linked only by the pages that show them: `icon-btn` (square icon buttons), `avatar` (the visitor's initial), `profile-chip` (the name chip in the top bar), `footer`, `features` (the feature list under a tool's lede), `file` (a file's name and details), `editor` (a preview beside a settings panel), `settings` (a panel of settings), `seg` (a two-way switch), `tracks` (a list of files, each with its own download) and `gestures` (the row of touch gestures on a game's start and pause screens), each a stylesheet of the same name. `lang.css` (the language switch in the top bar) and `bangla.css` (the Bangla font, which `lang.js` links for a visitor reading Bangla) are in `lang`.

Scripts, each exposing one `window.bdnix*` object:
- `lang` (`lang.js`): the site's languages (`window.bdnixLang`); see [Languages](#languages). Every page links it in `<head>`, written there by the build, before any other script.
- `backdrop` (`blocks.js`): the falling-block backdrop (`window.bdnix`).
- `analytics` (`analytics.js`): Google Analytics page views and the cookie consent banner (`window.bdnixAnalytics`). Every page links it in `<head>` (not `async`: the profile page reads it). It only runs on `www.bdnix.com` / `bdnix.com`, so local previews and tests show no banner and send nothing; its contract spec serves a page as `www.bdnix.com` to test it. Google's script loads only after the visitor accepts; they can change their choice on the profile page.
- `profile` (`profile.js`): the visitor's display name and the profile chip (`window.bdnixProfile`). The list of games and their best scores belongs to the profile page (`profile-page.js`).
- `files` (`files.js`): reading the files a visitor opens, dropping files on the page, file sizes and plurals, `loadScript()`, which fetches a big library the first time a tool needs it, and `offer()`, which points a link at a file to download (`window.bdnixFiles`). Every tool uses it.
- `pdftools` (`pdftools.js`): page-range parsing, spotting a PDF and the on-demand pdf-lib and PDF.js loaders, for the PDF tools (`window.bdnixPdf`), with the two libraries in its `vendor/`. Needs `files`.
- `images` (`images.js`): image files for the image tools: which files are images, the formats a canvas saves, the canvas size limit and result file names (`window.bdnixImages`).
- `search` (`search-core.js`): matching what's typed in the landing page's search against each card (`window.bdnixSearch`).
- `chess-core` (`chess-core.js`): the rules of chess, standard notation and PGN, reading Stockfish's lines and reviewing a game (`window.bdnixChess`), for the chess pages.
- `stockfish`: the Stockfish engine, vendored in its `vendor/` and published at `/assets/vendor/stockfish/`, for the chess pages, which each start it as a web worker when they need it.
- `gamesave` (`gamesave.js`): saves a game in progress and loads it back paused (`window.bdnixSave`). Each game snapshots its own state, checks a loaded save before using it, and throws away one that doesn't make sense.
- `upright` (`upright.js`): games are played with the phone upright (`window.bdnixUpright`). On a phone turned sideways it covers the page with a note asking for it to be turned back, and calls what each game passed to `bdnixUpright.onTurn()`, so the game pauses. Screens with a mouse are never covered, however short the window. Its styles are in `game-shell`'s `game.css`.
- `sound` (`sound.js`): the sound engine for the games (`window.bdnixSound`), made with the Web Audio API from short recipes, so there are no audio files. It has only the sounds every game plays (`start`, `over` and `best`); each game adds its own with `bdnixSound.add({ name: [tones] })`, made with `bdnixSound.tone()` and `bdnixSound.notes()`. `bdnixSound.play('<name>')` plays one unless sound is muted. It also runs the mute button (`#soundBtn` in a game's top bar) and the M key.

Third-party libraries are vendored in the module that loads them, each with its licence file, and published at `/assets/vendor/`: pdf-lib and PDF.js in `shared/pdftools/vendor/`, fontkit in `apps/watermark-pdf/vendor/`, three.js in `apps/king-of-streets/vendor/`, LAME (compiled to WebAssembly by `apps/mp4-to-mp3/lame/`) in `apps/mp4-to-mp3/vendor/`, Stockfish in `shared/stockfish/vendor/` (Chess and Learn Chess both use it). None is linked from a page: each is fetched the first time a tool needs it (`bdnixPdf.loadPdfLib()`, `bdnixPdf.loadPdfjs()`, `bdnixFiles.loadScript()`; the audio converter fetches LAME with the first MP3; the chess page starts Stockfish as a web worker when the first game starts, and Learn Chess when a learner plays on; King of Streets imports three.js as its page opens), so a page opens without them. Link a new big library the same way. The fonts are self-hosted and published in `/assets/fonts/`: Inter and JetBrains Mono from `shared/base/fonts/`, declared in `base.css`, Kalpurush (from Avro, OmicronLab) from `shared/lang/fonts/`, the unmodified TTF, declared in `bangla.css`, and the signing tool's handwriting fonts from `apps/sign-pdf/fonts/`, declared in `sign.css`; never link a font service, since a page must contact nothing but bdnix.com until the visitor accepts analytics.

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
- Each app's `module.json` has its page's title and description and its card (name, search keywords, icon, best-score key), and the landing page's (`site/landing/module.json`) lists the apps' cards in order. The build and the test server fill in the landing page's cards, the profile page's scores, `sitemap.xml` and every page's head tags from them (`tools/page.mjs`), so adding an app means adding its module and its place in that list.
- **Tests are modular too.** No spec lists every page or every game. The checks every page gets (accessibility and axe, its security policy, analytics, search and share tags, its fonts, layout, hashed files, the footer) and every game gets (mute button and language switch, pausing when left, played upright, its touch gestures, the credit line) live in `tests/ui/checks.mjs` (`checkPage()`), `tests/ui/checks-game.mjs` (`checkGame()`) and `tests/ui/checks-pdf.mjs` (`checkPdfLib()`, for a PDF tool), and each page runs them for itself from its page and i18n targets (see [Modules](#modules)). So adding or changing an app runs that app's specs, plus the specs of the pages the build changes with it (the landing page's cards, the profile page's scores), and leaves every other app's cached results alone; `tools/boundaries.mjs` fails if a module lacks a test target. What's shared is tested in its own module, on a page made up for it, never through an app; only `tests/ui/seo.spec.mjs` (robots.txt, the sitemap, the share images) is site-wide. Test helpers are components too: a spec depends only on the helpers it imports (see [CI](#ci)), so a helper only some specs need goes in its own file, imported by just those specs, not into `fixtures.mjs` or `checks.mjs`.
- Before editing a shared file for a feature, ask whether every page that links it needs the change. If not, the change belongs in the app, or in a new component.

## Modules

Every page and everything pages share is a module; `docs/development.md` has the details.

- **A module** is `apps/<name>/` (a game or tool), `shared/<name>/` (something apps share) or `site/<name>/` (the landing and profile pages), with a `module.json`: `name`, `kind`, `url` (an app or site page's), `publish` (each file → the URL it's published at, so URLs never change; a folder publishes everything in it), `uses` (the shared modules it uses), `inputs` (any other repository file its tests may read), an app's `page` and `card` fields, a site page's `page` fields, the landing page's `cards` (the apps, in order) and the profile page's `scores`. `tools/modules.mjs` reads and checks them. Anything not in `publish` (its tests, its translations, `module.json`) isn't published.
- **Its translations** are its `lang/<code>.json`. Each page gets its own pack, `/assets/lang/<name>.<code>.js`, with its translations and those of the shared modules it uses, and nothing else (the build names it with `data-pack` on the page's `lang.js` script); a page that shows the apps' cards or scores also gets those words, as each app translates them. `/assets/lang/<code>.js` has every shared module's, for a page that names no pack (a test's made-up page).
- **Its tests** are in its `test/`. An app or site page has up to four targets: `logic.test.mjs` (its pure logic, unit tests; none for an app with a single script), `behaviour.spec.mjs` (playing or using it), `page.spec.mjs` (`checkPage()` and, for a game, `checkGame()`, in English, with `languages: false`) and `i18n.spec.mjs` (`checkPageLanguages()`, `checkGameLanguages()` for a game, `checkStrings()` from `tests/ui/strings.mjs`, and its behaviour in Bangla: everything in its other languages). A shared module has contract tests: unit tests for its logic, and specs on a page made up for it (`openFixture()` from `tests/ui/fixture.mjs`), never through an app.
- **Its tests use only what it declares**: its own files, those of the modules in its `uses` (and theirs), its `inputs`, and what every page is made from (`scripts/parts.mjs`, every page's `module.json`, `assets/img/`, each language's `language.json`). After the UI tests, `tests/ui/inputs.mjs` fails the run if the test server served a module's spec anything else, naming the file; the unit test cache does the same for its unit tests. That keeps a module's `module.json` the whole truth about what its tests depend on.
- **`tools/boundaries.mjs`** (in `npm run lint`) fails unless every `module.json` is right, a module's page and stylesheets link only its own files and its `uses`', a shared module names no app (not its URL, files, storage keys or name, tests included), no file belongs to two modules, every translation has one owner (no English twice in one module's pack, or in two shared modules), every page's title and description are its own and fit search results, every card has what the landing page needs, the landing page lists every app once, and every module has its tests.
- **Adding an app**: see [Ground rules](#ground-rules) and `docs/development.md` (Adding a page). Snake (`apps/snake/`) is a small example of a game, Merge PDFs (`apps/merge-pdf/`) of a tool.

## Ground rules

- **Everything runs in the browser.** Files the visitor opens are never uploaded; there is no server. Don't send the visitor's files, or anything they type into a tool, anywhere. Vendor libraries in the module that loads them, never a CDN. The site uses Google Analytics (the `analytics` module); a new page must link it in `<head>`. A new page is a module (see [Modules](#modules)): its `module.json` has its title and description, and its page has `<!-- build:meta -->` markers in its `<head>` (and `<!-- build:footer -->` around a footer), from which the build fills in its title, description, canonical URL, Open Graph, Twitter and structured data and its `sitemap.xml` entry. Never edit between `build:` markers by hand. Every canvas but the backdrop is `role="img"` with an `aria-label`, every button has a `type`, and [axe](https://github.com/dequelabs/axe-core) finds no WCAG 2.1 A or AA problems. A new page, or new text on one, needs its translations in every language, in its module's `lang/` (see [Languages](#languages)). A new page's page target calls `checkPage()` from `tests/ui/checks.mjs`, which checks all of this for it (see [Keep apps modular](#keep-apps-modular)).
- **Every page has a content security policy.** The build writes it into each page's `build:meta` block from `CSP` in `scripts/parts.mjs`: the site's own files, Google Analytics, and nothing inline. So no inline `<script>`, `on...=` handlers or `style="..."` attributes (set styles from a script or a stylesheet), and a new outside origin has to be added there deliberately. The UI test fixture fails any test in which the policy blocks something; `checkPage()` checks each page's policy, and that it stops a script put into the page.
- **Keep it dependency-free at runtime.** No frameworks and no bundler. `package.json` holds dev tooling only (tests, coverage, building and publishing).
- **Match the existing code.** Each script is one IIFE, `(function(){ ... })();`, in ES5-style `var`/`function` code. A script that other scripts use exposes one `window.bdnix*` object. Comment density, naming and CSS style should match the file you're in.
- **Reuse what's truly shared.** Use the tokens in `base.css`, the layouts in `page.css`, `tool.css` and `game.css`, the components, and the helpers in `files.js`, `pdftools.js`, `images.js` and `profile.js`. When several apps need the same general-purpose logic (not a feature of one of them), give it its own shared file, as `files.js` and `images.js` are, and link it only from those apps.
- **Pure logic goes in its own file** (as in `watermark-layout.js`, `redact-core.js`, `sign-core.js`, `unlock-core.js`, `tetris-core.js`, `pacman-core.js`, `flappy-core.js`, `hop-core.js`, `snake-core.js`, `bricks-core.js`, `street-core.js`, `street-scene-core.js`, `chess-core.js`, `learn-core.js`, `audio-core.js`, `image-core.js`, `collage-core.js`, `frame-core.js`, `search-core.js`, `images.js`, `files.js` and `pdftools.js`), so it can be unit tested without a browser. Keep DOM code in the page scripts.
- **Every game keeps a game in progress.** A game must survive a reload or a later visit and come back paused exactly where it was, as Falling Blocks, Maze Chase, Flap, Road Hop, Snake, Brick Bounce, King of Streets and Chess do. Use `window.bdnixSave` from the `gamesave` module:
  - Save through `bdnixSave.keep('<game>', snapshot)`. `snapshot()` returns the whole state as plain JSON, or `null` when no game is in progress. Call the function `keep()` returns when the game pauses, starts a new game or ends.
  - Restore at startup. Check every field of the loaded save before using it. Clear a save that doesn't make sense and show the normal start screen.
  - Come back paused with "Picked up where you left off." The pause screen has **Resume** and a **New game** button (`#newBtn`).
  - Remove the save at game over.
  - The key is `bdnix_<game>_save`. Add it to the list of storage keys below.
  - UI tests must cover reloading mid-game and carrying on from the same spot, New game from the pause screen, discarding an invalid save, and the save being gone after game over (see the reload tests in `apps/falling-blocks/test/behaviour.spec.mjs`).
- **Every game has sound.** Use the `sound` module (`/assets/js/sound.js`), put the `#soundBtn` mute button in the top bar (its page target's `checkGame()` checks it), and call `window.bdnixSound.play()` for starting a game, the main moves, scoring, crashing and game over (`best` for a new best score, otherwise `over`). `start`, `over` and `best` come from `sound.js`; add the game's other sounds in its own script with `bdnixSound.add()`, never in `sound.js`. UI tests record what plays with `listen()` and `heard()` from `tests/ui/games.mjs`, and each game's behaviour target checks its sounds with `soundProblems()`.
- **Don't use other games' trademarks as our own.** Titles, headings, URLs, SEO tags, structured data and docs use the site's own names: Falling Blocks, Maze Chase, Flap, Road Hop, Snake, Brick Bounce and King of Streets, never Tetris, Pac-Man, Flappy Bird, Crossy Road, Blockade, Breakout or Road Rash. ("Snake" is the name of the genre, not a trademark.) New games get original names and artwork too. The exceptions are the credit line on each game's start screen (`<p class="credit">` in the overlay) and the Credits section of `docs/games.md`, which say which classic inspired the game and who created it, and state that the name is a trademark of its owner and bdnix isn't affiliated with or endorsed by them. A new game inspired by another needs both; pass `credit` to its `checkGame()` (`tests/ui/checks-game.mjs`), which checks the line, and `checkPage()` checks the names appear nowhere else. The old names also survive as internal identifiers (file names such as `tetris.js`, `bdnixSave` ids and storage keys), which stay as they are so visitors' saved data isn't lost.
- **Every game pauses when the page is left.** There's no pause button in a game's top bar: P / Esc pauses, on a phone so does tapping the score (`.stats`), and so do the window's `blur` and `visibilitychange` to hidden, which show the pause screen with its Resume button, waiting there when the visitor comes back. Its page target's `checkGame()` checks it.
- **Every arcade game is played by touch on a phone, with no buttons under the board.** A finger anywhere on the game area plays (drag, swipe or tap; a touch that starts on the score is for pausing, not playing), so the board gets the room and the thumb needn't cover it. The start and pause screens show the gestures in one row with the `gestures` component (`<ul class="gestures" aria-label="Touch controls">`, each item an arrow or `<i class="tap">`, what it does in `<b>` and how in `<span>`), followed by "Tap the score to pause.". Pass them to its page target's `checkGame()` as `gestures`, which checks them and the score tap.
- **Every game has the language switch.** Put `<nav class="langs" aria-label="Language" data-languages></nav>` before the mute button in the top bar and link `lang.css`. Its page target's `checkGame()` checks it.
- **Every game is played upright on a phone.** Use the `upright` module (`/assets/js/upright.js`) and pause the game in `window.bdnixUpright.onTurn()`, as you would on `blur`. Its page target's `checkGame()` checks it. The one exception is King of Streets, a full-screen 3D race the owner wants playable with a phone sideways too: it doesn't use `upright`, and its `checkGame()` is passed `upright: false`, which checks instead that it carries on and fills the screen either way up; filling the screen, it has no backdrop (`checkPage()`'s `backdrop: false`).
- **Every download opens in a new window.** This holds for every file any tool makes (a PDF, an image, audio, a signature): clicking to save it opens a new window, and the file downloads there, so a browser that shows the file instead of saving it (Safari on a phone shows PDFs and images) leaves the tool, and the visitor's work, where it was. A link's own `target="_blank"` isn't enough, since browsers save a link that names a download in the page it's on; `files.js` does it instead, and has the only code that saves a file:
  - A download link is set up with `bdnixFiles.offer(link, url, name)`.
  - A file made after the click (Merge PDFs and Photo Collage save straight away) uses `var win = bdnixFiles.fileWindow()`, called in the click handler itself, since browsers block a window opened later. It says the file is on its way; call `win.save(url, name)` when the file is ready, or `win.close()` if it can't be made.
  - Never save a file any other way (no link with `download` made and clicked by hand).
  - UI tests download through `inNewWindow(page, trigger)` from `tests/ui/downloads.mjs` (or `download()` from `tests/ui/pdfs.mjs`), which fails unless the file downloads in a new window that names it, with the tool's page left where it was. The `files` module's contract spec (`shared/files/test/downloads.spec.mjs`) covers the rest: the window's page, a window the browser blocks or the visitor closes, and a file that can't be made.
- **Languages.** Pages and scripts are written in English, and every other language is a set of translations (each module's `lang/<code>.json`) that `lang.js` applies in the browser; see [Languages](#languages). The owner reviews every translation: ask whether they want to see a batch before it ships or after.
- **Phone-sized screens matter.** Every page must work at 390 px wide with no sideways scrolling, and with touch as well as mouse and keyboard.
- **Browser storage is optional.** Wrap every `localStorage` / IndexedDB access in `try/catch`; pages must work without it (private browsing). The keys in use are `bdnix_visits`, `bdnix_name`, `bdnix_tetris_best`, `bdnix_pacman_best`, `bdnix_flappy_best`, `bdnix_hop_best`, `bdnix_snake_best`, `bdnix_bricks_best`, `bdnix_kingofstreets_best`, `bdnix_chess_best`, `bdnix_tetris_save`, `bdnix_pacman_save`, `bdnix_flappy_save`, `bdnix_hop_save`, `bdnix_snake_save`, `bdnix_bricks_save`, `bdnix_kingofstreets_save`, `bdnix_chess_save`, `bdnix_sound`, `bdnix_watermark_v1`, `bdnix_learn_chess`, `bdnix_kingofstreets_career`, `bdnix_analytics` and `bdnix_lang` (localStorage), and the `bdnix-tools` and `bdnix-sign` databases (IndexedDB). Don't rename them, since visitors' saved data would be lost.

## Languages

The site is in English and Bangla, and adding a language is adding its translations: nothing else changes.

- **Choosing.** The visitor's language is the one they picked with the switch in the top bar (`<nav class="langs" data-languages>`, on every page), kept in `localStorage` as `bdnix_lang`, or else their browser's language if the site has it, or else English. There are no separate pages per language: every page follows the choice, games included.
- **Translations.** `assets/lang/<code>/language.json` names the language (`name`, and `digits` and `style` if it has its own digits and a stylesheet for its font). Translations map English text, exactly as the page or script has it, to its translation, each module's in its `lang/<code>.json`. The build and the test server bundle them into packs (each page's own, `assets/lang/<name>.<code>.js`; see [Modules](#modules)) and fill in the list of languages in `lang.js` between its `build:languages` markers (`tools/languages.mjs`); none of it is committed, and the one line between those markers stays as it is (English only). The build fails if the same English is translated two ways in one pack.
- **Pages.** `lang.js` loads the visitor's language before the page is read, then translates text, `aria-label`, `title`, `placeholder` and `alt` as they appear, whenever a script changes them too, and writes standalone numbers in the language's digits. A paragraph with a link or bold words in it is one string, with its elements: `Read the code on <a>GitHub</a>.`. Mark anything that must stay as it is (a name the visitor typed, a file's name, a chess opening) `translate="no"`.
- **Scripts.** Write English. Text with something put into it goes through `window.bdnixLang`: `t('Saved {name}.', { name })` (a number put in comes out in the language's digits), `count(n, '{n} page', '{n} pages')`, and `num(n)` for a number drawn on a canvas. A word with two meanings says which after a bar: `t('Draw|result')` shows "Draw". Where English counts something (`'{areas} on {pages}'`), pass the bare number as `count` too, for a language that words it differently.
- **Tests.** Each page's i18n target opens it in every language and fails on English left untranslated (`bdnixLang.missing`) with `checkPageLanguages()`, plays a game in it with `checkGameLanguages()`, and checks with `checkStrings()` that its pack has every string its scripts pass to `t()` or `count()` and that no translation drops the elements or adds `{values}` its English doesn't have; `tests/unit/languages.test.mjs` checks the same of the shared modules' scripts and translations. Behaviour in Bangla is tested in the same target, opening pages with `inLanguage(page, 'bn')` and checking with `expectTranslated(page)` from `tests/ui/languages.mjs`.
- **Adding a language.** Copy `assets/lang/bn/language.json` to `assets/lang/<code>/` and each module's `lang/bn.json` to `lang/<code>.json`, translate them, add a font stylesheet if Inter doesn't cover its letters (as `bangla.css` does), and run the tests.

## Tests are required

**Every new feature and every bug fix must come with tests in the same change.** A pull request that adds or changes behaviour without tests isn't done.

- **Unit tests** (the modules' `test/*.test.mjs`, and `tests/unit/*.test.mjs` for the build and test tooling, Node's built-in `node:test`) are for pure logic: parsing, maths, data rules. They load a script into a sandbox with `load()` from `tests/unit/load.mjs`, which also provides fake `localStorage` and `document`. New pure logic needs unit tests covering its normal cases, edge cases and errors.
- **UI tests** (the modules' `test/*.spec.mjs`, and `tests/ui/seo.spec.mjs`, Playwright, with their helpers in `tests/ui/`) are for what a visitor sees and does. Import `test` and `expect` from `tests/ui/fixtures.mjs`, not from `@playwright/test`: the fixture fails the test on any uncaught page error, keeps the tests offline and records coverage and which files each spec loads. Read repository files through the test server (`request.get('/path')`), not `fs`, so the CI result cache (see [CI](#ci)) notices when they change. Each test runs at desktop and phone size. Build test files in code (see `tests/ui/pdfs.mjs`, `tests/ui/media.mjs` and `tests/ui/images.mjs`) rather than committing binaries, and check real output: open downloaded PDFs and assert on their contents.
- **A bug fix needs a test that fails without the fix.** Check that it does before relying on it.
- **Tests must be deterministic.** Don't assert on values that vary between runs (file sizes that include dates, real timings); wait for the state you need with `expect(...).toBe...` instead of fixed sleeps. Never skip, disable or loosen a test to get CI green. Find the cause instead; "flaky" isn't a cause.
- **Games and anything animated:** open the page with `openGame()` from `tests/ui/games.mjs`. It fixes `Math.random` (Falling Blocks then deals O, T, J, L, S, Z, I every bag) and freezes the clock *before* the page loads, so time only moves when the test calls `page.clock.runFor()`, and scores and positions come out exact. Don't install a clock after the page has loaded and then pause it: that races with the clock's real-time updates and occasionally steps time backwards, which stalls the game loops.

## Coverage must not drop

CI uploads the unit and UI tests' coverage of the site's own scripts (each reported at its place in the repository) to [Codecov](https://codecov.io/gh/bdnix/bdnix) in one upload. Codecov combines them (a line counts as covered if either suite runs it), comments on the pull request with a per-file table, and draws the README badge.

- **A pull request must not lower line coverage.** Codecov checks this on every pull request (settings in `codecov.yml`): **codecov/project** fails if overall line coverage drops more than 0.1% below `master`, and **codecov/patch** fails if less than 90% of the lines the pull request adds or changes are covered. Both must pass. Codecov's pull request comment shows which files lost coverage; add tests for the new or changed lines.
- Deleting code can lower coverage without anything being wrong. Say so in the pull request.
- To see exactly which lines are uncovered, open the file on Codecov, or run `npm run coverage` and open `coverage/report/index.html`.

## Cache-busting

Published pages link the site's own scripts and stylesheets with `?v=<hash of what's served there>`, so browsers fetch new versions as soon as they change. **Nothing generated is committed.** In the source, a page links its own files plainly, as `/assets/js/name.js` or `/assets/css/name.css`, and keeps its `build:` markers with nothing between them; `tools/page.mjs` stamps the links and fills in the parts generated from the modules' `module.json` (see [Keep apps modular](#keep-apps-modular)) whenever a page is served: by `npm run build`, which writes the published site to `_site/`, and by the test server, so the tests see exactly what visitors get. So editing a script or stylesheet is just editing it; there's nothing to rebuild or commit. Never write a `?v=` stamp or anything between `build:` markers by hand (`tests/unit/page.test.mjs` fails if a source page has either). Vendored files keep their library version as `?v=`, written by hand; bump it when upgrading one.

## Commands

Node 22 or later.

```bash
npm install
npx playwright install chromium   # first time only
npm run build          # make the published site in _site/ (what the Pages workflow deploys)
npm run lint           # ESLint (scripts, tests) and Stylelint (stylesheets)
npm test               # unit tests, then UI tests
npm run test:unit
npm run test:ui
npm run coverage       # both suites with coverage, combined into coverage/report
npm run serve          # the site at http://localhost:4173
npm run build:lame     # rebuild the MP3 encoder (apps/mp4-to-mp3/lame/README.md; rarely needed)
```

## Before you open a pull request

1. `npm run build` succeeds if you touched a page, a `module.json` or `assets/`, and `npm run lint` passes.
2. `npm run coverage` passes, and `coverage/report/index.html` shows your new and changed lines as covered.
3. New or changed behaviour has tests, and a bug fix has a test that failed before the fix.
4. The page works at phone width without sideways scrolling.
5. The docs are updated if you added a page or feature, or changed how something is used or developed: a brief entry in `README.md` for a new tool or game, and the details in the matching guide in `docs/` (`tools.md`, `games.md`, `privacy.md` or `development.md`).

## CI

`.github/workflows/tests.yml` runs on every pull request and push to `master`, and once a week on its own. Every job runs on one machine:

- **Unit tests:** lint (ESLint, Stylelint and `tools/boundaries.mjs`), then the unit tests with coverage, on one machine.
- **UI tests:** Playwright in Chromium with coverage, on one machine: it runs the specs whose inputs changed, then fails unless every spec has a passing result and each module's specs used only what it declares, and merges the coverage. On failure it uploads the HTML report and a trace of each failed test (**playwright-report** artifact).
- **Coverage:** once both pass, uploads their coverage to Codecov together. A failed upload fails the job, after one more try with Codecov's CLI from PyPI instead of `cli.codecov.io`, so the Codecov checks never go missing unnoticed. A red **Coverage** job with an upload error is usually Codecov being down: re-run the job.

Codecov then posts **codecov/project** and **codecov/patch** (see [Coverage must not drop](#coverage-must-not-drop)). `node_modules` and Playwright's Chromium are cached; see `.github/actions/setup`. `tests/unit/workflow.test.mjs` holds the workflow to what this section says.

Tests whose inputs haven't changed since they last passed don't run again; CI reuses their cached result and coverage:

- **Unit tests** are cached file by file by `scripts/unit-cache.mjs` (`npm run coverage:unit:cached`). A test file's inputs are what it uses (`scripts/test-deps.mjs`): its own file, the test helpers it imports (and theirs), every repository file it read, imported, listed or checked for while it ran (`tests/unit/track.mjs` records them), the npm packages those import at the versions the lock file pins, and the Node version. Not `package.json`, not the rest of the lock file, not the runners. `tests/unit/test-deps.test.mjs` checks this.
- **UI tests** are cached spec by spec by `scripts/ui-cache.mjs` (`npm run coverage:ui:cached`), on what each spec was **served**: its own code and the helpers it imports, what every spec runs on (`playwright.config.mjs`, `tests/ui/fixtures.mjs` and what they import), the npm packages and the Node version, and every response the test server gave it (each path's status, type and a digest of its body, without the site's `?v=` stamps; `tests/ui/fixtures.mjs` adds an `x-bdnix-spec` header to each request, and `tests/server.mjs` logs the answers). To check a cached result, the cache answers each path again with the same code the test server uses (`respond()` in `tools/page.mjs`). So a change to the build that serves the same bytes reruns nothing, and a change to a page or a module's file reruns exactly the specs that were served it. `tests/unit/ui-key.test.mjs` checks this. A spec that fails is never cached.
- So a UI test must get every repository file it depends on **through the test server** (`page.goto`, `request.get`, ...), never by reading it with `fs`, or the cache won't see a change to it.
- **A module's tests** fail if they use anything their module doesn't declare (see [Modules](#modules)).
- **Once a week**, the scheduled run ignores the caches and runs everything. Run the workflow by hand with **full** ticked to do the same. Locally, `npm test` and `npm run coverage` always run everything.

## Commit messages

Never write GitHub's skip keywords literally in a commit message, even when describing them: `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`, or a `skip-checks: true` trailer. GitHub honours them anywhere in the message, so the tests silently won't run for that push, and after a squash-merge not on `master` either.

Don't add `Claude-Session:` lines or claude.ai session links to commit messages or pull request descriptions.
