import { checkPage, checkGame } from './checks.mjs';

// The checks every page and every game gets (see checks.mjs).
checkPage('/falling-blocks/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/falling-blocks/', {
  credit: ['Tetris', 'Alexey Pajitnov'],
  gamepad: { dpad: { up: 'Hard drop', left: 'Move left', right: 'Move right', down: 'Soft drop' }, face: { a: 'Rotate', b: 'Hold' } }
});
