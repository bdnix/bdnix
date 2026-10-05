import { test, expect, takeCspViolations } from './fixtures.mjs';

// Every page carries a content security policy (written by scripts/build.mjs
// from scripts/parts.mjs); checkPage (checks.mjs) checks each page's. The
// fixture fails any test in which the policy blocks something, so every other
// spec checks the policy lets the site work. This checks it stops what it's for.
test('scripts injected into a page don\'t run, and scripts from elsewhere don\'t load', async ({ page }) => {
  await page.goto('/merge-pdf/');
  const ran = await page.evaluate(() => new Promise((resolve) => {
    const inline = document.createElement('script');
    inline.textContent = 'window.injected = true';
    document.head.appendChild(inline);
    const remote = document.createElement('script');
    remote.src = 'https://evil.example/steal.js';
    remote.onerror = () => resolve({ inline: !!window.injected, remote: 'blocked' });
    remote.onload = () => resolve({ inline: !!window.injected, remote: 'loaded' });
    document.head.appendChild(remote);
  }));
  expect(ran).toEqual({ inline: false, remote: 'blocked' });
  const blocked = takeCspViolations(page);
  expect(blocked.some((m) => /inline script/i.test(m))).toBe(true);
  expect(blocked.some((m) => m.includes('https://evil.example/steal.js'))).toBe(true);
});
