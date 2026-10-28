import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openGame } from '../../../tests/ui/games.mjs';
import { URL, noDrawing, until, seed, resume } from './street.mjs';

// King of Streets drawn, for every route and time of day, from behind and
// from the rider's seat. The test browser draws in software, seconds a
// frame, so each test plays with drawing off (street.mjs), then draws one
// frame, small, and looks at it.
noDrawing(test);
test.use({ viewport: { width: 480, height: 270 } });
test.setTimeout(240_000);

const stats = (page) => page.evaluate(() => window.bdnixStreet3d.current.stats());
// Draws a frame, and says how varied the picture is: a plain screen's
// colours barely differ.
async function busy(page){
  await page.evaluate(() => { window.bdnixStreet3d.draw = true; });
  await page.clock.runFor(20);
  await page.evaluate(() => { window.bdnixStreet3d.draw = false; });
  const shot = await page.locator('#board').screenshot({ animations: 'disabled', timeout: 120_000 });
  let sum = 0, sq = 0, n = 0;
  for (let i = 1000; i < shot.length; i += 97) { sum += shot[i]; sq += shot[i] * shot[i]; n++; }
  return Math.sqrt(sq / n - (sum / n) * (sum / n));
}
// Race `race` with the player `z` metres in, drawn.
async function ride(page, race, z, career){
  await seed(page, (a) => {
    const F = window.bdnixStreet, w = F.create(a.race);
    w.time = 60;
    Object.assign(w.player, { z: a.z, speed: 15 });
    w.rivals.forEach((o, i) => Object.assign(o, { z: a.z + 4 + i * 5, x: (i % 3 - 1) * 3, speed: 15, top: 15 }));
    return F.snapshot(w);
  }, { race, z }, career ? { career } : {});
  await resume(page);
  await page.clock.runFor(500);
}

// The start card, with the street drawn behind it.
test('the start card, with the street behind it', async ({ page }) => {
  await openGame(page, URL);
  await until(page, () => window.bdnixStreet3d.current && window.bdnixStreet3d.current.stats().chunks > 0);
  await page.clock.runFor(100);
  expect(await busy(page)).toBeGreaterThan(5);
});

// Every route at its time of day: a quick race on it, from the start card,
// drawn from the grid. Each in a page of its own, so they draw side by side.
const routes = ['Old Dhaka after midnight', 'Mirpur Road at dawn', 'Hatirjheel at midday', 'Moghbazar flyover at dusk', 'The expressway in the morning rush'];
for (const route of routes) {
  test(`${route}, drawn from the grid`, async ({ page }) => {
    await openGame(page, URL);
    await page.getByRole('button', { name: 'Quick race' }).click();
    await page.locator('#quick').getByRole('radio', { name: route }).click();
    await page.locator('#quick').getByRole('button', { name: 'Race' }).click();
    await until(page, () => /^[3৩]$/.test(document.getElementById('count').textContent));
    await page.clock.runFor(500);
    expect(await busy(page)).toBeGreaterThan(10);
    const s = await stats(page);
    expect(s.chunks).toBeGreaterThanOrEqual(3);
    expect(s.racers).toBe(7);
    expect(s.calls).toBeGreaterThan(30);
    // People on the footpaths at dawn, once the walk they share has loaded.
    if (route === routes[1]) await until(page, () => window.bdnixStreet3d.current.stats().people > 0);
  });
}

test('over a bridge on the lake, from the rider’s seat, with a fight on', async ({ page }) => {
  await ride(page, 7, 640, { points: 0, owned: [1, 2, 3], done: [], view: 'rider' });
  expect((await stats(page)).mode).toBe('rider');
  await page.keyboard.press('KeyX');
  await page.clock.runFor(300);
  expect(await busy(page)).toBeGreaterThan(10);
  await page.keyboard.press('KeyZ');
  await page.clock.runFor(1500);
  expect((await stats(page)).cars).toBeGreaterThan(0);
});
