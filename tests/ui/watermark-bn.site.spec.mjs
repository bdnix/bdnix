import { expect } from './fixtures.mjs';
import { checkPage } from './checks.mjs';
import { checkPdfLib } from './checks-pdf.mjs';

// The checks every page and every PDF tool gets (see checks.mjs and
// checks-pdf.mjs), for the tool's Bangla copy.
checkPage('/bn/watermark-pdf/', { schema: 'WebApplication', category: 'UtilitiesApplication', footer: true, lang: 'bn' });
checkPdfLib('/bn/watermark-pdf/', (page) => expect(page.locator('#fileName')).toHaveText('A.pdf'), { lang: 'bn' });
