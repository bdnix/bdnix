// The checks every page gets: accessibility, its security policy, analytics,
// search and share tags, layout. Each app calls them for its own page from its
// own tests/ui/<app>.site.spec.mjs, so adding or changing an app runs that
// app's tests and leaves every other app's (and their cached results) alone;
// tests/unit/site.test.mjs checks that every page in scripts/site.mjs has its
// checks. Games add checks-game.mjs, PDF tools checks-pdf.mjs, so a change to
// one kind's checks only runs that kind's specs.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectNoSideScroll } from './fixtures.mjs';

export const LIVE = 'https://www.bdnix.com';
export const GA = 'G-67D1H8GX6X';
export const TAG = `https://www.googletagmanager.com/gtag/js?id=${GA}`;

// axe checks a page against WCAG 2.1 A and AA. Its colour contrast check
// can't judge text over the site's gradients and translucent panels, so it
// reports those as incomplete rather than as violations.
export async function axeProblems(page){
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

// Records every request to Google (the fixture aborts them, so nothing is sent).
export function watchGoogle(page){
  const urls = [];
  page.on('request', (r) => { if (/googletagmanager|google-analytics/.test(r.url())) urls.push(r.url()); });
  return urls;
}

// Serves the local site as www.bdnix.com, so analytics.js treats it as live.
export async function serveLive(page){
  const local = test.info().project.use.baseURL;
  await page.route(/^https:\/\/www\.bdnix\.com\//, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(LIVE, local) });
    await route.fulfill({ response });
  });
}

const meta = (page, attr, name) => page.locator(`head meta[${attr}="${name}"]`);
// Other games' names, which only a credit line may use.
const TRADEMARKS = /tetris|pac-?man|flappy|crossy|blockade|breakout/i;

