import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen, touch } from '../../../tests/ui/fixture.mjs';

// gamepad.css: on a phone, a D-pad on the left and round action buttons on
// the right; on a computer, nothing. On a page of its own.
const pad = (face) => [
  '<nav class="touch" aria-label="Game controls"><div class="dpad">',
  '<button class="up" type="button" aria-label="Up"></button><button class="left" type="button" aria-label="Left"></button>',
  '<button class="right" type="button" aria-label="Right"></button><button class="down" type="button" aria-label="Down"></button></div>',
  face ? '<div class="face"><button class="a" type="button" aria-label="A"><span>A</span></button><button class="b" type="button" aria-label="B"><span>B</span></button></div>' : '',
  '</nav>'
].join('');
const open = (page, face) => openFixture(page, { css: ['/assets/css/base.css', '/assets/css/gamepad.css'], body: pad(face) });
const box = (page, sel) => page.locator(sel).boundingBox();
const mid = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

test('the D-pad is one cross, with round action buttons to its right', async ({ page }) => {
  await open(page, true);
  if (!(await touch(page))) { await expect(page.locator('.touch')).toBeHidden(); return; }
  const [u, l, r, d] = await Promise.all(['.up', '.left', '.right', '.down'].map((s) => box(page, '.dpad ' + s)));
  for (const b of [u, l, r, d]) expect(b.width).toBeGreaterThanOrEqual(44);
  expect(Math.abs(mid(l).y - mid(r).y)).toBeLessThan(1);
  expect(Math.abs(mid(u).x - mid(d).x)).toBeLessThan(1);
  expect(Math.abs(mid(u).x - (mid(l).x + mid(r).x) / 2)).toBeLessThan(1);
  expect(mid(u).y).toBeLessThan(mid(l).y);
  expect(mid(d).y).toBeGreaterThan(mid(l).y);
  const dpad = await box(page, '.dpad');
  const a = await box(page, '.face .a'), b = await box(page, '.face .b');
  expect(a.x).toBeGreaterThan(dpad.x + dpad.width);
  expect(a.x).toBeGreaterThan(b.x);
  expect(a.y).toBeLessThan(b.y);
  expect(await style(page, '.face .a', 'border-radius')).toBe('50%');
  await fitsScreen(page);
});

test('a D-pad on its own sits in the middle, and lights up while held', async ({ page }) => {
  await open(page, false);
  if (!(await touch(page))) { await expect(page.locator('.touch')).toBeHidden(); return; }
  const dpad = await box(page, '.dpad');
  expect(Math.abs(dpad.x + dpad.width / 2 - page.viewportSize().width / 2)).toBeLessThan(2);
  const before = await style(page, '.dpad .up', 'background-image');
  await page.locator('.dpad .up').evaluate((b) => b.classList.add('on'));
  expect(await style(page, '.dpad .up', 'background-image')).not.toBe(before);
});
