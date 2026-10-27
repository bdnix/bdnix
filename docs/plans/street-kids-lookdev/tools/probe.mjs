import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', e => { console.log(e.stack); process.exit(1); });
await p.goto(process.argv[2]); await p.waitForFunction(() => document.title === 'ok', null, { timeout: 300000 });
console.log(await p.evaluate(() => window.out)); await b.close();
