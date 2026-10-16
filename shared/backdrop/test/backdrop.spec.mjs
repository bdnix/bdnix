import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture } from '../../../tests/ui/fixture.mjs';

// blocks.js: the falling-block backdrop on canvas#bg, and the one way the
// site draws a block (window.bdnix), on a page of its own.
const BODY = '<canvas id="bg" aria-hidden="true"></canvas>';

test('the backdrop fills the window and draws falling blocks', async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css'], js: ['/assets/js/blocks.js'], body: BODY });
  const size = await page.locator('#bg').evaluate((c) => [c.clientWidth, c.clientHeight]);
  expect(size).toEqual(await page.evaluate(() => [innerWidth, innerHeight]));
  // Something is drawn: some pixel isn't transparent.
  await expect.poll(() => page.locator('#bg').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
    return false;
  })).toBe(true);
});

test('every block shape has its colour, and a block can be drawn anywhere', async ({ page }) => {
  await openFixture(page, { css: ['/assets/css/base.css'], js: ['/assets/js/blocks.js'], body: BODY + '<canvas id="c" width="40" height="40"></canvas>' });
  const drawn = await page.evaluate(() => {
    const { PALETTE, SHAPES, block } = window.bdnix;
    const ctx = document.getElementById('c').getContext('2d');
    block(ctx, 0, 0, 40, PALETTE.T);
    const mid = ctx.getImageData(20, 20, 1, 1).data;
    return { shapes: Object.keys(SHAPES).sort(), colours: Object.keys(PALETTE).sort(), alpha: mid[3] };
  });
  expect(drawn.shapes).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  expect(drawn.colours).toEqual(drawn.shapes);
  expect(drawn.alpha).toBe(255);
});
