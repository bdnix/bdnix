# bdnix — Check back soon

A static "under construction" page for [www.bdnix.com](https://www.bdnix.com), plus a small Tetris game to play while you wait. Hosted on GitHub Pages; no build step.

## Preview locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## Files

Both pages share one design system, so they look like the same site:

- [assets/css/base.css](assets/css/base.css): colours, type, header, buttons and panels used by every page
- [assets/js/blocks.js](assets/js/blocks.js): the shared block palette, block renderer and falling-block backdrop
- [index.html](index.html), [assets/css/style.css](assets/css/style.css), [assets/js/main.js](assets/js/main.js): landing page
- [play/index.html](play/index.html), [assets/css/tetris.css](assets/css/tetris.css), [assets/js/tetris.js](assets/js/tetris.js): Tetris, served at `/play/`

## Tetris controls

| Action     | Keyboard            | Touch      |
|------------|---------------------|------------|
| Move       | ← → (or A / D)      | ◀ ▶        |
| Rotate     | ↑ / X (Z for CCW)   | ⟳ or tap the board |
| Soft drop  | ↓                   | ▼          |
| Hard drop  | Space               | ⤓          |
| Hold       | C / Shift           | HOLD       |
| Pause      | P / Esc             | ❚❚         |

The best score is saved in the browser's localStorage.

## Contact

root@bdnix.com
