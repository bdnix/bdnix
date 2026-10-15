import { test, expect } from './fixtures.mjs';
import { inLanguage } from './languages.mjs';

// Inter and JetBrains Mono come from assets/fonts, not a font service. Every
// page links base.css and the same preloads, so one page stands for them all.
test('the site\'s own fonts load, in every weight the pages use', async ({ page }) => {
  await page.goto('/merge-pdf/');
  const loaded = await page.evaluate(async () => {
    const faces = ['400 16px Inter', '600 16px Inter', '800 16px Inter', '400 16px "JetBrains Mono"', '600 16px "JetBrains Mono"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, 'bdnix Ąž')));
    return faces.map((f) => [f, document.fonts.check(f, 'bdnix Ąž')]);
  });
  expect(loaded).toEqual(loaded.map(([f]) => [f, true]));
  // The headline really is drawn in Inter, not the fallback.
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Inter' && f.weight === '800' && f.status === 'loaded'))).toBe(true);
});

test('the preloaded fonts are the ones the stylesheet asks for', async ({ page, request }) => {
  await page.goto('/merge-pdf/');
  const preloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll((els) => els.map((l) => l.getAttribute('href')));
  expect(preloads.length).toBeGreaterThan(0);
  const css = await (await request.get('/assets/css/base.css')).text();
  for (const href of preloads) {
    expect(css, href).toContain(`url(${href})`);
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    expect(res.headers()['content-type'], href).toBe('font/woff2');
  }
});

// In Bangla, pages add Hind Siliguri for the Bangla letters (bangla.css,
// which lang.js links), also from assets/fonts.
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
