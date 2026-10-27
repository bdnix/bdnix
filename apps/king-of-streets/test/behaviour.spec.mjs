import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openGame, press, inkOn, tap, listen, heard, soundProblems } from '../../../tests/ui/games.mjs';

// The race as saved: pausing saves it, and resuming carries on at the same
// moment, since time only moves when a test runs the clock.
async function peek(page){
  await press(page, 'KeyP');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_kingofstreets_save') || 'null'));
  await press(page, 'KeyP');
  return s && s.data;
}
const stored = (page) => page.evaluate(() => localStorage.getItem('bdnix_kingofstreets_save'));

// Loads the page with a race saved as `data`. Only once: a later reload
// finds whatever the game saved, as a visitor's would. (Each call's script
// runs on every load after it, so each saves only if it's the newest.)
let seeds = 0;
async function openSaved(page, data){
  await page.addInitScript(([d, n]) => {
    if (n <= (+sessionStorage.getItem('seeded') || 0)) return;
    sessionStorage.setItem('seeded', n);
    localStorage.setItem('bdnix_kingofstreets_save', JSON.stringify({ v: 1, data: d }));
  }, [data, ++seeds]);
  await page.reload();
}
// A race in progress, made with the page's own rules (street-core.js):
// race `race`, late enough that the traffic has driven on far ahead, with
// the player riding at 30 m/s and every rival stopped at the start. `set`
// changes it, given the world: (w, F) => { ... }.
function race(page, set = '', race = 1){
  return page.evaluate(([set, race]) => {
    const F = window.bdnixStreet, w = F.create(race);
    w.time = 3000;
    Object.assign(w.player, { z: 200, speed: 30 });
    w.rivals.forEach((o) => { o.z = 0; o.speed = 0; o.cool = 5; });
    if (set) new Function('w', 'F', set)(w, F);
    return { state: 'playing', carry: 0, world: F.snapshot(w) };
  }, [set, race]);
}
// Opens a saved race and resumes it.
async function ride(page, set, n){
  await openSaved(page, await race(page, set, n));
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await page.locator('#startBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
}
// Waits (on the frozen clock) for the overlay to show.
async function waitForOverlay(page, ms = 20000){
  const overlay = page.locator('#overlay');
  for (let t = 0; t < ms && !(await overlay.isVisible()); t += 250) await page.clock.runFor(250);
  await expect(overlay).toBeVisible();
}
// Holds a key down for `ms` of the game's time.
async function hold(page, key, ms){
  await page.keyboard.down(key);
  await page.clock.runFor(ms);
  await page.keyboard.up(key);
}
// Rival `i` alongside the player, `dz` metres ahead and `dx` across, keeping
// pace, with `extra` set too (cool: 0 to fight back straight away).
const alongside = (i, dz, dx, extra = '') => `Object.assign(w.rivals[${i}], { z: w.player.z + ${dz}, x: w.player.x + ${dx}, speed: 30, top: 30 }, { ${extra} });`;

// A digest of what's drawn on the board.
function drawn(page){
  return page.locator('#board').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
    return h;
  });
}

test.beforeEach(async ({ page }) => {
  await openGame(page, '/king-of-streets/');
  await expect(page.locator('#ovTitle')).toHaveText('King of Streets');
  await page.clock.runFor(100);
});

test('a countdown, then the race: the bike speeds up along the road', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(2000);
  expect(await peek(page)).toBeNull();                 // nothing to keep on the grid
  await page.clock.runFor(1200);
  const s = await peek(page);
  expect(s.state).toBe('playing');
  expect(s.world.race).toBe(1);
  expect(s.world.player.z).toBeGreaterThan(0);
  expect(s.world.rivals.every((o) => o.z > 0 && o.speed > 0)).toBe(true);
  await page.clock.runFor(3000);
  const later = await peek(page);
  expect(later.world.player.speed).toBeGreaterThan(s.world.player.speed);
  expect(later.world.player.z).toBeGreaterThan(s.world.player.z + 50);
  await expect(page.locator('#score')).toHaveText('0');
});

