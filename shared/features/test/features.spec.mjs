import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// features.css: a tool's short list of what it does, under its lede. On a
// page of its own.
test('the features are a list under the lede, in muted text with bold words bright', async ({ page }) => {
  await openFixture(page, {
    css: ['/assets/css/base.css', '/assets/css/features.css'],
    body: '<p class="lede">What it does.</p><ul class="features"><li><b>Private.</b> Nothing uploaded.</li><li>Uses <code>WebP</code>.</li></ul>'
  });
  expect(await style(page, '.features', 'flex-direction')).toBe('column');
  expect(await style(page, '.features', 'color')).toBe('rgb(142, 151, 171)');
  expect(await style(page, '.features b', 'color')).toBe('rgb(238, 241, 248)');
  expect(await style(page, '.lede', 'margin-bottom')).toBe('14px');
  await fitsScreen(page);
});
