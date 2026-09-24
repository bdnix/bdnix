# bdnix — Check back soon

A static "under construction" page for [www.bdnix.com](https://www.bdnix.com), plus a small Tetris game to play while you wait. Hosted on GitHub Pages; no build step.

## Preview locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## Files

- [index.html](index.html): landing page (animated logo, typewriter status, visit counter, falling-block background)
- [assets/css/style.css](assets/css/style.css) and [assets/js/main.js](assets/js/main.js): landing page styles and script
- [play/index.html](play/index.html): Tetris, served at `/play/`
- [assets/css/tetris.css](assets/css/tetris.css) and [assets/js/tetris.js](assets/js/tetris.js): game styles and logic

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
