import { checkPage } from './checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/', { schema: 'WebSite', footer: true });
