import { checkPage } from './checks.mjs';

// The checks every page gets (see checks.mjs). The profile only shows what's
// saved in the visitor's own browser, so it's kept out of search engines.
checkPage('/profile/', { noindex: true, footer: true });
