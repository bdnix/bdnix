import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkGameLanguages } from '../../../tests/ui/checks-game.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';
import { inLanguage, expectTranslated } from '../../../tests/ui/languages.mjs';
import { openGame } from '../../../tests/ui/games.mjs';
import { URL, noDrawing, seed, resume, startRace } from './street.mjs';

// King of Streets' i18n target: the page and the game in every other language
// the site has, from its own translations (lang/) and those of the shared
// modules it uses, and nothing else; and its cards and messages in Bangla.
noDrawing(test);
checkPageLanguages('/king-of-streets/');
checkGameLanguages('/king-of-streets/', { upright: false });
checkStrings('/king-of-streets/', 'king-of-streets');

test('in Bangla: the garage, a quick race, the race and its result', async ({ page }) => {
  await inLanguage(page, 'bn');
  await page.addInitScript(() => {
    if (!localStorage.getItem('bdnix_kingofstreets_career')) localStorage.setItem('bdnix_kingofstreets_career', JSON.stringify({ points: 5000, owned: [1, 2], done: [1] }));
  });
  await openGame(page, URL);
  await expect(page.locator('#ovCareer')).toHaveText('রেস ২/১৫ · ৫০০০ পয়েন্ট · ১২৫');
  await page.getByRole('button', { name: 'গ্যারেজ' }).click();
  await expect(page.locator('#garagePoints')).toHaveText('৫০০০ পয়েন্ট');
  await expect(page.locator('.bikes li').nth(2)).toContainText('সর্বোচ্চ গতি ১৩৫ কিমি/ঘণ্টা');
  await page.locator('#viewBtn').click();
  await expectTranslated(page, 'bn');
  await page.getByRole('button', { name: 'হয়ে গেছে' }).click();
  await page.getByRole('button', { name: 'ঝটপট রেস' }).click();
  await expectTranslated(page, 'bn');
  await page.locator('#quickBack').click();
  await startRace(page, true);
  await expect(page.locator('#togo')).toHaveText(/^২\.[০-৯] কিমি$/);
  await expectTranslated(page, 'bn');
});

test('in Bangla: a knockout, a weapon taken and the race won', async ({ page }) => {
  await inLanguage(page, 'bn');
  await seed(page, () => {
    const F = window.bdnixStreet, w = F.create(1);
    w.time = 3000;
    Object.assign(w.player, { z: 1985, speed: 25 });
    w.rivals.forEach((o) => Object.assign(o, { z: 5, speed: 0, top: 0, cool: 5 }));
    Object.assign(w.rivals[1], { z: 1985.5, x: 1.2, speed: 25, top: 25, health: 10 });
    return F.snapshot(w);
  });
  await expect(page.locator('#ovText')).toHaveText('যেখানে থেমেছিলেন, সেখান থেকেই শুরু।');
  await resume(page);
  await expect(page.locator('#foeName')).toHaveText('বাবলু · লাঠি');
  await page.keyboard.press('KeyX');
  await page.clock.runFor(400);
  await expect(page.locator('#msg')).toHaveText('বাবলু পড়ে গেছে! আপনি লাঠি কেড়ে নিলেন।');
  await page.clock.runFor(4500);
  await expect(page.locator('#ovTitle')).toHaveText('১ম স্থান');
  await expectTranslated(page, 'bn');
});
