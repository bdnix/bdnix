import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';
import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { inLanguage, expectTranslated } from '../../../tests/ui/languages.mjs';
import { REPLY, open, move, stepsOf, playMoves, startLine, fakeEngine } from './learn.mjs';

// Learning in Bangla (each test opens the page in Bangla, and finds nothing
// left in English at the end): the courses, the notes on every move of a
// line, practising, and playing on.
test.describe('in Bangla', () => {
  test.beforeEach(({ page }) => inLanguage(page, 'bn'));
  test.afterEach(({ page }) => expectTranslated(page));

  test('the courses, and a line learned in Bangla, with every move explained', async ({ page }) => {
    await open(page);
    await expect(page.locator('.course-meta').first()).toHaveText('লেভেল ১ · সাদা হয়ে');
    await expect(page.locator('.course-progress').first()).toHaveText('৩টি লাইনের ০টি শেখা হয়েছে · ০টি আয়ত্তে');
    await expect(page.locator('.course-name').first()).toHaveText('Italian Game');
    await startLine(page, 'Italian Game শুরু করুন', 'শিখুন: শান্ত প্রধান লাইন');
    await expect(page.locator('#lessonMode')).toHaveText('শেখা হচ্ছে');
    await expect(page.locator('#prompt')).toHaveText('আপনার চাল: আপনার বোড়ে e2 থেকে e4-এ নিন।');
    await move(page, 'd2', 'd4');
    await expect(page.locator('#lessonMsg')).toHaveText('ঠিক হলো না। হলুদ তীরচিহ্ন দেখুন: আপনার বোড়ে e2 থেকে e4-এ নিন।');
    await move(page, 'e2', 'e4');
    await expect(page.locator('#notes li').first()).toHaveText('চাল ১ আপনি বোড়ে e2 থেকে e4-এ নিলেন। রাজার সামনের বোড়েটি দুই ঘর এগিয়ে শুরু করুন। এটি বোর্ডের মাঝখানে জায়গা নেয়, আর আপনার মন্ত্রী ও একটি হাতির জন্য পথ খুলে দেয়।');
    await expect(page.locator('#prompt')).toHaveText('কালো চাল দিচ্ছে…');
    await page.clock.runFor(REPLY);
    const steps = await stepsOf(page, 'italian', 'giuoco-piano');
    await playMoves(page, steps, 'w', 1, 10);
    await expect(page.locator('#prompt')).toHaveText('আপনার চাল: ক্যাসল করুন। রাজাকে e1 থেকে g1-এ নিন, আর নৌকা তাকে টপকে h1 থেকে f1-এ চলে যাবে।');
    await playMoves(page, steps, 'w', 10, steps.length);
    await expect(page.locator('#doneTitle')).toHaveText('লাইন শেখা হয়েছে');
    await expectTranslated(page);
    await expectNoSideScroll(page);
  });

  // Every line of each course, learned, one test per course.
  for (const [ci, id] of ['italian', 'london', 'scandinavian', 'queens-gambit-declined'].entries()) {
    test(`every line of course ${ci + 1}, ${id}, learned in Bangla`, async ({ page }) => {
      await open(page);
      const c = await page.evaluate((k) => {
        const x = window.bdnixCourses.find((y) => y.id === k);
        return { side: x.side, lines: x.lines.map((l) => l.id) };
      }, id);
      await page.locator('.course .btn').nth(ci).click();
      for (const [li, l] of c.lines.entries()) {
        await page.locator('.line .learn').nth(li).click();
        await playMoves(page, await stepsOf(page, id, l), c.side);
        await expect(page.locator('#doneTitle')).toHaveText('লাইন শেখা হয়েছে');
        await page.locator('#doneLinesBtn').click();
      }
      await expect(page.locator('.line-state')).toHaveText(Array(c.lines.length).fill('শেখা হয়েছে'));
      await page.locator('#allBtn').click();
      await expect(page.locator('.course-progress').nth(ci)).toHaveText(`৩টি লাইনের ৩টি শেখা হয়েছে · ০টি আয়ত্তে`);
    });
  }

  test('a line practised with a mistake and a hint, then mastered, in Bangla', async ({ page }) => {
    await open(page);
    // Practising, with a mistake and a hint: counted in Bangla.
    await startLine(page, 'Scandinavian Defence শুরু করুন', 'অনুশীলন: যখন সাদা আপনার বোড়েকে পাশ কাটিয়ে এগোয়');
    await page.clock.runFor(REPLY);
    await move(page, 'a7', 'a6');
    await expect(page.locator('#lessonMsg')).toHaveText('এই লাইনের চাল ওটা নয়। আরেকবার চেষ্টা করুন।');
    await move(page, 'a7', 'a5');
    await expect(page.locator('#lessonMsg')).toHaveText('ওটাও নয়। চালটি হলো: আপনার বোড়ে d7 থেকে d5-এ নিন।');
    await move(page, 'd7', 'd5');
    await expect(page.locator('#lessonMsg')).toHaveText('');
    await page.clock.runFor(REPLY);
    await page.locator('#hintBtn').click();
    await expect(page.locator('#lessonMsg')).toHaveText('চালটি হলো: আপনার হাতি c8 থেকে f5-এ নিন।');
    const steps = await stepsOf(page, 'scandinavian', 'push-e5');
    await playMoves(page, steps, 'b', 3, steps.length);
    await expect(page.locator('#doneTitle')).toHaveText('অনুশীলন হয়েছে, ৩টি ভুলসহ');
    await expect(page.locator('#doneText')).toHaveText('আয়ত্ত করতে কোনো ভুল ছাড়া আবার অনুশীলন করুন।');
    await page.locator('#practiseBtn').click();
    await page.clock.runFor(REPLY);
    await move(page, 'd7', 'd5');
    await expect(page.locator('#lessonMsg')).toHaveText('ঠিক, দারুণ!');
    await playMoves(page, steps, 'b', 2, steps.length);
    await expect(page.locator('#doneTitle')).toHaveText('লাইন আয়ত্তে: একটিও ভুল নেই!');
  });

  test('playing on against Stockfish, to checkmate, in Bangla', async ({ page }) => {
    await fakeEngine(page, ['f3e5', 'e2c4']);
    await open(page);
    await startLine(page, 'Scandinavian Defence শুরু করুন', 'শিখুন: যখন সাদা আগে একটি ঘোড়া বের করে');
    await playMoves(page, await stepsOf(page, 'scandinavian', 'knight-f3'), 'b');
    await page.getByRole('button', { name: 'Stockfish-এর সঙ্গে খেলা চালিয়ে যান' }).click();
    await expect(page.locator('#playStatus')).toHaveText('আপনার চাল।');
    await expect(page.locator('.level-seg span')).toHaveText(['সহজ', 'মাঝারি', 'কঠিন']);
    await move(page, 'd5', 'd4');
    await move(page, 'd4', 'd1');
    await expect(page.locator('#playStatus')).toHaveText('চেকমেট: আপনি জিতেছেন!');
  });

  test('if the engine can’t be loaded, it says so in Bangla', async ({ page }) => {
    await fakeEngine(page, [], { fail: true });
    await open(page);
    await startLine(page, 'Queen’s Gambit Declined শুরু করুন', 'শিখুন: এলিফ্যান্ট ট্র্যাপ');
    await playMoves(page, await stepsOf(page, 'queens-gambit-declined', 'elephant-trap'), 'b');
    await page.locator('#playBtn').click();
    await expect(page.locator('#playStatus')).toHaveText('দাবা ইঞ্জিন লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
  });
});

// Learn Chess's i18n target: the page in every other language the site has,
// from its own translations (lang/) and those of the shared modules it uses.
checkPageLanguages('/learn-chess/');
checkStrings('/learn-chess/', 'learn-chess');
