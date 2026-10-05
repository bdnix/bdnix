import { expect } from './fixtures.mjs';
import { checkPage, checkPdfLib } from './checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/merge-pdf/', { schema: 'WebApplication', category: 'UtilitiesApplication', footer: true });
// pdf-lib is fetched with the first PDF: what shows once A.pdf is open.
checkPdfLib('/merge-pdf/', (page) => expect(page.locator('.file-name')).toHaveText(['A.pdf']));
