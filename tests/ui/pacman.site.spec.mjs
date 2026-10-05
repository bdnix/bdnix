import { checkPage } from './checks.mjs';
import { checkGame } from './checks-game.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs).
checkPage('/maze-chase/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/maze-chase/', { credit: ['Pac-Man', 'Toru Iwatani'], gamepad: { dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } } });
