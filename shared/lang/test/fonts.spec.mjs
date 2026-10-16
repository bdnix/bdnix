import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { inLanguage } from '../../../tests/ui/languages.mjs';

// In Bangla, pages add Hind Siliguri for the Bangla letters (bangla.css,
// which lang.js links), from shared/lang/fonts, published at /assets/fonts.
test('Bangla is drawn in the site\'s own Bangla font', async ({ page }) => {
  await page.goto('/');
  // The English pages don't need it.
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Hind')))).toBe(false);
  await inLanguage(page, 'bn');
  await page.goto('/');
  const loaded = await page.evaluate(async () => {
    const faces = ['400 16px "Hind Siliguri"', '600 16px "Hind Siliguri"', '700 16px "Hind Siliguri"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, 'বাংলা')));
    return faces.map((f) => [f, document.fonts.check(f, 'বাংলা')]);
  });
  expect(loaded).toEqual(loaded.map(([f]) => [f, true]));
  expect(await page.locator('h1').evaluate((h) => getComputedStyle(h).fontFamily)).toContain('Hind Siliguri');
});
