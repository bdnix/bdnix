import fs from 'node:fs';
import { test, expect, expectNoSideScroll } from './fixtures.mjs';

test('shows the games and tools, with no under-construction wording', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('bdnix — Free browser games and PDF, audio and image tools');
  await expect(page.locator('h1')).toHaveText('Play a little.Get things done.');
  await expect(page.locator('body')).not.toContainText(/under construction|check back soon|being built/i);

  const cards = page.locator('.game-card');
  await expect(cards).toHaveCount(13);
  const links = await cards.evaluateAll((els) => els.map((a) => [a.querySelector('b').textContent, a.getAttribute('href')]));
  expect(links).toEqual([
    ['Falling Blocks', '/falling-blocks/'], ['Maze Chase', '/maze-chase/'], ['Flap', '/flap/'], ['Road Hop', '/road-hop/'], ['Snake', '/snake/'], ['Brick Bounce', '/brick-bounce/'],
    ['Merge PDFs', '/merge-pdf/'], ['Watermark a PDF', '/watermark-pdf/'], ['Redact a PDF', '/redact-pdf/'], ['MP4 to MP3', '/mp4-to-mp3/'],
    ['Compress Images', '/compress-image/'], ['Photo Collage', '/photo-collage/'], ['Fit to Frame', '/fit-to-frame/']
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

for (const path of ['/', '/falling-blocks/', '/maze-chase/', '/flap/', '/road-hop/', '/snake/', '/brick-bounce/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/mp4-to-mp3/', '/compress-image/', '/photo-collage/', '/fit-to-frame/', '/profile/']) {
  test(`${path} fits the screen without scrolling sideways`, async ({ page }) => {
    await page.goto(path);
    await expectNoSideScroll(page);
  });
}

test('every page links its own scripts and styles with a content hash, and they load', async ({ page }) => {
  for (const path of ['/', '/falling-blocks/', '/maze-chase/', '/flap/', '/road-hop/', '/snake/', '/brick-bounce/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/mp4-to-mp3/', '/compress-image/', '/photo-collage/', '/fit-to-frame/', '/profile/']) {
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

test('asks for tool and game requests by email or GitHub issue, and says the site is open source', async ({ page }) => {
  await page.goto('/');
  const suggest = page.getByRole('region', { name: 'Want a tool or game that isn’t here?' });
  await expect(suggest).toBeVisible();

  const email = suggest.getByRole('link', { name: 'Email a request' });
  const mail = new URL(await email.getAttribute('href'));
  expect(mail.protocol).toBe('mailto:');
  expect(mail.pathname).toBe('root@bdnix.com');
  expect(mail.searchParams.get('subject')).toBe('bdnix request: ');
  expect(mail.searchParams.get('body')).toBe('What should it do?\n\n');

  const issue = suggest.getByRole('link', { name: 'Open a GitHub issue' });
  await expect(issue).toHaveAttribute('href', 'https://github.com/bdnix/bdnix/issues/new?template=request.yml');
  // The link picks the issue form by file name, so it has to exist.
  expect(fs.existsSync(new URL('../../.github/ISSUE_TEMPLATE/request.yml', import.meta.url))).toBe(true);

  await expect(suggest.locator('.oss')).toHaveText('bdnix is open source. Read the code, report a bug or send a pull request on GitHub.');
  await expect(suggest.locator('.oss').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/bdnix/bdnix');
  await expectNoSideScroll(page);
});

test('every page with a footer links to the GitHub repository and to the request section', async ({ page }) => {
  for (const url of ['/', '/merge-pdf/', '/watermark-pdf/', '/redact-pdf/', '/mp4-to-mp3/', '/compress-image/', '/photo-collage/', '/fit-to-frame/', '/profile/']) {
    await page.goto(url);
    const foot = page.locator('footer.foot');
    await expect(foot.getByRole('link', { name: 'Open source on GitHub' }), url).toHaveAttribute('href', 'https://github.com/bdnix/bdnix');
    await expect(foot.getByRole('link', { name: 'Suggest a tool or game' }), url).toHaveAttribute('href', '/#suggest');
    await expect(foot.getByRole('link', { name: 'root@bdnix.com' }), url).toHaveAttribute('href', 'mailto:root@bdnix.com');
    await expectNoSideScroll(page);
  }

  await page.goto('/merge-pdf/');
  await page.getByRole('link', { name: 'Suggest a tool or game' }).click();
  await expect(page).toHaveURL(/\/#suggest$/);
  await expect(page.locator('#suggest')).toBeInViewport();
});
