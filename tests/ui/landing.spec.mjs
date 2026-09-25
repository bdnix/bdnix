import { test, expect, expectNoSideScroll } from './fixtures.mjs';

test('shows the games and tools, with no under-construction wording', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('bdnix');
  await expect(page.locator('h1')).toHaveText('Play a little.Get things done.');
  await expect(page.locator('body')).not.toContainText(/under construction|check back soon|being built/i);

  const cards = page.locator('.game-card');
  await expect(cards).toHaveCount(5);
  const links = await cards.evaluateAll((els) => els.map((a) => [a.querySelector('b').textContent, a.getAttribute('href')]));
  expect(links).toEqual([
    ['Tetris', '/play/'], ['Pac-Man', '/pacman/'],
    ['Merge PDFs', '/merge-pdf/'], ['Watermark a PDF', '/watermark-pdf/'], ['Redact a PDF', '/redact-pdf/']
  ]);
  await expectNoSideScroll(page);
});

test('profile chip says "User" until a name is set, and links to the profile', async ({ page }) => {
  await page.goto('/');
  const chip = page.locator('.profile-chip');
  await expect(chip).toHaveText('UUser');
  await expect(chip).toHaveAttribute('href', '/profile/');

  await page.evaluate(() => localStorage.setItem('bdnix_name', 'Musa'));
  await page.reload();
  await expect(chip).toHaveText('MMusa');
  await chip.click();
  await expect(page).toHaveURL(/\/profile\/$/);
});

test('welcome line greets first-time and returning visitors', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#visit')).toHaveText('Welcome! Pick a game or a tool to get started.');
  await page.reload();
  await expect(page.locator('#visit')).toHaveText('Welcome back.');
  await page.evaluate(() => { localStorage.setItem('bdnix_name', 'Musa'); localStorage.setItem('bdnix_visits', '8'); });
  await page.reload();
  await expect(page.locator('#visit')).toHaveText('Welcome back, Musa. Visit #9, you’re a regular now.');
});

for (const path of ['/', '/play/', '/pacman/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/profile/']) {
  test(`${path} fits the screen without scrolling sideways`, async ({ page }) => {
    await page.goto(path);
    await expectNoSideScroll(page);
  });
}

test('every page links its own scripts and styles with a content hash, and they load', async ({ page }) => {
  for (const path of ['/', '/play/', '/pacman/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/profile/']) {
    const failed = [];
    page.on('response', (r) => { if (r.url().includes('/assets/') && r.status() >= 400) failed.push(r.url()); });
    await page.goto(path);
    const own = await page.locator('script[src^="/assets/js/"], link[href^="/assets/css/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('src') || e.getAttribute('href')));
    expect(own.length, `${path} has scripts and styles`).toBeGreaterThan(1);
    for (const url of own) expect(url, path).toMatch(/^\/assets\/(js\/[\w-]+\.js|css\/[\w-]+\.css)\?v=[0-9a-f]{10}$/);
    expect(failed, `${path}: assets that failed to load`).toEqual([]);
  }
});
