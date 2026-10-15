import { checkPage } from './checks.mjs';

// The checks every page gets (see checks.mjs), for the profile page's Bangla
// copy, which is kept out of search engines like the English one.
checkPage('/bn/profile/', { noindex: true, footer: true, lang: 'bn' });
