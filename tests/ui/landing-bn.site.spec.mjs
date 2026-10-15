import { checkPage } from './checks.mjs';

// The checks every page gets (see checks.mjs), for the landing page's Bangla copy.
checkPage('/bn/', { schema: 'WebSite', footer: true, lang: 'bn' });
