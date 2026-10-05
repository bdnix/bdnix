// The checks every game gets, on top of checkPage(url, { game: true, ... })
// from checks.mjs: mute and pause buttons, played upright, a short wide window,
// the credit line and the gamepad. Each game calls checkGame() from its own
// tests/ui/<app>.site.spec.mjs.
import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press } from './games.mjs';

const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);

const PAUSE = 'M4 2h3v12H4zM9 2h3v12H9z';

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
