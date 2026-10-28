import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openGame } from '../../../tests/ui/games.mjs';
import { URL, noDrawing, until, seed, resume } from './street.mjs';

// King of Streets drawn, for every route and time of day, from behind and
// from the rider's seat. The test browser draws in software, seconds a
// frame, so each test plays with drawing off (street.mjs), then draws one
// frame, small, and looks at it: never a plain screen, and never too dark
// to see, night included.
noDrawing(test);
test.use({ viewport: { width: 480, height: 270 } });
test.setTimeout(240_000);

const stats = (page) => page.evaluate(() => window.bdnixStreet3d.current.stats());
// Draws a frame and looks at it: how bright it is on average (0 to 255)
// and how much its brightness varies (a plain screen's barely does).
async function look(page){
  await page.evaluate(() => { window.bdnixStreet3d.draw = true; });
  await page.clock.runFor(20);
  await page.evaluate(() => { window.bdnixStreet3d.draw = false; });
  const shot = await page.locator('#board').screenshot({ animations: 'disabled', timeout: 120_000 });
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, sq = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += l; sq += l * l; n++; }
    return { bright: sum / n, spread: Math.sqrt(sq / n - (sum / n) ** 2) };
  }, shot.toString('base64'));
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

// Every route at its time of day: a quick race on it, from the start card,
// drawn from the grid, with the graphics set low (no shadows: they're drawn
// on the bridge, below). Each in a page of its own, so they draw side by side.
const routes = ['Mirpur Road at dawn', 'Old Dhaka after midnight', 'Hatirjheel at midday', 'Moghbazar flyover at dusk', 'The expressway in the morning rush'];
for (const route of routes) {
  test(`${route}, drawn from the grid`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('bdnix_kingofstreets_career', JSON.stringify({ points: 0, owned: [1], done: [], quality: 'low' })));
    await openGame(page, URL);
    await page.getByRole('button', { name: 'Quick race' }).click();
    await page.locator('#quick').getByRole('radio', { name: route }).click();
    await page.locator('#quick').getByRole('button', { name: 'Race' }).click();
    await until(page, () => /^[3৩]$/.test(document.getElementById('count').textContent));
    await page.clock.runFor(500);
    const seen = await look(page);
    expect(seen.spread, 'not a plain screen').toBeGreaterThan(20);
    expect(seen.bright, 'bright enough to see').toBeGreaterThan(70);
    const s = await stats(page);
    expect(s.chunks).toBeGreaterThanOrEqual(3);
    expect(s.racers).toBe(7);
    expect(s.calls).toBeGreaterThan(30);
    expect(s.shadows).toBe(false);
    // People on the footpaths at dawn, once the walk they share has loaded.
    if (route === routes[0]) await until(page, () => window.bdnixStreet3d.current.stats().people > 0);
  });
}

test('over a bridge on the lake, from the rider’s seat, with a fight on', async ({ page }) => {
  await ride(page, 7, 640, { points: 0, owned: [1, 2, 3], done: [], view: 'rider' });
  expect((await stats(page)).mode).toBe('rider');
  expect((await stats(page)).shadows).toBe(true);
  await page.keyboard.press('KeyX');
  await page.clock.runFor(300);
  const seen = await look(page);
  expect(seen.spread).toBeGreaterThan(20);
  expect(seen.bright).toBeGreaterThan(70);
  await page.keyboard.press('KeyZ');
  await page.clock.runFor(1500);
  expect((await stats(page)).cars).toBeGreaterThan(0);
});
