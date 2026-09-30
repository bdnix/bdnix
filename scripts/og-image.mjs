// Draws the site's share images with Playwright's Chromium:
//   assets/img/og.png               1200×630, shown when a page is shared
//   assets/img/apple-touch-icon.png 180×180, the icon for a home-screen bookmark
// Run `npm run og-image` after changing the design below, and commit the PNGs.
// Uses the site's own fonts from assets/fonts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const face = (family, weight, file) => `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${
  fs.readFileSync(path.join(root, 'assets/fonts', file)).toString('base64')}) format('woff2')}`;
const fonts = '<style>' + [
  face('Inter', 600, 'inter-latin-600-normal.woff2'),
  face('Inter', 800, 'inter-latin-800-normal.woff2'),
  face('JetBrains Mono', 400, 'jetbrains-mono-latin-400-normal.woff2')
].join('') + '</style>';

const og = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0;width:1200px;height:630px}
  body{
    box-sizing:border-box;padding:84px 96px;display:flex;flex-direction:column;justify-content:space-between;
    font-family:Inter,system-ui,sans-serif;color:#eef1f8;
    background:radial-gradient(1100px 560px at 50% -10%,#10142a,transparent 70%),#080a12;
  }
  .mark{display:flex;align-items:center;gap:22px;font-weight:800;font-size:44px;letter-spacing:-.03em}
  .mark i{display:block;width:64px;height:64px;border-radius:12px;background:#0f172a;border:2px solid rgba(255,255,255,.12);
    font:700 36px/64px Inter,system-ui,sans-serif;font-style:normal;text-align:center}
  h1{margin:0;font-size:92px;font-weight:800;line-height:1.02;letter-spacing:-.045em}
  h1 em{font-style:normal;background:linear-gradient(100deg,#22d3ee 0%,#a855f7 55%,#f472b6 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin:0;font:400 28px/1.45 'JetBrains Mono',ui-monospace,monospace;color:#8e97ab}
</style></head><body>
  <div class="mark"><i>B</i>bdnix</div>
  <h1>Play a little.<br><em>Get things done.</em></h1>
  <p>Falling Blocks · Maze Chase · PDF, audio and image tools<br>Free, in your browser. Nothing uploaded.</p>
</body></html>`;

const icon = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0;width:180px;height:180px;background:#0f172a}
  body{display:flex;align-items:center;justify-content:center;color:#fff;font:700 100px/1 Inter,system-ui,sans-serif}
</style></head><body>B</body></html>`;

const browser = await chromium.launch();
async function shot(html, width, height, file){
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, file) });
  await page.close();
  console.log('Wrote ' + file);
}
await shot(og, 1200, 630, 'assets/img/og.png');
await shot(icon, 180, 180, 'assets/img/apple-touch-icon.png');
await browser.close();
