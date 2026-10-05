import { checkPage } from './checks.mjs';
import { checkGame } from './checks-game.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs).
checkPage('/brick-bounce/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/brick-bounce/', { credit: ['Breakout', 'Atari'], gamepad: { dpad: { left: 'Left', right: 'Right' }, face: { a: 'Launch' } } });
