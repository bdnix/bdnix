import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// settings.css: a panel of settings, fieldsets with sliders and hints. On a
// page of its own.
test('a settings panel stacks its fieldsets, with full-width sliders and hints', async ({ page }) => {
  await openFixture(page, {
    css: ['/assets/css/base.css', '/assets/css/settings.css'],
    body: '<div class="settings panel"><fieldset><legend class="label">Opacity</legend><input type="range" id="range"></fieldset><fieldset><legend class="label">Size</legend><p class="hint" id="hint">Fine.</p></fieldset></div>'
  });
  expect(await style(page, '.settings', 'flex-direction')).toBe('column');
  expect(await style(page, '.settings fieldset', 'border-top-width')).toBe('0px');
  const range = await page.locator('#range').boundingBox();
  const fieldset = await page.locator('.settings fieldset').first().boundingBox();
  expect(range.width).toBeCloseTo(fieldset.width, 0);
  await page.locator('#hint').evaluate((h) => h.classList.add('error'));
  expect(await style(page, '#hint', 'color')).toBe('rgb(244, 114, 182)');
  await fitsScreen(page);
});
