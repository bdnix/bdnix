# Games guide

All four games work with a keyboard, mouse or touch screen, and at phone size.

- [Falling Blocks](#falling-blocks)
- [Maze Chase](#maze-chase)
- [Flap](#flap)
- [Road Hop](#road-hop)
- [Scores and saved games](#scores-and-saved-games)
- [Credits](#credits)

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

The maze is the site's own design. A game saved on an earlier maze doesn't fit it, so it's discarded and a new game starts.

## Flap

`/flap/`

| Action | Keyboard | Touch |
|---|---|---|
| Flap | Space, ↑ or W (or click) | Tap anywhere |
| Pause | P / Esc | ❚❚ |

Each pipe passed scores a point. 10, 20, 30 and 40 points earn bronze, silver, gold and platinum medals.

## Road Hop

`/road-hop/`

| Action | Keyboard | Touch |
|---|---|---|
| Hop | Arrow keys or WASD (Space or a click hops forward) | Tap to hop forward, swipe to hop any way, or the arrow buttons |
| Pause | P / Esc | ❚❚ |

Each new row the chicken reaches scores a point. Lanes of grass, roads and rivers are laid out at random for every round, and the traffic and the rivers speed up the further the chicken goes. A car ends the round, and so does landing in the water, riding a log off the edge of the board, or standing still so long that the screen moves on without the chicken. Trees are in the way but harmless.

## Scores and saved games

Each game keeps its best score in the browser's `localStorage`, and the [profile page](privacy.md#profile) shows them all.

A game in progress is saved whenever it pauses and when the page is reloaded, closed or left. Returning to the page, even days later, shows the game paused exactly where it was, with the message "Picked up where you left off.": **Resume** carries on and **New game** starts over. The save is removed when the game ends. Flap only keeps a round once the bird has flapped, and Road Hop once the chicken has hopped.

Clearing the browser's site data removes saved games and best scores. See [Privacy and data](privacy.md) for the storage keys.

## Credits

Each game is our own take on a classic, with its own name, artwork and code. The start screen of each credits the original:

| Our game | Inspired by |
|---|---|
| Falling Blocks | Tetris, created by Alexey Pajitnov in 1984 |
| Maze Chase | Pac-Man, created by Toru Iwatani at Namco in 1980 |
| Flap | Flappy Bird, created by Dong Nguyen in 2013 |
| Road Hop | Crossy Road, created by Hipster Whale in 2014 |

These names are trademarks of their owners. bdnix isn't affiliated with or endorsed by them.
