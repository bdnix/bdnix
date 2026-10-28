import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openGame } from '../../../tests/ui/games.mjs';
import { URL, noDrawing, until, seed, resume } from './street.mjs';

// King of Streets drawn, for every route and time of day, from behind and
// from the rider's seat. The test browser draws in software, seconds a
// frame, so each test plays with drawing off (street.mjs), then draws one
// frame, small, and looks at it.
noDrawing(test);
test.use({ viewport: { width: 480, height: 270 } });
test.setTimeout(120_000);

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

test('Old Dhaka after midnight: the street, its lamps, the racers and the traffic', async ({ page }) => {
  await ride(page, 1, 400);
  expect(await busy(page)).toBeGreaterThan(10);
  const s = await stats(page);
  expect(s.chunks).toBeGreaterThanOrEqual(4);
  expect(s.racers).toBe(7);
  expect(s.calls).toBeGreaterThan(30);
  expect(s.triangles).toBeGreaterThan(10_000);
});

test('the lake and its bridges at midday, from the rider’s seat', async ({ page }) => {
  await ride(page, 7, 520, { points: 0, owned: [1, 2, 3], done: [], view: 'rider' });
  expect((await stats(page)).mode).toBe('rider');
  await page.keyboard.press('KeyX');
  await page.clock.runFor(300);
  expect(await busy(page)).toBeGreaterThan(10);
});

test('up the flyover at dusk, with a fight on', async ({ page }) => {
  await ride(page, 10, 900, { points: 0, owned: [1, 2, 3, 4], done: [] });
  await page.keyboard.press('KeyZ');
  await page.clock.runFor(1500);
  expect((await stats(page)).cars).toBeGreaterThan(0);
  expect(await busy(page)).toBeGreaterThan(10);
});

test('the expressway in the morning rush, and Mirpur Road at dawn, drawn plainly', async ({ page }) => {
  await ride(page, 13, 700, { points: 0, owned: [1, 2, 3, 4, 5], done: [], quality: 'low' });
  expect((await stats(page)).quality).toBe('low');
  expect(await busy(page)).toBeGreaterThan(10);
  await ride(page, 4, 300, { points: 0, owned: [1, 2], done: [], quality: 'low' });
  await page.clock.runFor(4000);
  expect((await stats(page)).people).toBeGreaterThan(0);
});

test('the start card shows the street behind it', async ({ page }) => {
  await openGame(page, URL);
  await until(page, () => window.bdnixStreet3d.current && window.bdnixStreet3d.current.stats().chunks > 0);
  await page.clock.runFor(100);
  expect(await busy(page)).toBeGreaterThan(5);
});
