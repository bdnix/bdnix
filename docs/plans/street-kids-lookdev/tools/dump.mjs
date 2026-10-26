import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', e => { console.log(e.stack); process.exit(1); });
await p.goto(url); await p.waitForFunction(() => document.title === 'ok', null, { timeout: 300000 });
const imgs = await p.evaluate(() => window.imgs);
imgs.forEach((d, i) => fs.writeFileSync(out + i + '.png', Buffer.from(d.split(',')[1], 'base64')));
await b.close();