test('the race is drawn on the board, moving, and still while paused', async ({ page }) => {
  expect(await inkOn(page, '#board')).toBeGreaterThan(1000);   // the grid, under the start screen
  await expect(page.locator('#board')).toHaveAttribute('aria-label', 'King of Streets race');
  await ride(page);
  const a = await drawn(page);
  await page.clock.runFor(200);
  const b = await drawn(page);
  expect(b).not.toBe(a);
  await press(page, 'KeyP');
  await page.clock.runFor(100);
  const c = await drawn(page);
  await page.clock.runFor(1000);
  expect(await drawn(page)).toBe(c);
});

test('the board is upright on a phone held upright, and wide on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(100);
  let box = await page.locator('#board').boundingBox();
  expect(box.height).toBeGreaterThan(box.width * 1.4);
  expect(box.width).toBeGreaterThan(330);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.clock.runFor(100);
  box = await page.locator('#board').boundingBox();
  expect(box.width).toBeGreaterThan(box.height * 1.3);
});

test('the arrow keys steer and brake', async ({ page }) => {
  await ride(page);
  let s = await peek(page);
  await hold(page, 'ArrowRight', 300);
  let now = await peek(page);
  expect(now.world.player.x).toBeGreaterThan(s.world.player.x + 0.3);
  await hold(page, 'KeyA', 300);                        // and A and D
  s = now; now = await peek(page);
  expect(now.world.player.x).toBeLessThan(s.world.player.x - 0.3);
  const fast = now.world.player.speed;
  await hold(page, 'ArrowDown', 500);
  now = await peek(page);
  expect(now.world.player.speed).toBeLessThan(fast - 10);
  // Let go, it speeds up again.
  await page.clock.runFor(1000);
  expect((await peek(page)).world.player.speed).toBeGreaterThan(now.world.player.speed);
});

test('X punches and Z kicks a rival alongside', async ({ page }) => {
  await ride(page, alongside(0, 0.5, 0.2));
  await press(page, 'KeyX');
  await page.clock.runFor(400);
  let o = (await peek(page)).world.rivals[0];
  expect(o.health).toBe(40 - 10);
  await press(page, 'KeyZ');
  await page.clock.runFor(700);
  o = (await peek(page)).world.rivals[0];
  expect(o.health).toBe(40 - 10 - 15);
  // J and K punch and kick too.
  await press(page, 'KeyJ');
  expect((await peek(page)).world.player.attack.move).toBe('punch');
  await page.clock.runFor(400);
  await press(page, 'KeyK');
  expect((await peek(page)).world.player.attack.move).toBe('kick');
});

test('knocking a rival off scores and takes their weapon, and it swings for a punch', async ({ page }) => {
  await ride(page, alongside(1, 0.5, 0.2, 'health: 5') + alongside(2, 1, -0.3));   // Bablu has the stick
  await press(page, 'KeyX');
  await page.clock.runFor(200);
  await expect(page.locator('#score')).toHaveText('100');
  await expect(page.locator('#best')).toHaveText('100');
  let s = await peek(page);
  expect(s.world.rivals[1].down).toBeGreaterThan(0);
  expect(s.world.rivals[1].weapon).toBeNull();
  expect(s.world.player.weapon).toBe('stick');
  await page.clock.runFor(300);
  await press(page, 'KeyX');
  s = await peek(page);
  expect(s.world.player.attack.move).toBe('stick');
  await page.clock.runFor(500);
  expect((await peek(page)).world.rivals[2].health).toBe(40 - 20);
});

test('rivals hit back', async ({ page }) => {
  await ride(page, alongside(4, 0.5, 0.3, 'cool: 0'));  // Tinku, with the chain
  await page.clock.runFor(500);
  expect((await peek(page)).world.player.health).toBe(100 - 12);
});

