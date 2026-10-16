import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { checkPage, axeProblems } from '../../../tests/ui/checks.mjs';
import { checkGame } from '../../../tests/ui/checks-game.mjs';
import { press } from '../../../tests/ui/games.mjs';

// The checks every page and every game gets (see checks.mjs and checks-game.mjs),
// in English. Its other languages are its i18n target's (i18n.spec.mjs).
checkPage('/road-hop/', { languages: false, schema: 'WebApplication', category: 'GameApplication', game: true });
checkGame('/road-hop/', { languages: false, credit: ['Crossy Road', 'Hipster Whale'], gamepad: { dpad: { up: 'Up', left: 'Left', right: 'Right', down: 'Down' } } });

// checkPage checks the page with axe as it opens; this checks the pause screen.
test('the pause screen passes axe', async ({ page }) => {
  // Not openGame(): axe needs a running clock. The chicken waits on the
  // grass for its first hop, and the game is paused straight away, so
  // nothing happens while axe looks.
  await page.goto('/road-hop/');
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  expect(await axeProblems(page)).toEqual([]);
});
