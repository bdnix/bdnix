import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen } from '../../../tests/ui/fixture.mjs';

// footer.css: the footer of the landing, tool and profile pages, on a page
// of its own. (What it says comes from the build, scripts/parts.mjs.)
const BODY = '<footer class="foot"><span>© 2026 bdnix · <a href="https://github.com/bdnix/bdnix">Open source on GitHub</a></span><span class="foot-links"><a href="/about/">About</a><a href="/#suggest">Suggest a tool or game</a><a href="mailto:root@bdnix.com">root@bdnix.com</a></span></footer>';

test('the footer spreads its two halves apart, and wraps on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/footer.css'], body: BODY });
  expect(await style(page, '.foot', 'font-family')).toMatch(/JetBrains Mono/);
  let [a, b] = await Promise.all([page.locator('.foot > span').first().boundingBox(), page.locator('.foot-links').boundingBox()]);
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  await page.setViewportSize({ width: 320, height: 800 });
  [a, b] = await Promise.all([page.locator('.foot > span').first().boundingBox(), page.locator('.foot-links').boundingBox()]);
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  await fitsScreen(page);
});
