import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// page.css: one centred column (the tool pages and the profile page), on a
// page of its own.
const body = (cls) => '<main class="' + cls + '"><p class="kicker">// tools</p><h1>Title</h1><p class="msg" id="msg">Saved.</p><button class="link-btn" type="button">Edit</button><button class="btn" type="button" disabled>Go</button><p hidden id="gone">Gone</p></main>';

test('one centred column, at most 720px wide, or 1040px when wide', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/page.css'], body: body('tool') });
  let col = await page.locator('.tool').boundingBox();
  expect(col.width).toBe(720);
  expect(Math.round(col.x + col.width / 2)).toBe(640);
  await page.locator('.tool').evaluate((m) => m.classList.add('wide'));
  col = await page.locator('.tool').boundingBox();
  expect(col.width).toBe(1040);
});

test('the title is in the gradient, an error message in pink, and hidden things stay hidden', async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/page.css'], body: body('tool') });
  expect(await style(page, '.tool h1', 'background-image')).toMatch(/^linear-gradient/);
  await page.locator('#msg').evaluate((m) => m.classList.add('error'));
  expect(await style(page, '#msg', 'color')).toBe('rgb(244, 114, 182)');
  await expect(page.locator('#gone')).toBeHidden();
  expect(await style(page, '.btn:disabled', 'opacity')).toBe('0.5');
  await fitsScreen(page);
});
