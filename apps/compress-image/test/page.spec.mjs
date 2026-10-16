import { checkPage } from '../../../tests/ui/checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/compress-image/', { languages: false, schema: 'WebApplication', category: 'MultimediaApplication', footer: true });