test('riding into the back of traffic knocks you off, and you get back on', async ({ page }) => {
  await ride(page, 'const car = F.traffic(1)[0]; w.time = 0; Object.assign(w.player, { z: car.z0 - 1.5, x: car.x, speed: 50, weapon: "chain" });');
  await page.clock.runFor(50);
  let s = await peek(page);
  expect(s.world.player.crash).toBeGreaterThan(2);
  expect(s.world.player.health).toBe(80);
  expect(s.world.player.weapon).toBeNull();
  await press(page, 'KeyX');                            // no fighting from the tarmac
  expect((await peek(page)).world.player.attack).toBeNull();
  await page.clock.runFor(2500);
  s = await peek(page);
  expect(s.world.player.crash).toBe(0);
  expect(s.world.player.speed).toBeGreaterThan(0);
});

test('out of health is a knockout: game over', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('bdnix_kingofstreets_best', '400'));
  await ride(page, 'w.player.health = 3; w.score = 200;' + alongside(0, 0.5, 0.2, 'cool: 0'));
  await waitForOverlay(page);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovKicker')).toHaveText('Knocked out cold.');
  await expect(page.locator('#ovText')).toHaveText('Score 200 · Best 400');
  expect(await stored(page)).toBeNull();                // nothing left to resume
  await expect(page.locator('#newBtn')).toBeHidden();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('400');
});

test('finishing in the top three scores, and the next race starts', async ({ page }) => {
  await ride(page, 'w.player.z = w.length - 20; w.player.speed = 50; w.score = 100;' +
    'Object.assign(w.rivals[3], { z: w.length + 5, place: 1, speed: 40 }); w.finished = 1;');
  await page.clock.runFor(1000);
  await expect(page.locator('#score')).toHaveText('700');   // 100, and 600 for second
  // A race just won saves as the start of the next.
  let s = await peek(page);
  expect([s.state, s.world.race, s.world.time, s.world.score, s.world.player.z]).toEqual(['ready', 2, 0, 700, 0]);
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovKicker')).toHaveText('Race 2');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#score')).toHaveText('700');
  await page.locator('#startBtn').click();
  await page.clock.runFor(4000);
  s = await peek(page);
  expect([s.state, s.world.race, s.world.player.health]).toEqual(['playing', 2, 100]);
  expect(s.world.player.z).toBeGreaterThan(0);
});

test('without a reload, the next race follows the result', async ({ page }) => {
  await ride(page, 'w.player.z = w.length - 20; w.player.speed = 50;');
  await page.clock.runFor(1000);
  await expect(page.locator('#score')).toHaveText('1000');
  await page.clock.runFor(4000);
  let s = await peek(page);
  expect([s.state, s.world.race]).toEqual(['ready', 2]);
  await page.clock.runFor(3500);
  s = await peek(page);
  expect([s.state, s.world.race]).toEqual(['playing', 2]);
});

test('finishing fourth ends the game', async ({ page }) => {
  await ride(page, 'w.player.z = w.length - 20; w.player.speed = 50; w.score = 300;' +
    '[0, 1, 2].forEach((i) => Object.assign(w.rivals[i], { z: w.length + 5 + i, place: i + 1, speed: 40 })); w.finished = 3;');
  await waitForOverlay(page);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovKicker')).toHaveText('4th place: not in the top three.');
  await expect(page.locator('#ovText')).toHaveText('Score 300 — new best!');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_kingofstreets_best'))).toBe('300');
  expect(await stored(page)).toBeNull();
});