// The checks every page gets. opts:
//   schema    'WebSite' or 'WebApplication' (structured data), or none
//   category  a WebApplication's applicationCategory
//   noindex   kept out of search engines (no minimum description length)
//   footer    has the site's footer
//   game      a game: asks for the phone upright (see checks-game.mjs)
export function checkPage(url, opts = {}){
  test(`${url}: its head has the security policy first, analytics, and search and share tags`, async ({ page, request }) => {
    const google = watchGoogle(page);
    await page.goto(url);

    // The content security policy comes before anything is loaded (written
    // by scripts/build.mjs from scripts/parts.mjs).
    const head = await page.locator('head > *').evaluateAll((els) => els.map((e) => ({
      tag: e.tagName, csp: e.getAttribute('http-equiv') === 'Content-Security-Policy', data: e.type === 'application/ld+json'
    })));
    const at = head.findIndex((h) => h.csp);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(head.findIndex((h) => (h.tag === 'LINK' || h.tag === 'SCRIPT') && !h.data));
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");

    // Google Analytics is linked, and stays off away from the live site.
    await expect(page.locator('head script[src^="/assets/js/analytics.js"]')).toHaveCount(1);
    expect(await page.evaluate(() => [window.bdnixAnalytics.id, window.bdnixAnalytics.live])).toEqual([GA, false]);
    expect(await page.evaluate(() => [typeof window.gtag, typeof window.dataLayer])).toEqual(['undefined', 'undefined']);
    await expect(page.locator('.consent')).toHaveCount(0);
    expect(google).toEqual([]);

    // Title, description, canonical URL and share tags.
    const title = await page.title();
    expect(title).toMatch(/bdnix/);
    expect(title.length, 'title length').toBeLessThanOrEqual(60);
    const description = await meta(page, 'name', 'description').getAttribute('content');
    // Long enough for search results to show something useful.
    if (!opts.noindex) expect(description.length, 'description length').toBeGreaterThanOrEqual(70);
    expect(description.length, 'description length').toBeLessThanOrEqual(230);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', LIVE + url);
    await expect(meta(page, 'property', 'og:url')).toHaveAttribute('content', LIVE + url);
    await expect(meta(page, 'property', 'og:title')).toHaveAttribute('content', title);
    await expect(meta(page, 'property', 'og:description')).toHaveAttribute('content', description);
    await expect(meta(page, 'property', 'og:site_name')).toHaveAttribute('content', 'bdnix');
    await expect(meta(page, 'property', 'og:type')).toHaveAttribute('content', 'website');
    await expect(meta(page, 'property', 'og:image')).toHaveAttribute('content', LIVE + '/assets/img/og.png');
    await expect(meta(page, 'property', 'og:image:width')).toHaveAttribute('content', '1200');
    await expect(meta(page, 'property', 'og:image:height')).toHaveAttribute('content', '630');
    await expect(meta(page, 'property', 'og:image:alt')).toHaveAttribute('content', /\w/);
    await expect(meta(page, 'name', 'twitter:card')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/assets/img/apple-touch-icon.png');
    if (opts.noindex) await expect(meta(page, 'name', 'robots')).toHaveAttribute('content', 'noindex');
    else await expect(meta(page, 'name', 'robots')).toHaveCount(0);

    // Structured data describing the page.
    const blocks = await page.locator('head script[type="application/ld+json"]').allTextContents();
    if (!opts.schema) {
      expect(blocks).toEqual([]);
    } else {
      expect(blocks).toHaveLength(1);
      const data = JSON.parse(blocks[0]);
      expect(data['@context']).toBe('https://schema.org');
      expect(data['@type']).toBe(opts.schema);
      expect(data.url).toBe(LIVE + url);
      expect(data.description).toBe(description);
      if (opts.schema === 'WebSite') expect(data.name).toBe('bdnix');
      else {
        expect(title).toContain(data.name);
        expect(data.applicationCategory).toBe(opts.category);
        expect(data.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
      }
    }

    // Other games' names only ever appear in a credit line. Asset paths such
    // as /assets/js/tetris.js and storage keys such as bdnix_tetris_best are
    // internal, so they're left out.
    const html = (await (await request.get(url)).text()).replace(/\/assets\/[\w./-]+/g, '').replace(/\bbdnix_[a-z]+_best\b/g, '');
    expect(html.replace(/<p class="credit">[^<]*<\/p>/g, '')).not.toMatch(TRADEMARKS);
  });

  test(`${url}: its body is accessible, fits a phone and loads its own hashed files`, async ({ page }) => {
    const failed = [];
    page.on('response', (r) => { if (r.url().includes('/assets/') && r.status() >= 400) failed.push(r.url()); });
    await page.goto(url);

    // The backdrop is decoration; every other canvas is a picture with a name.
    const canvases = await page.locator('canvas:not(#bg)').evaluateAll((els) =>
      els.map((c) => ({ id: c.id, role: c.getAttribute('role'), label: c.getAttribute('aria-label') })));
    for (const c of canvases) {
      expect(c.role, `#${c.id} role`).toBe('img');
      expect(c.label, `#${c.id} label`).toBeTruthy();
    }
    await expect(page.locator('canvas#bg')).toHaveAttribute('aria-hidden', 'true');
    // Outside a form a button without a type still works, but saying so keeps
    // one from submitting anything if it ever ends up inside one.
    await expect(page.locator('button:not([type])')).toHaveCount(0);
    expect(await axeProblems(page)).toEqual([]);

    // Other games' names stay out of what the page shows, but for credit lines.
    const text = await page.locator('body').evaluate((b) => {
      const copy = b.cloneNode(true);
      copy.querySelectorAll('.credit').forEach((c) => c.remove());
      return copy.innerText;
    });
    expect(text).not.toMatch(TRADEMARKS);

    // The site's own scripts and styles carry a hash of their contents, and load.
    const own = await page.locator('script[src^="/assets/js/"], link[href^="/assets/css/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('src') || e.getAttribute('href')));
    expect(own.length).toBeGreaterThan(1);
    for (const file of own) expect(file).toMatch(/^\/assets\/(js\/[\w-]+\.js|css\/[\w-]+\.css)\?v=[0-9a-f]{10}$/);
    expect(failed, 'assets that failed to load').toEqual([]);

    if (opts.footer) {
      const foot = page.locator('footer.foot');
      await expect(foot.getByRole('link', { name: 'Open source on GitHub' })).toHaveAttribute('href', 'https://github.com/bdnix/bdnix');
      await expect(foot.getByRole('link', { name: 'Suggest a tool or game' })).toHaveAttribute('href', '/#suggest');
      await expect(foot.getByRole('link', { name: 'root@bdnix.com' })).toHaveAttribute('href', 'mailto:root@bdnix.com');
    }
    await expectNoSideScroll(page);

    // Only the games ask for a phone to be held upright (upright.js).
    if (!opts.game) {
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.locator('.upright')).toHaveCount(0);
    }
  });

  test(`${url}: on the live site it asks before analytics, and contacts nothing but bdnix.com`, async ({ page }) => {
    await serveLive(page);
    const elsewhere = [];
    page.on('request', (r) => { if (!r.url().startsWith(LIVE + '/') && !r.url().startsWith('data:')) elsewhere.push(r.url()); });
    await page.goto(LIVE + url);
    await page.evaluate(() => document.fonts.ready);
    const banner = page.getByRole('region', { name: 'Cookie consent' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Google Analytics cookies');
    await expect(banner.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Decline' })).toBeVisible();
    await expect(banner.getByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/profile/');
    await expectNoSideScroll(page);
    expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
    expect(elsewhere).toEqual([]);
  });
}

// The requests a page makes for files matching `pattern`.
export function watch(page, pattern){
  const seen = [];
  page.on('request', (r) => { if (pattern.test(r.url())) seen.push(r.url()); });
  return seen;
}
