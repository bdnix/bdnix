import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen, touch } from '../../../tests/ui/fixture.mjs';

// game.css: what every game page has around its board: the board's frame,
// the overlay over it, the stat panels, and keys or touch hints. On a page
// of its own.
const BODY = [
  '<header class="bar"><span class="bar-actions"><button type="button" id="b">B</button></span></header>',
  '<main class="game"><div class="box panel stats"><div><span class="label">Score</span><b>0</b></div></div>',
  '<div class="board-wrap"><canvas id="board" width="200" height="300" role="img" aria-label="Board"></canvas>',
  '<div class="overlay" id="overlay"><h1>Paused</h1><p class="keys only-keys"><kbd>P</kbd> pause</p><p class="only-touch" id="tip">Tap to play</p>',
  '<div class="ov-actions"><button class="btn btn-primary" type="button">Resume</button></div><p class="credit">Inspired by a classic.</p></div></div></main>'
].join('');

test('the overlay covers the board, or on a phone the whole game area, with keys on a computer and touch hints on a phone', async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/game.css'], body: BODY, bodyClass: 'play' });
  // On a computer the overlay covers the board's frame, which is as tall as
  // the board (each game's own stylesheet sizes it). A phone's board has
  // too little room for it, so it covers the game area under the top bar.
  const wrap = await page.locator('.board-wrap').boundingBox();
  const board = await page.locator('#board').boundingBox();
  const overlay = await page.locator('#overlay').boundingBox();
  const covers = await page.locator(await touch(page) ? 'main.game' : '.board-wrap').boundingBox();
  for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(overlay[k] - covers[k]), k).toBeLessThan(1);
  expect(Math.abs(wrap.height - board.height)).toBeLessThan(1);
  expect(await style(page, 'body', 'overflow')).toBe('hidden');
  expect(await style(page, '.overlay kbd', 'border-bottom-width')).toBe('3px');
  if (await touch(page)) {
    await expect(page.locator('.only-keys')).toBeHidden();
    await expect(page.locator('#tip')).toBeVisible();
  } else {
    await expect(page.locator('.only-keys')).toBeVisible();
    await expect(page.locator('#tip')).toBeHidden();
  }
  await page.locator('#overlay').evaluate((o) => { o.hidden = true; });
  await expect(page.locator('#overlay')).toBeHidden();
  await fitsScreen(page);
});

// A card with more on it than there's room for scrolls inside the overlay,
// starting at its top, instead of spilling over the page.
test('a card taller than its room scrolls instead of spilling over the page', async ({ page }) => {
  const long = '<p>' + 'Words, words, words. '.repeat(40) + '</p>';
  await openFixture(page, { css: ['/assets/css/base.css', '/assets/css/game.css'], body: BODY.replace('<h1>Paused</h1>', '<h1>Paused</h1>' + long.repeat(4)), bodyClass: 'play' });
  const overlay = page.locator('#overlay');
  const box = await overlay.boundingBox();
  const title = await overlay.locator('h1').boundingBox();
  expect(title.y, 'the top of the card is in view').toBeGreaterThanOrEqual(box.y);
  expect(await overlay.evaluate((o) => o.scrollHeight > o.clientHeight)).toBe(true);
  expect(await style(page, '#overlay', 'overflow-y')).toBe('auto');
  await overlay.evaluate((o) => { o.scrollTop = o.scrollHeight; });
  const credit = await overlay.locator('.credit').boundingBox();
  expect(credit.y + credit.height, 'its end scrolls into view').toBeLessThanOrEqual(box.y + box.height + 1);
  await fitsScreen(page);
});
