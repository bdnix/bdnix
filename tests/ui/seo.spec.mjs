import { test, expect } from './fixtures.mjs';

const LIVE = 'https://www.bdnix.com';
// Pages search engines should list. The profile only shows what's saved in
// the visitor's own browser, so it's kept out of the index.
const listed = ['/', '/tetris/', '/pacman/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/mp4-to-mp3/', '/compress-image/'];
const pages = [...listed, '/profile/'];

const meta = (page, attr, name) => page.locator(`head meta[${attr}="${name}"]`);

test('every page has a title, description, canonical URL and share tags', async ({ page, request }) => {
  const titles = new Set();
  const descriptions = new Set();
  for (const url of pages) {
    await page.goto(url);
    const title = await page.title();
    expect(title, url).toMatch(/bdnix/);
    expect(title.length, url + ' title length').toBeLessThanOrEqual(60);
    const description = await meta(page, 'name', 'description').getAttribute('content');
    // Long enough for search results to show something useful (the profile isn't listed).
    if (listed.includes(url)) expect(description.length, url + ' description length').toBeGreaterThanOrEqual(70);
    expect(description.length, url + ' description length').toBeLessThanOrEqual(230);
    titles.add(title);
    descriptions.add(description);

    await expect(page.locator('head link[rel="canonical"]'), url).toHaveAttribute('href', LIVE + url);
    await expect(meta(page, 'property', 'og:url'), url).toHaveAttribute('content', LIVE + url);
    await expect(meta(page, 'property', 'og:title'), url).toHaveAttribute('content', title);
    await expect(meta(page, 'property', 'og:description'), url).toHaveAttribute('content', description);
    await expect(meta(page, 'property', 'og:site_name'), url).toHaveAttribute('content', 'bdnix');
    await expect(meta(page, 'property', 'og:type'), url).toHaveAttribute('content', 'website');
    await expect(meta(page, 'property', 'og:image'), url).toHaveAttribute('content', LIVE + '/assets/img/og.png');
    await expect(meta(page, 'property', 'og:image:width'), url).toHaveAttribute('content', '1200');
    await expect(meta(page, 'property', 'og:image:height'), url).toHaveAttribute('content', '630');
    await expect(meta(page, 'property', 'og:image:alt'), url).toHaveAttribute('content', /\w/);
    await expect(meta(page, 'name', 'twitter:card'), url).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('head link[rel="apple-touch-icon"]'), url).toHaveAttribute('href', '/assets/img/apple-touch-icon.png');
    await expect(meta(page, 'name', 'robots'), url).toHaveCount(url === '/profile/' ? 1 : 0);
  }
  expect(titles.size, 'titles are unique').toBe(pages.length);
  expect(descriptions.size, 'descriptions are unique').toBe(pages.length);
  await expect(meta(page, 'name', 'robots')).toHaveAttribute('content', 'noindex');

  // The share images exist, at the sizes the tags say.
  for (const [file, width, height] of [['/assets/img/og.png', 1200, 630], ['/assets/img/apple-touch-icon.png', 180, 180]]) {
    const res = await request.get(file);
    expect(res.status(), file).toBe(200);
    const png = await res.body();
    expect(png.subarray(1, 4).toString(), file).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([width, height]);
  }
});

test('the landing page, games and tools describe themselves as structured data', async ({ page }) => {
  for (const url of listed) {
    await page.goto(url);
    const blocks = await page.locator('head script[type="application/ld+json"]').allTextContents();
    expect(blocks, url).toHaveLength(1);
    const data = JSON.parse(blocks[0]);
    expect(data['@context'], url).toBe('https://schema.org');
    expect(data.url, url).toBe(LIVE + url);
    expect(data.description, url).toBe(await meta(page, 'name', 'description').getAttribute('content'));
    if (url === '/') {
      expect(data['@type']).toBe('WebSite');
      expect(data.name).toBe('bdnix');
    } else {
      expect(data['@type'], url).toBe('WebApplication');
      expect(await page.title(), url).toContain(data.name);
      expect(data.applicationCategory, url).toBe(/tetris|pacman/.test(url) ? 'GameApplication' : /pdf/.test(url) ? 'UtilitiesApplication' : 'MultimediaApplication');
      expect(data.offers, url).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
    }
  }
});

test('robots.txt points to a sitemap that lists every public page', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('User-agent: *');
  expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
  expect(robots).toContain('Sitemap: ' + LIVE + '/sitemap.xml');

  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  expect(locs).toEqual(listed.map((url) => LIVE + url));
});
