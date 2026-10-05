import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, listen, heard, soundProblems } from './games.mjs';
import { axeProblems } from './checks.mjs';

// Most tests play against a stand-in for Stockfish (fakeEngine), so every
// game goes the same way. Asked for a move, it plays the next move the test
// gave it, or else the first legal move in UCI order. Asked to look at a
// position for a review (depth 16), it finds a mate in one if there is one,
// and otherwise scores the material, from the side to move's view, with the
// first legal move as its choice. The last tests use the real engine.
const OFFLINE = 'Couldn’t load the chess engine. Check your connection and try again.';
const ENGINE = /\/assets\/vendor\/stockfish\/stockfish-19-lite-single\.js/;
const VALUES = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };

// Replaces Worker before the page loads. window.uci records every command
// the page sends; window.replies is the moves to play; while window.hold is
// set, searches wait until window.release() is called.
async function fakeEngine(page, replies = []){
  await page.addInitScript(([list, values]) => {
    window.uci = [];
    window.replies = list;
    window.hold = false;
    const waiting = [];
    window.release = () => waiting.splice(0).forEach((fn) => fn());
    window.Worker = class {
      constructor(url){ this.url = url; this.setup = null; }
      postMessage(cmd){
        window.uci.push(cmd);
        if (/^position /.test(cmd)) this.setup = cmd;
        if (!/^go /.test(cmd)) return;
        const say = (line) => Promise.resolve().then(() => this.onmessage({ data: line }));
        const answer = () => {
          const C = window.bdnixChess, m = /^position (?:startpos|fen (.+?))(?: moves (.*))?$/.exec(this.setup);
          const g = C.newGame(m[1]);
          if (m[2]) m[2].split(' ').forEach((u) => C.play(g, u));
          const pos = C.current(g), legal = C.moves(pos).map(C.uci).sort();
          if (cmd === 'go depth 16') {
            const mate = legal.find((u) => { const h = { positions: g.positions.slice(), moves: g.moves.slice() }; C.play(h, u); return C.status(h).result === 'checkmate'; });
            let cp = 0;
            pos.board.forEach((p) => { if (p) cp += (C.colorOf(p) === pos.turn ? 1 : -1) * values[p.toLowerCase()]; });
            say('info depth 16 score ' + (mate ? 'mate 1' : 'cp ' + cp) + ' nodes 1 pv ' + (mate || legal[0]));
            say('bestmove ' + (mate || legal[0]));
            return;
          }
          say('bestmove ' + (window.replies.shift() || legal[0]));
        };
        if (window.hold) waiting.push(answer); else answer();
      }
      terminate(){}
    };
  }, [replies, VALUES]);
}

const sq = (page, name) => page.locator(`#board [data-sq="${name}"]`);
async function move(page, from, to){
  await sq(page, from).click();
  await sq(page, to).click();
}
const pieceOn = (page, name) => sq(page, name).getAttribute('aria-label');
const status = (page) => page.locator('#status');
const commands = (page) => page.evaluate(() => window.uci.splice(0));

async function start(page, side = 'White'){
  await page.locator('#sideSeg').getByText(side, { exact: true }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
}

// The game as saved: pausing saves it.
async function peek(page){
  await page.locator('#restartBtn').click();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('bdnix_chess_save') || 'null'));
  await page.locator('#startBtn').click();         // Resume
  return s && s.data;
}
async function openSaved(page, data){
  await page.addInitScript((d) => localStorage.setItem('bdnix_chess_save', JSON.stringify({ v: 1, data: d })), data);
  await page.reload();
}

// A game file to open.
const file = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
const FOOLS = '[Event "Test match"]\n[Date "2026.01.02"]\n[White "Ann"]\n[Black "Bob"]\n[Result "0-1"]\n\n1. f3 {a bad start} e5 (1... d5) 2. g4?? Qh4# 0-1\n';
const reviewed = (page) => expect(page.locator('#reviewProgress')).toHaveText('Analysed by Stockfish, 16 moves deep.');

