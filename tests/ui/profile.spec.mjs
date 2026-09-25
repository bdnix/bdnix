import { test, expect } from './fixtures.mjs';

const scores = (page) => page.locator('.score').evaluateAll((els) => els.map((e) => ({
  game: e.querySelector('span').textContent,
  best: e.querySelector('b').textContent,
  link: e.querySelector('a').textContent + ' ' + e.querySelector('a').getAttribute('href')
})));

test('a new visitor is "User" with no scores yet', async ({ page }) => {
  await page.goto('/profile/');
  await expect(page.locator('h1')).toHaveText('User');
  await expect(page.locator('.avatar-lg')).toHaveText('U');
  expect(await scores(page)).toEqual([
    { game: 'Tetris', best: 'Not played yet', link: 'Play /tetris/' },
    { game: 'Pac-Man', best: 'Not played yet', link: 'Play /pacman/' }
  ]);
});

test('shows the best scores the games saved', async ({ page }) => {
  await page.goto('/profile/');
  await page.evaluate(() => {
    localStorage.setItem('bdnix_tetris_best', '12450');
    localStorage.setItem('bdnix_pacman_best', '3120');
  });
  await page.reload();
  expect(await scores(page)).toEqual([
    { game: 'Tetris', best: '12,450', link: 'Play again /tetris/' },
    { game: 'Pac-Man', best: '3,120', link: 'Play again /pacman/' }
  ]);
});

test('a score saved in another tab shows up straight away', async ({ page, context }) => {
  await page.goto('/profile/');
  const game = await context.newPage();
  await game.goto('/tetris/');
  await game.evaluate(() => localStorage.setItem('bdnix_tetris_best', '20000'));
  await expect(page.locator('.score').first().locator('b')).toHaveText('20,000');
});

test('editing the name saves it and updates the chip elsewhere', async ({ page }) => {
  await page.goto('/profile/');
  await page.getByRole('button', { name: 'Edit name' }).click();
  await expect(page.locator('#nameInput')).toBeFocused();
  await page.locator('#nameInput').fill('  Musa   Rahman ');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('h1')).toHaveText('Musa Rahman');
  await expect(page.locator('.avatar-lg')).toHaveText('M');
  await expect(page.locator('#msg')).toHaveText('Saved. Hi, Musa Rahman!');

  await page.reload();
  await expect(page.locator('h1')).toHaveText('Musa Rahman');
  await page.goto('/merge-pdf/');
  await expect(page.locator('.profile-chip')).toHaveText('MMusa Rahman');
});

test('Escape cancels, an empty name goes back to "User", names stop at 24 characters', async ({ page }) => {
  await page.goto('/profile/');
  const edit = page.getByRole('button', { name: 'Edit name' });
  const input = page.locator('#nameInput');

  await edit.click();
  await input.fill('Nope');
  await input.press('Escape');
  await expect(page.locator('h1')).toHaveText('User');

  await edit.click();
  await input.fill('x'.repeat(40));
  await expect(input).toHaveValue('x'.repeat(24));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('h1')).toHaveText('x'.repeat(24));

  await edit.click();
  await input.fill('   ');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('h1')).toHaveText('User');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_name'))).toBeNull();
});
