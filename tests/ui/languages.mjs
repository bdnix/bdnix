// For the tests of the site in another language (assets/js/lang.js): the
// visitor's choice, kept in this browser, and what's left in English.
import { expect } from './fixtures.mjs';

// Opens every page after this in language `code`, as if the visitor had
// picked it.
export async function inLanguage(page, code){
  await page.addInitScript((c) => { try { localStorage.setItem('bdnix_lang', c); } catch (e) {} }, code);
}

// The page is in language `code`, with nothing left in English: lang.js
// lists the English it found with no translation, on the page or asked of t().
export async function expectTranslated(page, code = 'bn'){
  await expect(page.locator('html')).toHaveAttribute('lang', code);
  expect(await page.evaluate(() => window.bdnixLang.missing), 'English with no translation').toEqual([]);
}
