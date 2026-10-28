import { createRequire } from 'module'; import fs from 'fs'; const { chromium } = createRequire(import.meta.url)('playwright');
const [jobs, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => { console.log('err:', e.message, e.stack); process.exit(1); });
await p.goto('http://localhost:8800/view/bake.html?jobs=' + jobs);
await p.waitForFunction(() => document.title === 'ok', null, { timeout: 3600000 });
fs.writeFileSync(out, JSON.stringify(await p.evaluate(() => window.RESULT)));
await b.close();