test('plays White against the engine, at the level picked', async ({ page }) => {
  await fakeEngine(page);
  await listen(page);
  await openGame(page, '/chess/');
  await expect(page.locator('#ovTitle')).toHaveText('Chess');
  await expect(page.locator('#undoBtn')).toBeDisabled();
  await expect(status(page)).toHaveText('Pick a side');
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'a8');

  await start(page);
  await expect(page.locator('#turn')).toHaveText('White · you');
  await expect(status(page)).toHaveText('Your move');
  expect(await heard(page)).toEqual(['start']);

  // Picking up a piece shows where it can go.
  await sq(page, 'g1').click();
  await expect(sq(page, 'g1')).toHaveClass(/sel/);
  await expect(page.locator('#board .to')).toHaveCount(2);
  await expect(sq(page, 'f3')).toHaveAttribute('aria-label', 'f3, can move here');
  await sq(page, 'g1').click();                      // put back
  await expect(page.locator('#board .to')).toHaveCount(0);
  await sq(page, 'e7').click();                      // not yours
  await expect(page.locator('#board .sel')).toHaveCount(0);

  await move(page, 'e2', 'e4');
  expect(await pieceOn(page, 'e4')).toBe('e4, White pawn');
  // The engine (first legal move) answers a7a5.
  await expect(status(page)).toHaveText('Your move');
  expect(await pieceOn(page, 'a5')).toBe('a5, Black pawn');
  await expect(sq(page, 'a7')).toHaveClass(/last/);
  await expect(sq(page, 'a5')).toHaveClass(/last/);
  expect(await heard(page)).toEqual(['move', 'move']);
  const sent = await commands(page);
  expect(sent).toContain('uci');
  expect(sent.slice(-3)).toEqual(['setoption name Skill Level value 4', 'position startpos moves e2e4', 'go depth 3']);

  // A new level counts from the engine's next move.
  await page.locator('#level').selectOption('10');
  await move(page, 'd2', 'd4');
  await expect(status(page)).toHaveText('Your move');
  expect((await commands(page)).slice(-3)).toEqual(['setoption name Skill Level value 20', 'position startpos moves e2e4 a7a5 d2d4', 'go depth 15']);
  expect(await peek(page)).toEqual({ side: 'w', level: 10, moves: ['e2e4', 'a7a5', 'd2d4', 'a5a4'] });
  await expectNoSideScroll(page);
});

test('plays Black: the board turns round and the engine moves first', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await page.locator('#sideSeg').getByText('Black', { exact: true }).click();
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'h1');   // turned before the game starts
  await start(page, 'Black');
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'h1');
  expect(await pieceOn(page, 'a3')).toBe('a3, White pawn');
  await expect(page.locator('#turn')).toHaveText('Black · you');
  await expect(page.locator('#undoBtn')).toBeDisabled();       // nothing of yours to take back
  await move(page, 'e7', 'e5');
  await expect(status(page)).toHaveText('Your move');
  await expect(page.locator('#undoBtn')).toBeEnabled();
  await page.locator('#undoBtn').click();
  expect(await pieceOn(page, 'e7')).toBe('e7, Black pawn');
  expect(await pieceOn(page, 'a3')).toBe('a3, White pawn');
  await expect(page.locator('#undoBtn')).toBeDisabled();
});

test('undo takes back your move and the reply, or just yours while the engine thinks', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await start(page);
  await move(page, 'e2', 'e4');
  await expect(status(page)).toHaveText('Your move');
  await page.locator('#undoBtn').click();
  expect(await pieceOn(page, 'e2')).toBe('e2, White pawn');
  expect(await pieceOn(page, 'a7')).toBe('a7, Black pawn');
  await expect(page.locator('#undoBtn')).toBeDisabled();

  await page.evaluate(() => { window.hold = true; });
  await move(page, 'd2', 'd4');
  await expect(status(page)).toHaveText('Stockfish is thinking…');
  await expect(page.locator('#turn')).toHaveText('Black · Stockfish');
  await sq(page, 'e2').click();                         // not your turn
  await expect(page.locator('#board .sel')).toHaveCount(0);
  await page.locator('#undoBtn').click();
  expect(await pieceOn(page, 'd2')).toBe('d2, White pawn');
  expect(await commands(page)).toContain('stop');
  // The answer to the search that was stopped is ignored.
  await page.evaluate(() => { window.hold = false; window.release(); });
  await expect(status(page)).toHaveText('Your move');
  expect(await pieceOn(page, 'a5')).toBe('a5');
});

