import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';

// Compress Images' i18n target: the page in every other language the
// site has, from its own translations (lang/) and those of the shared modules
// it uses, and nothing else.
checkPageLanguages('/compress-image/');
checkStrings('/compress-image/', 'compress-image');
