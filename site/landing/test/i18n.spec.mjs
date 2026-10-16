import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';
import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { inLanguage, expectTranslated } from '../../../tests/ui/languages.mjs';
const BANGLA = /[ঀ-৿]/;

// Using it in Bangla (each test opens it in Bangla, and finds nothing left
// in English at the end).
test.describe('in Bangla', () => {
  // The landing page in Bangla: the same page, counting in Bangla digits.
  test.beforeEach(({ page }) => inLanguage(page, 'bn'));
  // Whatever a test does, nothing is left in English.
  test.afterEach(({ page }) => expectTranslated(page));

  test('the headline and the line above it in Bangla', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('গেম আর টুল,সবই আপনার ব্রাউজারে।');
    await expect(page.locator('h1 em')).toHaveText('সবই আপনার ব্রাউজারে।');
    // The line above it is in the text font: a monospace font's wide spaces
    // would pull the Bangla words apart.
    await expect(page.locator('.kicker')).toHaveText('// চিরকাল ফ্রি। সাইন আপ নেই, আপলোড নেই।');
    expect(await page.locator('.kicker').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^Inter, Kalpurush/);
  });

  test('a card in Bangla for every game and tool', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('bdnix — ফ্রি ব্রাউজার গেম আর PDF, অডিও ও ছবির টুল');
    for (const [section, count] of [['গেম', 7], ['টুল', 9]]) {
      const cards = page.getByRole('region', { name: section }).locator('.card');
      await expect(cards).toHaveCount(count);
      for (const card of await cards.all()) {
        await expect(card.locator('b')).toHaveText(BANGLA);
        await expect(card.locator('.card-text > span')).toHaveText(BANGLA);
      }
    }
    await expect(page.locator('.card[href="/snake/"]')).toHaveCount(1);
    await expect(page.locator('.card[href="/snake/"] b')).toHaveText('সাপ');
    await expectNoSideScroll(page);
  });

  test('search finds cards by their Bangla or English words, and counts in Bangla digits', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox', { name: 'গেম ও টুল খুঁজুন' });
    await expect(search).toHaveAttribute('placeholder', 'লিখে দেখুন “pdf”, “ছবি” বা “সাপ”');
    const status = page.locator('#search-status');
    const shown = () => page.locator('.card:visible b').allTextContents();

    await search.fill('সাপ');
    expect(await shown()).toEqual(['সাপ']);
    await expect(status).toHaveText('১টি মিলেছে');

    // English still works: every PDF tool.
    await search.fill('pdf');
    expect(await shown()).toEqual(['PDF জোড়া লাগান', 'PDF-এ ওয়াটারমার্ক দিন', 'PDF-এর লেখা ঢেকে দিন', 'PDF-এ সই করুন', 'PDF আনলক করুন']);
    await expect(status).toHaveText('৫টি মিলেছে');

    // A Bangla search word, and a digit typed either way.
    await search.fill('ছবি');
    expect(await shown()).toEqual(expect.arrayContaining(['ছবি ছোট করুন', 'ছবির কোলাজ', 'ছবিতে বর্ডার']));
    await search.fill('9');
    expect(await shown()).toEqual(['ছবির কোলাজ']);
    await search.fill('৯');
    expect(await shown()).toEqual(['ছবির কোলাজ']);

    await search.fill('zqxjv');
    await expect(status).toHaveText('০টি মিলেছে');
    const empty = page.locator('#search-empty');
    await expect(empty).toHaveText('এর সঙ্গে মেলে এমন কিছু এখনো নেই। আপনি এর জন্যে অনুরোধ করতে পারেন।');
    await empty.getByRole('link', { name: 'অনুরোধ' }).click();
    await expect(page).toHaveURL(/\/#suggest$/);
  });

  test('greets visitors in Bangla, with Bangla digits, and the chip leads to the profile', async ({ page }) => {
    await page.goto('/');
    const visit = page.locator('#visit');
    await expect(visit).toHaveText('স্বাগতম! শুরু করতে একটি গেম বা টুল বেছে নিন।');
    const chip = page.locator('.profile-chip');
    await expect(chip).toHaveText('বব্যবহারকারী');
    await expect(chip).toHaveAttribute('title', 'আপনার প্রোফাইল');
    await expect(chip).toHaveAttribute('href', '/profile/');
    await page.reload();
    await expect(visit).toHaveText('আবার স্বাগতম।');
    await page.evaluate(() => { localStorage.setItem('bdnix_name', 'মুসা'); localStorage.setItem('bdnix_visits', '8'); });
    await page.reload();
    await expect(visit).toHaveText('আবার স্বাগতম, মুসা। এটি আপনার ৯ নম্বর ভিজিট, আপনি এখন নিয়মিত অতিথি।');
    await expect(chip).toHaveText('মমুসা');
    await expect(page.locator('#year')).toHaveText(/^[০-৯]{4}$/);
  });

  test('the typewriter types in Bangla, and screen readers hear one steady Bangla line', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const said = 'গেম আর টুল, যা চলে আপনার ব্রাউজারেই। কিছু ইনস্টল করতে হয় না, কিছু আপলোডও হয় না।';
    await expect(page.locator('.terminal')).toMatchAriaSnapshot(`- paragraph: ${said}`);
    const typed = page.locator('#typed');
    await expect(typed).toHaveText('এক রাউন্ড ইটের খেলা খেলুন।');
    // It rubs the line out and types the next one, letter by letter. The pause
    // between letters is random, so step through time and collect what it shows.
    const seen = new Set();
    for (let i = 0; i < 200 && !seen.has('গোলকধাঁধায় ভূতদের ফাঁকি দিন।'); i++) {
      await page.clock.runFor(100);
      seen.add(await typed.textContent());
    }
    expect(seen).toContain('গোলকধাঁধায় ভূতদের ফাঁকি দিন।');
  });

  test('asks for requests in Bangla, with a Bangla email ready to send', async ({ page }) => {
    await page.goto('/');
    const suggest = page.getByRole('region', { name: 'এখানে নেই এমন কোনো টুল বা গেম চান?' });
    const mail = new URL(await suggest.getByRole('link', { name: 'ইমেইলে অনুরোধ পাঠান' }).getAttribute('href'));
    expect(mail.pathname).toBe('root@bdnix.com');
    expect(mail.searchParams.get('subject')).toBe('bdnix অনুরোধ: ');
    expect(mail.searchParams.get('body')).toBe('এটি কী কী করবে?\n\n');
    await expect(suggest.getByRole('link', { name: 'GitHub-এ ইস্যু খুলুন' })).toHaveAttribute('href', 'https://github.com/bdnix/bdnix/issues/new?template=request.yml');
    await expect(suggest.locator('.oss')).toHaveText('bdnix ওপেন সোর্স। GitHub-এ কোড পড়ুন, বাগ জানান বা পুল রিকোয়েস্ট পাঠান।');
  });
});

// The landing page's i18n target: the page in every other language the
// site has, from its own translations (lang/) and those of the shared modules
// it uses, and nothing else.
checkPageLanguages('/');
checkStrings('/', 'landing');
