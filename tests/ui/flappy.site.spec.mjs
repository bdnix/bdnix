import { checkPage, checkGame } from './checks.mjs';

// The checks every page and every game gets (see checks.mjs).
checkPage('/flap/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/flap/', { credit: ['Flappy Bird', 'Dong Nguyen'] });
