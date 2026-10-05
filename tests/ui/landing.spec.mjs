import { test, expect, expectNoSideScroll } from './fixtures.mjs';

test('shows the games and tools, with no under-construction wording', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('bdnix — Free browser games and PDF, audio and image tools');
  await expect(page.locator('h1')).toHaveText('Play a little.Get things done.');
  await expect(page.locator('body')).not.toContainText(/under construction|check back soon|being built/i);

  // A card for every game and tool (written from scripts/site.mjs), each a
  // link to its page with an icon, a name and a line about it.
  for (const section of ['Games', 'Tools']) {
    const cards = page.getByRole('region', { name: section }).locator('.card');
    expect(await cards.count(), section).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('href', /^\/[a-z0-9-]+\/$/);
      await expect(card.locator('.card-icon')).toBeVisible();
      await expect(card.locator('b')).toHaveText(/\w/);
      await expect(card.locator('.card-text > span')).toHaveText(/\w/);
    }
  }
  await expectNoSideScroll(page);
});

test('screen readers get one steady line instead of the typewriter', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const terminal = page.locator('.terminal');
  const said = 'Games and tools that run in your browser. Nothing to install, nothing uploaded.';
  await expect(terminal).not.toHaveAttribute('aria-live', /.*/);
  await expect(terminal).toMatchAriaSnapshot(`- paragraph: ${said}`);
  // The typing carries on out of their hearing.
  const typed = page.locator('#typed');
  const first = await typed.textContent();
  await page.clock.runFor(4000);
  await expect(typed).not.toHaveText(first);
  await expect(terminal).toMatchAriaSnapshot(`- paragraph: ${said}`);
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

test('asks for tool and game requests by email or GitHub issue, and says the site is open source', async ({ page, request }) => {
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
  // The link picks the issue form by file name, so it has to exist. (Asked
  // of the test server, which serves the whole repository, so the UI result
  // cache knows this test depends on it.)
  expect((await request.get('/.github/ISSUE_TEMPLATE/request.yml')).ok()).toBe(true);

  await expect(suggest.locator('.oss')).toHaveText('bdnix is open source. Read the code, report a bug or send a pull request on GitHub.');
  await expect(suggest.locator('.oss').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/bdnix/bdnix');
  await expectNoSideScroll(page);
});

test('a page\'s footer link to the request section goes there', async ({ page }) => {
  await page.goto('/merge-pdf/');
  await page.getByRole('link', { name: 'Suggest a tool or game' }).click();
  await expect(page).toHaveURL(/\/#suggest$/);
  await expect(page.locator('#suggest')).toBeInViewport();
});

test('the search box filters the games and tools as you type', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search games & tools' });
  const status = page.locator('#search-status');
  const empty = page.locator('#search-empty');
  const games = page.getByRole('region', { name: 'Games' });
  const tools = page.getByRole('region', { name: 'Tools' });
  const shown = () => page.locator('.card:visible b').allTextContents();
  const all = await page.locator('.card').count();
  const gameNames = await games.locator('.card b').allTextContents();

  await expect(page.locator('.card:visible')).toHaveCount(all);
  await expect(status).toHaveText('');
  await expect(empty).toBeHidden();

  // Names, descriptions and keywords all count; the other section hides.
  await search.fill('pdf');
  const pdf = await shown();
  expect(pdf).toEqual(expect.arrayContaining(['Merge PDFs', 'Sign a PDF']));
  await expect(status).toHaveText(pdf.length + ' matches');
  await expect(games).toBeHidden();
  await expect(tools).toBeVisible();

  // A word from a card's keywords finds it, even when its name doesn't say it.
  await search.fill('ghosts');
  expect(await shown()).toContain('Maze Chase');
  await expect(tools).toBeHidden();

  // Every game says it's a game; plurals find the singular.
  await search.fill('game');
  expect(await shown()).toEqual(gameNames);
  await search.fill('games');
  expect(await shown()).toEqual(gameNames);
  await search.fill('photo');
  const photo = await shown();
  expect(photo).toEqual(expect.arrayContaining(['Compress Images', 'Photo Collage']));
  await search.fill('photos');
  expect(await shown()).toEqual(photo);

  // Every word has to match.
  await search.fill('photo grid');
  const grid = await shown();
  expect(grid).toContain('Photo Collage');
  expect(grid.length).toBeLessThan(photo.length);

  // Nothing left: both sections hide and the page asks for a request.
  await search.fill('zqxjv');
  expect(await shown()).toEqual([]);
  await expect(games).toBeHidden();
  await expect(tools).toBeHidden();
  await expect(status).toHaveText('0 matches');
  await expect(empty).toBeVisible();
  await expectNoSideScroll(page);
  await empty.getByRole('link', { name: 'Ask for it' }).click();
  await expect(page).toHaveURL(/\/#suggest$/);

  // Escape clears the search and brings everything back.
  await search.fill('snake');
  expect(await shown()).toContain('Snake');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.locator('.card:visible')).toHaveCount(all);
  await expect(status).toHaveText('');
  await expect(empty).toBeHidden();
  await expectNoSideScroll(page);
});

test('"/" jumps to the search box, but types normally inside it', async ({ page }) => {
  await page.goto('/');
  const search = page.locator('#search');
  await expect(search).not.toBeFocused();
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await page.keyboard.type('mp4/');
  await expect(search).toHaveValue('mp4/');
  expect(await page.locator('.card:visible b').allTextContents()).toContain('MP4 to MP3');

  // Held with a modifier, it's left to the browser.
  await search.blur();
  await page.keyboard.press('Control+/');
  await expect(search).not.toBeFocused();
});

test('a search already in the box when the page loads is applied', async ({ page }) => {
  // As when the browser brings back what was typed: fill the box before the page's script runs.
  await page.addInitScript(() => {
    new MutationObserver((changes, watcher) => {
      const box = document.getElementById('search');
      if (box) { box.value = 'bounce'; watcher.disconnect(); }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  await expect(page.locator('#search')).toHaveValue('bounce');
  const found = await page.locator('.card:visible b').allTextContents();
  expect(found).toContain('Brick Bounce');
  await expect(page.locator('#search-status')).toHaveText(found.length + (found.length === 1 ? ' match' : ' matches'));
});

test('the cards fill a laptop in three columns, a wide monitor in four, and stack on a phone', async ({ page }) => {
  const columns = () => page.locator('#games .card').evaluateAll((els) => new Set(els.map((e) => e.getBoundingClientRect().left)).size);
  const spare = () => page.evaluate(() => {
    const main = document.querySelector('.hero').getBoundingClientRect();
    const cards = document.querySelector('#games .cards').getBoundingClientRect();
    return Math.round(main.right - cards.right);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  expect(await columns()).toBe(3);
  // Only the page's side padding is left beside the cards.
  expect(await spare()).toBeLessThanOrEqual(32);
  await expectNoSideScroll(page);

  // A wide monitor gets a wider page with four columns.
  await page.setViewportSize({ width: 2560, height: 1440 });
  expect(await columns()).toBe(4);
  expect(await spare()).toBeLessThanOrEqual(32);
  expect(await page.locator('.hero').evaluate((e) => e.getBoundingClientRect().width)).toBeGreaterThan(1500);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await columns()).toBe(1);
  await expectNoSideScroll(page);
});
