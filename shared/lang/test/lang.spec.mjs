import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { openFixture } from '../../../tests/ui/fixture.mjs';
import { inLanguage, expectTranslated } from '../../../tests/ui/languages.mjs';

// lang.js on a page of its own: the language switch, the visitor's choice
// kept in this browser, the browser's language, a pack that can't be fetched,
// and text a page adds later. The page's Bangla pack is made up here, so this
// tests lang.js and not any module's translations (Fixture is the page's title).
const WORDS = { Fixture: 'ফিক্সচার', Hello: 'হ্যালো', Games: 'গেম', 'Your profile': 'আপনার প্রোফাইল', Language: 'ভাষা' };
async function open(page, { words = WORDS } = {}){
  await page.route(/\/assets\/lang\/bn\.js/, (route) => route.fulfill({
    contentType: 'text/javascript; charset=utf-8', body: `window.bdnixLang.pack(${JSON.stringify(words)});`
  }));
  await openFixture(page, {
    css: ['/assets/css/base.css', '/assets/css/lang.css'],
    js: ['/assets/js/lang.js'],
    body: '<header class="bar"><nav class="langs" aria-label="Language" data-languages></nav></header><main><h1>Hello</h1></main>'
  });
}
const h1 = (page) => page.locator('h1');

test('the top bar switches language, and the next page follows the choice', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const toBangla = page.getByRole('navigation', { name: 'Language' }).getByRole('button', { name: 'বাংলা' });
  await expect(toBangla).toHaveAttribute('lang', 'bn');
  await expect(toBangla).toHaveAttribute('translate', 'no');
  await toBangla.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(h1(page)).toHaveText('হ্যালো');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_lang'))).toBe('bn');
  await expectNoSideScroll(page);

  // Another page follows it, and switches back.
  await open(page);
  await expect(h1(page)).toHaveText('হ্যালো');
  await expectTranslated(page);
  await page.getByRole('navigation', { name: 'ভাষা' }).getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(h1(page)).toHaveText('Hello');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_lang'))).toBe('en');
  await open(page);
  await expect(h1(page)).toHaveText('Hello');
});

test.describe('a browser set to Bangla', () => {
  test.use({ locale: 'bn-BD' });
  test('opens in Bangla until the visitor picks another language', async ({ page }) => {
    await open(page);
    await expect(h1(page)).toHaveText('হ্যালো');
    expect(await page.evaluate(() => localStorage.getItem('bdnix_lang'))).toBeNull();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('a browser set to a language the site doesn’t have', () => {
  test.use({ locale: 'fr-FR' });
  test('opens in English, as does a saved language that’s gone', async ({ page }) => {
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await inLanguage(page, 'xx');
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(h1(page)).toHaveText('Hello');
    expect(await page.evaluate(() => window.bdnixLang.lang)).toBe('en');
  });
});

test('a language whose words can’t be fetched leaves the page in English', async ({ page }) => {
  await inLanguage(page, 'bn');
  await open(page);
  await page.unroute(/\/assets\/lang\/bn\.js/);
  await page.route(/\/assets\/lang\/bn\.js/, (route) => route.abort());
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(h1(page)).toHaveText('Hello');
});

test('text a page adds later, and its numbers, are translated as it appears', async ({ page }) => {
  await inLanguage(page, 'bn');
  await open(page);
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

// In Bangla, lang.js links bangla.css, with Kalpurush (Avro's) for the
// Bangla letters, from assets/fonts.
test('Bangla is drawn in the site\'s own Bangla font, and English pages don\'t load it', async ({ page, request }) => {
  await open(page);
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Kalpurush')))).toBe(false);
  await inLanguage(page, 'bn');
  await open(page);
  const loaded = await page.evaluate(async () => {
    const faces = ['400 16px Kalpurush', '600 16px Kalpurush', '700 16px Kalpurush'];
    await Promise.all(faces.map((f) => document.fonts.load(f, '১২৩ বাংলা')));
    return faces.map((f) => [f, document.fonts.check(f, '১২৩ বাংলা')]);
  });
  expect(loaded).toEqual(loaded.map(([f]) => [f, true]));
  expect(await page.evaluate(() => [...document.fonts].filter((f) => f.family === 'Kalpurush').map((f) => f.status))).toEqual(['loaded']);
  expect(await h1(page).evaluate((h) => getComputedStyle(h).fontFamily)).toContain('Kalpurush');
  // It's served as the TrueType font it is.
  const res = await request.get('/assets/fonts/kalpurush.ttf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('font/ttf');
});
