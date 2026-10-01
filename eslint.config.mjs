// `npm run lint`. The site's scripts are plain browser scripts: one IIFE each,
// ES5-style, exposing at most one window.bdnix* object (see AGENTS.md). The
// tests and build scripts are Node ES modules.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['assets/vendor/**', 'coverage/**', 'test-results/**', 'playwright-report/**', '.test-cache/**'] },
  js.configs.recommended,
  {
    files: ['assets/js/**/*.js'],
    // The vendored libraries' globals (assets/vendor).
    languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: { ...globals.browser, PDFLib: 'readonly', lamejs: 'readonly', fontkit: 'readonly' } },
    rules: {
      // Storage may be blocked (private browsing), and that's fine: catch (e) {}.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-implicit-globals': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'smart'],
      'no-shadow-restricted-names': 'error'
    }
  },
  {
    files: ['**/*.mjs'],
    // Tests hand functions to page.evaluate(), which run in the browser.
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }]
    }
  }
];