test('a piece can be dragged to its square', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await start(page);
  const from = await sq(page, 'g1').boundingBox(), to = await sq(page, 'f3').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await pieceOn(page, 'f3')).toBe('f3, White knight');
  await expect(status(page)).toHaveText('Your move');

  // Dropped where it can't go, it goes back.
  const back = await sq(page, 'f3').boundingBox(), off = await sq(page, 'f6').boundingBox();
  await page.mouse.move(back.x + back.width / 2, back.y + back.height / 2);
  await page.mouse.down();
  await page.mouse.move(off.x + off.width / 2, off.y + off.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await pieceOn(page, 'f3')).toBe('f3, White knight');
  await expect(page.locator('#board .sel')).toHaveCount(0);
});

test('the board can be played with the keyboard', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await start(page);
  await sq(page, 'a1').focus();
  await press(page, 'ArrowLeft');                       // already at the edge
  await expect(sq(page, 'a1')).toBeFocused();
  await press(page, 'ArrowRight', 4);
  await press(page, 'ArrowUp');
  await expect(sq(page, 'e2')).toBeFocused();
  await press(page, 'Enter');
  await press(page, 'ArrowUp', 2);
  await press(page, 'Enter');
  expect(await pieceOn(page, 'e4')).toBe('e4, White pawn');
  await expect(sq(page, 'e4')).toHaveAttribute('tabindex', '0');
  await press(page, 'ArrowDown', 6);
  await press(page, 'ArrowDown');                       // the bottom edge
  await expect(sq(page, 'e1')).toBeFocused();
});

