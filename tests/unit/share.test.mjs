import { test } from 'node:test';
import assert from 'node:assert/strict';
import { share } from '../../scripts/share.mjs';

// CI runs the UI specs that need to run on several machines at once; the
// plan shares them out by how long each last took (scripts/share.mjs).

test('every spec goes to exactly one machine, the longest first to the least loaded', () => {
  const ms = { 'a.spec.mjs': 9000, 'b.spec.mjs': 5000, 'c.spec.mjs': 4000, 'd.spec.mjs': 1000 };
  const shares = share(Object.keys(ms), ms, 2);
  assert.deepEqual(shares, [['a.spec.mjs', 'd.spec.mjs'], ['b.spec.mjs', 'c.spec.mjs']]);
  assert.deepEqual(shares.flat().sort(), Object.keys(ms));
});

test('a spec with no time yet counts as 30 seconds; ties go by name, so every machine shares them alike', () => {
  assert.deepEqual(share(['n.spec.mjs', 'm.spec.mjs', 'o.spec.mjs'], { 'o.spec.mjs': 40000 }, 2), [['o.spec.mjs'], ['m.spec.mjs', 'n.spec.mjs']]);
  assert.deepEqual(share(['b', 'a'], {}, 2), [['a'], ['b']]);
});

test('more machines than specs leaves some with none; nothing to run gives every machine nothing', () => {
  assert.deepEqual(share(['a'], {}, 3), [['a'], [], []]);
  assert.deepEqual(share([], {}, 4), [[], [], [], []]);
});
