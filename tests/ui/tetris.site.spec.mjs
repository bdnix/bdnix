import { checkPage } from './checks.mjs';
import { checkGame } from './checks-game.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs).
checkPage('/falling-blocks/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/falling-blocks/', {
  credit: ['Tetris', 'Alexey Pajitnov'],
  gamepad: { dpad: { up: 'Hard drop', left: 'Move left', right: 'Move right', down: 'Soft drop' }, face: { a: 'Rotate', b: 'Hold' } }
});
