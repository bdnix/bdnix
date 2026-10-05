import { checkPage, checkGame } from './checks.mjs';

// The checks every page and every game gets (see checks.mjs).
checkPage('/road-hop/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/road-hop/', { credit: ['Crossy Road', 'Hipster Whale'], gamepad: { dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } } });
