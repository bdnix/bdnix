import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openGame, listen, heard, soundProblems } from '../../../tests/ui/games.mjs';
import { URL, noDrawing, until, startRace, seed, resume, race } from './street.mjs';

// King of Streets as it's played: the career from the start card, riding,
// fighting, kicking CNGs aside, crashing, finishing, the garage, a quick
// race, the camera, the engines and saving. See street.mjs for why nothing
// is drawn.
noDrawing(test);
// Each page loads a city of 3D models: on a busy machine, with coverage on,
// that takes longer than the usual 30 seconds a test may.
test.setTimeout(90_000);

const text = (page, id) => page.locator('#' + id).textContent();
// A race with the player `z` metres in at `speed`, everyone else stopped at
// the start (unless brought alongside), late enough that the traffic has
// gone on ahead.
function lonely({ race = 1, bike, z = 300, speed = 20, x = 0, health = 100, rivals = {} }){
  const F = window.bdnixStreet, w = F.create(race, bike);
  w.time = 3000;
  Object.assign(w.player, { z, speed, x, health });
  w.rivals.forEach((o, i) => {
    Object.assign(o, { z: 5, x: o.x, speed: 0, top: 0, cool: 5 }, rivals[i] ? { z: z + rivals[i].dz, x: x + rivals[i].dx, speed, top: speed, health: rivals[i].health || o.health } : {});
  });
  return F.snapshot(w);
}

test('a career starts on the scooter: the countdown, then the race', async ({ page }) => {
  await listen(page);
  await openGame(page, URL);
  await until(page, () => document.getElementById('ovCareer').textContent.length > 0);
  await expect(page.locator('#ovCareer')).toHaveText('Race 1 of 15 · 0 points · Scooter');
  await startRace(page);
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#place')).toHaveText('7/7');
  await expect(page.locator('#togo')).toHaveText('2.0 km');
  expect(await heard(page)).toEqual(['start', 'beep']);
  await page.clock.runFor(1000);
  await expect(page.locator('#count')).toHaveText('2');
  await page.clock.runFor(2000);
  await expect(page.locator('#msg')).toHaveText('Go!');
  expect(await heard(page)).toEqual(['beep', 'beep', 'go']);
  await page.clock.runFor(4000);
  // Off the line: the scooter tops out at 90 km/h.
  expect(+(await text(page, 'speed'))).toBeGreaterThan(50);
  expect(+(await text(page, 'speed'))).toBeLessThanOrEqual(90);
  await page.clock.runFor(3000);
  await expect(page.locator('#togo')).toHaveText(/^1\.[0-9] km$/);
  // The engine runs, its note following the revs.
  const engine = await page.evaluate(() => window.bdnixStreetAudio.state());
  expect(engine.running).toBe(true);
  expect(engine.hz).toBeGreaterThan(30);
  expect(engine.gain).toBeGreaterThan(0.05);
  expect(await soundProblems(page)).toEqual([]);
});

test('steering moves the bike across the road, and braking slows it', async ({ page }) => {
  await seed(page, lonely, {});
  await resume(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(500);
  await page.keyboard.up('ArrowRight');
  let w = await race(page);
  expect(w.player.x).toBeGreaterThan(1.5);
  await page.keyboard.down('KeyA');
  await page.clock.runFor(1000);
  await page.keyboard.up('KeyA');
  w = await race(page);
  expect(w.player.x).toBeLessThan(-1.5);
  const before = w.player.speed;
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(500);
  await page.keyboard.up('ArrowDown');
  w = await race(page);
  expect(w.player.speed).toBeLessThan(before - 8);
});

test('a punch lands on the rival beside, a knockout scores, and their weapon is yours', async ({ page }) => {
  await listen(page);
  // Bablu rides with a stick in race 1; one punch is all he has left.
  await seed(page, lonely, { rivals: { 1: { dz: 0.5, dx: 1.2, health: 10 } } });
  await resume(page);
  await expect(page.locator('#foe')).toBeVisible();
  await expect(page.locator('#foeName')).toHaveText('Bablu · Stick');
  await page.keyboard.press('KeyX');
  await page.clock.runFor(400);
  await expect(page.locator('#msg')).toHaveText('Bablu is down! You took the Stick.');
  await expect(page.locator('#score')).toHaveText('100');
  await expect(page.locator('#weapon')).toHaveText('Stick');
  expect(await heard(page)).toEqual(expect.arrayContaining(['swing', 'punch', 'ko']));
  // Now a punch swings the stick.
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(100);
  const w = await race(page);
  expect(w.player.attack.move).toBe('stick');
});

test('a kick shoves a CNG out of the way', async ({ page }) => {
  await listen(page);
  await seed(page, () => {
    const F = window.bdnixStreet, w = F.create(1);
    // The first CNG and the first car on the road, each with the player just beside it.
    const cars = F.traffic(1).filter((v) => !v.parked), cng = cars.find((v) => v.kind === 'cng');
    w.time = 20;
    const at = F.at(cng, w.time);
    Object.assign(w.player, { z: at, x: cng.x + (cng.x > 0 ? -2.2 : 2.2), speed: cng.speed });
    w.rivals.forEach((o) => Object.assign(o, { z: 5, speed: 0, top: 0 }));
    return F.snapshot(w);
  });
  await resume(page);
  await page.keyboard.press('KeyZ');
  await page.clock.runFor(400);
  await expect(page.locator('#msg')).toHaveText('Out of the way!');
  expect(await heard(page)).toEqual(expect.arrayContaining(['swing', 'shove']));
  const w = await race(page);
  expect(Object.keys(w.shoved)).toHaveLength(1);
});

test('a kick at a car bounces off: it’s too big to move', async ({ page }) => {
  await listen(page);
  await seed(page, () => {
    const F = window.bdnixStreet, w = F.create(1);
    const car = F.traffic(1).find((v) => !v.parked && v.kind !== 'cng');
    w.time = 20;
    Object.assign(w.player, { z: F.at(car, w.time), x: car.x + (car.x > 0 ? -2.4 : 2.4), speed: car.speed });
    w.rivals.forEach((o) => Object.assign(o, { z: 5, speed: 0, top: 0 }));
    return F.snapshot(w);
  });
  await resume(page);
  await page.keyboard.press('KeyZ');
  await page.clock.runFor(400);
  await expect(page.locator('#msg')).toHaveText('Too big to move.');
  expect(await heard(page)).toContain('clang');
  expect(Object.keys((await race(page)).shoved)).toHaveLength(0);
});

test('riding into the back of a bus crashes, and hurts', async ({ page }) => {
  await listen(page);
  await seed(page, () => {
    const F = window.bdnixStreet, w = F.create(1);
    const bus = F.traffic(1).find((v) => !v.parked && v.kind === 'bus');
    w.time = 20;
    Object.assign(w.player, { z: F.at(bus, w.time) - bus.len / 2 - 4, x: bus.x, speed: 25 });
    w.rivals.forEach((o) => Object.assign(o, { z: 5, speed: 0, top: 0 }));
    return F.snapshot(w);
  });
  await resume(page);
  await page.clock.runFor(800);
  await expect(page.locator('#msg')).toHaveText('Crash!');
  expect(await heard(page)).toContain('crash');
  const w = await race(page);
  expect(w.player.health).toBe(80);
  expect(w.player.crash).toBeGreaterThan(0);
});

test('finishing in the top three wins points for the career and opens the next race', async ({ page }) => {
  await listen(page);
  await seed(page, lonely, { z: 1985, speed: 25 });
  await resume(page);
  await page.clock.runFor(1500);
  await expect(page.locator('#msg')).toHaveText('1st place');
  // The save is gone as soon as the race is decided; the career has the points.
  expect(await page.evaluate(() => localStorage.getItem('bdnix_kingofstreets_save'))).toBeNull();
  const career = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_career')));
  expect(career).toMatchObject({ points: 1000, owned: [1], done: [1], race: 2 });
  await page.clock.runFor(3200);
  await expect(page.locator('#ovTitle')).toHaveText('1st place');
  await expect(page.locator('#ovText')).toHaveText('You won 1000 points.');
  await expect(page.locator('#ovKicker')).toHaveText('Race 1 · Old Dhaka after midnight');
  await expect(page.locator('#ovCareer')).toHaveText('Race 2 of 15 · 1000 points · Scooter');
  await expect(page.locator('#startBtn')).toHaveText('Next race');
  expect(await heard(page)).toEqual(expect.arrayContaining(['finish', 'best']));
  expect(await page.evaluate(() => localStorage.getItem('bdnix_kingofstreets_best'))).toBe('1000');
  expect((await page.evaluate(() => window.bdnixStreetAudio.state())).running).toBe(false);
  // The next race is on.
  await startRace(page);
  await expect(page.locator('#togo')).toHaveText('2.4 km');
});

test('knocked out: the race ends, and its points are kept', async ({ page }) => {
  await listen(page);
  await seed(page, () => {
    const F = window.bdnixStreet, w = F.create(1);
    const bus = F.traffic(1).find((v) => !v.parked && v.kind === 'bus');
    w.time = 20; w.score = 100;
    Object.assign(w.player, { z: F.at(bus, w.time) - bus.len / 2 - 4, x: bus.x, speed: 25, health: 15 });
    w.rivals.forEach((o) => Object.assign(o, { z: 5, speed: 0, top: 0 }));
    w.rivals[0].health = 0; w.rivals[0].down = 1;
    return F.snapshot(w);
  });
  await resume(page);
  await page.clock.runFor(800);
  await expect(page.locator('#msg')).toHaveText('Knocked out!');
  await page.clock.runFor(2500);
  await expect(page.locator('#ovTitle')).toHaveText('Knocked out');
  await expect(page.locator('#ovText')).toHaveText('You keep 100 points from the race.');
  await expect(page.locator('#startBtn')).toHaveText('Try again');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_career')).points)).toBe(100);
});

test('the garage: buy a bike with points and ride it, pick a rider and a race', async ({ page }) => {
  await listen(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('bdnix_kingofstreets_career')) localStorage.setItem('bdnix_kingofstreets_career', JSON.stringify({ points: 2000, owned: [1], done: [1, 2] }));
  });
  await openGame(page, URL);
  await expect(page.locator('#ovCareer')).toHaveText('Race 3 of 15 · 2000 points · Scooter');
  await page.getByRole('button', { name: 'Garage' }).click();
  const garage = page.locator('#garage');
  await expect(garage.locator('#garagePoints')).toHaveText('2000 points');
  const bikes = garage.locator('.bikes li');
  await expect(bikes).toHaveCount(5);
  await expect(bikes.nth(0).getByRole('button')).toHaveText('Riding');
  await expect(bikes.nth(1)).toContainText('Top speed 115 km/h');
  await expect(bikes.nth(2).getByRole('button', { name: 'Buy for 4000' })).toBeDisabled();
  // Level 2's races open with the 125.
  await expect(garage.getByRole('radio', { name: '4', exact: true })).toBeDisabled();
  await bikes.nth(1).getByRole('button', { name: 'Buy for 1500' }).click();
  expect(await heard(page)).toContain('buy');
  await expect(garage.locator('#garagePoints')).toHaveText('500 points');
  await expect(bikes.nth(1).getByRole('button')).toHaveText('Riding');
  // Race 3 is still the next not placed in; 4 is open now.
  await expect(garage.getByRole('radio', { name: '3', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(garage.getByRole('radio', { name: '4', exact: true })).toBeEnabled();
  // Back on the scooter, for race 2 again, as the teal helmet.
  await bikes.nth(0).getByRole('button', { name: 'Ride' }).click();
  await garage.getByRole('radio', { name: /^2( ✓)?$/ }).click();
  await garage.getByRole('radio', { name: 'Teal helmet' }).click();
  await expect(garage.getByRole('radio', { name: 'Teal helmet' })).toHaveAttribute('aria-checked', 'true');
  await expect(garage.locator('.races .done')).toHaveCount(2);
  await garage.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#ovCareer')).toHaveText('Race 2 of 15 · 500 points · Scooter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_career')))).toMatchObject({ points: 500, owned: [1, 2], ride: 1, race: 2, rider: 4 });
  await startRace(page);
  await expect(page.locator('#togo')).toHaveText('2.4 km');
});

test('a quick race: any route on any bike, scored but not for the career', async ({ page }) => {
  await openGame(page, URL);
  await page.getByRole('button', { name: 'Quick race' }).click();
  const quick = page.locator('#quick');
  await expect(quick.getByRole('radio', { name: 'Old Dhaka after midnight' })).toHaveAttribute('aria-checked', 'true');
  await quick.getByRole('radio', { name: 'The expressway in the morning rush' }).click();
  await quick.getByRole('radio', { name: 'Hyper 1000' }).click();
  await expect(quick.getByRole('radio', { name: 'Hyper 1000' })).toHaveAttribute('aria-checked', 'true');
  // Back to the start card, and in again.
  await quick.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('#ovTitle')).toHaveText('King of Streets');
  await page.getByRole('button', { name: 'Quick race' }).click();
  await quick.getByRole('button', { name: 'Race' }).click();
  await until(page, () => /^[3৩]$/.test(document.getElementById('count').textContent));
  // Race 13, on the expressway: 3.2 km.
  await expect(page.locator('#togo')).toHaveText('3.2 km');
  await page.clock.runFor(5000);
  const w = await race(page);
  expect(w).toMatchObject({ race: 13, bike: 5 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_save')).data.mode);
  expect(saved).toBe('quick');
});

test('a quick race’s result doesn’t touch the career, and races again', async ({ page }) => {
  await seed(page, lonely, { z: 1985, speed: 25 }, { mode: 'quick' });
  await resume(page);
  await page.clock.runFor(4800);
  await expect(page.locator('#ovTitle')).toHaveText('1st place');
  await expect(page.locator('#ovText')).toHaveText('Score 1000 · Best 1000');
  await expect(page.locator('#startBtn')).toHaveText('Race again');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_career')))).toBeNull();
  await startRace(page);
  await expect(page.locator('#togo')).toHaveText('2.0 km');
});

test('a race picked up after a reload comes back paused where it was', async ({ page }) => {
  await seed(page, lonely, { z: 600 });
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#togo')).toHaveText('1.4 km');
  await resume(page);
  await page.clock.runFor(1000);
  const w = await race(page);
  expect(w.player.z).toBeGreaterThan(615);
  // Reloaded mid-race, it's still there, and New game starts it over.
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  const again = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_save')).data.world.player.z);
  expect(again).toBeCloseTo(w.player.z, 0);
  await page.locator('#newBtn').click();
  await until(page, () => /^[3৩]$/.test(document.getElementById('count').textContent));
  await expect(page.locator('#togo')).toHaveText('2.0 km');
});

test('a save that makes no sense is thrown away', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bdnix_kingofstreets_save', JSON.stringify({ v: 1, data: { mode: 'career', rider: 0, carry: 0, world: { race: 99 } } })));
  await openGame(page, URL);
  await expect(page.locator('#ovTitle')).toHaveText('King of Streets');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_kingofstreets_save'))).toBeNull();
});

test('a career race on a bike the career doesn’t own isn’t picked up', async ({ page }) => {
  await seed(page, lonely, { race: 13, bike: 5 });
  await expect(page.locator('#ovTitle')).toHaveText('King of Streets');
});

test('V switches to the rider’s own view and back, and a new race keeps it', async ({ page }) => {
  await openGame(page, URL);
  await startRace(page, true);
  const mode = () => page.evaluate(() => window.bdnixStreet3d.current.stats().mode);
  expect(await mode()).toBe('chase');
  await page.keyboard.press('KeyV');
  await page.clock.runFor(200);
  expect(await mode()).toBe('rider');
  await page.keyboard.press('KeyP');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.getByRole('button', { name: 'New game' }).click();
  await until(page, () => window.bdnixStreet3d.current && window.bdnixStreet3d.current.stats().mode === 'rider');
  await page.keyboard.press('KeyV');
  await page.clock.runFor(200);
  expect(await mode()).toBe('chase');
});

test('the garage shows the camera and the graphics, and keeps a change', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) localStorage.setItem('bdnix_kingofstreets_career', JSON.stringify({ points: 0, owned: [1], done: [], view: 'rider' }));
    sessionStorage.setItem('seeded', '1');
  });
  await openGame(page, URL);
  await page.getByRole('button', { name: 'Garage' }).click();
  await expect(page.locator('#viewBtn')).toHaveText('Camera: rider');
  await page.locator('#viewBtn').click();
  await expect(page.locator('#viewBtn')).toHaveText('Camera: behind');
  await page.locator('#qualityBtn').click();
  const q = await page.locator('#qualityBtn').textContent();
  expect(['Graphics: low', 'Graphics: high']).toContain(q);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_career')).view)).toBe('chase');
  await page.reload();
  await page.getByRole('button', { name: 'Garage' }).click();
  await expect(page.locator('#viewBtn')).toHaveText('Camera: behind');
  await expect(page.locator('#qualityBtn')).toHaveText(q);
});

test('muting silences the engines, and pausing stops them', async ({ page }) => {
  await openGame(page, URL);
  await startRace(page, true);
  await page.keyboard.press('KeyM');
  expect(await page.evaluate(() => window.bdnixStreetAudio.state())).toMatchObject({ running: true, muted: true });
  await page.keyboard.press('KeyP');
  expect((await page.evaluate(() => window.bdnixStreetAudio.state())).running).toBe(false);
  await page.locator('#startBtn').click();
  expect((await page.evaluate(() => window.bdnixStreetAudio.state())).running).toBe(true);
});

test('by touch: drag to steer, tap to punch, flick up to kick, flick down to brake', async ({ page }) => {
  await seed(page, lonely, { rivals: { 2: { dz: 0.3, dx: -2 } } });
  await resume(page);
  const board = page.locator('#game');
  const touch = (type, x, y) => board.dispatchEvent(type, { pointerType: 'touch', isPrimary: true, pointerId: 1, clientX: x, clientY: y, button: 0 });
  await touch('pointerdown', 200, 300);
  await touch('pointermove', 260, 300);
  await page.clock.runFor(400);
  await touch('pointerup', 260, 300);
  let w = await race(page);
  expect(w.player.x).toBeGreaterThan(1);
  // A tap: a punch.
  await touch('pointerdown', 200, 300);
  await touch('pointerup', 200, 300);
  await page.clock.runFor(50);
  w = await race(page);
  expect(w.player.attack && w.player.attack.move).toBe('punch');
  await page.clock.runFor(500);
  // A flick up: a kick.
  await touch('pointerdown', 200, 300);
  await touch('pointermove', 200, 240);
  await touch('pointerup', 200, 240);
  await page.clock.runFor(50);
  w = await race(page);
  expect(w.player.attack && w.player.attack.move).toBe('kick');
  await page.clock.runFor(600);
  // A flick down: the brakes, until the finger lifts.
  const before = (await race(page)).player.speed;
  await touch('pointerdown', 200, 300);
  await touch('pointermove', 200, 360);
  await page.clock.runFor(400);
  await touch('pointerup', 200, 360);
  w = await race(page);
  expect(w.player.speed).toBeLessThan(before - 5);
});

test('without 3D graphics it says so, and offers nothing to start', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, o){ return kind === 'webgl2' ? null : get.call(this, kind, o); };
  });
  await openGame(page, URL);
  await expect(page.locator('#ovText')).toHaveText('This game needs 3D graphics (WebGL 2), which this browser can’t show.');
  await expect(page.locator('#startBtn')).toBeDisabled();
  await expect(page.locator('#garageBtn')).toBeDisabled();
});
