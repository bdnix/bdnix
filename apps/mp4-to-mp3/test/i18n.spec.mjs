import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';

// MP4 to MP3's i18n target: the page in every other language the
// site has, from its own translations (lang/) and those of the shared modules
// it uses, and nothing else.
checkPageLanguages('/mp4-to-mp3/');
checkStrings('/mp4-to-mp3/', 'mp4-to-mp3');
