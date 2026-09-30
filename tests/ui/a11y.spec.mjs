import { test, expect } from './fixtures.mjs';

// What screen reader and keyboard users need from every page.
const pages = [
  '/', '/profile/',
  '/falling-blocks/', '/maze-chase/', '/flap/', '/road-hop/', '/snake/', '/brick-bounce/',
  '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/mp4-to-mp3/',
  '/compress-image/', '/photo-collage/', '/fit-to-frame/'
];

for (const url of pages) {
  test(`${url}: canvases are labelled pictures, and buttons say what they are`, async ({ page }) => {
    await page.goto(url);
    // The backdrop is decoration; every other canvas is a picture with a name.
    const canvases = await page.locator('canvas:not(#bg)').evaluateAll((els) =>
      els.map((c) => ({ id: c.id, role: c.getAttribute('role'), label: c.getAttribute('aria-label') })));
    for (const c of canvases) {
      expect(c.role, `#${c.id} role`).toBe('img');
      expect(c.label, `#${c.id} label`).toBeTruthy();
    }
    await expect(page.locator('canvas#bg')).toHaveAttribute('aria-hidden', 'true');
    // Outside a form a button without a type still works, but saying so keeps
    // one from submitting anything if it ever ends up inside one.
    await expect(page.locator('button:not([type])')).toHaveCount(0);
  });
}
