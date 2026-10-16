import { checkPage } from '../../../tests/ui/checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/', { languages: false, schema: 'WebSite', footer: true });