test('checkmating the engine: a win, a new best, and the game\'s review', async ({ page }) => {
  await fakeEngine(page, ['f2f3', 'g2g4']);
  await listen(page);
  await openGame(page, '/chess/');
  await start(page, 'Black');
  await move(page, 'e7', 'e5');
  await move(page, 'd8', 'h4');
  await expect(page.locator('#review')).toBeVisible();
  await expect(page.locator('#reviewTitle')).toHaveText('You win!');
  await expect(page.locator('#reviewKicker')).toHaveText('Checkmate');
  await expect(page.locator('#reviewText')).toHaveText('Checkmate — Black wins · Level 3 — your best yet!');
  await expect(status(page)).toHaveText('Checkmate — Black wins');
  await expect(page.locator('#best')).toHaveText('Level 3');
  await expect(sq(page, 'e1')).toHaveClass(/check/);
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('bdnix_chess_best'))).toBe('3');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_chess_save'))).toBeNull();
  expect(await heard(page)).toEqual(['start', 'move', 'move', 'move', 'check', 'best']);

  // Every position looked at by the engine at full strength, but the last: mate.
  await reviewed(page);
  const sent = await commands(page);
  expect(sent.filter((c) => c === 'go depth 16')).toHaveLength(4);
  expect(sent).toContain('setoption name Skill Level value 20');
  expect(sent).toContain('position startpos moves f2f3 e7e5 g2g4');
  await expect(page.locator('#accW')).toHaveText(/^\d+%$/);
  await expect(page.locator('#accB')).toHaveText('100%');
  await expect(page.locator('#blunderW')).toHaveText('1');
  await expect(page.locator('#blunderB')).toHaveText('0');
  await expect(page.locator('#mistakeW')).toHaveText('0');
  await expect(page.locator('#evalNow')).toHaveText('#');
  await expect(page.locator('#moveNow')).toHaveText('2… Qh4#: Best move.');
  await expect(page.locator('.mv')).toHaveText(['f3', 'e5', 'g4??', 'Qh4#']);
  await expect(page.locator('.mv.blunder')).toHaveAttribute('aria-label', '2. g4, blunder');
  await expect(page.locator('#graph')).toHaveAttribute('aria-label', /Accuracy: White \d+%, Black 100%/);
  await expect(page.locator('#nextBtn')).toBeDisabled();

  // Stepping through: buttons, keys and the move list.
  await page.locator('#firstBtn').click();
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');
  await expect(page.locator('#evalNow')).toHaveText('0.00');
  await expect(page.locator('#prevBtn')).toBeDisabled();
  expect(await pieceOn(page, 'f2')).toBe('f2, White pawn');
  await expect(sq(page, 'a2')).toHaveClass(/hint/);     // the engine's choice: a3
  await page.locator('#nextBtn').click();
  await expect(page.locator('#moveNow')).toHaveText('1. f3: Good move. Best was a3.');
  await expect(sq(page, 'f3')).toHaveClass(/last/);
  await press(page, 'ArrowRight', 2);
  await expect(page.locator('#moveNow')).toHaveText('2. g4: Blunder. Best was a3.');
  await expect(page.locator('#evalNow')).toHaveText('-M1');
  await expect(status(page)).toHaveText('Reviewing');
  await expect(sq(page, 'd8')).toHaveClass(/hint/);     // Qh4# is coming
  await press(page, 'ArrowLeft');
  await expect(page.locator('#moveNow')).toHaveText('1… e5: Good move. Best was a5.');
  await press(page, 'End');
  await expect(page.locator('#moveNow')).toHaveText('2… Qh4#: Best move.');
  await press(page, 'Home');
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');
  await page.locator('.mv').nth(2).click();
  await expect(page.locator('.mv').nth(2)).toHaveAttribute('aria-current', 'true');
  await page.locator('#lastBtn').click();
  await page.locator('#prevBtn').click();
  await expect(page.locator('#moveNow')).toHaveText('2. g4: Blunder. Best was a3.');
  // The graph: a click picks the move under it.
  const box = await page.locator('#graph').boundingBox();
  await page.mouse.click(box.x + 1, box.y + box.height / 2);
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');
  await page.mouse.click(box.x + box.width - 1, box.y + box.height / 2);
  await expect(page.locator('#moveNow')).toHaveText('2… Qh4#: Best move.');
  // The board turns round.
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'h1');
  await page.locator('#flipBtn').click();
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'a8');
  await expectNoSideScroll(page);

  // Play again: the start screen, then the same win isn't a new best.
  await page.evaluate(() => window.replies.push('f2f3', 'g2g4'));
  await page.locator('#againBtn').click();
  await expect(page.locator('#review')).toBeHidden();
  await expect(page.locator('#ovTitle')).toHaveText('Chess');
  await start(page, 'Black');
  await move(page, 'e7', 'e5');
  await move(page, 'd8', 'h4');
  await expect(page.locator('#reviewText')).toHaveText('Checkmate — Black wins · Level 3');
  expect((await heard(page)).pop()).toBe('win');
});

test('being checkmated, and a draw', async ({ page }) => {
  await fakeEngine(page, ['e7e5', 'd8h4']);
  await listen(page);
  await openGame(page, '/chess/');
  await page.evaluate(() => localStorage.setItem('bdnix_chess_best', '5'));
  await start(page);
  await move(page, 'f2', 'f3');
  await move(page, 'g2', 'g4');
  await expect(page.locator('#reviewTitle')).toHaveText('Stockfish wins');
  await expect(page.locator('#reviewText')).toHaveText('Checkmate — Black wins · Level 3');
  await expect(page.locator('#againBtn')).toHaveText('Play again');
  await expect(page.locator('#turn')).toHaveText('—');
  expect((await heard(page)).pop()).toBe('over');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_chess_best'))).toBe('5');
  await reviewed(page);

  // A draw by repetition: the knights go out and back twice.
  await page.evaluate(() => window.replies.push('g8f6', 'f6g8', 'g8f6', 'f6g8'));
  await page.locator('#againBtn').click();
  await page.getByRole('button', { name: 'Start game' }).click();
  for (let i = 0; i < 2; i++) {
    await move(page, 'g1', 'f3');
    await move(page, 'f3', 'g1');
  }
  await expect(page.locator('#reviewTitle')).toHaveText('Draw');
  await expect(page.locator('#reviewKicker')).toHaveText('Draw');
  await expect(page.locator('#reviewText')).toHaveText('Draw by threefold repetition · Level 3');
  await expect(status(page)).toHaveText('Draw by threefold repetition');
  await reviewed(page);
  await expect(page.locator('#evalNow')).toHaveText('0.00');
});

