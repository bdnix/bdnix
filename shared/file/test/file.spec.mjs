import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// file.css: a file's name and details, in a bar with its buttons. On a page
// of its own.
test('a long file name is cut short in the bar, beside its buttons', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openFixture(page, {
    css: ['/assets/css/base.css', '/assets/css/file.css'],
    body: '<div class="file-bar panel"><div class="file-info"><span class="file-name">' + 'a-very-long-file-name-'.repeat(8) + '.pdf</span><span class="file-meta">3 pages · 1 MB</span></div><button class="btn" type="button">Change</button></div>'
  });
  expect(await style(page, '.file-name', 'text-overflow')).toBe('ellipsis');
  const name = await page.locator('.file-name').boundingBox();
  const btn = await page.locator('.file-bar .btn').boundingBox();
  expect(name.x + name.width).toBeLessThanOrEqual(btn.x);
  expect(await style(page, '.file-meta', 'font-family')).toMatch(/JetBrains Mono/);
  await fitsScreen(page);
});
