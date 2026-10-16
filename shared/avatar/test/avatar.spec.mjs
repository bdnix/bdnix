import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style } from '../../../tests/ui/fixture.mjs';

// avatar.css: the visitor's initial in a circle, on a page of its own.
test('the initial sits in a 28px circle of the site\'s gradient', async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/avatar.css'], body: '<span class="avatar">U</span>' });
  const box = await page.locator('.avatar').boundingBox();
  expect([box.width, box.height]).toEqual([28, 28]);
  expect(await style(page, '.avatar', 'border-radius')).toBe('50%');
  expect(await style(page, '.avatar', 'background-image')).toMatch(/^linear-gradient/);
  expect(await style(page, '.avatar', 'justify-content')).toBe('center');
});
