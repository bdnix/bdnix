import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

// A `document` whose <head> records the scripts added to it.
function page(hostname){
  const added = [];
  const document = {
    createElement: (tag) => ({ tagName: tag }),
    head: { appendChild: (el) => { added.push(el); } }
  };
  const win = load('assets/js/analytics.js', { location: { hostname }, document });
  return { win, added };
}

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
});

test('on the live site it loads gtag.js with the measurement ID and records a page view', () => {
  const { win, added } = page('www.bdnix.com');
  assert.equal(win.bdnixAnalytics.id, 'G-67D1H8GX6X');
  assert.equal(added.length, 1);
  assert.equal(added[0].tagName, 'script');
  assert.equal(added[0].async, true);
  assert.equal(added[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-67D1H8GX6X');

  const calls = win.dataLayer.map((args) => Array.prototype.slice.call(args));
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'js');
  assert.equal(Object.prototype.toString.call(calls[0][1]), '[object Date]');
  assert.deepEqual(plain(calls[1]), ['config', 'G-67D1H8GX6X']);

  win.gtag('event', 'test');
  assert.deepEqual(plain(Array.prototype.slice.call(win.dataLayer[2])), ['event', 'test']);
});

test('keeps an existing dataLayer', () => {
  const added = [];
  const document = { createElement: () => ({}), head: { appendChild: (el) => added.push(el) } };
  const win = load('assets/js/analytics.js', { location: { hostname: 'bdnix.com' }, document, dataLayer: [['earlier']] });
  assert.deepEqual(plain(win.dataLayer[0]), ['earlier']);
  assert.equal(win.dataLayer.length, 3);
});

test('elsewhere it adds no script and no gtag', () => {
  const { win, added } = page('localhost');
  assert.equal(added.length, 0);
  assert.equal(win.gtag, undefined);
  assert.equal(win.dataLayer, undefined);
});
