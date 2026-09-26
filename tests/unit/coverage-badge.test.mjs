import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badge } from '../coverage/badge.mjs';

test('shows line coverage as a shields.io endpoint badge', () => {
  assert.deepEqual(badge(87.25), { schemaVersion: 1, label: 'coverage', message: '87.2%', color: 'green' });
});

test('rounds down, so only full coverage shows 100%', () => {
  assert.equal(badge(99.96).message, '99.9%');
  assert.equal(badge(100).message, '100%');
  assert.equal(badge(0).message, '0%');
  assert.equal(badge(62).message, '62%');
});

test('colour steps down every 10 points below 90%', () => {
  const colours = [100, 90, 89.9, 80, 79.9, 70, 69.9, 60, 59.9, 50, 49.9, 0].map((p) => badge(p).color);
  assert.deepEqual(colours, ['brightgreen', 'brightgreen', 'green', 'green', 'yellowgreen', 'yellowgreen', 'yellow', 'yellow', 'orange', 'orange', 'red', 'red']);
});

test('refuses anything that is not a percentage', () => {
  for (const bad of ['', '87', NaN, Infinity, -1, 100.1, undefined, null]) {
    assert.throws(() => badge(bad), RangeError, String(bad));
  }
});
