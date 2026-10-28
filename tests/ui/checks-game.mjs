// The checks every game gets, on top of checkPage(url, { game: true, ... })
// from checks.mjs: the top bar's mute button and languages, pausing when the
// page is left, played upright, a short wide window, the credit line and the
// touch gestures. Each game calls checkGame() from its page target
// (test/page.spec.mjs), and checkGameLanguages() from its i18n target.
import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press } from './games.mjs';
import { inLanguage, expectTranslated } from './languages.mjs';

const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);

// opts:
//   credit    [the classic that inspired it, who created it], for its credit line
//   gestures  [[what, how], ...]: the touch gestures an arcade game is played
//             with on a phone ([['Move', 'drag'], ['Rotate', 'tap']]), in order
//   languages false for a module's game, whose own i18n target calls
//             checkGameLanguages(url) instead
//   upright   false for a game that may be played with a phone sideways
//             (AGENTS.md): it's checked to fill the screen either way instead
export function checkGame(url, opts = {}){
  // The top bar has the mute button and the language switch, and no pause
  // button: P or Esc pauses, and so does leaving the page, which then shows
  // the pause screen with its big Resume button when the visitor comes back.
  test(`${url}: the top bar has mute and the languages, and leaving the page pauses the game`, async ({ page }) => {
    await openGame(page, url);
    const sound = page.locator('.bar #soundBtn');
    await expect(sound).toHaveAttribute('aria-label', 'Mute sound');
    await expect(sound.locator('svg')).toBeVisible();
    await expect(page.locator('#pauseBtn')).toHaveCount(0);
    const langs = page.locator('.bar').getByRole('navigation', { name: 'Language' });
    await expect(langs.getByRole('button', { name: 'বাংলা' })).toBeVisible();
    await expectNoSideScroll(page);

    const title = page.locator('#ovTitle');
    const resume = page.locator('#startBtn');
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.locator('#overlay')).toBeHidden();
    await press(page, 'KeyP');
    await expect(title).toHaveText('Paused');
    await expect(resume).toHaveText('Resume');
    await resume.click();
    await expect(page.locator('#overlay')).toBeHidden();

    // Another window or app takes the focus.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(title).toHaveText('Paused');
    await page.clock.runFor(1000);
    await expect(resume).toBeVisible();
    await resume.click();
    await expect(page.locator('#overlay')).toBeHidden();

    // Another tab, or the phone's home screen.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(title).toHaveText('Paused');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(1000);
    await expect(title).toHaveText('Paused');   // still waiting for Resume
    await resume.click();
    await expect(page.locator('#overlay')).toBeHidden();
  });

  // Turned sideways, a phone gets a note asking for it to be turned back, and
  // the game pauses. A mouse and keyboard screen is never covered, however
  // short the window: the game carries on, laid out beside its board.
  if (opts.upright !== false) test(`${url}: turning a phone sideways pauses the game and asks for it upright`, async ({ page }) => {
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
        const langs = document.querySelector('.bar .langs').getBoundingClientRect();
        const sound = document.getElementById('soundBtn').getBoundingClientRect();
        return word.height < 30 && word.right <= langs.left && langs.right <= sound.left;
      });
      expect(fits, 'the top bar fits beside the board').toBe(true);
      await expectNoSideScroll(page);
    }
  });

  // A game played either way up: turned sideways, nothing covers it, it
  // carries on, and it fills the screen.
  if (opts.upright === false) test(`${url}: turned sideways, the game carries on and fills the screen`, async ({ page }) => {
    await openGame(page, url);
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.locator('#overlay')).toBeHidden();
    await page.clock.runFor(300);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.clock.runFor(300);
    await expect(page.locator('.upright')).toHaveCount(0);
    await expect(page.locator('#overlay')).toBeHidden();
    const board = await page.locator('#board').boundingBox();
    expect(board).toEqual({ x: 0, y: 0, width: 844, height: 390 });
    await expectNoSideScroll(page);
  });

  // On a phone with the browser's bars showing (360 × 640), the start card
  // fits whole: nothing on it is cut off, off screen or left for scrolling.
  test(`${url}: on a small phone the start card fits whole`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page, url);
    if (!(await touch(page))) return;
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();
    const fits = await overlay.evaluate((o) => {
      const card = o.getBoundingClientRect();
      const out = [...o.querySelectorAll('*')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
        .filter((e) => { const r = e.getBoundingClientRect(); return r.top < card.top - 1 || r.bottom > card.bottom + 1 || r.left < 0 || r.right > innerWidth; })
        .map((e) => e.id || e.className || e.tagName);
      return { scrolls: o.scrollHeight > o.clientHeight + 1, out, bottom: card.bottom <= innerHeight + 1 };
    });
    expect(fits).toEqual({ scrolls: false, out: [], bottom: true });
    await expectNoSideScroll(page);
  });

  if (opts.languages !== false) checkGameLanguages(url, opts);

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

  if (opts.gestures) checkGestures(url, opts.gestures);
}