test('on a phone: drag to steer, tap to punch, flick up to kick, flick down to brake', async ({ page }) => {
  await ride(page, alongside(0, 0.5, 0.2));
  const game = page.locator('#game');
  const touch = (type, x, y, id = 1) => game.dispatchEvent(type, { pointerType: 'touch', pointerId: id, isPrimary: id === 1, clientX: x, clientY: y });
  // A tap punches.
  await touch('pointerdown', 200, 400);
  await touch('pointerup', 200, 400);
  let s = await peek(page);
  expect(s.world.player.attack.move).toBe('punch');
  await page.clock.runFor(400);
  expect((await peek(page)).world.rivals[0].health).toBe(30);
  // A drag steers, as far as it goes: here to the left, away from Kalu.
  s = await peek(page);
  await touch('pointerdown', 200, 400);
  await touch('pointermove', 140, 404);
  await page.clock.runFor(300);
  let now = await peek(page);
  expect(now.world.player.x).toBeLessThan(s.world.player.x - 0.3);
  expect(now.world.player.attack).toBeNull();           // lifting after a drag isn't a tap
  await touch('pointermove', 200, 404);                 // back to the middle: straight on
  await touch('pointerup', 200, 404);
  // A flick up kicks.
  await page.clock.runFor(1000);
  await touch('pointerdown', 200, 400);
  await touch('pointermove', 202, 340);
  expect((await peek(page)).world.player.attack.move).toBe('kick');
  await touch('pointerup', 202, 340);
  // A flick down brakes until the finger lifts.
  await page.clock.runFor(1000);
  s = await peek(page);
  await touch('pointerdown', 200, 300);
  await touch('pointermove', 200, 360);
  await page.clock.runFor(500);
  now = await peek(page);
  expect(now.world.player.speed).toBeLessThan(s.world.player.speed - 10);
  await touch('pointerup', 200, 360);
  await page.clock.runFor(500);
  expect((await peek(page)).world.player.speed).toBeGreaterThan(now.world.player.speed);
  // Only the first finger plays.
  s = await peek(page);
  await touch('pointerdown', 200, 400);
  await touch('pointerdown', 300, 400, 2);
  await touch('pointermove', 360, 400, 2);
  await page.clock.runFor(300);
  expect(Math.abs((await peek(page)).world.player.x - s.world.player.x)).toBeLessThan(0.2);
  await touch('pointerup', 360, 400, 2);
  await touch('pointercancel', 200, 400);
  // A touch on the score is for pausing, not playing.
  await tap(page.locator('.stats'));
  expect((await peek(page)).world.player.attack).toBeNull();
});

test('pausing stops the race, and it resumes where it was', async ({ page }) => {
  await ride(page);
  await page.clock.runFor(500);
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovKicker')).toHaveText('Race 1');
  await expect(page.locator('#startBtn')).toHaveText('Resume');
  const before = await stored(page);
  await page.clock.runFor(3000);
  await press(page, 'KeyX');                            // keys do nothing while paused
  await hold(page, 'ArrowLeft', 300);
  await press(page, 'KeyP');
  await press(page, 'KeyP');
  expect(await stored(page)).toBe(before);
  await press(page, 'Space');                           // Space resumes...
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(300);
  expect((await peek(page)).world.player.z).toBeGreaterThan(JSON.parse(before).data.world.player.z);   // ...and on it goes
});

test('a saved best score shows on load', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('bdnix_kingofstreets_best', '3100'));
  await page.reload();
  await expect(page.locator('#best')).toHaveText('3100');
});

test('a reload keeps the race, paused where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.clock.runFor(6000);
  await hold(page, 'ArrowRight', 100);
  const s = await peek(page);
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await page.clock.runFor(3000);
  await page.locator('#startBtn').click();              // Resume
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await peek(page)).toEqual(s);                  // on the same spot
  await page.clock.runFor(1000);
  expect((await peek(page)).world.player.z).toBeGreaterThan(s.world.player.z + 20);
});

test('New game from the pause screen starts over, and before the first race starts there is nothing to keep', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('King of Streets');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.clock.runFor(5000);
  await press(page, 'KeyP');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('King of Streets');
  expect(await stored(page)).toBeNull();
});

