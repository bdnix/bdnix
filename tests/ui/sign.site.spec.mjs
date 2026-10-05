import { expect } from './fixtures.mjs';
import { checkPage } from './checks.mjs';
import { checkPdfLib } from './checks-pdf.mjs';

// The checks every page and every PDF tool gets (see checks.mjs and checks-pdf.mjs).
checkPage('/sign-pdf/', { schema: 'WebApplication', category: 'UtilitiesApplication', footer: true });
// pdf-lib is fetched with the first PDF: what shows once A.pdf is open.
checkPdfLib('/sign-pdf/', (page) => expect(page.locator('#fileName')).toHaveText('A.pdf'));
