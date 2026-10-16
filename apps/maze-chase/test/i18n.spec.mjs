import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkGameLanguages } from '../../../tests/ui/checks-game.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';

// Maze Chase's i18n target: the page and the game in every other language the
// site has, from its own translations (lang/) and those of the shared modules
// it uses, and nothing else.
checkPageLanguages('/maze-chase/');
checkGameLanguages('/maze-chase/');
checkStrings('/maze-chase/', 'maze-chase');
