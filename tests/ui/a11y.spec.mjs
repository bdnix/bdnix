import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';
import { press } from './games.mjs';
import { upload, numberedPdf } from './pdfs.mjs';

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

// axe checks each page against WCAG 2.1 A and AA. Its colour contrast check
// can't judge text over the site's gradients and translucent panels, so it
// reports those as incomplete rather than as violations.
async function axeProblems(page){
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const url of pages) {
  test(`${url}: axe finds nothing to fix`, async ({ page }) => {
    await page.goto(url);
    expect(await axeProblems(page)).toEqual([]);
  });
}

test('a paused game, and a tool with files in it, pass axe too', async ({ page }) => {
  // Not openGame(): axe needs a running clock, and the snake waits for the
  // first turn before it moves, so nothing happens while axe looks.
  await page.goto('/snake/');
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  expect(await axeProblems(page)).toEqual([]);

  await page.goto('/merge-pdf/');
  await page.locator('#picker').setInputFiles([upload('A.pdf', await numberedPdf(100, 3)), upload('B.pdf', await numberedPdf(200, 2))]);
  await expect(page.locator('.file')).toHaveCount(2);
  expect(await axeProblems(page)).toEqual([]);
});
