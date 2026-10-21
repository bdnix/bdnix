import { checkPage } from '../../../tests/ui/checks.mjs';

// The checks every page gets (see checks.mjs), in English.
checkPage('/learn-chess/', { languages: false, schema: 'WebApplication', category: 'EducationalApplication', footer: true });
