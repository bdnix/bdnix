import { checkPage } from './checks.mjs';

// The checks every page gets (see checks.mjs).
checkPage('/compress-image/', { schema: 'WebApplication', category: 'MultimediaApplication', footer: true });
