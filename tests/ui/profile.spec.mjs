import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { LIVE, TAG, watchGoogle, serveLive } from './checks.mjs';

const scores = (page) => page.locator('.score').evaluateAll((els) => els.map((e) => ({
  game: e.querySelector('span').textContent,
  best: e.querySelector('b').textContent,
  link: e.querySelector('a').textContent + ' ' + e.querySelector('a').getAttribute('href')
})));

// Each game's row: the key its best score is kept under, and the word
// (if any) shown before it.
const rows = (page) => page.locator('.score').evaluateAll((els) => els.map((e) => ({ key: e.dataset.best, label: e.dataset.bestLabel || '' })));

test('a new visitor is "User" with no scores yet', async ({ page }) => {
  await page.goto('/profile/');
  await expect(page.locator('h1')).toHaveText('User');
  await expect(page.locator('.avatar-lg')).toHaveText('U');
  const shown = await scores(page);
  expect(shown.length).toBeGreaterThan(0);
  for (const s of shown) {
    expect(s.best, s.game).toBe('Not played yet');
    expect(s.link, s.game).toMatch(/^Play \/[a-z0-9-]+\/$/);
  }
});

test('shows the best scores the games saved, after the game\'s own word for them', async ({ page }) => {
  await page.goto('/profile/');
  const games = await rows(page);
  expect(games.some((g) => g.label), 'a game with a label for its best').toBe(true);
  await page.evaluate((keys) => keys.forEach((k, i) => localStorage.setItem(k, String(12450 + i))), games.map((g) => g.key));
  await page.reload();
  const shown = await scores(page);
  games.forEach((g, i) => {
    expect(shown[i].best, g.key).toBe((g.label ? g.label + ' ' : '') + (12450 + i).toLocaleString('en-US'));
    expect(shown[i].link, g.key).toMatch(/^Play again \//);
  });
});

test('junk scores count as not played, and the landing page’s visits are counted', async ({ page }) => {
  await page.goto('/profile/');
  await expect(page.locator('#visits')).toHaveText('');
  const [a, b] = await rows(page);
  await page.evaluate(([x, y]) => {
    localStorage.setItem(x, 'abc');
    localStorage.setItem(y, '-5');
    localStorage.setItem('bdnix_visits', '1');
  }, [a.key, b.key]);
  await page.reload();
  expect((await scores(page)).slice(0, 2).map((s) => s.best)).toEqual(['Not played yet', 'Not played yet']);
  await expect(page.locator('#visits')).toHaveText('You’ve visited bdnix once.');
  await page.evaluate(() => localStorage.setItem('bdnix_visits', '1234'));
  await page.reload();
  await expect(page.locator('#visits')).toHaveText('You’ve visited bdnix 1,234 times.');
});

test('a score saved in another tab shows up straight away', async ({ page, context }) => {
  await page.goto('/profile/');
  const [first] = await rows(page);
  const other = await context.newPage();
  await other.goto('/profile/');
  await other.evaluate((k) => localStorage.setItem(k, '20000'), first.key);
  await expect(page.locator('.score').first().locator('b')).toHaveText((first.label ? first.label + ' ' : '') + '20,000');
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

test('the profile page turns analytics on and off', async ({ page }) => {
  const google = watchGoogle(page);
  await serveLive(page);
  await page.goto(LIVE + '/profile/');
  const state = page.locator('#analyticsState');
  const toggle = page.locator('#analyticsBtn');
  await expect(state).toHaveText(/^Off\./);
  await expect(toggle).toHaveText('Turn on');
  await expectNoSideScroll(page);

  // Choosing here answers the banner too.
  await toggle.click();
  await expect(page.locator('.consent')).toHaveCount(0);
  await expect(state).toHaveText(/^On\./);
  await expect(toggle).toHaveText('Turn off');
  await expect(page.locator('#msg')).toHaveText('Analytics cookies turned on. Thanks!');
  await expect.poll(() => google).toEqual([TAG]);

  await toggle.click();
  await expect(state).toHaveText(/^Off\./);
  await expect(page.locator('#msg')).toHaveText('Analytics cookies turned off.');
  const last = await page.evaluate(() => Array.prototype.slice.call(window.dataLayer[window.dataLayer.length - 1]));
  expect(last).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);

  await page.reload();
  await expect(state).toHaveText(/^Off\./);
  await expect(page.locator('.consent')).toHaveCount(0);
  expect(google).toEqual([TAG]);
});

test('answering the banner on the profile page updates the setting there', async ({ page }) => {
  await serveLive(page);
  await page.goto(LIVE + '/profile/');
  await expect(page.locator('#analyticsBtn')).toHaveText('Turn on');
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.locator('#analyticsState')).toHaveText(/^On\./);
  await expect(page.locator('#analyticsBtn')).toHaveText('Turn off');
});
