// `npm run check:live`: checks that www.bdnix.com is the site built from
// this checkout, and that it works.
//
// 1. Every file of the build (_site/, made fresh by tools/site.mjs) is
//    fetched from the live site, past the CDN's cache, and must match byte
//    for byte. So the live site is exactly this commit.
// 2. Every page is opened in Chromium at desktop and phone size, in English
//    and Bangla: no error on the page, no failed request to the site, nothing
//    blocked by the security policy, nothing left untranslated, the consent
//    banner shown, and no request anywhere else before consent. A screenshot
//    of each goes to .test-cache/live/, to look at.
//
//   node tools/check-live.mjs                  both
//   node tools/check-live.mjs --files-only     only 1
//   node tools/check-live.mjs --wait 600       retry 1 for up to 600 s (after a deploy)
//
// LIVE_URL overrides the site checked. Behind a proxy that re-signs HTTPS
// (HTTPS_PROXY set), requests go through it and its certificates are trusted.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, request, devices } from '@playwright/test';
import { build } from './site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = (process.env.LIVE_URL || 'https://www.bdnix.com').replace(/\/$/, '');
const OUT = path.join(root, '.test-cache', 'live');
const args = process.argv.slice(2);
const filesOnly = args.includes('--files-only');
const wait = Number(args[args.indexOf('--wait') + 1]) || 0;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const net = { proxy, ignoreHTTPSErrors: !!proxy };

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
// A page is served at its folder's URL.
const url = (file) => '/' + file.replace(/(^|\/)index\.html$/, '$1');

const site = path.join(root, '_site');
const files = build(root, site);
const problems = [];

// ---- 1. The live files are this build ----
const api = await request.newContext(net);
let todo = files, round = 0;
const start = Date.now();
for (;;) {
  round++;
  const bust = `live-check=${Date.now()}`;
  const wrong = [];
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async (file) => {
      // A server error or a dropped connection gets two more tries.
      let problem;
      for (let tries = 0; tries < 3; tries++) {
        try {
          const res = await api.get(`${LIVE}${url(file)}?${bust}`, { maxRedirects: 0 });
          if (res.status() >= 500) { problem = `HTTP ${res.status()}`; await new Promise((r) => setTimeout(r, 2000)); continue; }
          if (res.status() !== 200) problem = `HTTP ${res.status()}`;
          else if (sha(await res.body()) !== sha(fs.readFileSync(path.join(site, file)))) problem = 'differs from the build';
          else problem = null;
          break;
        } catch (e) {
          problem = e.message.split('\n')[0];
        }
      }
      if (problem) wrong.push(`${url(file)}: ${problem}`);
    }));
  }
  console.log(`Files: ${files.length - wrong.length} of ${files.length} match the build${round > 1 ? ` (try ${round})` : ''}.`);
  if (!wrong.length) break;
  if (Date.now() - start > wait * 1000) { problems.push(...wrong.sort()); break; }
  todo = files.filter((f) => wrong.some((w) => w.startsWith(url(f) + ':')));
  await new Promise((r) => setTimeout(r, 30000));
}
await api.dispose();

// ---- 2. Every page works in a browser ----
if (!filesOnly) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const pages = files.filter((f) => f.endsWith('index.html')).map(url);
  const browser = await chromium.launch({ proxy });
  for (const [device, use] of [['desktop', devices['Desktop Chrome']], ['phone', devices['Pixel 7']]]) {
    for (const lang of ['en', 'bn']) {
      const context = await browser.newContext({ ...use, ignoreHTTPSErrors: net.ignoreHTTPSErrors });
      await context.addInitScript((l) => { try { localStorage.setItem('bdnix_lang', l); } catch (e) {} }, lang);
      for (const p of pages) {
        const where = `${p} (${lang}, ${device})`;
        const page = await context.newPage();
        const found = [];
        page.on('pageerror', (e) => found.push(`error on the page: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/.test(m.text())) found.push(`blocked: ${m.text()}`); });
        page.on('requestfailed', (r) => { if (r.url().startsWith(LIVE)) found.push(`failed: ${r.url()} (${r.failure().errorText})`); });
        page.on('response', (r) => { if (r.url().startsWith(LIVE) && r.status() >= 400) found.push(`HTTP ${r.status()}: ${r.url()}`); });
        page.on('request', (r) => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(LIVE + '/')) found.push(`contacted before consent: ${r.url()}`); });
        try {
          await page.goto(LIVE + p, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const state = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            missing: window.bdnixLang ? window.bdnixLang.missing.slice() : ['no bdnixLang'],
            consent: !!document.querySelector('.consent[role="region"]')
          }));
          if (state.lang !== lang) found.push(`<html lang="${state.lang}">, expected ${lang}`);
          if (state.missing.length) found.push(`left untranslated: ${state.missing.slice(0, 5).join(' | ')}`);
          if (!state.consent) found.push('no consent banner');
          await page.screenshot({ path: path.join(OUT, `${p.replace(/\//g, '_').replace(/^_|_$/g, '') || 'home'}-${lang}-${device}.png`), fullPage: true });
        } catch (e) {
          found.push(e.message.split('\n')[0]);
        }
        await page.close();
        problems.push(...found.map((f) => `${where}: ${f}`));
        console.log(`${found.length ? 'FAIL' : 'ok  '} ${where}`);
      }
      await context.close();
    }
  }
  await browser.close();
  console.log(`Screenshots in ${path.relative(process.cwd(), OUT) || OUT}/.`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) on ${LIVE}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`\n${LIVE} is this build${filesOnly ? '' : ', and every page works'}.`);
