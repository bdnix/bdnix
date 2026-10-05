import { checkPage } from './checks.mjs';
import { checkGame } from './checks-game.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs).
checkPage('/snake/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/snake/', { credit: ['Blockade', 'Gremlin'], gamepad: { dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } } });
