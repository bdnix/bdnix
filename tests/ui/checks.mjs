// The checks every page gets (accessibility, its security policy, analytics,
// search and share tags, layout), the ones every game gets (mute and pause
// buttons, played upright, gamepad, credit line), and the ones every PDF tool
// gets (pdf-lib fetched on demand). Each app calls them for its own page from
// its own tests/ui/<app>.site.spec.mjs, so adding or changing an app runs
// that app's tests and leaves every other app's (and their cached results)
// alone. tests/unit/site.test.mjs checks that every page in scripts/site.mjs
// has its checks.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press } from './games.mjs';
import { upload, numberedPdf } from './pdfs.mjs';

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
const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);
// Other games' names, which only a credit line may use.
const TRADEMARKS = /tetris|pac-?man|flappy|crossy|blockade|breakout/i;

// The checks every page gets. opts:
//   schema    'WebSite' or 'WebApplication' (structured data), or none
//   category  a WebApplication's applicationCategory
//   noindex   kept out of search engines (no minimum description length)
//   footer    has the site's footer
//   game      a game: asks for the phone upright (see checkGame)
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

const PAUSE = 'M4 2h3v12H4zM9 2h3v12H9z';

// The checks every game gets, on top of checkPage(url, { game: true, ... }).
// opts:
//   credit    [the classic that inspired it, who created it], for its credit line
//   gamepad   { dpad: { up, left, right, down }, face: { a, b } }: the names of
//             its on-screen buttons, for a game played with buttons on a phone
export function checkGame(url, opts = {}){
  test(`${url}: the mute and pause buttons in the top bar follow the game`, async ({ page }) => {
    await openGame(page, url);
    const sound = page.locator('#soundBtn');
    await expect(sound).toHaveAttribute('aria-label', 'Mute sound');
    await expect(sound.locator('svg')).toBeVisible();
    const pause = page.locator('#pauseBtn');
    const icon = () => pause.locator('svg path').getAttribute('d');
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(pause).toHaveAttribute('aria-label', 'Pause');
    expect(await icon()).toBe(PAUSE);

    await press(page, 'KeyP');
    await expect(page.locator('#ovTitle')).toHaveText('Paused');
    await expect(pause).toHaveAttribute('aria-label', 'Resume');
    expect(await icon()).not.toBe(PAUSE);

    await pause.click();
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(pause).toHaveAttribute('aria-label', 'Pause');
    expect(await icon()).toBe(PAUSE);
  });

  // Turned sideways, a phone gets a note asking for it to be turned back, and
  // the game pauses. A mouse and keyboard screen is never covered, however
  // short the window: the game carries on, laid out beside its board.
  test(`${url}: turning a phone sideways pauses the game and asks for it upright`, async ({ page }) => {
    const note = page.locator('.upright');
    await openGame(page, url);
    const upright = page.viewportSize();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.locator('#overlay')).toBeHidden();
    await page.clock.runFor(300);
    await expect(note).toBeHidden();

    await page.setViewportSize({ width: 844, height: 390 });
    if (await touch(page)) {
      await expect(note).toBeVisible();
      await expect(note).toContainText('Turn your phone upright');
      await expect(note).toContainText('only work in portrait mode');
      await expect(page.locator('#ovTitle')).toHaveText('Paused');
      await expectNoSideScroll(page);

      // Turned back, the game waits paused until the player resumes it.
      await page.setViewportSize(upright);
      await expect(note).toBeHidden();
      await page.clock.runFor(1000);
      await expect(page.locator('#ovTitle')).toHaveText('Paused');
      await page.locator('#startBtn').click();   // Resume
      await expect(page.locator('#overlay')).toBeHidden();
    } else {
      // A short window on a computer: no note, and the game goes on, with the
      // top bar beside the board and the whole board on screen.
      await page.clock.runFor(300);
      await expect(note).toBeHidden();
      await expect(page.locator('#overlay')).toBeHidden();
      const board = await page.locator('#board').boundingBox();
      expect(board.y).toBeGreaterThanOrEqual(0);
      expect(board.y + board.height).toBeLessThanOrEqual(390);
      const fits = await page.evaluate(() => {
        const word = document.querySelector('.wordmark').getBoundingClientRect();
        const sound = document.getElementById('soundBtn').getBoundingClientRect();
        return word.height < 30 && word.right <= sound.left;
      });
      expect(fits, 'the top bar fits beside the board').toBe(true);
      await expectNoSideScroll(page);
    }
  });

  if (opts.credit) {
    const [name, creator] = opts.credit;
    test(`${url}: credits the classic that inspired it, without claiming any link to it`, async ({ page }) => {
      await page.goto(url);
      const credit = page.locator('#overlay .credit');
      await expect(credit).toBeVisible();
      await expect(credit).toContainText('Inspired by ' + name);
      await expect(credit).toContainText(creator);
      await expect(credit).toContainText(name + ' is a trademark of its owner; bdnix isn’t affiliated with or endorsed by them.');
    });
  }

  if (opts.gamepad) checkGamepad(url, opts.gamepad);
}