test('opens a PGN file and reviews it', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#reviewKicker')).toHaveText('fools.pgn');
  await expect(page.locator('#reviewTitle')).toHaveText('Ann vs Bob');
  await expect(page.locator('#reviewText')).toHaveText('Black won · Test match · 2026.01.02 · 4 moves');
  await expect(page.locator('#againBtn')).toHaveText('Play a game');
  await expect(page.locator('.mv')).toHaveText(['f3', 'e5', 'g4??', 'Qh4#']);
  await reviewed(page);
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'a8');
  await expectNoSideScroll(page);

  // The import button opens the same picker.
  const picker = page.waitForEvent('filechooser');
  await page.locator('#anotherBtn').click();
  await (await picker).setFiles(file('moves.txt', 'e4 e5 Nf3 Nc6'));
  await expect(page.locator('#reviewTitle')).toHaveText('White vs Black');
  await expect(page.locator('#reviewText')).toHaveText('Unfinished · 4 moves');
  await reviewed(page);
  await expect(page.locator('.moves li')).toHaveCount(2);

  // A file that isn't a game says why, and the review stays.
  await page.locator('#pgnFile').setInputFiles(file('notes.txt', 'e4 e5 Nf6'));
  await expect(page.locator('#reviewMsg')).toHaveText('Couldn’t read a game from notes.txt. Move 2. Nf6 isn’t a legal move there.');
  await expect(page.locator('#reviewTitle')).toHaveText('White vs Black');

  await page.locator('#againBtn').click();
  await expect(page.locator('#ovTitle')).toHaveText('Chess');
  await expect(page.locator('#reviewMsg')).toHaveText('');
});

test('a game from a file is replayed on the board, a move a second', async ({ page }) => {
  await fakeEngine(page);
  await listen(page);
  await openGame(page, '/chess/');
  const btn = page.locator('#replayBtn');
  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');
  await expect(btn).toHaveAttribute('aria-label', 'Pause the replay');
  await expect(status(page)).toHaveText('Replaying');
  expect(await pieceOn(page, 'f2')).toBe('f2, White pawn');
  await page.clock.runFor(1000);
  await expect(page.locator('#moveNow')).toHaveText('1. f3: Good move. Best was a3.');
  expect(await pieceOn(page, 'f3')).toBe('f3, White pawn');
  await expect(sq(page, 'f3')).toHaveClass(/last/);
  await page.clock.runFor(3000);
  await expect(page.locator('#moveNow')).toHaveText('2… Qh4#: Best move.');
  await expect(btn).toHaveAttribute('aria-label', 'Replay the moves');
  await expect(status(page)).toHaveText('Checkmate — Black wins');
  expect(await heard(page)).toEqual(['move', 'move', 'move', 'check']);
  await page.clock.runFor(3000);                           // it stays at the end
  await expect(page.locator('#moveNow')).toHaveText('2… Qh4#: Best move.');

  // From the end, play starts again from the beginning.
  await btn.click();
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');
  await expect(btn).toHaveAttribute('aria-label', 'Pause the replay');
  await page.clock.runFor(1000);
  await expect(page.locator('#moveNow')).toHaveText('1. f3: Good move. Best was a3.');
  // A step by hand stops it there.
  await page.locator('#nextBtn').click();
  await expect(page.locator('#moveNow')).toHaveText('1… e5: Good move. Best was a5.');
  await expect(btn).toHaveAttribute('aria-label', 'Replay the moves');
  await expect(status(page)).toHaveText('Reviewing');
  await page.clock.runFor(3000);
  await expect(page.locator('#moveNow')).toHaveText('1… e5: Good move. Best was a5.');
  // Space carries on from where it is, and stops it again.
  await page.evaluate(() => document.activeElement.blur());
  await press(page, 'Space');
  await expect(btn).toHaveAttribute('aria-label', 'Pause the replay');
  await page.clock.runFor(1000);
  await expect(page.locator('#moveNow')).toHaveText('2. g4: Blunder. Best was a3.');
  await press(page, 'Space');
  await expect(btn).toHaveAttribute('aria-label', 'Replay the moves');
  await page.clock.runFor(2000);
  await expect(page.locator('#moveNow')).toHaveText('2. g4: Blunder. Best was a3.');

  // Leaving the review stops it too.
  await btn.click();
  await page.locator('#againBtn').click();
  await page.clock.runFor(3000);
  await expect(page.locator('#ovTitle')).toHaveText('Chess');
  expect(await pieceOn(page, 'f2')).toBe('f2, White pawn');
});

