import { checkPage } from './checks.mjs';
import { checkGame } from './checks-game.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs).
checkPage('/chess/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/chess/');
