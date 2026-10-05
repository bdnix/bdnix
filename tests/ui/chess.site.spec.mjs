import { checkPage, checkGame } from './checks.mjs';

// The checks every page and every game gets (see checks.mjs).
checkPage('/chess/', { schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/chess/');
