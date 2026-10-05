import { expect } from './fixtures.mjs';
import { checkPage, checkPdfLib } from './checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/unlock-pdf/', { schema: 'WebApplication', category: 'UtilitiesApplication', footer: true });
// pdf-lib is fetched with the first PDF: what shows once A.pdf is open.
checkPdfLib('/unlock-pdf/', (page) => expect(page.locator('#fileName')).toHaveText('A.pdf'));
