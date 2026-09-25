# bdnix — Check back soon

A static "under construction" page for [www.bdnix.com](https://www.bdnix.com), plus Tetris and Pac-Man to play while you wait and a PDF merger tool. Hosted on GitHub Pages; no build step.

## Preview locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## Files

Both pages share one design system, so they look like the same site:

- [assets/css/base.css](assets/css/base.css): colours, type, header, buttons and panels used by every page
- [assets/js/blocks.js](assets/js/blocks.js): the shared block palette, block renderer and falling-block backdrop
- [assets/css/game.css](assets/css/game.css): board frame, overlay, stat panels and touch buttons shared by both games
- [index.html](index.html), [assets/css/style.css](assets/css/style.css), [assets/js/main.js](assets/js/main.js): landing page
- [play/index.html](play/index.html), [assets/css/tetris.css](assets/css/tetris.css), [assets/js/tetris.js](assets/js/tetris.js): Tetris, served at `/play/`
- [pacman/index.html](pacman/index.html), [assets/css/pacman.css](assets/css/pacman.css), [assets/js/pacman.js](assets/js/pacman.js): Pac-Man, served at `/pacman/`
- [merge-pdf/index.html](merge-pdf/index.html), [assets/css/merge.css](assets/css/merge.css), [assets/js/merge.js](assets/js/merge.js): PDF merger, served at `/merge-pdf/`
- [assets/vendor/pdf-lib.min.js](assets/vendor/pdf-lib.min.js): [pdf-lib](https://pdf-lib.js.org/) 1.17.1 (MIT, see [its licence](assets/vendor/pdf-lib.LICENSE.md)), used by the PDF merger

## Deploying changes

GitHub Pages lets browsers cache CSS and JS for a while. When you change any file in `assets/css` or `assets/js`, bump the `?v=` number on its `<link>` / `<script>` tags in every page that loads it (`index.html`, `play/index.html`, `pacman/index.html`, `merge-pdf/index.html`). Otherwise visitors can get the new HTML with old styles.

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

## PDF merger

Add PDFs by dropping them on the page or choosing them. Reorder them by dragging or with the arrow buttons, then merge and download `merged.pdf`. Each file has a **Pages** box: leave it empty to include every page, or list pages and ranges separated by commas, e.g. `1-3, 5, 8-` (`8-` means page 8 to the end, `-3` means pages 1 to 3, and `5-3` adds pages 5, 4, 3 in that order). Pages come out in the order you list them. The merge runs in the browser with pdf-lib, so files are never uploaded anywhere. Password-protected PDFs are skipped with a message.

## Contact

root@bdnix.com
