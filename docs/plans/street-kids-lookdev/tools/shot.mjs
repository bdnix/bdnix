import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out, w = 1000, h = 600] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR || 1) });
p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); }); p.on('pageerror', e => { console.log('err:', e.message, e.stack); process.exit(1); });
await p.goto(url); await p.waitForFunction(() => document.title.startsWith('ok'), null, { timeout: 180000 });
console.log(await p.title()); await p.screenshot({ path: out, timeout: 120000 }); await b.close();
