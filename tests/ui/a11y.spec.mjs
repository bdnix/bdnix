import { test, expect } from './fixtures.mjs';
import { press } from './games.mjs';
import { upload, numberedPdf } from './pdfs.mjs';
import { axeProblems } from './checks.mjs';

// Every page is checked with axe as it opens (checkPage in checks.mjs, from
// each app's own site spec). This checks the shared parts in the states
// they're in once a page is in use: a game's pause screen and a tool's file
// list and preview.
test('a paused game, and a tool with files in it, pass axe too', async ({ page }) => {
  // Not openGame(): axe needs a running clock, and the snake waits for the
  // first turn before it moves, so nothing happens while axe looks.
  await page.goto('/snake/');
  await page.getByRole('button', { name: 'Start game' }).click();
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  expect(await axeProblems(page)).toEqual([]);

  await page.goto('/merge-pdf/');
  await page.locator('#picker').setInputFiles([upload('A.pdf', await numberedPdf(100, 3)), upload('B.pdf', await numberedPdf(200, 2))]);
  await expect(page.locator('.file')).toHaveCount(2);
  // With with the merged file's preview showing.
  await expect(page.locator('#pageLabel')).toHaveText('Page 1 of 5');
  await expect(page.locator('#pageCanvas')).toBeVisible();
  expect(await axeProblems(page)).toEqual([]);
});
