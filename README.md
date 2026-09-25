# bdnix — Check back soon

A static "under construction" page for [www.bdnix.com](https://www.bdnix.com), plus Tetris and Pac-Man to play while you wait. Hosted on GitHub Pages; no build step.

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

## Deploying changes

GitHub Pages lets browsers cache CSS and JS for a while. When you change any file in `assets/css` or `assets/js`, bump the `?v=` number on its `<link>` / `<script>` tags in `index.html` and `play/index.html`. Otherwise visitors can get the new HTML with old styles.

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

## Contact

root@bdnix.com
