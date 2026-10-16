// A page made up for a shared module's contract tests: the module's own
// stylesheets and scripts (and those of the modules it uses), around some
// markup. The test answers for it itself (page.route), so the module is
// tested on its own, not through an app, and the test server only serves
// what the page links, which tests/ui/inputs.mjs checks the module declares.
import { expect } from './fixtures.mjs';

// Opens the page: css and js are the published URLs of stylesheets and
// scripts, linked in that order (scripts at the end of the body, after the
// markup).
export async function openFixture(page, { css = [], js = [], body = '', bodyClass = '' } = {}){
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Fixture</title>',
    ...css.map((href) => `<link rel="stylesheet" href="${href}">`),
    '</head>',
    `<body${bodyClass ? ` class="${bodyClass}"` : ''}>`,
    body,
    ...js.map((src) => `<script src="${src}"></script>`),
    '</body>',
    '</html>'
  ].join('\n');
  await page.route('**/fixture/', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto('/fixture/');
}

// A CSS property of the first element matching selector, as computed.
export function style(page, selector, property){
  return page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
}

// The page is no wider than the screen.
export async function fitsScreen(page){
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, 'page is wider than the screen').toBeLessThanOrEqual(client);
}

// Whether the page is on a touch screen (the phone-sized project).
export const touch = (page) => page.evaluate(() => matchMedia('(pointer:coarse)').matches);
