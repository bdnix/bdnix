import { test } from '../../../tests/ui/fixtures.mjs';
import { checkPage } from '../../../tests/ui/checks.mjs';
import { checkGame } from '../../../tests/ui/checks-game.mjs';
import { noDrawing } from './street.mjs';

// King of Streets' page target: the checks every page and every game gets (see
// checks.mjs and checks-game.mjs), in English. Its other languages are its
// i18n target's (i18n.spec.mjs). It may be played with a phone sideways.
noDrawing(test);
// Each page loads a city of 3D models: on a busy machine, with coverage on,
// that takes longer than the usual 30 seconds a test may.
test.setTimeout(90_000);
checkPage('/king-of-streets/', { languages: false, schema: 'WebApplication', category: 'GameApplication', game: true, backdrop: false });
checkGame('/king-of-streets/', { languages: false, upright: false, credit: ['Road Rash', 'Electronic Arts'], gestures: [['Steer', 'drag'], ['Punch', 'button'], ['Kick', 'button'], ['Brake', 'button']] });
