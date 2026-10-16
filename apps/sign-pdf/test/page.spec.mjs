import { expect } from '../../../tests/ui/fixtures.mjs';
import { checkPage } from '../../../tests/ui/checks.mjs';
import { checkPdfLib } from '../../../tests/ui/checks-pdf.mjs';

// The checks every page and every PDF tool gets (see checks.mjs and checks-pdf.mjs).
checkPage('/sign-pdf/', { languages: false, schema: 'WebApplication', category: 'UtilitiesApplication', footer: true });
// pdf-lib is fetched with the first PDF: what shows once A.pdf is open.
checkPdfLib('/sign-pdf/', (page) => expect(page.locator('#fileName')).toHaveText('A.pdf'));
