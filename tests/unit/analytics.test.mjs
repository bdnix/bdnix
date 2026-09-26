import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, fakeStorage } from './load.mjs';

// Just enough `document` for analytics.js: a <head> that records the scripts
// added to it, cookies, and (with no body yet) a DOMContentLoaded listener.
function page(hostname, saved, cookies){
  const added = [];
  const listeners = {};
  const cookieLog = [];
  const document = {
    createElement: (tag) => ({ tagName: tag }),
    head: { appendChild: (el) => { added.push(el); } },
    body: null,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    get cookie(){ return cookies || ''; },
    set cookie(v){ cookieLog.push(v); }
  };
  const localStorage = fakeStorage(saved === undefined ? {} : { bdnix_analytics: saved });
  const events = [];
  const win = load('assets/js/analytics.js', {
    location: { hostname }, document, localStorage,
    Event: class { constructor(type){ this.type = type; } },
    dispatchEvent: (e) => { events.push(e.type); }
  });
  return { win, added, listeners, localStorage, cookieLog, events };
}

const calls = (win) => win.dataLayer.map((args) => plain(Array.prototype.slice.call(args)));

test('only the live site is tracked', () => {
  const { enabled } = page('localhost').win.bdnixAnalytics;
  assert.equal(enabled('www.bdnix.com'), true);
  assert.equal(enabled('bdnix.com'), true);
  assert.equal(enabled('WWW.BDNIX.COM'), true);
  assert.equal(enabled('localhost'), false);
  assert.equal(enabled('127.0.0.1'), false);
  assert.equal(enabled('bdnix.github.io'), false);
  assert.equal(enabled('evil-bdnix.com'), false);
  assert.equal(enabled(''), false);
  assert.equal(enabled(undefined), false);
  assert.equal(page('localhost').win.bdnixAnalytics.live, false);
  assert.equal(page('www.bdnix.com', 'denied').win.bdnixAnalytics.live, true);
});

test('reads the saved choice, ignoring anything else', () => {
  assert.equal(page('localhost', 'granted').win.bdnixAnalytics.consent(), 'granted');
  assert.equal(page('localhost', 'denied').win.bdnixAnalytics.consent(), 'denied');
  assert.equal(page('localhost').win.bdnixAnalytics.consent(), null);
  assert.equal(page('localhost', 'yes').win.bdnixAnalytics.consent(), null);
});

test('works without storage (private browsing)', () => {
  const broken = { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } };
  const document = { head: { appendChild(){} }, body: null, addEventListener(){} };
  const win = load('assets/js/analytics.js', { location: { hostname: 'localhost' }, document, localStorage: broken });
  assert.equal(win.bdnixAnalytics.consent(), null);
  assert.equal(win.bdnixAnalytics.setConsent('granted'), 'granted');
});

test('on the live site, with consent, it loads gtag.js and records a page view', () => {
  const { win, added, listeners } = page('www.bdnix.com', 'granted');
  assert.equal(win.bdnixAnalytics.id, 'G-67D1H8GX6X');
  assert.equal(added.length, 1);
  assert.equal(added[0].tagName, 'script');
  assert.equal(added[0].async, true);
  assert.equal(added[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-67D1H8GX6X');
  assert.equal(listeners.DOMContentLoaded, undefined, 'no banner');

  const c = calls(win);
  assert.equal(c.length, 2);
  assert.equal(c[0][0], 'js');
  assert.deepEqual(c[1], ['config', 'G-67D1H8GX6X']);

  // Accepting again doesn't load it twice.
  win.bdnixAnalytics.setConsent('granted');
  assert.equal(added.length, 1);
  assert.equal(win.dataLayer.length, 2);
});

test('keeps an existing dataLayer', () => {
  const document = { createElement: () => ({}), head: { appendChild(){} } };
  const win = load('assets/js/analytics.js', {
    location: { hostname: 'bdnix.com' }, document,
    localStorage: fakeStorage({ bdnix_analytics: 'granted' }), dataLayer: [['earlier']]
  });
  assert.deepEqual(plain(win.dataLayer[0]), ['earlier']);
  assert.equal(win.dataLayer.length, 3);
});

test('on the live site, before a choice, it waits to ask and loads nothing', () => {
  const { win, added, listeners } = page('www.bdnix.com');
  assert.equal(typeof listeners.DOMContentLoaded, 'function');
  assert.equal(added.length, 0);
  assert.equal(win.gtag, undefined);
  assert.equal(win.dataLayer, undefined);
});

test('on the live site, once declined, it neither asks nor loads', () => {
  const { win, added, listeners } = page('www.bdnix.com', 'denied');
  assert.equal(listeners.DOMContentLoaded, undefined);
  assert.equal(added.length, 0);
  assert.equal(win.gtag, undefined);
});

test('accepting saves the choice and starts tracking straight away', () => {
  const { win, added, localStorage, events } = page('www.bdnix.com');
  assert.equal(win.bdnixAnalytics.setConsent('granted'), 'granted');
  assert.equal(localStorage.getItem('bdnix_analytics'), 'granted');
  assert.equal(added.length, 1);
  assert.deepEqual(events, ['bdnix:consent']);
});

test('declining saves the choice, tells gtag and deletes Google\'s cookies', () => {
  const { win, localStorage, cookieLog } = page('www.bdnix.com', 'granted', '_ga=GA1.1.1; bdnix=1; _ga_67D1H8GX6X=GS1; _gat=1; x_ga=2');
  assert.equal(win.bdnixAnalytics.setConsent('denied'), 'denied');
  assert.equal(localStorage.getItem('bdnix_analytics'), 'denied');
  assert.deepEqual(calls(win)[2], ['consent', 'update', { analytics_storage: 'denied' }]);
  const gone = '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  assert.deepEqual(cookieLog, [
    '_ga' + gone, '_ga' + gone + '; domain=.bdnix.com',
    '_ga_67D1H8GX6X' + gone, '_ga_67D1H8GX6X' + gone + '; domain=.bdnix.com'
  ]);
});

test('anything but "granted" counts as declining', () => {
  const { win, localStorage, added } = page('www.bdnix.com');
  assert.equal(win.bdnixAnalytics.setConsent('maybe'), 'denied');
  assert.equal(localStorage.getItem('bdnix_analytics'), 'denied');
  assert.equal(added.length, 0);
});

test('elsewhere it adds no script, no banner and no gtag, even if accepted', () => {
  const { win, added, listeners, cookieLog } = page('localhost', 'granted', '_ga=1');
  assert.equal(added.length, 0);
  assert.equal(listeners.DOMContentLoaded, undefined);
  assert.equal(win.gtag, undefined);
  win.bdnixAnalytics.setConsent('denied');
  assert.deepEqual(cookieLog, []);
});
