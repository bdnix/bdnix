import { test, expect } from './fixtures.mjs';
import { openGame, press, tap, listen, heard } from './games.mjs';

// The player starts low in the maze, heading left. Each dot is 10 points and a
// power pellet 50. The game waits 2.2 seconds on "Ready" before it moves.

test.beforeEach(async ({ page }) => {
  await openGame(page, '/maze-chase/');
  await expect(page.locator('#ovTitle')).toHaveText('Maze Chase');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(2300);
});

test('eats its way to a power pellet, then loses its lives', async ({ page }) => {
  // Plays out every frame until the ghosts have caught it three times, which
  // takes most of the default 30 s at phone size and more when the machine
  // is busy, so give it the extra time Playwright allows for slow tests.
  test.slow();
  const score = page.locator('#score');
  await page.clock.runFor(2000);                    // left to the corner: 11 dots and a pellet
  await expect(score).toHaveText('160');
  await press(page, 'ArrowUp');
  await page.clock.runFor(800);                     // 3 dots up the side, to the wall
  await expect(score).toHaveText('190');

  // Stuck at the top of the side corridor, the ghosts catch it three times.
  const overlay = page.locator('#overlay');
  for (let s = 0; s < 120 && !(await overlay.isVisible()); s++) await page.clock.runFor(1000);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovText')).toHaveText('Score 190 — new best!');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_pacman_best'))).toBe('190');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_pacman_save'))).toBeNull(); // nothing left to resume
  await expect(page.locator('#newBtn')).toBeHidden();

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(overlay).toBeHidden();
  await expect(score).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('190');
});

test('pausing stops the game, and it resumes where it was', async ({ page }) => {
  const score = page.locator('#score');
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  await page.clock.runFor(5000);
  await expect(score).toHaveText('0');              // didn't move while paused

  await press(page, 'KeyP');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(2000);
  await expect(score).toHaveText('160');

  await press(page, 'Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
});

test('the touch buttons and swipes steer', async ({ page }) => {
  const score = page.locator('#score');
  await page.clock.runFor(2000);                    // stopped in the corner, 160 points
  await expect(score).toHaveText('160');
  await tap(page.locator('.touch button[data-dir="up"]'));
  await page.clock.runFor(800);                     // up the side corridor
  await expect(score).toHaveText('190');

  // A swipe right steers right at the next junction.
  const game = page.locator('#game');
  await game.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 });
  await game.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 140, clientY: 102 });
  await game.dispatchEvent('pointerup', { pointerType: 'touch' });
  const before = Number(await score.textContent());
  await page.clock.runFor(1000);
  expect(Number(await score.textContent())).toBeGreaterThan(before);
});

test('a reload keeps the game, paused where it was', async ({ page }) => {
  // The same route as the first test, with a reload in the corner.
  const score = page.locator('#score');
  await page.clock.runFor(2000);
  await expect(score).toHaveText('160');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(score).toHaveText('160');
  await page.clock.runFor(5000);
  await expect(score).toHaveText('160');                              // didn't move while paused

  await press(page, 'Enter');
  await expect(page.locator('#overlay')).toBeHidden();
  await press(page, 'ArrowUp');
  await page.clock.runFor(800);
  await expect(score).toHaveText('190');                              // the same 3 dots up the side
});

test('New game on the pause screen starts over', async ({ page }) => {
  await page.clock.runFor(2000);
  await page.reload();
  await expect(page.locator('#score')).toHaveText('160');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await page.clock.runFor(2300 + 2000);
  await expect(page.locator('#score')).toHaveText('160');              // every dot back
});

test('a save that does not make sense is thrown away', async ({ page }) => {
  // Written as the page loads, after the game in progress has saved itself.
  await page.addInitScript(() => localStorage.setItem('bdnix_pacman_save', JSON.stringify({ v: 1, data: { state: 'playing', score: 5 } })));
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Maze Chase');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_pacman_save'))).toBeNull();
});

test('a save from a different maze is thrown away', async ({ page }) => {
  // A real save, but with a dot where this maze has a wall, as a save from the
  // old layout would have. Written as the page loads, like the test above.
  await page.clock.runFor(1500);
  await press(page, 'KeyP');
  const save = JSON.parse(await page.evaluate(() => localStorage.getItem('bdnix_pacman_save')));
  save.data.dots[0][0] = 1;
  await page.addInitScript(s => localStorage.setItem('bdnix_pacman_save', s), JSON.stringify(save));
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Maze Chase');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_pacman_save'))).toBeNull();
});

test('dots, power pellets and getting caught each have a sound', async ({ page }) => {
  await listen(page);
  await page.reload();                              // paused, from the save
  await page.getByRole('button', { name: 'New game' }).click();
  await page.clock.runFor(2300 + 2000);             // left to the corner: 11 dots and a pellet
  const chomps = Array.from({ length: 11 }, (_, i) => (i % 2 ? 'chomp2' : 'chomp'));
  expect(await heard(page)).toEqual(['start', ...chomps, 'power']);

  // Stuck in the corner, a ghost catches it.
  let sounds = [];
  for (let s = 0; s < 60 && !sounds.includes('die'); s++) {
    await page.clock.runFor(500);
    sounds = sounds.concat(await heard(page));
  }
  expect(sounds).toContain('die');
});

test('eating a ghost or fruit, an extra life and clearing the maze each have a sound', async ({ page }) => {
  // A real save, changed to put the player two tiles right of the power
  // pellet in the bottom-left corner, heading for it, with a fruit and a
  // frightened ghost where it stands. The fruit takes the score past 10,000,
  // and after the pellet the dot above it is the last one. (Where the player
  // is when the game pauses shifts by a frame from run to run, so it's set
  // rather than taken from the save.)
  await page.clock.runFor(1500);
  await press(page, 'KeyP');
  const save = JSON.parse(await page.evaluate(() => localStorage.getItem('bdnix_pacman_save')));
  const d = save.data, at = { x: 3, y: 23 }, left = { x: -1, y: 0 };
  d.dots[23][1] = 2;
  Object.assign(d.pac, at, { dir: left, face: left });
  Object.assign(d, { dotsLeft: 2, score: 9995, extraLifeGiven: false, frightTime: 5, fruit: { ...at, t: 5 } });
  Object.assign(d.ghosts[0], at, { state: 'active', fright: true, dir: left });
  await page.addInitScript(s => localStorage.setItem('bdnix_pacman_save', s), JSON.stringify(save));
  await listen(page);
  await page.reload();
  await press(page, 'Enter');
  await page.clock.runFor(1500);                    // stops in the corner after the pellet
  expect(await heard(page)).toEqual(['life', 'fruit', 'ghost', 'power']);
  await press(page, 'ArrowUp');
  await page.clock.runFor(800);
  expect((await heard(page)).slice(-1)).toEqual(['level']);   // after the last chomp
});
