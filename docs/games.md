# Games guide

All eight games work with a keyboard, mouse or touch screen, and at phone size.

There's no pause button: **P** or **Esc** pauses, on a phone so does tapping the score (every game but Chess), and so does leaving the page (another tab, window or app, or the phone's home screen). Coming back shows the pause screen, with its big **Resume** button. The language switch sits in the top bar, beside the mute button.

On a phone, the games are played upright. Turning the phone sideways pauses the game and shows a note asking for it to be turned back; the game then waits, paused, for Resume. On a computer, a short, wide window still shows the game, with the scores and buttons beside the board.

On a phone, there are no buttons under the board: the games are played by touching the screen anywhere (dragging, swiping or tapping), so the board gets the room and a thumb can play from beside it. Their start and pause screens show how, in one row: what each gesture does, with an arrow for its direction (or a ring for a tap), and that tapping the score pauses. On a computer, the start screen shows the keys to press as keycaps.

- [Falling Blocks](#falling-blocks)
- [Maze Chase](#maze-chase)
- [Flap](#flap)
- [Road Hop](#road-hop)
- [Snake](#snake)
- [Brick Bounce](#brick-bounce)
- [King of Streets](#king-of-streets)
- [Chess](#chess)
- [Sound](#sound)
- [Scores and saved games](#scores-and-saved-games)
- [Credits](#credits)

## Falling Blocks

`/falling-blocks/`

| Action | Keyboard | Touch |
|---|---|---|
| Move | ← → (or A / D) | Drag sideways, a column for each cell's width |
| Rotate | ↑ / X (Z for counter-clockwise) | Tap |
| Soft drop | ↓ | Drag down slowly, a row for each cell's height |
| Hard drop | Space | Flick down |
| Hold | C / Shift | Flick up |
| Pause | P / Esc | Tap the score, or leave the page |

On a phone, a finger anywhere on the game area plays, so it needn't cover the board. A stroke goes one way: once it has gone a little, it either moves the piece sideways or drops it, never both. A flick is a quick stroke at least 30 pixels long; a tap is a touch that stays put and lets go within a third of a second.

The level goes up every 10 lines, and pieces fall faster at each level.

## Maze Chase

`/maze-chase/`

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys or WASD | Swipe anywhere |
| Pause | P / Esc | Tap the score, or leave the page |

The maze is the site's own design. A game saved on an earlier maze doesn't fit it, so it's discarded and a new game starts.

## Flap

`/flap/`

| Action | Keyboard | Touch |
|---|---|---|
| Flap | Space, ↑ or W (or click) | Tap anywhere |
| Pause | P / Esc | Tap the score, or leave the page |

Each pipe passed scores a point. 10, 20, 30 and 40 points earn bronze, silver, gold and platinum medals.

Hitting a pipe (its wider end caps count too) ends the round with a jolt: the board shakes, a burst marks the spot, and the bird bounces back off the pipe, dazed, and tumbles down beside it, or onto the pipe below, never through it.

## Road Hop

`/road-hop/`

| Action | Keyboard | Touch |
|---|---|---|
| Hop | Arrow keys or WASD (Space or a click hops forward) | Tap to hop forward, swipe to hop any way |
| Pause | P / Esc | Tap the score, or leave the page |

Each new row the chicken reaches scores a point. Lanes of grass, roads and rivers are laid out at random for every round, and the traffic and the rivers speed up the further the chicken goes. A car ends the round, and so does landing in the water, riding a log off the edge of the board, or standing still so long that the screen moves on without the chicken. Trees are in the way but harmless.

A car hit ends the round with a thump: the car stops dead, the board shakes, a ring flashes where it struck and a burst of feathers flies off, while the chicken tumbles through the air and lands on its back in the road past the car's bumper, feet up and seeing stars. Landing in the water makes a splash: a crown of foam and a spray of drops burst out as the chicken sinks, and ripples spread where it went under.

## Snake

`/snake/`

| Action | Keyboard | Touch |
|---|---|---|
| Turn | Arrow keys or WASD | Swipe anywhere |
| Pause | P / Esc | Tap the score, or leave the page |

The snake waits until the first direction is pressed, then glides from cell to cell at about four and a half cells a second. Each piece of food scores a point and makes the snake one longer and a little faster, up to ten cells a second. Hitting a wall or the snake's own body ends the round; filling the whole board wins it. Two quick presses make two turns on the next two steps, so a U-turn is easy.

The board is 17 cells across. On a wide screen it's square, 17 rows tall; on a tall, narrow one (a phone held upright) it takes as many rows as fill the screen (up to 32), so the board isn't a small square with empty space around it. A round keeps its rows until it ends, even if the window changes shape, and a saved round comes back with the rows it had.

One swipe makes one turn, and one stroke can make several, each 18 px in a new direction. While the finger keeps going the way it last turned, the 18 px count starts again from where it is, so a thumb that curves at the end of a swipe doesn't turn the snake a second time. Only the first finger on the screen steers; a second finger or a palm is ignored.

## Brick Bounce

`/brick-bounce/`

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Move the paddle | ← → (or A / D) | Point across the board | Drag anywhere |
| Launch the ball | Space, ↑ or W | Click | Tap |
| Pause | P / Esc | Leave the page | Tap the score, or leave the page |

Each wall of bricks has its own shape: a house, a space invader, a heart, waves, a castle and a chessboard, then round again. The first, the house, is the gentlest: its bottom row is whole, so the first shots always find a brick. Bricks score by row: 1 point in the bottom two rows, then 3, 5 and 7 for the top two. The ball waits on the paddle until it's launched and bounces back off the paddle at an angle set by where it lands, straight up off the middle and steeper towards the ends. It starts slow and speeds up after the 10th and 25th bricks of a wall and the first time it breaks into the upper and top rows. Once it reaches the top of the board the paddle shrinks for the rest of that wall.

There are three balls. Missing the ball with the paddle loses one: the board shakes, the bottom flashes red, a shockwave spreads from where the ball fell and it bursts into sparks, the paddle blinks red, "Missed!" pops up with the number of balls left ("Last ball!" before the last one), the ball count flashes and a sinking tune plays. The next ball waits on the paddle; losing the last ends the game. Clearing a wall is celebrated: the board flashes, confetti in the bricks' colours bursts from both bottom corners, "Wall 1 cleared!" pops up in gold, the wall count flashes and a fanfare plays, while the next wall drops in from the top, row by row, with the paddle back to full size. Each new wall starts the ball a little faster.

### Powers

Six bricks in every wall, picked at random, hide a power: they glow and pulse in the power's colour, a shine sweeps across them now and then, and they show the power's icon. Breaking one drops a glowing capsule with the same icon; catch it with the paddle to turn the power on. A capsule the paddle misses is gone.

| Icon | Power | What it does |
|---|---|---|
| Three balls (cyan) | Multi-ball | Every ball in play splits in three (up to 12 balls). A ball is only lost when the last one in play goes past the paddle; an extra ball that drains away just pops. |
| Flame (orange) | Fireball | For 8 seconds the balls burn straight through every brick they touch instead of bouncing off. |
| Lightning bolt (red) | Laser | For 8 seconds the paddle fires a shot from each end every 0.4 seconds; each shot breaks the first brick above it. |
| Double arrow (green) | Wide paddle | For 12 seconds the paddle is half as wide again. |
| Heart (yellow) | Extra ball | One more ball, up to five. |

Each wall hides two multi-balls and one of each of the others. The seconds left of the fireball, laser and wide paddle show under the paddle, beside their icons. Losing a ball or clearing a wall ends every power and clears away falling capsules and shots.

## King of Streets

`/king-of-streets/`

| Action | Keyboard | Touch |
|---|---|---|
| Steer | ← → (or A / D) | Drag sideways anywhere, as far as you want to turn, or (picked on the start card or in the garage) turn the phone like a handlebar |
| Brake | ↓ (or S) | Hold the **Brake** button (bottom left) |
| Punch (or swing your weapon) | X (or J) | The **Punch** button (bottom right) |
| Kick | Z (or K) | The **Kick** button, beside it |
| Camera: behind the bike or from the rider's seat | V | In the garage |
| Pause | P / Esc | Tap the score, or leave the page |

On a phone the buttons sit under the thumbs, and a finger anywhere else steers, so one thumb can steer while the other punches. Tilt steering takes straight ahead from however the phone is held when the race starts (an iPhone asks first whether the game may use its motion; refused, it steers by dragging). The first race of a career shows how to steer and, when a rival first comes alongside, how to punch.

A motorbike race through Dhaka, in 3D, against six rivals: Kalu, Bablu, Mintu, Rocky, Tinku and Pinky. The game fills the whole screen, on a computer or a phone, and a phone can be held either way up. Everyone lines up on the grid, you at the back; a countdown (3, 2, 1, Go!) starts the race, and the bike speeds up on its own to its top speed, so the work is steering, braking and fighting. Bends pull a fast bike towards the outside, more on a bike that holds the road less well, so steer into them. Up on the footpath the bike can't go faster than 50 km/h, and the electricity poles and trees standing there throw you off it. So does riding into the back of the traffic: CNG auto-rickshaws, cars, buses and trucks, each driving on at its own pace in its lane, and CNGs waiting at the kerb for fares, their drivers beside them.

Ride up beside a rival to fight. A punch is quick and reaches a short way; a kick reaches further, hits harder and shoves them across the road, but takes longer. The rival in reach shows their name, what they carry and their health at the top of the screen, with an arrow to the side they're on; once they're close enough to hit, the Punch button pulses. A blow that lands flashes the screen and jolts the camera, and a knockout plays out in slow motion for a moment. Some rivals carry a weapon (a stick, a chain or nunchaku), and the keen ones pull alongside to use it on you. Knock a rival off their bike (100 points) and they're out of the race, and their weapon is yours: from then on a punch swings it. A crash drops it. A kick at a CNG beside you shoves it sideways out of its lane, its driver hanging on, and it rolls to a stop at the kerb; the keen rivals do it too. A car, a bus or a truck is too big to move: the kick bounces off.

Your health is the bar at the bottom left. Rivals' blows and crashes take it away (a crash costs 20); when it runs out you're knocked out and the race is over. After a crash you're back on the bike in the road a couple of seconds later, while nothing can hit you. The panel at the top left shows your place (1 of 7 to 7 of 7), the race's points and how far there is to go, and your speed is at the bottom right.

**The career.** It starts on the scooter with no points. Finishing first, second or third wins 1,000, 600 or 300 points, each knockout 100 more, and winning on a bike slower than the race's own 1,000 more; a race that ends in a knockout keeps the points won in it. Points buy faster bikes in the **Garage**, and a bike is kept once bought:

| Bike | Top speed | Price | Opens |
|---|---|---|---|
| Scooter | 90 km/h | free | Races 1 to 3 |
| 125 | 115 km/h | 1,500 | Races 4 to 6 |
| Street 135 | 135 km/h | 4,000 | Races 7 to 9 |
| Sport 600 | 180 km/h | 10,000 | Races 10 to 12 |
| Hyper 1000 | 230 km/h | 22,500 | Races 13 to 15 |

There are fifteen races, three at each of five places and times of day, each longer than the last (from 2 km), and busier:

| Races | Where | When | Traffic |
|---|---|---|---|
| 1 to 3 | Mirpur Road | Dawn, in the mist | Almost none |
| 4 to 6 | Old Dhaka | After midnight, the street lamps lit | Light |
| 7 to 9 | Hatirjheel, beside the lake and over its bridges | Midday | Moderate |
| 10 to 12 | Moghbazar, up over the flyover | Dusk | Heavy |
| 13 to 15 | The elevated expressway | The morning rush | Jammed |

**Start game** rides the career's next race: the first one open that you haven't yet placed in the top three of. The garage also picks the bike you ride (any you own), your rider (six, three men and three women, told apart by their helmets) and any open race, and has the settings: the camera, how to steer on a touchscreen, and how much the game draws (**Graphics**: high draws shadows and further ahead, low suits a weak machine; it takes effect the next time the page loads). Either way the game keeps itself smooth: if frames come slower than 50 a second it draws the picture a little coarser, a step at a time, and at its coarsest leaves out the shadows. Add `?fps` to the address to see the frame rate in the corner. **Quick race** rides one race on any route and any bike: it scores, and keeps a best, but its points don't go to the career.

The city is real-looking, made of 3D artists' models and photographs: plastered concrete buildings with grilled windows, balconies and water tanks on the roofs, shops under Bangla signboards, tiled footpaths behind yellow and black kerbs, concrete poles strung with tangles of cable, mango and rain trees, mosques, people walking on the footpaths, and the sky for the time of day. Every rider wears a full-face helmet, sits on the bike with both hands closed round its grips, and leans into the bends, further the faster they go; the front lifts as a bike pulls away hard. The camera rides low and close behind, widening its view and shuddering as the speed builds. The view from the rider's seat (V) looks over the handlebars, both hands on the grips. The engines are heard too: your bike's in its own voice, its revs following the speed and dipping at each gear change, the rivals' as they pass, the wind past the helmet and the tyres squealing in a hard lean, and the street's hum, CNGs' rattle, buses' and trucks' diesels and their horns, busiest at rush hour.

The start card shows a picture of the street, so it opens at once; a race's city loads when it starts (the loading bar shows how far it's got), the riders and bikes near the camera in full detail and those further off lighter.

The models' and textures' sources are credited in `apps/king-of-streets/models/CREDITS.md` and `apps/king-of-streets/textures/CREDITS.md` (see [Development](development.md#third-party-libraries)).

## Chess

`/chess/`

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Move a piece | Arrow keys to a square, Enter to pick it up, again to put it down | Click the piece, then its square, or drag it | Tap the piece, then its square, or drag it |
| Pause | P / Esc | Leave the page | Leave the page |

The opponent is [Stockfish](https://stockfishchess.org/), the free and open-source chess engine, in its lite WebAssembly build. It runs in the browser in its own web worker, fetched (about 1.8 MB) when the first game starts; if it can't be fetched the game pauses and says so, and **Resume** tries again.

Before a game, pick a side on the start screen: White moves first, and playing Black turns the board round so your pieces are at the bottom. **Both** lets you play both sides yourself, White at the bottom: Stockfish doesn't play (it's only asked for a hint and the review), Undo takes back just the last move, Resign resigns for the side to move, a draw offer is agreed at once, and the game counts for no best win. The review then lists both sides' slips. The **Difficulty** slider beside the board sets Stockfish's strength from Level 1 (skill 0, looking 1 move ahead) to Level 10 (full strength, depth 15), each with roughly the rating of a player it plays like, as a guide rather than a measure (Level 1 about 800, then 200 more a level to Level 9 about 2400, and Level 10 about 2700); a change counts from the engine's next move.

The panel shows whose turn it is and how the game stands: your move, Stockfish thinking, check, checkmate and who won, or the draw: stalemate, threefold repetition, the fifty-move rule or insufficient material. It also names the opening once the moves match one of about sixty well-known ones (the longest that fits, so "Ruy Lopez, Morphy Defence" rather than "Open Game"). The players sit above and below the board, Stockfish with its level and rating and you below, each with the pieces they've taken and their lead in material (+3, counting a pawn as 1, a knight or bishop as 3, a rook as 5 and a queen as 9). The last move is highlighted, the king in check glows red, and a picked-up piece shows dots on the squares it can go to (rings on pieces it can take). A pawn reaching the last row asks which piece to become.

**Undo move** takes back your last move and Stockfish's reply, so it's your turn again; while Stockfish is thinking it takes back just your move. **Hint** asks Stockfish at full strength (12 moves deep) for your move: it's named under the buttons and drawn as a yellow arrow until the position changes. **Offer a draw** ends the game drawn ("Draw agreed") unless Stockfish's last look at the game had it ahead by more than 0.30; before it has moved it wants to play a few moves first. **Resign** asks to be sure (press it again; a move or a pause forgets it) and ends the game lost. **New game** asks first during a game (Resume or New game, with the side picker), and starts straight away otherwise.

The best score is the highest level you've beaten.

### Game review

When a game ends (checkmate or any draw) the page goes straight into its review: the result at the top, and Stockfish at full strength looking at every position, 16 moves deep, filling the review in as it goes ("Analysing… 12 of 41 positions"). For each move it shows:

- the evaluation after it: +0.85 is White ahead by most of a pawn, -1.20 Black ahead, M3 a forced mate in three for White (-M3 for Black), # mate on the board;
- what kind of move it was, from how much it lowered the mover's winning chances (as [lichess](https://lichess.org/) reckons them from the evaluation): **Best move** (Stockfish's own choice), **Good move**, **Inaccuracy** ?! (chances down by 10 points out of 200 or more), **Mistake** ? (20) or **Blunder** ?? (30);
- Stockfish's better move for anything but its own choice, and its choice in the position on the board, outlined in cyan.

The summary gives each side's accuracy (the average over its moves of lichess's per-move accuracy, 100% for moves that lose nothing) and how many inaccuracies, mistakes and blunders it made; on a phone, to keep the review short, it's one line ("Accuracy · White 92% · Black 67%"), the slips being listed below. The graph shows the evaluation over the game, White's share shaded light, with the slips marked in their colours; pressing it jumps to that point, and dragging along it goes through the game. On the board, an evaluation bar beside it shows White's winning chances in the position shown (from White's side of the board, so it turns with the board), Stockfish's choice there is drawn as an arrow, and a slip is marked (?!, ?, ??) on the square it moved to. The players sit above and below the board, by the names and ratings in the game file, with the pieces each has taken by the move shown. The move shown, with its evaluation and what kind of move it was, sits at the top with the buttons to step through the game: above the review beside the board on a wide screen, and above the board on a phone, so the board and what's said about it stay on screen together. As the moves go by, the move list scrolls itself to the move shown, never the page. Choosing the move shown (**All moves**) opens the whole game as text, as it's written: numbered moves with their marks, Stockfish's better move after each slip ("2. g4?? (a3 was better) 2… Qh4#") and the result; choosing a move there shows it on the board. The text view also copies the game as PGN (**Copy PGN**) or downloads it (**Download PGN**, in a new window like every download on the site): the seven usual tags, any others the file had, the result, and a set-up position if it had one; a game just played is a "Casual game" at bdnix.com between you and Stockfish, dated that day. Step through the game with the buttons (first, previous, next, last), the move list, the text, a swipe across the move shown (to the left for the next move, to the right for the one before), or ← → Home End; each step forward slides the piece and plays its sound, and the turn-round button flips the board. The play button (or Space) replays the game on the board, a move every second and a half, from the start if it's at the end; the speed button beside it changes that to slow (3 seconds, ½×) or fast (0.75 seconds, 2×) and round again, from the next move; it stops at the last move, at the pause button, or at any step taken by hand. A game that has just ended opens at its last move. **Play again** goes back to the start screen. If Stockfish can't be fetched the review says so, with **Try again**.

**Where you could have done better** lists every inaccuracy, mistake and blunder (the visitor's own after a game they played, both sides' in a game opened), each with Stockfish's better move and how far the mover's winning chances fell: "2. g4?? Blunder. 2. a3 was better: White's chances fell from 50% to 2%." Choosing one plays the better move instead, as a line tried (below), to compare it with the game and see how it goes on. A game without slips says so.

**Trying a different move.** In a review, either side's pieces can be moved on the board (dragged, clicked or played from the keyboard), from whatever position is shown; picking one up stops a replay. Playing the game's own move just steps on to it. Any other move starts a line of the visitor's own, and the board, the evaluation and the engine's hint follow it. Stockfish looks at each position of the line (16 moves deep), and a panel compares the first move tried with the game's: what kind of move each was, the evaluation after each and the mover's winning chances, and which was better ("g6 is better than the game's Nf6: Black's chances go up from 2% to 53%"). Below that it says how the position shown stands (the evaluation and who's ahead, in words such as "White is better" or "Black mates in 3", or how it ended) against how the game itself ended. Either side can carry on moving. **Stockfish plays on** plays both sides from there (12 moves deep each), until the game is over or for 60 moves, to show how the game would have gone, and **Stop** halts it; pressing it again plays on from there. Once it has played, **Where Stockfish began** goes straight back to the position it started playing on from, to step through its moves from there. The whole line is kept: ← and →, Home and End, a swipe and the step buttons go back and forth along it, from where it branched off to its last move, so each move of a better line can be looked at in turn (a step stops Stockfish playing on). Playing the line's next move steps on to it; any other move part way along, or **Stockfish plays on** from there, replaces the rest of the line. The line goes only when asked: **Reset to the game** (or Escape), choosing a move of the game (in the move list, the graph, the slips or the game as text) or replaying. A search that's under way is stopped first, and the next starts only once Stockfish has answered, since it can't take a new search before then.

### Analysing a game file

**Analyse a game file** (on the start and pause screens, and in a review) opens a game file and reviews the game in it, the same way, starting from its first position and replaying the moves on the board one by one. It reads PGN with its tags (the players, event, date and result are shown), comments, variations, numeric annotations and a `[FEN]` set-up position, or a text file that only lists the moves, in SAN (`1. e4 e5 2. Nf3`, also written loosely as `Ngf3`, `0-0` or `e8Q`) or UCI (`e2e4 e7e5`). A file that can't be read says why, naming the first move that isn't legal. A file of several games (a PGN database, such as a player's games downloaded from a chess site) lists them to pick one from: each by its players, result, event, date and round, searched by any words in its tags (players, event, place, date, round, result or opening code), the first 100 that match shown. Only the game picked is read, so a file of thousands of games opens at once; one that can't be read says why, and the list stays. **Another game from the file** (in its review) opens the list again as it was left. Files over 50 MB, far more than any game file, are refused. The picker accepts any file, since browsers that don't know the `.pgn` type (Safari on an iPhone, for one) won't let such a file be picked otherwise; what's in it decides whether it's a game. **Paste a game** (beside it) opens a box to paste a PGN or the moves into instead, for a game copied from somewhere else; it says why if it can't read a game, and Escape, **Cancel** or a click outside closes it. The file or text is read in the browser and never uploaded. A game paused when the file is opened waits, and is still saved: **Back to your game** returns to it.


## Sound

Every game has sound effects: a jingle when a game starts, sounds for the main moves (moving, turning and dropping pieces, eating dots and power pellets, flapping, hopping, eating food, the ball hitting the paddle, the walls and bricks, catching a power and firing the laser, the countdown to a race, punches, kicks and weapon blows landing and missing, being hit, bikes bumping, a rival knocked off, chess moves, captures and checks), for scoring and clearing lines, for each way a round can end (a car, the river, a crash, a lost ball, a knockout), a fanfare for a race finished in the top three, and a tune at game over, a brighter one for a new best score.

The speaker button in the top bar, or **M**, turns sound off and on. The choice applies to every game and is remembered in the browser (`bdnix_sound`). Sound is on until it's turned off.

The sounds are made in the browser with the Web Audio API, so there are no audio files to download. Browsers only let a page play sound after the visitor has pressed a key or tapped, so the first sound comes with the first press. Safari also stops a page's sound when the phone locks or another app takes over the sound; every tap and key press starts it again, so sounds that come from the game itself (a dot eaten, a ghost catching you) keep playing. On an iPhone, the sounds follow the ring/silent switch: with it on silent they don't play. Safari also stops a page's sound when the phone locks or another app takes over the sound; every tap and key press starts it again, so sounds that come from the game itself (a dot eaten, a ghost catching you) keep playing. On an iPhone, the sounds follow the ring/silent switch: with it on silent they don't play.

## Scores and saved games

Each game keeps its best score in the browser's `localStorage`, and the [profile page](privacy.md#profile) shows them all.

A game in progress is saved whenever it pauses and when the page is reloaded, closed or left. Returning to the page, even days later, shows the game paused exactly where it was, with the message "Picked up where you left off.": **Resume** carries on and **New game** starts over. The save is removed when the game ends. Flap only keeps a round once the bird has flapped, Road Hop once the chicken has hopped, Snake once the snake has started moving, Brick Bounce once the first ball has been launched, King of Streets once a race has got under way (a race that's over isn't kept; its points are already in the career), and Chess once the first move has been played.

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
| King of Streets | Road Rash, created by Electronic Arts in 1991 |

These names are trademarks of their owners. bdnix isn't affiliated with or endorsed by them.

Chess is centuries old and nobody's trademark. Its start screen credits its opponent instead: Stockfish, by the Stockfish developers, in the Stockfish.js build by Nathan Rugg and Chess.com, under the GPL 3 (see [Development](development.md#third-party-libraries)).