// The game in the site's other languages: the switch in the top bar, and
// playing it in each. Part of checkGame(), unless a module's game tests its
// languages on their own. opts: { upright: false } as for checkGame().
export function checkGameLanguages(url, opts = {}){
  // The switch in the top bar shows the game in another language.
  test(`${url}: the language switch in the top bar shows the game in Bangla`, async ({ page }) => {
    await openGame(page, url);
    await page.locator('.bar').getByRole('button', { name: 'বাংলা' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expect(page.locator('.bar').getByRole('navigation', { name: 'ভাষা' }).getByRole('button', { name: 'English' })).toBeVisible();
    await expectTranslated(page, 'bn');
  });

  // In every language the site has: the game, left to itself for a while
  // (some end on their own), its pause screen and the note asking for a
  // phone upright, with nothing left in English.
  test(`${url}: in every language, playing it leaves nothing in English`, async ({ page }) => {
    await page.goto(url);
    const languages = await page.evaluate(() => window.bdnixLang.languages.map((l) => l.code).filter((c) => c !== 'en'));
    for (const code of languages) {
      await inLanguage(page, code);
      await openGame(page, url);
      await page.locator('#startBtn').click();
      await page.clock.runFor(20_000);
      await expectTranslated(page, code);
      if (await page.locator('#overlay').isHidden()) {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(page.locator('#overlay')).toBeVisible();
        await expect(page.locator('#ovTitle')).not.toHaveText('Paused');
      }
      await expectTranslated(page, code);
      if (opts.upright !== false && await touch(page)) {
        await page.setViewportSize({ width: 844, height: 390 });
        await expect(page.locator('.upright')).toBeVisible();
        await expect(page.locator('.upright')).not.toContainText('Turn your phone upright');
        await expectTranslated(page, code);
      }
    }
  });
}

// On a phone, a game has no buttons under its board: it's played by touching
// the screen, and its start and pause screens show how, in one row
// (gestures.css), with a tap on the score to pause, since a phone has no P
// key. On a computer the keys are shown as keycaps.
function checkGestures(url, gestures){
  test(`${url}: on a phone it's played by touch, shown on its start and pause screens, and tapping the score pauses it`, async ({ page }) => {
    await openGame(page, url);
    const list = page.locator('#overlay').getByRole('list', { name: 'Touch controls' });
    await expect(page.locator('.touch')).toHaveCount(0);
    if (!(await touch(page))) {
      await expect(list).toBeHidden();
      await expect(page.locator('.overlay .only-keys kbd').first()).toBeVisible();
      await expect(page.locator('.overlay .only-keys kbd').getByText('P', { exact: true })).toBeVisible();
      return;
    }
    await expect(page.locator('.overlay .only-keys')).toBeHidden();
    const items = list.getByRole('listitem');
    await expect(items).toHaveCount(gestures.length);
    for (const [i, [what, how]] of gestures.entries()) {
      await expect(items.nth(i).locator('b')).toHaveText(what);
      await expect(items.nth(i).locator('span')).toHaveText(how);
    }
    const hint = page.locator('#overlay').getByText('Tap the score to pause.');
    await expect(hint).toBeVisible();
    await expectNoSideScroll(page);

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.locator('#overlay')).toBeHidden();
    await page.clock.runFor(300);
    await page.locator('.stats').tap();
    await expect(page.locator('#ovTitle')).toHaveText('Paused');
    await expect(list).toBeVisible();
    await expect(hint).toBeVisible();
    await page.locator('#startBtn').click();   // Resume
    await expect(page.locator('#overlay')).toBeHidden();
  });
}
