import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';

test('says where the name comes from, and what the games and tools are for', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About bdnix');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['The name', 'Games to pass the time', 'Tools that don’t take your files', 'Free, with no accounts', 'Say hello']);
  await expect(page.getByText('bd is for Bangladesh')).toContainText('nix is for their love of Linux, Unix');
  await expect(page.getByText('Everything happens in your browser')).toBeVisible();
  await expect(page.getByText('No subscriptions, no sign-ups and no accounts. There never will be.')).toBeVisible();
  await expectNoSideScroll(page);
});

test('links to the games, the tools, the code, the profile and a way to get in touch', async ({ page }) => {
  await page.goto('/about/');
  const main = page.locator('main');
  await expect(main.getByRole('link', { name: 'See the games' })).toHaveAttribute('href', '/#games');
  await expect(main.getByRole('link', { name: 'See the tools' })).toHaveAttribute('href', '/#tools');
  await expect(main.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/bdnix/bdnix');
  await expect(main.getByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/profile/');
  await expect(main.getByRole('link', { name: 'root@bdnix.com' })).toHaveAttribute('href', 'mailto:root@bdnix.com');
  await expect(main.getByRole('link', { name: 'suggest it' })).toHaveAttribute('href', '/#suggest');
});

// Every page's footer links here (checkPage()'s footer check); this page's
// own footer link leads back to it.
test('the footer links to it', async ({ page }) => {
  await page.goto('/about/');
  await page.locator('footer.foot').getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About bdnix');
});
