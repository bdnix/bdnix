import { test, expect, expectNoSideScroll } from './fixtures.mjs';

test('shows the games and tools, with no under-construction wording', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('bdnix — Free browser games and PDF, audio and image tools');
  await expect(page.locator('h1')).toHaveText('Play a little.Get things done.');
  await expect(page.locator('body')).not.toContainText(/under construction|check back soon|being built/i);

  const cards = page.locator('.card');
  await expect(cards).toHaveCount(13);
  const links = await cards.evaluateAll((els) => els.map((a) => [a.querySelector('b').textContent, a.getAttribute('href')]));
  expect(links).toEqual([
    ['Falling Blocks', '/falling-blocks/'], ['Maze Chase', '/maze-chase/'], ['Flap', '/flap/'], ['Road Hop', '/road-hop/'], ['Snake', '/snake/'], ['Brick Bounce', '/brick-bounce/'],
    ['Merge PDFs', '/merge-pdf/'], ['Watermark a PDF', '/watermark-pdf/'], ['Redact a PDF', '/redact-pdf/'], ['MP4 to MP3', '/mp4-to-mp3/'],
    ['Compress Images', '/compress-image/'], ['Photo Collage', '/photo-collage/'], ['Resize Without Cropping', '/fit-to-frame/']
  ]);
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

test('the search box filters the games and tools as you type', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search games & tools' });
  const status = page.locator('#search-status');
  const empty = page.locator('#search-empty');
  const games = page.getByRole('region', { name: 'Games' });
  const tools = page.getByRole('region', { name: 'Tools' });
  const shown = () => page.locator('.card:visible b').allTextContents();

  await expect(page.locator('.card:visible')).toHaveCount(13);
  await expect(status).toHaveText('');
  await expect(empty).toBeHidden();

  // Names, descriptions and keywords all count; the other section hides.
  await search.fill('pdf');
  expect(await shown()).toEqual(['Merge PDFs', 'Watermark a PDF', 'Redact a PDF']);
  await expect(status).toHaveText('3 matches');
  await expect(games).toBeHidden();
  await expect(tools).toBeVisible();

  await search.fill('ghosts');
  expect(await shown()).toEqual(['Maze Chase']);
  await expect(status).toHaveText('1 match');
  await expect(tools).toBeHidden();

  await search.fill('Photo');
  expect(await shown()).toEqual(['Compress Images', 'Photo Collage', 'Resize Without Cropping']);

  await search.fill('game');
  expect(await shown()).toEqual(['Falling Blocks', 'Maze Chase', 'Flap', 'Road Hop', 'Snake', 'Brick Bounce']);

  // Plurals find the singular.
  await search.fill('games');
  expect(await shown()).toEqual(['Falling Blocks', 'Maze Chase', 'Flap', 'Road Hop', 'Snake', 'Brick Bounce']);
  await search.fill('photos');
  expect(await shown()).toEqual(['Compress Images', 'Photo Collage', 'Resize Without Cropping']);

  // Every word has to match.
  await search.fill('photo grid');
  expect(await shown()).toEqual(['Photo Collage']);

  // Nothing left: both sections hide and the page asks for a request.
  await search.fill('spreadsheet');
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
  expect(await shown()).toEqual(['Snake']);
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.locator('.card:visible')).toHaveCount(13);
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
  expect(await page.locator('.card:visible b').allTextContents()).toEqual(['MP4 to MP3']);

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
  expect(await page.locator('.card:visible b').allTextContents()).toEqual(['Brick Bounce']);
  await expect(page.locator('#search-status')).toHaveText('1 match');
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
