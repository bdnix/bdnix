import { test, expect } from './fixtures.mjs';
import { openGame, press, tap, listen, heard, soundProblems } from './games.mjs';

// With Math.random fixed at 0 every gap is at the same height: 64 to 188 on
// the 288 x 512 board. The bird hovers at 220 until the first flap.

// The bird's height on the board, found from its yellow pixels.
function birdY(page){
  return page.locator('#board').evaluate((c) => {
    const s = c.width / 288;
    const x0 = Math.floor(68 * s), w = Math.ceil(24 * s);
    const d = c.getContext('2d').getImageData(x0, 0, w, c.height).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 200 && Math.abs(d[i] - 250) < 12 && Math.abs(d[i + 1] - 204) < 12 && Math.abs(d[i + 2] - 21) < 12) {
        sum += Math.floor(i / 4 / w); n++;
      }
    }
    return n ? sum / n / s : null;
  });
}

// Flaps whenever the bird sinks below the middle of the gaps, until it has
// passed `pipes` pipes.
async function flyThrough(page, pipes, flap){
  const score = page.locator('#score');
  let prev = await birdY(page);
  for (let i = 0; i < 1000 && Number(await score.textContent()) < pipes; i++) {
    const y = await birdY(page);
    if (y > 150 && y >= prev) await flap();
    prev = y;
    await page.clock.runFor(32);
  }
  await expect(score).toHaveText(String(pipes));
}

test.beforeEach(async ({ page }) => {
  await openGame(page, '/flap/');
  await expect(page.locator('#ovTitle')).toHaveText('Flap');
  await page.clock.runFor(100);
});

test('flies through three pipes, then crashes', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  const overlay = page.locator('#overlay');
  await expect(overlay).toBeHidden();

  // Waits in the air until the first flap.
  await page.clock.runFor(3000);
  expect(Math.abs(await birdY(page) - 220)).toBeLessThan(8);

  await flyThrough(page, 3, () => press(page, 'Space'));

  // Stops flapping: falls into the next pipe, or the ground.
  for (let s = 0; s < 20 && !(await overlay.isVisible()); s++) await page.clock.runFor(250);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovText')).toHaveText('Score 3 — new best!');
  await expect(page.locator('#ovKicker')).toHaveText('bdnix arcade');   // no medal under 10
  expect(await page.evaluate(() => localStorage.getItem('bdnix_flappy_best'))).toBe('3');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_flappy_save'))).toBeNull(); // nothing left to resume
  await expect(page.locator('#newBtn')).toBeHidden();

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(overlay).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('3');

  // A worse round keeps the best score.
  await press(page, 'ArrowUp');
  for (let s = 0; s < 20 && !(await overlay.isVisible()); s++) await page.clock.runFor(250);
  await expect(page.locator('#ovText')).toHaveText('Score 0 · Best 3');
  await press(page, 'Enter');
  await expect(overlay).toBeHidden();
});

test('clicks and taps on the game flap', async ({ page }) => {
  await press(page, 'Enter');
  await expect(page.locator('#overlay')).toBeHidden();
  const game = page.locator('#game');
  const flap = () => tap(game);
  await flap();
  await page.clock.runFor(150);
  expect(await birdY(page)).toBeLessThan(200);          // rose from 220

  await flyThrough(page, 1, flap);

  // A right click doesn't flap.
  await page.clock.runFor(400);
  const before = await birdY(page);
  await game.dispatchEvent('pointerdown', { pointerType: 'mouse', button: 2 });
  await page.clock.runFor(50);
  expect(await birdY(page)).toBeGreaterThan(before);
});

test('pausing stops the game, and it resumes where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');
  await page.clock.runFor(200);
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#pauseBtn')).toHaveAttribute('aria-label', 'Resume');
  const y = await birdY(page);
  await page.clock.runFor(3000);
  expect(await birdY(page)).toBe(y);                    // hung in the air while paused
  await press(page, 'Space');                           // Space doesn't flap while paused...
  await expect(page.locator('#overlay')).toBeHidden();  // ...it resumes
  await page.clock.runFor(300);
  expect(await birdY(page)).not.toBe(y);

  await press(page, 'Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // switching away pauses
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();                // the overlay's Resume button
  await expect(page.locator('#overlay')).toBeHidden();
});

test('pausing before the first flap, and a hidden tab pauses too', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
});

test('a saved best score shows on load', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('bdnix_flappy_best', '12'));
  await page.reload();
  await expect(page.locator('#best')).toHaveText('12');
});

// What's on the left of the board, sampled once per world unit: where the
// bird's yellow body is, and the left edge of the pipes.
function scan(page){
  return page.locator('#board').evaluate((c) => {
    const s = c.width / 288;
    const d = c.getContext('2d').getImageData(0, 0, Math.ceil(160 * s), c.height).data, row = Math.ceil(160 * s);
    const bird = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    let pipeLeft = Infinity;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 160; x++) {
        const i = (Math.floor(y * s) * row + Math.floor(x * s)) * 4;
        const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
        if (a > 200 && Math.abs(r - 250) < 12 && Math.abs(g - 204) < 12 && Math.abs(b - 21) < 12) {
          bird.left = Math.min(bird.left, x); bird.right = Math.max(bird.right, x);
          bird.top = Math.min(bird.top, y); bird.bottom = Math.max(bird.bottom, y);
        }
        if (a > 200 && r < 40 && g > 90 && b > 100 && y < 420) pipeLeft = Math.min(pipeLeft, x);
      }
    }
    bird.y = (bird.top + bird.bottom) / 2;
    return { bird, pipeLeft };
  });
}

