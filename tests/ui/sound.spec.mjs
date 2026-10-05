import { test, expect } from './fixtures.mjs';
import { openGame, press, listen, heard } from './games.mjs';

// Every game has a mute button in its top bar (checkGame in checks.mjs
// checks each). This checks the choice is shared: muting one game mutes the
// others, and M turns it back on. Two games are enough to show it.
const btn = (page) => page.locator('#soundBtn');
const games = ['/snake/', '/brick-bounce/'];

test('muting one game mutes them all', async ({ page }) => {
  await listen(page);
  await openGame(page, games[0]);
  await btn(page).click();
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_sound'))).toBe('off');
  await expect(btn(page)).not.toBeFocused();         // so Space and Enter go to the game, not the button

  // Still muted after a reload and on the other game, and nothing plays.
  for (const url of games) {
    await page.goto(url);
    await expect(btn(page), url).toHaveAttribute('aria-label', 'Unmute sound');
    await page.getByRole('button', { name: 'Start game' }).click();
    expect(await heard(page), url).toEqual([]);
  }

  // M turns it back on (and off again).
  await press(page, 'KeyM');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Mute sound');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_sound'))).toBe('on');
  await press(page, 'KeyP');                           // Brick Bounce is on "Get ready": pause it
  await page.getByRole('button', { name: 'New game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await press(page, 'KeyM');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
});

test('the games play without storage, with sound on', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get(){ throw new Error('blocked'); } });
  });
  await listen(page);
  await openGame(page, '/snake/');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Mute sound');
  await page.getByRole('button', { name: 'Start game' }).click();
  expect(await heard(page)).toEqual(['start']);
  await btn(page).click();                             // mutes for this visit, just can't remember it
  await expect(btn(page)).toHaveAttribute('aria-label', 'Unmute sound');
});

// Makes audio behave as it does in Safari on an iPhone: it only starts, or
// starts again, while the page is handling a tap or key press. Every audio
// context the page makes is kept in window.audio.
async function likeSafari(page){
  await page.addInitScript(() => {
    const pressing = () => !!window.event && window.event.isTrusted && /^(pointer|touch|key|click|mouse)/.test(window.event.type);
    const Real = window.AudioContext;
    window.audio = [];
    window.AudioContext = class extends Real {
      constructor(){ super(); this.awake = pressing(); window.audio.push(this); }
      get state(){ return this.awake ? 'running' : 'suspended'; }
      resume(){ if (pressing()) this.awake = true; return Promise.resolve(); }
    };
  });
}
const audioStates = (page) => page.evaluate(() => window.audio.map((c) => c.state));

test('on Safari, resuming a saved game still has sound, even when every sound comes from the game loop', async ({ page }) => {
  await likeSafari(page);
  await listen(page);
  await openGame(page, '/maze-chase/');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.clock.runFor(2300 + 500);                 // eats a few dots
  await press(page, 'KeyP');
  await page.reload();                                 // comes back paused, with no sound yet
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await heard(page);

  await press(page, 'Enter');                          // Resume: makes no sound of its own
  await page.clock.runFor(1000);
  expect(await heard(page)).toContain('chomp');
  expect(await audioStates(page)).toEqual(['running']);

  // Locking the phone puts the audio to sleep; the next steer wakes it.
  await page.evaluate(() => window.audio.forEach((c) => { c.awake = false; }));
  await press(page, 'ArrowUp');
  expect(await audioStates(page)).toEqual(['running']);
});

test('on Safari, a resumed Brick Bounce game still has its bounce sounds', async ({ page }) => {
  await likeSafari(page);
  await listen(page);
  await openGame(page, '/brick-bounce/');
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'Space');                          // launch the ball
  await page.clock.runFor(200);
  await press(page, 'KeyP');
  await page.reload();                                 // comes back paused, with no sound yet
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await heard(page);

  await press(page, 'Enter');                          // Resume: makes no sound of its own
  let sounds = [];
  for (let t = 0; t < 10000 && !sounds.length; t += 50) {
    await page.clock.runFor(50);
    sounds = await heard(page);
  }
  expect(['brick', 'paddle', 'wall']).toContain(sounds[0]);
  expect(await audioStates(page)).toEqual(['running']);
});
