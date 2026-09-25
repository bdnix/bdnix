import { test, expect } from './fixtures.mjs';

for (const [path, title] of [['/play/', 'Tetris'], ['/pacman/', 'Pac-Man']]) {
  test(`${title} loads and starts`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('#ovTitle')).toHaveText(title);
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#score')).toHaveText(/^\d+$/);
  });
}
