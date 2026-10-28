// What King of Streets' specs share. The game draws no frames in them: the
// test browser draws in software, seconds a frame, so noDrawing() turns
// drawing off as each page loads (bdnixStreet3d.draw); everything else
// about a frame (the road built, everyone moved, the camera) still happens.
// graphics.spec.mjs draws.
import { expect } from '../../../tests/ui/fixtures.mjs';
import { openGame } from '../../../tests/ui/games.mjs';

export const URL = '/king-of-streets/';

export function noDrawing(test){
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      let view;
      Object.defineProperty(window, 'bdnixStreet3d', { configurable: true, get: () => view, set: (v) => { v.draw = false; view = v; } });
    });
  });
}

// Runs the game's clock a little at a time until fn (run in the page)
// returns true: the city loads in real time, but the game only sees it on
// its next frame.
export async function until(page, fn, arg, timeout = 90_000){
  await expect.poll(async () => {
    if (await page.evaluate(fn, arg)) return true;
    await page.clock.runFor(100);
    return page.evaluate(fn, arg);
  }, { timeout, intervals: [50] }).toBe(true);
}

// Starts the race on the start card (or whatever card has #startBtn) and
// waits for the countdown; with `go`, through it to the start.
export async function startRace(page, go){
  await page.locator('#startBtn').click();
  await until(page, () => /^[3৩]$/.test(document.getElementById('count').textContent));
  if (go) await page.clock.runFor(3100);
}

// A race set up in the page before the game loads: `make` runs in the page
// (with `arg`) and returns the race as bdnixStreet.snapshot() gives it, which
// the game picks up paused. opts: { mode, career } (the career to keep).
export async function seed(page, make, arg, opts = {}){
  // Made by the rules alone, on a page with nothing else on it: the game's
  // own page would load a whole city first.
  await page.goto('/assets/js/street-core.js');
  await page.setContent('<script src="/assets/js/street-core.js"></script>');
  const world = await page.evaluate(make, arg);
  // Put in place as the next page loads, once only, so a reload finds what
  // the game itself saved.
  await page.addInitScript(({ world, opts }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('bdnix_kingofstreets_save', JSON.stringify({ v: 1, data: { mode: opts.mode || 'career', rider: 0, carry: 0, world } }));
    if (opts.career) localStorage.setItem('bdnix_kingofstreets_career', JSON.stringify(opts.career));
  }, { world, opts });
  await openGame(page, URL);
}

// Resumes a race picked up from a save, once its city has loaded. The city
// loads (in real time) behind the pause card, so resuming carries straight
// on, the same moment of the race every time.
export async function resume(page){
  await expect(page.locator('#newBtn')).toBeVisible();
  await expect.poll(() => page.evaluate(() => { const v = window.bdnixStreet3d.current; return !!v && v.progress === 1; }), { timeout: 90_000 }).toBe(true);
  await page.locator('#startBtn').click();
  await until(page, () => document.getElementById('loading').hidden && !document.getElementById('hud').hidden);
}

// The race as the game last saved it (it saves when it pauses): pauses,
// reads it, and resumes.
export async function race(page){
  await page.keyboard.press('KeyP');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_save')));
  await page.keyboard.press('KeyP');
  return s && s.data.world;
}
