import { test, expect } from './fixtures.mjs';
import { LIVE } from './checks.mjs';

// checkPage (checks.mjs) checks each page's own title, description, share
// tags and structured data; tests/unit/site.test.mjs checks they're unique
// and that sitemap.xml lists exactly the public pages. This checks what the
// pages share and what search engines are pointed to.
test('the share images exist, at the sizes the tags say', async ({ request }) => {
  for (const [file, width, height] of [['/assets/img/og.png', 1200, 630], ['/assets/img/apple-touch-icon.png', 180, 180]]) {
    const res = await request.get(file);
    expect(res.status(), file).toBe(200);
    const png = await res.body();
    expect(png.subarray(1, 4).toString(), file).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([width, height]);
  }
});

test('robots.txt points to a sitemap of the site\'s public pages', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('User-agent: *');
  expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
  expect(robots).toContain('Sitemap: ' + LIVE + '/sitemap.xml');

  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  expect(locs[0]).toBe(LIVE + '/');
  for (const loc of locs) {
    expect(loc.startsWith(LIVE + '/'), loc).toBe(true);
    expect(loc.slice(LIVE.length)).toMatch(/^\/([a-z0-9-]+\/)?$/);
  }
  expect(locs).not.toContain(LIVE + '/profile/');
});
