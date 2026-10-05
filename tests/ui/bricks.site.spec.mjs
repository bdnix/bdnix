import { checkPage, checkGame } from './checks.mjs';

// The checks every page and every game gets (see checks.mjs).
checkPage('/brick-bounce/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/brick-bounce/', { credit: ['Breakout', 'Atari'], gamepad: { dpad: { left: 'Left', right: 'Right' }, face: { a: 'Launch' } } });
