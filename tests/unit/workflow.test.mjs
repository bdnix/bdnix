import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// What .github/workflows/tests.yml promises about which tests run where:
// the UI tests always on several machines, the unit tests on one, and once a
// week everything, ignoring cached results.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const yml = fs.readFileSync(path.join(root, '.github/workflows/tests.yml'), 'utf8');
// Each job's text, by its id.
const jobs = Object.fromEntries(yml.split(/^jobs:\n/m)[1].split(/^(?= {2}[\w-]+:\n)/m).filter((j) => /^ {2}[\w-]+:\n/.test(j)).map((j) => [/^ {2}([\w-]+):/.exec(j)[1], j]));
const FULL = "${{ !(inputs.full || github.event_name == 'schedule') }}";

test('once a week, the workflow runs on its own, with every test', () => {
  const cron = /^ {2}schedule:\n {4}- cron: '([^']+)'$/m.exec(yml);
  assert.ok(cron, 'no schedule');
  const [minute, hour, day, month, weekday] = cron[1].split(' ');
  assert.ok(/^\d+$/.test(minute) && /^\d+$/.test(hour), cron[1]);
  assert.deepEqual([day, month], ['*', '*']);
  assert.match(weekday, /^[0-6]$/, 'one day a week');
  // Every cache restore is skipped then, and when run by hand with "full".
  const restores = [...yml.matchAll(/name: Restore (unit|UI) test results from cache\n\s+if: (.*)\n/g)];
  assert.deepEqual(restores.map((r) => [r[1], r[2]]), [['unit', FULL], ['UI', FULL]]);
});

test('the UI tests run on four machines, sharing out what the plan found; the unit tests on one', () => {
  assert.match(jobs['ui-plan'], /--plan --shards=4\n/);
  assert.match(jobs['ui-machine'], /machine: \[1, 2, 3, 4\]/);
  assert.match(jobs['ui-machine'], /SPECS: \$\{\{ fromJSON\(needs\.ui-plan\.outputs\.shards\)\[matrix\.machine - 1\] \}\}/);
  assert.match(jobs['ui-machine'], /coverage:ui:cached -- --run \$SPECS/);
  // The last job, the check named "UI tests", fails unless every spec passed.
  assert.match(jobs.ui, /name: UI tests\n/);
  assert.match(jobs.ui, /needs: \[ui-plan, ui-machine\]/);
  assert.match(jobs.ui, /coverage:ui:cached -- --merge/);
  assert.doesNotMatch(jobs.unit, /matrix|shard/);
  assert.match(jobs.coverage, /needs: \[unit, ui\]/);
});
