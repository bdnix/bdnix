import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, touch } from '../../../tests/ui/fixture.mjs';

// upright.js: a phone turned sideways gets a note asking for it upright, and
// whatever registered with onTurn() is told (a game pauses). A screen with
// a mouse is never covered. On a page of its own, with game.css's styles.
const open = (page) => openFixture(page, { css: ['/assets/css/base.css', '/assets/css/game.css'], js: ['/assets/js/upright.js'], body: '<main>Game</main>' });
const note = (page) => page.locator('.upright');

test('turned sideways, a phone is covered and the game told; upright again, the note goes', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.turns = 0; window.bdnixUpright.onTurn(() => { window.turns++; }); });
  await expect(note(page)).toBeHidden();
  expect(await page.evaluate(() => window.turns)).toBe(0);
  const upright = page.viewportSize();
  await page.setViewportSize({ width: 844, height: 390 });
  if (await touch(page)) {
    await expect(note(page)).toBeVisible();
    await expect(note(page)).toHaveAttribute('role', 'alert');
    await expect(note(page).getByRole('heading')).toHaveText('Turn your phone upright');
    await expect.poll(() => page.evaluate(() => window.turns)).toBe(1);
    await page.setViewportSize(upright);
    await expect(note(page)).toBeHidden();
  } else {
    await expect(note(page)).toBeHidden();
    expect(await page.evaluate(() => window.turns)).toBe(0);
  }
});

test('a game that starts while the phone is already sideways is told straight away', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await open(page);
  const sideways = await touch(page);
  expect(await page.evaluate(() => { let n = 0; window.bdnixUpright.onTurn(() => { n++; }); return n; })).toBe(sideways ? 1 : 0);
  await expect(note(page)).toBeVisible({ visible: sideways });
});
