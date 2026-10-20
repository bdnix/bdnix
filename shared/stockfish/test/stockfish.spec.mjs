import { test, expect } from '../../../tests/ui/fixtures.mjs';
import { openFixture } from '../../../tests/ui/fixture.mjs';

// The vendored engine (Stockfish.js, the lite single-threaded WebAssembly
// build), published at /assets/vendor/stockfish/, run as a web worker on a
// page of its own: it speaks UCI and answers a search with a legal move.
const ENGINE = '/assets/vendor/stockfish/stockfish-19-lite-single.js?v=19.0.0';

// Starts the engine, sends it commands and collects what it says until a
// line matches `until` (a regular expression's source).
function ask(page, commands, until){
  return page.evaluate(({ url, commands, until }) => new Promise((resolve, reject) => {
    const worker = new Worker(url), heard = [], done = new RegExp(until);
    worker.onerror = (e) => reject(new Error(e.message || 'the engine failed'));
    worker.onmessage = (e) => {
      heard.push(String(e.data));
      if (done.test(String(e.data))) { worker.terminate(); resolve(heard); }
    };
    commands.forEach((c) => worker.postMessage(c));
  }), { url: ENGINE, commands, until });
}

test('the engine says who it is and is ready', async ({ page }) => {
  await openFixture(page);
  const heard = await ask(page, ['uci', 'isready'], '^readyok$');
  expect(heard).toContain('uciok');
  expect(heard.some((l) => /^id name Stockfish/.test(l))).toBe(true);
});

test('a search from a position answers with the best move', async ({ page }) => {
  await openFixture(page);
  // White mates in one: Qh5xf7 (the Scholar's mate).
  const heard = await ask(page, [
    'uci', 'ucinewgame',
    'position startpos moves e2e4 e7e5 d1h5 b8c6 f1c4 g8f6',
    'go depth 6'
  ], '^bestmove ');
  expect(heard[heard.length - 1]).toMatch(/^bestmove h5f7\b/);
  expect(heard.some((l) => / score mate 1 /.test(l))).toBe(true);
});

test('its licence is published beside it', async ({ request }) => {
  const res = await request.get('/assets/vendor/stockfish/LICENSE.md');
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/GNU GENERAL PUBLIC LICENSE/);
});
