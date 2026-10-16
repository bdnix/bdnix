import { checkPage } from '../../../tests/ui/checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/about/', { languages: false, footer: true });