test('crashing into a pipe bounces the bird off it, and it tumbles down beside the pipe', async ({ page }) => {
  await listen(page);
  await page.reload();
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');
  // Keeps the bird below the gaps (64 to 188) until it flies into the bottom pipe.
  let prev = 220, before;
  for (let i = 0; i < 400; i++) {
    const s = await scan(page);
    if (s.bird.left < 67) break;                                       // knocked back from x 80
    before = s;
    if (s.bird.y > 320 && s.bird.y >= prev) await press(page, 'Space');
    prev = s.bird.y;
    await page.clock.runFor(32);
  }
  expect(before.bird.right).toBeLessThanOrEqual(before.pipeLeft + 1);
  const hit = await scan(page);
  expect(hit.bird.left).toBeLessThan(67);
  await expect.poll(async () => (await heard(page)).includes('hit')).toBe(true);

  // Frame by frame to game over: never in the pipe, and down to the ground.
  const overlay = page.locator('#overlay');
  let s = hit;
  for (let i = 0; i < 200 && !(await overlay.isVisible()); i++) {
    expect(s.bird.right, 'frame ' + i).toBeLessThanOrEqual(s.pipeLeft + 1);
    await page.clock.runFor(16);
    s = await scan(page);
  }
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  expect(s.bird.bottom).toBeGreaterThan(428);                         // on the ground
  expect(s.bird.right).toBeLessThan(80);                              // a little way back from where it flew
});

test('a reload keeps the round, paused where it was', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await flyThrough(page, 1, () => press(page, 'Space'));
  const y = await birdY(page);
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#score')).toHaveText('1');
  expect(Math.abs(await birdY(page) - y)).toBeLessThan(1);            // in the air where it was
  await page.clock.runFor(3000);
  expect(Math.abs(await birdY(page) - y)).toBeLessThan(1);            // and stays there while paused

  await page.locator('#startBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await flyThrough(page, 2, () => press(page, 'Space'));              // carries on through the next pipe
});

test('a reload while falling after a crash still ends the round', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await flyThrough(page, 1, () => press(page, 'Space'));
  // Stops flapping and reloads as soon as the bird hits something.
  const dying = () => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bdnix_flappy_save') || 'null');
    return s && s.data.state;
  });
  for (let s = 0; s < 200; s++) {
    await page.locator('#pauseBtn').click();                          // pausing saves
    const state = await dying();
    if (state === 'dying') break;
    await page.locator('#pauseBtn').click();
    await page.clock.runFor(20);
  }
  expect(await dying()).toBe('dying');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await page.locator('#startBtn').click();
  for (let s = 0; s < 20 && !(await page.locator('#ovTitle').textContent()).includes('Game over'); s++) await page.clock.runFor(250);
  await expect(page.locator('#ovTitle')).toHaveText('Game over');
  await expect(page.locator('#ovText')).toHaveText('Score 1 — new best!');
});

test('before the first flap there is nothing to keep', async ({ page }) => {
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Flap');
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');
  await page.clock.runFor(200);
  await press(page, 'KeyP');
  await page.getByRole('button', { name: 'New game' }).click();       // back to "Get ready"
  await expect(page.locator('#overlay')).toBeHidden();
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Flap');
});

test('a round saved before the bird could bounce back still loads', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bdnix_flappy_save', JSON.stringify({ v: 1, data: {
    state: 'playing', stateTime: 1, carry: 0, groundTime: 0, wingTime: 1, bird: { y: 300, vy: 0 },
    pipes: [], nextPipe: 300, score: 2, dead: false, landed: false, distance: 500
  } })));
  await page.reload();
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#score')).toHaveText('2');
  expect(Math.abs(await birdY(page) - 300)).toBeLessThan(1);          // found where birds fly, at x 80
});

test('a save that does not make sense is thrown away', async ({ page }) => {
  const round = {
    state: 'dying', stateTime: 1, carry: 0, groundTime: 0, wingTime: 1, pipes: [],
    nextPipe: 300, score: 2, dead: true, landed: false, distance: 500
  };
  for (const bird of [{}, { x: 'far', y: 300, vx: 0, vy: 0 }, { x: 60, y: 300, vx: null, vy: 0 }]) {
    // Written as the page loads, after the game in progress has saved itself.
    await page.addInitScript((data) => localStorage.setItem('bdnix_flappy_save', JSON.stringify({ v: 1, data })), { ...round, bird });
    await page.reload();
    await expect(page.locator('#ovTitle')).toHaveText('Flap');
    expect(await page.evaluate(() => localStorage.getItem('bdnix_flappy_save'))).toBeNull();
  }
});

test('flapping, scoring and crashing each have a sound', async ({ page }) => {
  await listen(page);
  await page.reload();
  await page.getByRole('button', { name: 'Start game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await press(page, 'Space');
  expect(await heard(page)).toEqual(['flap']);
  await flyThrough(page, 1, () => press(page, 'Space'));
  const sounds = await heard(page);
  expect(sounds.pop()).toBe('point');
  expect(new Set(sounds)).toEqual(new Set(['flap']));

  const overlay = page.locator('#overlay');
  for (let s = 0; s < 20 && !(await overlay.isVisible()); s++) await page.clock.runFor(250);
  expect(await heard(page)).toEqual(['hit', 'best']);
  await page.getByRole('button', { name: 'Play again' }).click();
  await press(page, 'Space');
  for (let s = 0; s < 20 && !(await overlay.isVisible()); s++) await page.clock.runFor(250);
  expect(await heard(page)).toEqual(['start', 'flap', 'hit', 'over']);
});

test('its sounds are well formed and loud enough', async ({ page }) => {
  expect(await soundProblems(page)).toEqual([]);
});
