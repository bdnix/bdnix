// For an app's i18n target: the words its page's scripts ask lang.js for
// (t() and count()) are all in the app's own pack (tools/languages.mjs), in
// every language the site has, and fit their English. tests/unit/languages.test.mjs
// checks the same of the pack for pages that haven't moved into modules.
import { test, expect } from './fixtures.mjs';
import { asked, misfits, lacking } from '../strings.mjs';

export function checkStrings(url, module){
  test(`${url}: its own translations have every word its scripts ask for, and fit their English`, async ({ request }) => {
    const html = await (await request.get(url)).text();
    const scripts = [...html.matchAll(/<script src="(\/assets\/js\/[\w-]+\.js)[?"]/g)].map((m) => m[1]).filter((s) => s !== '/assets/js/lang.js');
    expect(scripts.length).toBeGreaterThan(0);
    const sources = {};
    for (const s of scripts) sources[s] = await (await request.get(s)).text();
    const wanted = asked(sources);

    const lang = await (await request.get('/assets/js/lang.js')).text();
    const codes = JSON.parse(/var LANGUAGES = (.*);/.exec(lang)[1]).map((l) => l.code).filter((c) => c !== 'en');
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const res = await request.get(`/assets/lang/${module}.${code}.js`);
      expect(res.status(), `${module}'s pack in ${code}`).toBe(200);
      const words = JSON.parse(/pack\(([\s\S]*)\);\s*$/.exec(await res.text())[1]);
      expect(misfits(words), code).toEqual([]);
      expect(lacking(wanted, words), `${code} has no translation for these`).toEqual([]);
    }
  });
}