test('a game that has just ended can be replayed from its review', async ({ page }) => {
  await fakeEngine(page, ['e7e5', 'd8h4']);
  await openGame(page, '/chess/');
  await start(page);
  await move(page, 'f2', 'f3');
  await move(page, 'g2', 'g4');
  await expect(page.locator('#moveNow')).toHaveText(/^2… Qh4#/);   // opens at the end, not replaying
  await expect(page.locator('#replayBtn')).toHaveAttribute('aria-label', 'Replay the moves');
  await page.locator('#replayBtn').click();
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');
  await page.clock.runFor(4000);
  await expect(page.locator('#moveNow')).toHaveText(/^2… Qh4#/);
  await expect(page.locator('#replayBtn')).toHaveAttribute('aria-label', 'Replay the moves');
});

test('a game file from a set-up position, with Black to move first', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('endgame.pgn', '[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"]\n\n40... Kd7 41. e4 Ke6 *'));
  await reviewed(page);
  await expect(page.locator('#reviewText')).toHaveText('Unfinished · 3 moves');
  expect(await page.locator('.moves li').first().innerText()).toMatch(/^40…\s+Kd7$/);
  await expect(page.locator('.moves .num')).toHaveText(['40…', '41.']);
  expect(await commands(page)).toContain('position fen 4k3/8/8/8/8/8/4P3/4K3 b - - 0 40 moves e8d7');
  await press(page, 'Home');
  expect(await pieceOn(page, 'e8')).toBe('e8, Black king');
});

test('game files that can\'t be opened say why on the start screen', async ({ page }) => {
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('empty.pgn', '[Event "Nothing"]\n\n*'));
  await expect(page.locator('#ovMsg')).toHaveText('Couldn’t read a game from empty.pgn. There are no moves in it.');
  await page.locator('#pgnFile').setInputFiles(file('big.pgn', 'e4 '.repeat(400000)));
  await expect(page.locator('#ovMsg')).toHaveText('big.pgn is too big to be a game (over 1 MB).');
  await expect(page.locator('#ovTitle')).toHaveText('Chess');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#ovMsg')).toHaveText('');
});

test('a paused game waits while a game file is reviewed, even across a reload', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await start(page);
  await move(page, 'e2', 'e4');
  await expect(status(page)).toHaveText('Your move');
  await press(page, 'KeyP');
  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await expect(page.locator('#againBtn')).toHaveText('Back to your game');
  await reviewed(page);
  await press(page, 'KeyP');                             // no pausing a review
  await expect(page.locator('#overlay')).toBeHidden();

  // Opening another file still goes back to the game.
  await page.locator('#pgnFile').setInputFiles(file('moves.txt', 'd4 d5'));
  await expect(page.locator('#againBtn')).toHaveText('Back to your game');
  await page.locator('#againBtn').click();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Your game is just as you left it.');
  expect(await pieceOn(page, 'e4')).toBe('e4, White pawn');
  expect(await pieceOn(page, 'a5')).toBe('a5, Black pawn');

  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await page.reload();
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await page.locator('#startBtn').click();
  await expect(status(page)).toHaveText('Your move');
  expect(await pieceOn(page, 'a5')).toBe('a5, Black pawn');
});

