// A pretend unit test for tests/unit/test-deps.test.mjs, run with
// tests/unit/track.mjs: it imports a helper, reads a file, lists a folder and
// checks for a file, and tests/unit/track.mjs should note each.
import fs from 'node:fs';
import { helper } from './helper.mjs';

helper();
fs.readFileSync('tests/unit/test-deps/shared.mjs', 'utf8');
fs.readdirSync('tests/unit/test-deps');
fs.existsSync('tests/unit/test-deps/nowhere.mjs');
fs.readFileSync('package.json', 'utf8');