// On a phone, a game's buttons are laid out like a gamepad (gamepad.css): a
// D-pad cross on the left and round, named action buttons on the right, or
// the D-pad alone in the middle. On a computer the keys are shown as keycaps.
function checkGamepad(url, g){
  const box = (page, sel) => page.locator(sel).boundingBox();
  const mid = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  test(`${url}: the buttons are laid out like a gamepad`, async ({ page }) => {
    await openGame(page, url);
    if (!(await touch(page))) {
      await expect(page.locator('.touch')).toBeHidden();
      await expect(page.locator('.overlay .only-keys kbd').first()).toBeVisible();
      await expect(page.locator('.overlay .only-keys kbd').getByText('P', { exact: true })).toBeVisible();
      return;
    }
    await expect(page.locator('.overlay .only-keys')).toBeHidden();
    const view = page.viewportSize();
    const board = await box(page, '#board');
    const b = {};
    for (const [pos, name] of Object.entries(g.dpad)) {
      const btn = page.locator(`.touch .dpad .${pos}`);
      await expect(btn).toHaveAttribute('aria-label', name);
      b[pos] = await btn.boundingBox();
      expect(b[pos].width, `${pos} is big enough to press`).toBeGreaterThanOrEqual(44);
      expect(b[pos].height).toBeGreaterThanOrEqual(44);
      expect(b[pos].y, `${pos} is below the board`).toBeGreaterThanOrEqual(board.y + board.height);
      expect(b[pos].y + b[pos].height, `${pos} is on screen`).toBeLessThanOrEqual(view.height);
    }
    // The arms of one cross: left and right level, either side of up and down.
    const l = mid(b.left), r = mid(b.right);
    expect(Math.abs(l.y - r.y)).toBeLessThan(1);
    expect(r.x - l.x).toBeGreaterThan(b.left.width * 1.5);
    if (b.up) {
      const u = mid(b.up), d = mid(b.down);
      expect(Math.abs(u.x - d.x)).toBeLessThan(1);
      expect(Math.abs(u.x - (l.x + r.x) / 2)).toBeLessThan(1);
      expect(u.y).toBeLessThan(l.y);
      expect(d.y).toBeGreaterThan(l.y);
    }

    const pad = await box(page, '.touch .dpad');
    if (g.face) {
      // Round, named action buttons to the right of the D-pad.
      for (const [pos, name] of Object.entries(g.face)) {
        const btn = page.locator(`.touch .face .${pos}`);
        await expect(btn).toHaveAttribute('aria-label', name);
        await expect(btn).toContainText(name);
        const f = await btn.boundingBox();
        expect(f.x).toBeGreaterThan(pad.x + pad.width);
        expect(f.x + f.width).toBeLessThanOrEqual(view.width);
        expect(f.width).toBeGreaterThanOrEqual(56);
        expect(await btn.evaluate((e) => getComputedStyle(e).borderRadius)).toBe('50%');
        b[pos] = f;
      }
      // A sits up and to the right of B, as on a gamepad.
      if (b.b) {
        expect(b.a.x).toBeGreaterThan(b.b.x);
        expect(b.a.y).toBeLessThan(b.b.y);
      }
    } else {
      // A D-pad on its own sits in the middle.
      expect(Math.abs(pad.x + pad.width / 2 - view.width / 2)).toBeLessThan(2);
    }
    await expectNoSideScroll(page);
  });
}

export const PDF_LIB = /\/assets\/vendor\/pdf-lib\.min\.js/;
export const OFFLINE_PDF = 'Couldn’t load the PDF tools. Check your connection and try again.';

// The requests a page makes for files matching `pattern`.
export function watch(page, pattern){
  const seen = [];
  page.on('request', (r) => { if (pattern.test(r.url())) seen.push(r.url()); });
  return seen;
}

// The checks every PDF tool gets: pdf-lib isn't part of the page, but is
// fetched with the first PDF opened, and a failed fetch says so and is tried
// again next time. isOpen(page) waits for what shows once A.pdf is open.
export function checkPdfLib(url, isOpen){
  const pdf = async () => upload('A.pdf', await numberedPdf(100, 2));
  test(`${url}: pdf-lib is fetched with the first PDF`, async ({ page }) => {
    const seen = watch(page, PDF_LIB);
    await page.goto(url);
    expect(await page.evaluate(() => typeof window.PDFLib)).toBe('undefined');
    expect(seen).toEqual([]);
    await page.locator('#picker').setInputFiles([await pdf()]);
    await isOpen(page);
    expect(seen).toEqual([expect.stringContaining('/assets/vendor/pdf-lib.min.js?v=1.17.1')]);
  });

  test(`${url}: says so when pdf-lib can't be fetched, and tries again`, async ({ page }) => {
    await page.route(PDF_LIB, (route) => route.abort());
    await page.goto(url);
    await page.locator('#picker').setInputFiles([await pdf()]);
    await expect(page.locator('#msg')).toHaveText(OFFLINE_PDF);
    await expect(page.locator('script[src*="pdf-lib"]')).toHaveCount(0);   // the failed tag is gone
    await page.unroute(PDF_LIB);
    await page.locator('#picker').setInputFiles([await pdf()]);
    await isOpen(page);
  });
}