test('captures, material and check show in the panels', async ({ page }) => {
  await fakeEngine(page, ['d7d5', 'd8d5', 'd5e5']);
  await listen(page);
  await openGame(page, '/chess/');
  await start(page);
  await move(page, 'e2', 'e4');
  await move(page, 'e4', 'd5');
  await expect(page.locator('#capYou svg')).toHaveCount(1);
  await expect(page.locator('#capThem svg')).toHaveCount(1);       // the queen took back
  await expect(page.locator('#capYou')).toHaveAttribute('aria-label', 'Taken: pawn');
  await expect(page.locator('#advYou')).toHaveText('');
  await move(page, 'g1', 'f3');                                     // the queen checks on e5
  await expect(status(page)).toHaveText('Check!');
  await move(page, 'f1', 'e2');
  await expect(status(page)).toHaveText('Your move');
  await move(page, 'f3', 'e5');                                     // takes the queen
  await expect(page.locator('#advYou')).toHaveText('+9');
  await expect(page.locator('#capYou')).toHaveAttribute('aria-label', 'Taken: queen, pawn');
  expect(await heard(page)).toEqual(['start', 'move', 'move', 'capture', 'capture', 'move', 'check', 'move', 'move', 'capture', 'move']);
  expect(await soundProblems(page)).toEqual([]);
});

test('a pawn on the last row becomes the piece picked', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await openSaved(page, { side: 'w', level: 3, moves: ['h2h4', 'g7g5', 'h4g5', 'h7h6', 'g5h6', 'b8c6', 'h6h7', 'c6b8'] });
  await page.locator('#startBtn').click();               // Resume
  await move(page, 'h7', 'g8');
  await expect(page.locator('#promo')).toBeVisible();
  await press(page, 'Escape');                           // changed your mind
  await expect(page.locator('#promo')).toBeHidden();
  expect(await pieceOn(page, 'h7')).toBe('h7, White pawn');
  await move(page, 'h7', 'g8');
  await page.locator('#promo').getByRole('button', { name: 'Knight' }).click();
  expect(await pieceOn(page, 'g8')).toBe('g8, White knight');
  expect(await page.evaluate(() => window.uci.filter((c) => c.startsWith('position')).pop())).toMatch(/h7g8n$/);
});

test('a game is kept across a reload and comes back paused', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await start(page, 'Black');
  await page.locator('#level').selectOption('7');
  await move(page, 'e7', 'e5');
  await expect(status(page)).toHaveText('Your move');
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  await expect(page.locator('#level')).toHaveValue('7');
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'h1');
  expect(await pieceOn(page, 'e5')).toBe('e5, Black pawn');
  expect(await pieceOn(page, 'a2')).toBe('a2, White rook');
  await expect(page.locator('#sideSeg input[value=b]')).toBeChecked();
  await page.locator('#startBtn').click();               // Resume
  await expect(status(page)).toHaveText('Your move');
  await move(page, 'd7', 'd5');
  await expect(status(page)).toHaveText('Your move');
  expect((await peek(page)).moves).toEqual(['a2a3', 'e7e5', 'a1a2', 'd7d5', 'a2a1']);
});

test('the engine moves when a game saved on its turn is resumed', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await openSaved(page, { side: 'b', level: 2, moves: ['e2e4', 'e7e5'] });
  await expect(page.locator('#ovText')).toHaveText('Picked up where you left off.');
  expect(await commands(page)).toEqual([]);              // nothing asked while paused
  await page.locator('#pauseBtn').click();
  await expect(status(page)).toHaveText('Your move');
  expect(await pieceOn(page, 'a3')).toBe('a3, White pawn');
});