test('saves that do not make sense are thrown away', async ({ page }) => {
  const good = await race(page);
  const grid = await page.evaluate(() => ({ state: 'ready', carry: 0, world: window.bdnixStreet.snapshot(window.bdnixStreet.create(2)) }));
  for (const bad of [
    { world: good.world },                                                     // missing most fields
    { ...good, state: 'over' },
    { ...good, carry: -1 },
    { ...good, carry: 0.5 },                                                   // more than a step
    { ...good, world: null },
    { ...good, world: { ...good.world, race: 0 } },
    { ...good, world: { ...good.world, player: { ...good.world.player, health: 0 } } },     // already out
    { ...good, world: { ...good.world, rivals: good.world.rivals.slice(1) } },             // a rival missing
    { ...good, state: 'ready' },                                               // on the grid, but already riding
    { ...grid, world: { ...grid.world, race: 1 } }                             // the first race's grid isn't kept
  ]) {
    await openSaved(page, bad);
    await expect(page.locator('#ovTitle'), JSON.stringify(bad).slice(0, 80)).toHaveText('King of Streets');
    expect(await stored(page)).toBeNull();
  }
  await openSaved(page, grid);                                                // and good ones are kept
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await openSaved(page, good);
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
});

test('the countdown, blows, knockouts, crashes and the finish each have a sound', async ({ page }) => {
  await listen(page);
  await page.reload();
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.clock.runFor(3200);
  expect(await heard(page)).toEqual(['start', 'beep', 'beep', 'beep', 'go']);

  await ride(page, alongside(0, 0.5, 0.2, 'health: 25') + alongside(4, 0.5, 0.3, 'cool: 0'));
  await press(page, 'KeyJ');                            // a punch: 15 left, and Tinku's chain
  await page.clock.runFor(300);
  expect(await heard(page)).toEqual(['swing', 'punch', 'hurt']);
  await ride(page, alongside(0, 0.5, 0.2, 'health: 15'));
  await press(page, 'KeyK');                            // a kick knocks Kalu off
  await page.clock.runFor(600);
  expect(await heard(page)).toEqual(['swing', 'kick', 'ko']);

  await ride(page, alongside(1, 0.5, 0.2, 'health: 5') + alongside(2, 1, -0.3));
  await press(page, 'KeyX');                            // Bablu's stick...
  await page.clock.runFor(600);
  await press(page, 'KeyX');                            // ...on Mintu
  await page.clock.runFor(400);
  expect(await heard(page)).toEqual(['swing', 'punch', 'ko', 'swing', 'whack']);

  await ride(page, alongside(0, 0.5, 0.05));
  await page.clock.runFor(50);
  expect(await heard(page)).toContain('bump');

  await ride(page, 'const car = F.traffic(1)[0]; w.time = 0; Object.assign(w.player, { z: car.z0 - 1.5, x: car.x, speed: 50 });');
  await page.clock.runFor(50);
  expect(await heard(page)).toEqual(['crash']);

  await ride(page, 'w.player.z = w.length - 10; w.player.speed = 50;');
  await page.clock.runFor(500);
  expect(await heard(page)).toEqual(['finish']);

  await ride(page, 'w.player.z = w.length - 10; w.player.speed = 50; w.score = 50;' +
    '[0, 1, 2].forEach((i) => Object.assign(w.rivals[i], { z: w.length + 5 + i, place: i + 1, speed: 40 })); w.finished = 3;');
  await waitForOverlay(page);
  expect(await heard(page)).toEqual(['best']);
  await ride(page, 'w.player.z = w.length - 10; w.player.speed = 50;' +
    '[0, 1, 2].forEach((i) => Object.assign(w.rivals[i], { z: w.length + 5 + i, place: i + 1, speed: 40 })); w.finished = 3;');
  await waitForOverlay(page);
  expect(await heard(page)).toEqual(['over']);
});

test('its sounds are well formed and loud enough', async ({ page }) => {
  expect(await soundProblems(page)).toEqual([]);
});
