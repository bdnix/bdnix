import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// seg.css: a two-way switch of radio buttons, side by side. On a page of
// its own.
test('two choices side by side, half each, and the checked one stands out', async ({ page }) => {
  await openFixture(page, {
    css: ['/assets/css/base.css', '/assets/css/seg.css'],
    body: '<fieldset class="seg"><legend>Mode</legend><label><input type="radio" name="m" checked><span id="one">One</span></label><label><input type="radio" name="m"><span id="two">Two</span></label></fieldset>'
  });
  const one = await page.locator('#one').boundingBox(), two = await page.locator('#two').boundingBox();
  expect(Math.abs(one.y - two.y)).toBeLessThan(1);
  expect(Math.abs(one.width - two.width)).toBeLessThan(1);
  expect(two.x).toBeGreaterThanOrEqual(one.x + one.width - 1);
  const checked = await style(page, '#one', 'background-color');
  expect(checked).not.toBe(await style(page, '#two', 'background-color'));
  await page.locator('#two').click();
  // (after its short transition)
  await expect.poll(() => style(page, '#two', 'background-color')).toBe(checked);
  await fitsScreen(page);
});
