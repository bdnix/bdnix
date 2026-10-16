import { checkPageLanguages } from '../../../tests/ui/checks.mjs';
import { checkStrings } from '../../../tests/ui/strings.mjs';
import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { inLanguage, expectTranslated } from '../../../tests/ui/languages.mjs';

// Reading it in Bangla (each test opens it in Bangla, and finds nothing left
// in English at the end).
test.describe('in Bangla', () => {
  test.beforeEach(({ page }) => inLanguage(page, 'bn'));
  test.afterEach(({ page }) => expectTranslated(page));

  test('the page, its links and the footer’s link to it, in Bangla', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('bdnix পরিচিতি');
    await expect(page.getByText('bd এসেছে বাংলাদেশ থেকে')).toContainText('nix এসেছে Linux, Unix');
    // The name's two halves, and the email address, stay as they are.
    await expect(page.locator('.name-parts')).toHaveText('bd+nix');
    const main = page.locator('main');
    await expect(main.getByRole('link', { name: 'root@bdnix.com' })).toHaveAttribute('href', 'mailto:root@bdnix.com');
    await expect(main.getByRole('link', { name: 'প্রস্তাব দিন' })).toHaveAttribute('href', '/#suggest');
    await expect(main.getByRole('link', { name: 'আপনার প্রোফাইলে' })).toHaveAttribute('href', '/profile/');
    await expect(page.locator('footer.foot').getByRole('link', { name: 'পরিচিতি' })).toHaveAttribute('href', '/about/');
    await expectNoSideScroll(page);
  });
});

// The about page's i18n target: the page in every other language the site
// has, from its own translations (lang/) and those of the shared modules it
// uses, and nothing else.
checkPageLanguages('/about/');
checkStrings('/about/', 'about');
