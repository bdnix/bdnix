import { checkPage } from '../../../tests/ui/checks.mjs';
import { checkGame } from '../../../tests/ui/checks-game.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs),
// in English. Its other languages are its i18n target's (i18n.spec.mjs).
checkPage('/chess/', { languages: false, schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/chess/', { languages: false });
