import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame } from './games.mjs';

// On a phone the games' buttons are laid out like a gamepad (gamepad.css): a
// D-pad cross on the left and round, named action buttons on the right, or
// the D-pad alone in the middle. On a computer the keys are shown as keycaps.
const games = [
  { url: '/falling-blocks/', dpad: { up: 'Hard drop', left: 'Move left', right: 'Move right', down: 'Soft drop' },
    face: { a: 'Rotate', b: 'Hold' } },
  { url: '/maze-chase/', dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } },
  { url: '/road-hop/', dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } },
  { url: '/snake/', dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } },
  { url: '/brick-bounce/', dpad: { left: 'Left', right: 'Right' }, face: { a: 'Launch' } }
];
const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);
const box = (page, sel) => page.locator(sel).boundingBox();
const mid = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

for (const g of games) {
  test(`${g.url}: the buttons are laid out like a gamepad`, async ({ page }) => {
    await openGame(page, g.url);
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

test('a D-pad arm lights up while it is held', async ({ page }) => {
  await openGame(page, '/brick-bounce/');
  if (!(await touch(page))) return;
  await page.getByRole('button', { name: 'Start game' }).click();
  const left = page.locator('.touch .dpad .left');
  const b = await left.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(left).toHaveClass(/\bon\b/);
  await page.mouse.up();
  await expect(left).not.toHaveClass(/\bon\b/);
});