test('New game: from the panel asks first, from the pause screen starts over with the side picked', async ({ page }) => {
  await fakeEngine(page);
  await listen(page);
  await openGame(page, '/chess/');
  await start(page);
  await move(page, 'e2', 'e4');
  await expect(status(page)).toHaveText('Your move');
  await page.locator('#restartBtn').click();
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await expect(page.locator('#ovText')).toHaveText('Pick a side for a new game, or resume this one.');
  await expect(status(page)).toHaveText('Paused');
  await page.locator('#sideSeg').getByText('Black', { exact: true }).click();
  await heard(page);
  await page.locator('#newBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(sq(page, 'a3')).toHaveAttribute('aria-label', 'a3, White pawn');
  expect(await pieceOn(page, 'e2')).toBe('e2, White pawn');
  expect(await heard(page)).toEqual(['start', 'move']);
  await expect(page.locator('#turn')).toHaveText('Black · you');
  expect((await commands(page)).filter((c) => c === 'ucinewgame').length).toBeGreaterThan(1);

  // P pauses and resumes too.
  await press(page, 'KeyP');
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  await press(page, 'KeyP');
  await expect(page.locator('#overlay')).toBeHidden();
});

test('a save that doesn\'t make sense is thrown away', async ({ page }) => {
  await openGame(page, '/chess/');
  for (const data of [
    { side: 'x', level: 3, moves: ['e2e4'] },
    { side: 'w', level: 11, moves: ['e2e4'] },
    { side: 'w', level: 2.5, moves: ['e2e4'] },
    { side: 'w', level: 3, moves: [] },
    { side: 'w', level: 3, moves: 'e2e4' },
    { side: 'w', level: 3, moves: ['e2e5'] },
    { side: 'w', level: 3, moves: [42] },
    { side: 'w', level: 3, moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'] }       // already over
  ]) {
    await page.evaluate((d) => localStorage.setItem('bdnix_chess_save', JSON.stringify({ v: 1, data: d })), data);
    await page.reload();
    await expect(page.locator('#ovTitle'), JSON.stringify(data)).toHaveText('Chess');
    expect(await page.evaluate(() => localStorage.getItem('bdnix_chess_save'))).toBeNull();
  }
});

test('no save before the first move, and none after the game ends', async ({ page }) => {
  await fakeEngine(page, ['e7e5', 'd8h4']);
  await openGame(page, '/chess/');
  await start(page);
  expect(await peek(page)).toBeNull();
  await move(page, 'f2', 'f3');
  expect(await peek(page)).toEqual({ side: 'w', level: 3, moves: ['f2f3', 'e7e5'] });
  await move(page, 'g2', 'g4');
  await expect(page.locator('#reviewTitle')).toHaveText('Stockfish wins');
  expect(await page.evaluate(() => localStorage.getItem('bdnix_chess_save'))).toBeNull();
  await page.reload();
  await expect(page.locator('#ovTitle')).toHaveText('Chess');
});

test('Stockfish is fetched when a game starts, says so when it can\'t be, and plays', async ({ page }) => {
  test.setTimeout(60000);
  const seen = [];
  page.on('request', (r) => { if (ENGINE.test(r.url())) seen.push(r.url()); });
  await page.route(ENGINE, (route) => route.abort());
  await openGame(page, '/chess/');
  expect(seen).toEqual([]);
  await page.locator('#sideSeg').getByText('Black', { exact: true }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#ovText')).toHaveText(OFFLINE);
  await expect(page.locator('#ovTitle')).toHaveText('Paused');
  expect(seen).toEqual([expect.stringContaining('stockfish-19-lite-single.js?v=19.0.0')]);

  // Back online, Resume tries again, and the real engine opens for White.
  await page.unroute(ENGINE);
  await page.locator('#sideSeg').getByText('Black', { exact: true }).click();
  await page.locator('#startBtn').click();               // Resume
  await expect(status(page)).toHaveText('Your move', { timeout: 45000 });
  const moved = await page.locator('#board .last').count();
  expect(moved).toBe(2);
  await expect(page.locator('#turn')).toHaveText('Black · you');
});

test('a review says so when Stockfish can\'t be fetched, and tries again', async ({ page }) => {
  test.setTimeout(60000);
  await page.route(ENGINE, (route) => route.abort());
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await expect(page.locator('#reviewProgress')).toHaveText(OFFLINE);
  await expect(page.locator('#accW')).toHaveText('—');
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');
  await page.locator('#replayBtn').click();                // stop the replay
  await press(page, 'End');
  await expect(page.locator('#moveNow')).toHaveText('2… Qh4#: not analysed yet.');
  await page.unroute(ENGINE);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#reviewProgress')).toHaveText('Analysed by Stockfish, 16 moves deep.', { timeout: 45000 });
  await expect(page.locator('#retryBtn')).toBeHidden();
  await expect(page.locator('#blunderW')).toHaveText('1');
  await expect(page.locator('.mv.blunder .san')).toHaveText('g4');
  await expect(page.locator('#moveNow')).toHaveText('2… Qh4#: Best move.');
});

test('a game review passes axe', async ({ page }) => {
  // Not openGame(): axe needs a running clock.
  await fakeEngine(page);
  await page.goto('/chess/');
  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await reviewed(page);
  await page.locator('.mv').nth(2).click();
  expect(await axeProblems(page)).toEqual([]);
});
