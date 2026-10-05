import { test, expect } from './fixtures.mjs';
import { openGame } from './games.mjs';

// On a phone the games' buttons are laid out like a gamepad (gamepad.css);
// checkGame (checks.mjs) checks each game's layout. This checks the buttons
// respond to a press.
const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);

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
