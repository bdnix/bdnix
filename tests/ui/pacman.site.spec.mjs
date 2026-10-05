import { checkPage, checkGame } from './checks.mjs';

// The checks every page and every game gets (see checks.mjs).
checkPage('/maze-chase/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/maze-chase/', { credit: ['Pac-Man', 'Toru Iwatani'], gamepad: { dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } } });
