import { checkPage } from '../../../tests/ui/checks.mjs';
import { checkGame } from '../../../tests/ui/checks-game.mjs';

// Snake's page target: the checks every page and every game gets (see
// checks.mjs and checks-game.mjs), in English. Its other languages are its
// i18n target's (i18n.spec.mjs).
checkPage('/snake/', { schema: 'WebApplication', category: 'GameApplication', game: true, languages: false });
checkGame('/snake/', { credit: ['Blockade', 'Gremlin'], gamepad: { dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } }, languages: false });
