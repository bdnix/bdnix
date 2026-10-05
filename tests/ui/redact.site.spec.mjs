import { expect } from './fixtures.mjs';
import { checkPage, checkPdfLib } from './checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/redact-pdf/', { schema: 'WebApplication', category: 'UtilitiesApplication', footer: true });
// pdf-lib is fetched with the first PDF: what shows once A.pdf is open.
checkPdfLib('/redact-pdf/', (page) => expect(page.locator('#fileName')).toHaveText('A.pdf'));
