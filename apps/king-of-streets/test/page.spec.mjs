import { test } from '../../../tests/ui/fixtures.mjs';
import { checkPage } from '../../../tests/ui/checks.mjs';
import { checkGame } from '../../../tests/ui/checks-game.mjs';
import { noDrawing } from './street.mjs';

// King of Streets' page target: the checks every page and every game gets (see
// checks.mjs and checks-game.mjs), in English. Its other languages are its
// i18n target's (i18n.spec.mjs). It may be played with a phone sideways.
noDrawing(test);
checkPage('/king-of-streets/', { languages: false, schema: 'WebApplication', category: 'GameApplication', game: true, backdrop: false });
checkGame('/king-of-streets/', { languages: false, upright: false, credit: ['Road Rash', 'Electronic Arts'], gestures: [['Steer', 'drag'], ['Punch', 'tap'], ['Kick', 'flick'], ['Brake', 'flick']] });
