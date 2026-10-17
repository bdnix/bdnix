import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// base.css: what every page uses. Its colours, the site's own fonts, the
// top bar, buttons and panels, on a page of its own.
const BODY = [
  '<header class="bar"><a class="wordmark" href="/"><b>bdnix</b><span>// fixture</span></a></header>',
  '<main><p class="label">Label</p><div class="panel" id="panel">Panel</div>',
  '<a class="btn btn-primary" id="primary" href="#">Primary</a> <button class="btn btn-ghost" id="ghost" type="button">Ghost</button></main>'
].join('');

test('the page is dark, in Inter, with the bar, buttons and panels styled', async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css'], body: BODY });
  expect(await style(page, 'html', 'background-color')).toBe('rgb(8, 10, 18)');
  expect(await style(page, 'body', 'color')).toBe('rgb(238, 241, 248)');
  expect(await style(page, 'body', 'font-family')).toMatch(/^Inter,/);
  expect(await style(page, '.bar', 'display')).toBe('flex');
  expect(await style(page, '.wordmark span', 'font-family')).toMatch(/^"JetBrains Mono"/);
  expect(await style(page, '#panel', 'border-radius')).toBe('14px');
  expect(await style(page, '#primary', 'background-image')).toMatch(/^linear-gradient/);
  expect(await style(page, '#ghost', 'display')).toBe('inline-flex');
  expect(await style(page, '.label', 'text-transform')).toBe('uppercase');
  await fitsScreen(page);
});

test('the site\'s own fonts load from /assets/fonts, in every weight', async ({ page }) => {
  const fonts = [];
  page.on('response', (r) => { if (r.url().includes('/assets/fonts/')) fonts.push(r.status()); });
  await openFixture(page, { css: ['/assets/css/base.css'], body: BODY });
  const loaded = await page.evaluate(async () => {
    const faces = ['400 16px Inter', '600 16px Inter', '800 16px Inter', '400 16px "JetBrains Mono"', '600 16px "JetBrains Mono"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, 'bdnix Ąž')));
    return faces.map((f) => [f, document.fonts.check(f, 'bdnix Ąž')]);
  });
  expect(loaded).toEqual(loaded.map(([f]) => [f, true]));
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((s) => s === 200)).toBe(true);
});

// Inter and JetBrains Mono come from assets/fonts, not a font service.
test('the site\'s own fonts load, in every weight the pages use', async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css'], body: BODY });
  const loaded = await page.evaluate(async () => {
    const faces = ['400 16px Inter', '600 16px Inter', '800 16px Inter', '400 16px "JetBrains Mono"', '600 16px "JetBrains Mono"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, 'bdnix Ąž')));
    return faces.map((f) => [f, document.fonts.check(f, 'bdnix Ąž')]);
  });
  expect(loaded).toEqual(loaded.map(([f]) => [f, true]));
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Inter' && f.weight === '800' && f.status === 'loaded'))).toBe(true);
});

// On a phone the page's name after the logo stays on one line, cut short
// before it reaches the buttons beside it, and makes way altogether on the
// narrowest screens; the logo itself is never cut.
test('a long page name in the top bar stays on one line and never runs into the buttons', async ({ page }) => {
  const bar = '<header class="bar"><a class="wordmark" href="/"><b>bdnix</b><span>/ a page with a long name indeed</span></a><button class="btn btn-ghost" id="end" type="button">Buttons beside it</button></header>';
  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 640 });
    await openFixture(page, { css: ['/assets/css/base.css'], body: bar });
    const logo = page.locator('.wordmark b');
    expect(await logo.evaluate((b) => b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().width > 40), `${width}: the whole logo`).toBe(true);
    const end = await page.locator('#end').boundingBox();
    const name = page.locator('.wordmark span');
    if (width < 360) await expect(name).toBeHidden();
    else {
      const box = await name.boundingBox();
      expect(box.height, `${width}: one line`).toBeLessThan(24);
      expect(box.x + box.width, `${width}: clear of the buttons`).toBeLessThanOrEqual(end.x);
      expect(await style(page, '.wordmark span', 'text-overflow')).toBe('ellipsis');
    }
    expect(end.x + end.width).toBeLessThanOrEqual(width);
    await fitsScreen(page);
  }
});
