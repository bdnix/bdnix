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
    { game: 'Falling Blocks', best: 'Not played yet', link: 'Play /falling-blocks/' },
    { game: 'Maze Chase', best: 'Not played yet', link: 'Play /maze-chase/' },
    { game: 'Flap', best: 'Not played yet', link: 'Play /flap/' },
    { game: 'Road Hop', best: 'Not played yet', link: 'Play /road-hop/' },
    { game: 'Snake', best: 'Not played yet', link: 'Play /snake/' },
    { game: 'Brick Bounce', best: 'Not played yet', link: 'Play /brick-bounce/' }
  ]);
});

test('shows the best scores the games saved', async ({ page }) => {
  await page.goto('/profile/');
  await page.evaluate(() => {
    localStorage.setItem('bdnix_tetris_best', '12450');
    localStorage.setItem('bdnix_pacman_best', '3120');
    localStorage.setItem('bdnix_flappy_best', '27');
    localStorage.setItem('bdnix_hop_best', '42');
    localStorage.setItem('bdnix_snake_best', '57');
    localStorage.setItem('bdnix_bricks_best', '320');
  });
  await page.reload();
  expect(await scores(page)).toEqual([
    { game: 'Falling Blocks', best: '12,450', link: 'Play again /falling-blocks/' },
    { game: 'Maze Chase', best: '3,120', link: 'Play again /maze-chase/' },
    { game: 'Flap', best: '27', link: 'Play again /flap/' },
    { game: 'Road Hop', best: '42', link: 'Play again /road-hop/' },
    { game: 'Snake', best: '57', link: 'Play again /snake/' },
    { game: 'Brick Bounce', best: '320', link: 'Play again /brick-bounce/' }
  ]);
});

test('junk scores count as not played, and the landing page’s visits are counted', async ({ page }) => {
  await page.goto('/profile/');
  await expect(page.locator('#visits')).toHaveText('');
  await page.evaluate(() => {
    localStorage.setItem('bdnix_tetris_best', 'abc');
    localStorage.setItem('bdnix_pacman_best', '-5');
    localStorage.setItem('bdnix_visits', '1');
  });
  await page.reload();
  expect((await scores(page)).slice(0, 2).map((s) => s.best)).toEqual(['Not played yet', 'Not played yet']);
  await expect(page.locator('#visits')).toHaveText('You’ve visited bdnix once.');
  await page.evaluate(() => localStorage.setItem('bdnix_visits', '1234'));
  await page.reload();
  await expect(page.locator('#visits')).toHaveText('You’ve visited bdnix 1,234 times.');
});

test('a score saved in another tab shows up straight away', async ({ page, context }) => {
  await page.goto('/profile/');
  const game = await context.newPage();
  await game.goto('/falling-blocks/');
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

test('works without storage, showing no scores', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get(){ throw new Error('blocked'); } });
  });
  await page.goto('/profile/');
  await expect(page.locator('h1')).toHaveText('User');
  expect((await scores(page)).every((s) => s.best === 'Not played yet')).toBe(true);
  await expect(page.locator('#visits')).toHaveText('');
});
