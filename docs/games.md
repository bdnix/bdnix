# Games guide

All five games work with a keyboard, mouse or touch screen, and at phone size.

- [Falling Blocks](#falling-blocks)
- [Maze Chase](#maze-chase)
- [Flap](#flap)
- [Road Hop](#road-hop)
- [Snake](#snake)
- [Sound](#sound)
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

## Snake

`/snake/`

| Action | Keyboard | Touch |
|---|---|---|
| Turn | Arrow keys or WASD | Swipe anywhere, or the arrow buttons |
| Pause | P / Esc | ❚❚ |

The snake waits until the first direction is pressed, then glides from cell to cell at about four and a half cells a second. Each piece of food scores a point and makes the snake one longer and a little faster, up to ten cells a second. Hitting a wall or the snake's own body ends the round; filling the whole board wins it. Two quick presses make two turns on the next two steps, so a U-turn is easy.

## Sound

Every game has sound effects: a jingle when a game starts, sounds for the main moves (moving, turning and dropping pieces, eating dots and power pellets, flapping, hopping, eating food), for scoring and clearing lines, for each way a round can end (a car, the river, a crash), and a tune at game over, a brighter one for a new best score.

The speaker button beside pause in the top bar, or **M**, turns sound off and on. The choice applies to every game and is remembered in the browser (`bdnix_sound`). Sound is on until it's turned off.

The sounds are made in the browser with the Web Audio API, so there are no audio files to download. Browsers only let a page play sound after the visitor has pressed a key or tapped, so the first sound comes with the first press.

## Scores and saved games

Each game keeps its best score in the browser's `localStorage`, and the [profile page](privacy.md#profile) shows them all.

A game in progress is saved whenever it pauses and when the page is reloaded, closed or left. Returning to the page, even days later, shows the game paused exactly where it was, with the message "Picked up where you left off.": **Resume** carries on and **New game** starts over. The save is removed when the game ends. Flap only keeps a round once the bird has flapped, Road Hop once the chicken has hopped, and Snake once the snake has started moving.

Clearing the browser's site data removes saved games and best scores. See [Privacy and data](privacy.md) for the storage keys.

## Credits

Each game is our own take on a classic, with its own name, artwork and code. The start screen of each credits the original:

| Our game | Inspired by |
|---|---|
| Falling Blocks | Tetris, created by Alexey Pajitnov in 1984 |
| Maze Chase | Pac-Man, created by Toru Iwatani at Namco in 1980 |
| Flap | Flappy Bird, created by Dong Nguyen in 2013 |
| Road Hop | Crossy Road, created by Hipster Whale in 2014 |
| Snake | Blockade, created by Gremlin in 1976, and the snake games that followed |

These names are trademarks of their owners. bdnix isn't affiliated with or endorsed by them.
