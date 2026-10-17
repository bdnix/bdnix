import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture, style, fitsScreen, touch } from '../../../tests/ui/fixture.mjs';

// gestures.css: on a phone, the gestures a game is played with in one row,
// each an arrow or a ring, what it does and how; on a computer, nothing. On a
// page of its own.
const row = [
  '<ul class="gestures" aria-label="Touch controls">',
  '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18"/></svg><b>Move</b><span>drag</span></li>',
  '<li><i class="tap"></i><b>Rotate</b><span>tap</span></li>',
  '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v16"/></svg><b>Drop</b><span>flick</span></li>',
  '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V5"/></svg><b>Hold</b><span>flick</span></li>',
  '</ul>'
].join('');
const open = (page) => openFixture(page, { css: ['/assets/css/base.css', '/assets/css/gestures.css'], body: row });

test('on a phone the gestures sit in one row, each with what it does and how', async ({ page }) => {
  await open(page);
  const list = page.getByRole('list', { name: 'Touch controls' });
  if (!(await touch(page))) { await expect(list).toBeHidden(); return; }
  await expect(list).toBeVisible();
  const items = list.getByRole('listitem');
  await expect(items).toHaveCount(4);
  const boxes = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (let i = 1; i < boxes.length; i++) {
    expect(Math.abs(boxes[i].y - boxes[0].y), 'one row').toBeLessThan(1);
    expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
  }
  // Each says what it does on one line, and how on the next.
  const lines = await items.evaluateAll((els) => els.map((e) => {
    const b = e.querySelector('b').getBoundingClientRect(), s = e.querySelector('span').getBoundingClientRect();
    return { b: b.height, s: s.height, below: s.top >= b.bottom - 1 };
  }));
  for (const l of lines) {
    expect(l.below).toBe(true);
    expect(l.b).toBeLessThan(20);
    expect(l.s).toBeLessThan(16);
  }
  expect(await style(page, '.gestures .tap', 'border-radius')).toBe('50%');
  expect(await style(page, '.gestures', 'list-style-type')).toBe('none');
  await fitsScreen(page);
});
