import { checkPage } from '../../../tests/ui/checks.mjs';
import { checkGame } from '../../../tests/ui/checks-game.mjs';

// Street Kids' page target: the checks every page and every game gets (see
// checks.mjs and checks-game.mjs), in English. Its other languages are its
// i18n target's (i18n.spec.mjs).
checkPage('/street-kids/', { languages: false, schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/street-kids/', { languages: false, credit: ['Road Rash', 'Electronic Arts'], gestures: [['Steer', 'drag'], ['Punch', 'tap'], ['Kick', 'flick'], ['Brake', 'flick']] });
