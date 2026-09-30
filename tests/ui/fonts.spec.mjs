import { test, expect } from './fixtures.mjs';

// Inter and JetBrains Mono come from assets/fonts, not a font service.
test('the site\'s own fonts load, in every weight the pages use', async ({ page }) => {
  await page.goto('/');
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
  await page.goto('/');
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
