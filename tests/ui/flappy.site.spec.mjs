import { checkPage } from './checks.mjs';
import { checkGame } from './checks-game.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs).
checkPage('/flap/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/flap/', { credit: ['Flappy Bird', 'Dong Nguyen'] });
