import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { inLanguage, expectTranslated } from '../../../tests/ui/languages.mjs';

// The site's languages (shared/lang/lang.js), through the landing page and a
// game: the visitor's choice is kept in this browser, and every page follows it.

test('the top bar switches language, and every page follows the choice', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const toBangla = page.getByRole('navigation', { name: 'Language' }).getByRole('button', { name: 'বাংলা' });
  await expect(toBangla).toHaveAttribute('lang', 'bn');
  await expect(toBangla).toHaveAttribute('translate', 'no');
  await toBangla.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.locator('h1')).toHaveText('খেলুন প্রাণ খুলে,কাজ সারুন চোখের পলকে।');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_lang'))).toBe('bn');
  await expectNoSideScroll(page);

  // A game follows it too, and has the switch in its own top bar.
  await page.goto('/snake/');
  await expect(page.locator('#ovTitle')).toHaveText('সাপ');
  await expect(page.getByRole('navigation', { name: 'ভাষা' }).getByRole('button', { name: 'English' })).toBeVisible();
  await expectTranslated(page);

  await page.goto('/merge-pdf/');
  await page.getByRole('navigation', { name: 'ভাষা' }).getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText('Merge PDFs');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_lang'))).toBe('en');
  await page.goto('/snake/');
  await expect(page.locator('#ovTitle')).toHaveText('Snake');
});

test.describe('a browser set to Bangla', () => {
  test.use({ locale: 'bn-BD' });
  test('opens the site in Bangla until the visitor picks another language', async ({ page }) => {
    await page.goto('/');
    await expectTranslated(page);
    expect(await page.evaluate(() => localStorage.getItem('bdnix_lang'))).toBeNull();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('a browser set to a language the site doesn’t have', () => {
  test.use({ locale: 'fr-FR' });
  test('opens the site in English, as does a saved language that’s gone', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await inLanguage(page, 'xx');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText(/Play a little/);
    expect(await page.evaluate(() => window.bdnixLang.lang)).toBe('en');
  });
});

test('a language whose words can’t be fetched leaves the page in English', async ({ page }) => {
  await page.route(/\/assets\/lang\/bn\.js/, (route) => route.abort());
  await inLanguage(page, 'bn');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText(/Play a little/);
  await expect(page.locator('#visit')).toHaveText(/^Welcome/);
});

test('text a page adds later, and its numbers, are translated as it appears', async ({ page }) => {
  await inLanguage(page, 'bn');
  await page.goto('/');
  const shown = await page.evaluate(async () => {
    const p = document.createElement('p');
    p.textContent = 'Games';
    p.title = 'Your profile';
    document.body.appendChild(p);
    const q = document.createElement('p');
    q.innerHTML = 'Mixed <b>and</b> 12';
    q.setAttribute('translate', 'no');
    document.body.appendChild(q);
    const odd = document.createElement('p');
    odd.innerHTML = 'Odd <b>words</b>  here';
    document.body.appendChild(odd);
    await new Promise((r) => setTimeout(r, 0));
    p.textContent = '2026';
    await new Promise((r) => setTimeout(r, 0));
    return [p.textContent, p.title, q.textContent, window.bdnixLang.t('{n} of {total}', { n: 3, total: 'x' })];
  });
  expect(shown).toEqual(['২০২৬', 'আপনার প্রোফাইল', 'Mixed and 12', '৩ of x']);
  // Text with no translation is listed: a paragraph with words in bold as
  // it reads, and a phrase the test asked for.
  expect(await page.evaluate(() => window.bdnixLang.missing)).toEqual(['Odd words here', '{n} of {total}']);
});
