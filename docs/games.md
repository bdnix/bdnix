# Games guide

All three games work with a keyboard, mouse or touch screen, and at phone size.

- [Falling Blocks](#falling-blocks)
- [Maze Chase](#maze-chase)
- [Flap](#flap)
- [Scores and saved games](#scores-and-saved-games)

## Falling Blocks

`/falling-blocks/`

| Action | Keyboard | Touch |
|---|---|---|
| Move | ← → (or A / D) | ◀ ▶ |
| Rotate | ↑ / X (Z for counter-clockwise) | ⟳ or tap the board |
| Soft drop | ↓ | ▼ |
| Hard drop | Space | ⤓ |
| Hold | C / Shift | HOLD |
| Pause | P / Esc | ❚❚ |

The level goes up every 10 lines, and pieces fall faster at each level.

## Maze Chase

`/maze-chase/`

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys or WASD | Swipe anywhere, or the arrow buttons |
| Pause | P / Esc | ❚❚ |

## Flap

`/flap/`

| Action | Keyboard | Touch |
|---|---|---|
| Flap | Space, ↑ or W (or click) | Tap anywhere |
| Pause | P / Esc | ❚❚ |

Each pipe passed scores a point. 10, 20, 30 and 40 points earn bronze, silver, gold and platinum medals.

## Scores and saved games

Each game keeps its best score in the browser's `localStorage`, and the [profile page](privacy.md#profile) shows all three.

A game in progress is saved whenever it pauses and when the page is reloaded, closed or left. Returning to the page, even days later, shows the game paused exactly where it was, with the message "Picked up where you left off.": **Resume** carries on and **New game** starts over. The save is removed when the game ends. Flap only keeps a round once the bird has flapped.

Clearing the browser's site data removes saved games and best scores. See [Privacy and data](privacy.md) for the storage keys.
