# Games guide

All six games work with a keyboard, mouse or touch screen, and at phone size.

- [Falling Blocks](#falling-blocks)
- [Maze Chase](#maze-chase)
- [Flap](#flap)
- [Road Hop](#road-hop)
- [Snake](#snake)
- [Brick Bounce](#brick-bounce)
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

## Brick Bounce

`/brick-bounce/`

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Move the paddle | ← → (or A / D) | Point across the board | Drag anywhere, or ◀ ▶ |
| Launch the ball | Space, ↑ or W | Click | Tap, or the ↑ button |
| Pause | P / Esc | ❚❚ | ❚❚ |

Eight rows of bricks sit at the top of the board: the bottom two rows score 1 point a brick, then 3, 5 and 7 for the top two. The ball waits on the paddle until it's launched and bounces back off the paddle at an angle set by where it lands, straight up off the middle and steeper towards the ends. It speeds up after the 4th and 12th bricks of a wall and the first time it breaks into the upper and top rows. Once it reaches the top of the board the paddle shrinks for the rest of that wall.

There are three balls. Missing the ball with the paddle loses one, and the next waits on the paddle; losing the last ends the game. Clearing a wall puts up a new one with the paddle back to full size, and each new wall starts the ball a little faster.

### Powers

Six bricks in every wall, picked at random, hide a power and show its letter. Breaking one drops a capsule; catch it with the paddle to turn the power on. A capsule the paddle misses is gone.

| Letter | Power | What it does |
|---|---|---|
| M | Multi-ball | Every ball in play splits in three (up to 12 balls). A ball is only lost when the last one in play goes past the paddle. |
| F | Fireball | For 8 seconds the balls burn straight through every brick they touch instead of bouncing off. |
| L | Laser | For 8 seconds the paddle fires a shot from each end every 0.4 seconds; each shot breaks the first brick above it. |
| W | Wide paddle | For 12 seconds the paddle is half as wide again. |
| + | Extra ball | One more ball, up to five. |

Each wall hides two multi-balls and one of each of the others. The seconds left of the fireball, laser and wide paddle show under the paddle. Losing a ball or clearing a wall ends every power and clears away falling capsules and shots.

## Sound

Every game has sound effects: a jingle when a game starts, sounds for the main moves (moving, turning and dropping pieces, eating dots and power pellets, flapping, hopping, eating food, the ball hitting the paddle, the walls and bricks, catching a power and firing the laser), for scoring and clearing lines, for each way a round can end (a car, the river, a crash, a lost ball), and a tune at game over, a brighter one for a new best score.

The speaker button beside pause in the top bar, or **M**, turns sound off and on. The choice applies to every game and is remembered in the browser (`bdnix_sound`). Sound is on until it's turned off.

The sounds are made in the browser with the Web Audio API, so there are no audio files to download. Browsers only let a page play sound after the visitor has pressed a key or tapped, so the first sound comes with the first press. Safari also stops a page's sound when the phone locks or another app takes over the sound; every tap and key press starts it again, so sounds that come from the game itself (a dot eaten, a ghost catching you) keep playing. On an iPhone, the sounds follow the ring/silent switch: with it on silent they don't play. Safari also stops a page's sound when the phone locks or another app takes over the sound; every tap and key press starts it again, so sounds that come from the game itself (a dot eaten, a ghost catching you) keep playing. On an iPhone, the sounds follow the ring/silent switch: with it on silent they don't play.

## Scores and saved games

Each game keeps its best score in the browser's `localStorage`, and the [profile page](privacy.md#profile) shows them all.

A game in progress is saved whenever it pauses and when the page is reloaded, closed or left. Returning to the page, even days later, shows the game paused exactly where it was, with the message "Picked up where you left off.": **Resume** carries on and **New game** starts over. The save is removed when the game ends. Flap only keeps a round once the bird has flapped, Road Hop once the chicken has hopped, Snake once the snake has started moving, and Brick Bounce once the first ball has been launched.

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
| Brick Bounce | Breakout, created by Atari in 1976 |

These names are trademarks of their owners. bdnix isn't affiliated with or endorsed by them.
