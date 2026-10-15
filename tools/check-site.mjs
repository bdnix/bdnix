// Checks the published site works, before it goes live and after.
//
// `npm run check:site` (before a deploy): builds _site/ (tools/site.mjs),
// serves it locally as www.bdnix.com, and opens every page in Chromium at
// desktop and phone size, in English and Bangla: no error on the page, no
// failed request to the site, nothing blocked by the security policy,
// nothing left untranslated, the consent banner shown, and no request
// anywhere else before consent. The Pages workflow runs this on every pull
// request and before every deploy, so a build that fails it never goes live.
//
// `npm run check:live` (after a deploy): fetches every file of the build
// from www.bdnix.com, past the CDN's cache, and checks it matches byte for
// byte, so the live site is exactly this commit; then runs the same page
// checks against the live site. `--wait <seconds>` keeps retrying files that
// don't match yet, while the CDN catches up; `--files-only` skips the pages.
//
// Each problem is listed by page and kind. A screenshot of every page goes to
// .test-cache/site/, for a look at anything a check can't judge.
//
// LIVE_URL overrides the live site. Behind a proxy that re-signs HTTPS
// (HTTPS_PROXY set), live requests go through it and its certificates are
// trusted.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, request, devices } from '@playwright/test';
import { build } from './site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = (process.env.LIVE_URL || 'https://www.bdnix.com').replace(/\/$/, '');
const OUT = path.join(root, '.test-cache', 'site');
const args = process.argv.slice(2);
const live = args.includes('--live');
const filesOnly = args.includes('--files-only');
const wait = args.includes('--wait') ? Number(args[args.indexOf('--wait') + 1]) || 0 : 0;
const proxy = live && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const net = { proxy, ignoreHTTPSErrors: !!proxy };
const LOCAL_PORT = 4174;

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// A page is served at its folder's URL.
const url = (file) => '/' + file.replace(/(^|\/)index\.html$/, '$1');

const site = path.join(root, '_site');
const files = build(root, site);
const problems = [];

if (live) await checkFiles();
if (!filesOnly) await checkPages();

if (problems.length) {
  console.error(`\n${problems.length} problem(s) on ${live ? LIVE : 'the build'}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(live ? `\n${LIVE} is this build${filesOnly ? '' : ', and every page works'}.` : '\nEvery page of the build works.');

// The live files are this build.
async function checkFiles(){
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
            if (res.status() >= 500) { problem = `HTTP ${res.status()}`; await pause(2000); continue; }
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
    await pause(30000);
  }
  await api.dispose();
}

// Serves _site/ locally (tests/server.mjs), until stop() is called.
async function serveBuild(){
  const server = spawn(process.execPath, [path.join(root, 'tests', 'server.mjs')], {
    env: { ...process.env, SITE_DIR: '_site', PORT: String(LOCAL_PORT) }, stdio: 'ignore'
  });
  const local = `http://localhost:${LOCAL_PORT}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(local + '/')).ok) break; } catch (e) {}
    if (i > 100) throw new Error('the local server for _site/ did not start');
    await pause(100);
  }
  return { local, stop: () => server.kill() };
}

// Every page works in a browser.
async function checkPages(){
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const pages = files.filter((f) => f.endsWith('index.html')).map(url);
  const server = live ? null : await serveBuild();
  const browser = await chromium.launch({ proxy });
  try {
    for (const [device, use] of [['desktop', devices['Desktop Chrome']], ['phone', devices['Pixel 7']]]) {
      for (const lang of ['en', 'bn']) {
        const context = await browser.newContext({ ...use, ignoreHTTPSErrors: net.ignoreHTTPSErrors });
        await context.addInitScript((l) => { try { localStorage.setItem('bdnix_lang', l); } catch (e) {} }, lang);
        // Before a deploy, the build answers for www.bdnix.com (so the page
        // runs as it will live, consent banner and all), and nothing else is
        // contacted.
        if (server) {
          await context.route('**/*', async (route) => {
            const u = route.request().url();
            if (!u.startsWith(LIVE + '/')) return route.abort();
            const response = await route.fetch({ url: server.local + u.slice(LIVE.length) });
            await route.fulfill({ response });
          });
        }
        for (const p of pages) {
          const where = `${p} (${lang}, ${device})`;
          const found = await checkPage(context, p, lang, device);
          problems.push(...found.map((f) => `${where}: ${f}`));
          console.log(`${found.length ? 'FAIL' : 'ok  '} ${where}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (server) server.stop();
  }
  console.log(`Screenshots in ${path.relative(process.cwd(), OUT) || OUT}/.`);
}

async function checkPage(context, p, lang, device){
  const page = await context.newPage();
  const found = [];
  page.on('pageerror', (e) => found.push(`error on the page: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/.test(m.text())) found.push(`blocked: ${m.text()}`); });
  page.on('response', (r) => { if (r.url().startsWith(LIVE) && r.status() >= 400) found.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(LIVE + '/')) found.push(`contacted before consent: ${r.url()}`); });
  page.on('requestfailed', (r) => { if (r.url().startsWith(LIVE)) found.push(`failed: ${r.url()} (${r.failure().errorText})`); });
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
  return found;
}
