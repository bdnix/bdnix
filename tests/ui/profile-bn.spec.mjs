import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { LIVE, serveLive } from './checks.mjs';

// The profile page's Bangla copy (bn/profile/index.html), counting in Bangla
// digits. It reads and saves the same name and scores as the English page.
const scores = (page) => page.locator('.score').evaluateAll((els) => els.map((e) => ({
  best: e.querySelector('b').textContent,
  link: e.querySelector('a').textContent
})));

test('the top bar switches between the English and Bangla profile', async ({ page }) => {
  await page.goto('/profile/');
  await page.getByRole('navigation', { name: 'Language' }).getByRole('link', { name: 'বাংলা' }).click();
  await expect(page).toHaveURL(/\/bn\/profile\/$/);
  await expect(page.getByRole('link', { name: 'bdnix-এ ফিরে যান' })).toHaveAttribute('href', '/bn/');
  await page.getByRole('navigation', { name: 'ভাষা' }).getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/profile\/$/);
  await expect(page.locator('h1')).toHaveText('User');
});

test('a new visitor is "ব্যবহারকারী", with no scores yet', async ({ page }) => {
  await page.goto('/bn/profile/');
  await expect(page.locator('h1')).toHaveText('ব্যবহারকারী');
  await expect(page.locator('.avatar-lg')).toHaveText('ব');
  await expect(page.getByText('সেরা স্কোর')).toBeVisible();
  const shown = await scores(page);
  expect(shown).toHaveLength(7);
  for (const s of shown) expect(s).toEqual({ best: 'এখনো খেলা হয়নি', link: 'খেলুন' });
  await expect(page.locator('#visits')).toHaveText('');
  await expectNoSideScroll(page);
});

test('scores, levels and visits in Bangla digits', async ({ page }) => {
  await page.goto('/bn/profile/');
  await page.evaluate(() => {
    localStorage.setItem('bdnix_snake_best', '12450');
    localStorage.setItem('bdnix_chess_best', '3');
    localStorage.setItem('bdnix_visits', '1');
  });
  await page.reload();
  const row = (key) => page.locator(`.score[data-best="${key}"]`);
  await expect(row('bdnix_snake_best').locator('b')).toHaveText('১২,৪৫০');
  await expect(row('bdnix_snake_best').locator('a')).toHaveText('আবার খেলুন');
  await expect(row('bdnix_chess_best').locator('b')).toHaveText('লেভেল ৩');
  await expect(page.locator('#visits')).toHaveText('আপনি bdnix-এ একবার এসেছেন।');
  await page.evaluate(() => localStorage.setItem('bdnix_visits', '1234'));
  await page.reload();
  await expect(page.locator('#visits')).toHaveText('আপনি bdnix-এ ১,২৩৪ বার এসেছেন।');
  await expect(page.locator('#year')).toHaveText(/^[০-৯]{4}$/);
});

test('editing the name in Bangla, which the English pages show too', async ({ page }) => {
  await page.goto('/bn/profile/');
  await page.getByRole('button', { name: 'নাম বদলান' }).click();
  await expect(page.getByLabel('আপনার নাম')).toBeFocused();
  await expect(page.getByText('সর্বোচ্চ ২৪টি অক্ষর। “ব্যবহারকারী”-তে ফিরে যেতে ঘরটি খালি রাখুন।')).toBeVisible();
  await page.getByLabel('আপনার নাম').fill('মুসা');
  await page.getByRole('button', { name: 'সেভ করুন' }).click();
  await expect(page.locator('h1')).toHaveText('মুসা');
  await expect(page.locator('#msg')).toHaveText('সেভ হয়েছে। হ্যালো, মুসা!');
  await page.goto('/profile/');
  await expect(page.locator('h1')).toHaveText('মুসা');

  await page.goto('/bn/profile/');
  await page.getByRole('button', { name: 'নাম বদলান' }).click();
  await page.getByLabel('আপনার নাম').fill('আর না');
  await page.getByRole('button', { name: 'বাতিল' }).click();
  await expect(page.locator('h1')).toHaveText('মুসা');
});

test('analytics in Bangla: the banner, and turning it on and off', async ({ page }) => {
  await serveLive(page);
  await page.goto(LIVE + '/bn/profile/');
  await expect(page.getByText('অ্যানালিটিক্স কুকি')).toBeVisible();
  const state = page.locator('#analyticsState');
  const toggle = page.locator('#analyticsBtn');
  await expect(state).toHaveText('বন্ধ। Google Analytics-কে কুকি দিয়ে আপনার ভিজিট গুনতে দিতে চাইলে চালু করুন। টুলে খোলা আপনার ফাইল কখনো আপনার ব্রাউজারের বাইরে যায় না।');
  await expect(toggle).toHaveText('চালু করুন');

  // The banner's answer shows here too.
  await page.getByRole('button', { name: 'সম্মতি দিচ্ছি' }).click();
  await expect(state).toHaveText('চালু। Google Analytics কুকি দিয়ে আপনার ভিজিট গোনে। টুলে খোলা আপনার ফাইল কখনো আপনার ব্রাউজারের বাইরে যায় না।');
  await expect(toggle).toHaveText('বন্ধ করুন');

  await toggle.click();
  await expect(state).toHaveText('বন্ধ। Google Analytics-কে কুকি দিয়ে আপনার ভিজিট গুনতে দিতে চাইলে চালু করুন। টুলে খোলা আপনার ফাইল কখনো আপনার ব্রাউজারের বাইরে যায় না।');
  await expect(page.locator('#msg')).toHaveText('অ্যানালিটিক্স কুকি বন্ধ হয়েছে।');
  await toggle.click();
  await expect(page.locator('#msg')).toHaveText('অ্যানালিটিক্স কুকি চালু হয়েছে। ধন্যবাদ!');
  await expect(page.getByText('আপনার প্রোফাইল শুধু এই ব্রাউজারেই রাখা থাকে। এটি আপলোড বা শেয়ার করা হয় না, তাই অন্য ডিভাইসে এটি পাবেন না, আর এই সাইটের ডেটা মুছে ফেললে এটিও মুছে যাবে।')).toBeVisible();
});
