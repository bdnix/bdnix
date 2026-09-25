// Makes the games deterministic for tests: Math.random always returns 0
// (so Tetris deals O, T, J, L, S, Z, I every bag and frightened ghosts
// always take their first option), and time only moves when a test calls
// page.clock.runFor(). Leaves the game on its start screen.
//
// The clock is paused before the page loads, so it never runs in real
// time. Pausing a clock that is already running races with its real-time
// updates, which can step time backwards and stall the games' loops.
export async function openGame(page, path){
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto(path);
}

export async function press(page, key, times = 1){
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

// How much has been drawn on a canvas (0 when it's blank).
export function inkOn(page, selector){
  return page.locator(selector).evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
}

// Touch controls fire on pointerdown; dispatching works at any screen size.
export async function tap(locator){
  await locator.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
  await locator.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
}
