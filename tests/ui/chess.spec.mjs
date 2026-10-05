import { test, expect, expectNoSideScroll } from './fixtures.mjs';
import { openGame, press, listen, heard, soundProblems } from './games.mjs';
import { axeProblems } from './checks.mjs';

// Most tests play against a stand-in for Stockfish (fakeEngine), so every
// game goes the same way. Asked for a move, it plays the next move the test
// gave it, or else the first legal move in UCI order. Asked to look at a
// position for a review (depth 16), it finds a mate in one if there is one,
// and otherwise scores the material, from the side to move's view, with the
// first legal move as its choice. Any other search scores the position
// level. The last tests use the real engine.
const OFFLINE = 'Couldn’t load the chess engine. Check your connection and try again.';
const ENGINE = /\/assets\/vendor\/stockfish\/stockfish-19-lite-single\.js/;
const VALUES = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };

// Replaces Worker before the page loads. window.uci records every command
// the page sends; window.replies is the moves to play; while window.hold is
// set, searches wait until window.release() is called, or until they're
// stopped, which answers them at once. Like Stockfish, it crashes if a
// search starts before the one before it has answered. window.engines
// counts the engines started.
async function fakeEngine(page, replies = []){
  await page.addInitScript(([list, values]) => {
    window.uci = [];
    window.replies = list;
    window.hold = false;
    let waiting = [];
    window.release = () => waiting.splice(0).forEach((fn) => fn());
    window.Worker = class {
      constructor(url){ this.url = url; this.setup = null; this.searching = null; window.engines = (window.engines || 0) + 1; }
      postMessage(cmd){
        window.uci.push(cmd);
        if (/^position /.test(cmd)) this.setup = cmd;
        if (cmd === 'stop' && waiting.includes(this.searching)) {
          waiting = waiting.filter((fn) => fn !== this.searching);
          this.searching();
        }
        if (!/^go /.test(cmd)) return;
        if (this.searching) {
          this.onerror({ message: 'RuntimeError: unreachable', preventDefault(){} });
          return;
        }
        const setup = this.setup;
        const say = (line) => Promise.resolve().then(() => {
          if (/^bestmove /.test(line)) this.searching = null;
          this.onmessage({ data: line });
        });
        const answer = () => {
          const C = window.bdnixChess, m = /^position (?:startpos|fen (.+?))(?: moves (.*))?$/.exec(setup);
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
          const reply = window.replies.shift() || legal[0];
          say('info depth 1 score cp 0 nodes 1 pv ' + reply);
          say('bestmove ' + reply);
        };
        this.searching = answer;
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
  // Only the visitor's own slips are listed, and Stockfish's g4 isn't one.
  await expect(page.locator('#momentsTitle')).toHaveText('Where you could have done better');
  await expect(page.locator('.moment')).toHaveCount(0);
  await expect(page.locator('#momentsNote')).toHaveText('None: every move you made kept your chances.');

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

const SCHOLARS = '[White "Ann"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7# 1-0\n';
const alt = (page) => page.locator('#alt');

test('a different move can be tried in a review, against the game\'s own', async ({ page }) => {
  await fakeEngine(page);
  await listen(page);
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('scholars.pgn', SCHOLARS));
  await reviewed(page);
  await expect(page.locator('#altTip')).toBeVisible();

  // Picking up a piece stops the replay; Black, to move after 3. Qh5, can move.
  await page.clock.runFor(5000);
  await expect(page.locator('#moveNow')).toHaveText('3. Qh5: Good move. Best was a3.');
  await expect(page.locator('#replayBtn')).toHaveAttribute('aria-label', 'Pause the replay');
  await sq(page, 'g7').click();
  await expect(page.locator('#replayBtn')).toHaveAttribute('aria-label', 'Replay the moves');
  await expect(sq(page, 'g7')).toHaveClass(/sel/);
  await sq(page, 'g6').click();
  expect(await heard(page)).toEqual(['move', 'move', 'move', 'move', 'move', 'move']);
  expect(await pieceOn(page, 'g6')).toBe('g6, Black pawn');
  await expect(sq(page, 'g6')).toHaveClass(/last/);
  await expect(status(page)).toHaveText('Trying a move');
  await expect(page.locator('#altTip')).toBeHidden();
  await expect(page.locator('#moveNow')).toHaveText('Your line: 3… g6');
  // The game's move let White mate; g6 stops it.
  await expect(page.locator('#altGame')).toHaveText('3… Nf6 · Blunder · M1 · Black’s chances 2%');
  await expect(page.locator('#altMine')).toHaveText('3… g6 · Good move · 0.00 · Black’s chances 50%');
  await expect(page.locator('#altVerdict')).toHaveText('g6 is better than the game’s Nf6: Black’s chances go up from 2% to 50%.');
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: White won.');
  await expect(page.locator('#evalNow')).toHaveText('0.00');
  // The move list stays on the game's move it branched from.
  await expect(page.locator('.mv.on .san')).toHaveText('Qh5');
  expect(await commands(page)).toContain('position startpos moves e2e4 e7e5 f1c4 b8c6 d1h5 g7g6');
  await expectNoSideScroll(page);

  // Either side carries on: White, then Black.
  await move(page, 'h5', 'f3');
  await move(page, 'g8', 'f6');
  await expect(page.locator('#moveNow')).toHaveText('Your line: 3… g6 4. Qf3 Nf6');
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: White won.');
  // ← takes a move back (off the board, where the arrows move round it),
  // and so does Take back.
  await page.evaluate(() => document.activeElement.blur());
  await press(page, 'ArrowLeft');
  await expect(page.locator('#moveNow')).toHaveText('Your line: 3… g6 4. Qf3');
  expect(await pieceOn(page, 'g8')).toBe('g8, Black knight');
  await page.getByRole('button', { name: 'Take back' }).click();
  await expect(page.locator('#moveNow')).toHaveText('Your line: 3… g6');
  // Taking back the first move tried goes back to the game.
  await page.locator('#prevBtn').click();
  await expect(alt(page)).toBeHidden();
  await expect(page.locator('#moveNow')).toHaveText('3. Qh5: Good move. Best was a3.');
  await expect(status(page)).toHaveText('Reviewing');
  expect(await pieceOn(page, 'g7')).toBe('g7, Black pawn');

  // Playing the game's own move just steps on to it.
  await move(page, 'g8', 'f6');
  await expect(alt(page)).toBeHidden();
  await expect(page.locator('#moveNow')).toHaveText('3… Nf6: Blunder. Best was a5.');
  await expect(page.locator('.mv.on .san')).toHaveText('Nf6');

  // Back to the game, and stepping to another move, leave a line tried.
  await move(page, 'c4', 'f7');
  await expect(page.locator('#altVerdict')).toHaveText('Bxf7+ is worse than the game’s Qxf7#: White’s chances go down from 98% to 59%.');
  await page.getByRole('button', { name: 'Back to the game' }).click();
  await expect(alt(page)).toBeHidden();
  await expect(page.locator('#moveNow')).toHaveText('3… Nf6: Blunder. Best was a5.');
  expect(await pieceOn(page, 'f7')).toBe('f7, Black pawn');
  await move(page, 'c4', 'f7');
  await page.evaluate(() => document.activeElement.blur());
  await press(page, 'Escape');
  await expect(alt(page)).toBeHidden();
  await move(page, 'c4', 'f7');
  await page.locator('#nextBtn').click();
  await expect(alt(page)).toBeHidden();
  await expect(page.locator('#moveNow')).toHaveText('4. Qxf7#: Best move.');
  // The game's over there, so there's nothing to try.
  await expect(page.locator('#altTip')).toBeHidden();
  await sq(page, 'e8').click();
  await expect(page.locator('#board .sel')).toHaveCount(0);
});

test('Stockfish plays on from a move tried, to show how the game would have gone', async ({ page }) => {
  // Its moves when playing on: White mates, as in the game, but later.
  await fakeEngine(page, ['h5f3', 'a7a6', 'f3f7']);
  await listen(page);
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('scholars.pgn', SCHOLARS));
  await reviewed(page);
  await page.locator('.mv').nth(4).click();                // 3. Qh5
  await move(page, 'g7', 'g6');
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: White won.');
  await commands(page);
  await heard(page);

  await page.getByRole('button', { name: 'Stockfish plays on' }).click();
  await expect(page.locator('#altNow')).toHaveText('After 3 more moves by Stockfish: Checkmate — White wins. In the game: White won.');
  await expect(page.locator('#moveNow')).toHaveText('Your line: 3… g6 4. Qf3 a6 5. Qxf7#');
  await expect(status(page)).toHaveText('Checkmate — White wins');
  await expect(page.locator('#playOnBtn')).toBeDisabled();
  expect(await pieceOn(page, 'f7')).toBe('f7, White queen');
  expect((await commands(page)).filter((c) => /^go /.test(c))).toEqual(['go depth 12', 'go depth 12', 'go depth 12']);
  expect(await heard(page)).toEqual(['move', 'move', 'check']);
  // The board can't be moved on once it's over, but the line can be taken back.
  await sq(page, 'e8').click();
  await expect(page.locator('#board .sel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Take back' }).click();
  await expect(page.locator('#playOnBtn')).toBeEnabled();
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: White won.');

  // Stop halts it while Stockfish is thinking, and the moves don't come.
  await page.evaluate(() => { window.hold = true; window.replies = ['f3f7']; });
  await page.getByRole('button', { name: 'Stockfish plays on' }).click();
  await expect(page.locator('#playOnBtn')).toHaveText('Stop');
  await expect(status(page)).toHaveText('Stockfish is playing on…');
  await expect(page.locator('#altNow')).toHaveText('Now: Stockfish is playing on… In the game: White won.');
  await sq(page, 'f3').click();                              // no moving while it plays
  await expect(page.locator('#board .sel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('#playOnBtn')).toHaveText('Stockfish plays on');
  await page.evaluate(() => { window.hold = false; window.release(); });
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: White won.');
  expect(await pieceOn(page, 'f7')).toBe('f7, Black pawn');
  await expect(status(page)).toHaveText('Trying a move');
});

test('a move tried while the review is still being worked out waits for the engine to stop', async ({ page }) => {
  await fakeEngine(page);
  await page.addInitScript(() => { window.hold = true; });
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('scholars.pgn', SCHOLARS));
  await expect(page.locator('#reviewProgress')).toHaveText('Analysing… 0 of 8 positions');
  await page.locator('#replayBtn').click();
  await move(page, 'd2', 'd4');
  await move(page, 'd7', 'd5');                              // and again, straight away
  await expect(page.locator('#altMine')).toHaveText('1. d4 · analysing…');
  await page.evaluate(() => { window.hold = false; window.release(); });
  await expect(page.locator('#altMine')).toHaveText('1. d4 · Good move · 0.00 · White’s chances 50%');
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: White won.');
  await page.getByRole('button', { name: 'Back to the game' }).click();
  await reviewed(page);
  // The one engine never crashed: each search started only once the one
  // stopped before it had answered.
  expect(await page.evaluate(() => window.engines)).toBe(1);
  const sent = (await commands(page)).filter((c) => /^(go|stop)/.test(c));
  sent.forEach((c, i) => { if (c === 'stop') expect(sent[i - 1]).toMatch(/^go /); });
});

test('Stockfish plays on for 60 moves at most, and the line is shortened', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('scholars.pgn', SCHOLARS));
  await reviewed(page);
  await page.locator('.mv').nth(4).click();
  await move(page, 'g7', 'g6');
  // Its moves: 70 that never repeat a position or end the game.
  await page.evaluate(() => {
    const C = window.bdnixChess, g = C.parsePgn('1. e4 e5 2. Bc4 Nc6 3. Qh5 g6').game, seen = new Set([C.key(C.current(g))]);
    window.replies = [];
    while (window.replies.length < 70) {
      const u = C.moves(C.current(g)).map(C.uci).sort().find((m) => {
        const h = { positions: g.positions.slice(), moves: g.moves.slice() };
        C.play(h, m);
        return !seen.has(C.key(C.current(h))) && !C.status(h).over;
      });
      C.play(g, u);
      seen.add(C.key(C.current(g)));
      window.replies.push(u);
    }
  });
  await page.getByRole('button', { name: 'Stockfish plays on' }).click();
  await expect(page.locator('#altNow')).toHaveText(/^After 60 more moves by Stockfish: [^…]+\. In the game: White won\.$/);
  await expect(status(page)).toHaveText('Trying a move');
  await expect(page.locator('#moveNow')).toHaveText('Your line: 3… g6 4. a3 … 32… Bb2 33. Bb1 Ba1');
  // It carries on from there when asked again.
  await commands(page);
  await page.getByRole('button', { name: 'Stockfish plays on' }).click();
  await expect(page.locator('#altNow')).toHaveText(/^After \d+ more moves? by Stockfish: /);
  expect((await commands(page)).filter((c) => c === 'go depth 12').length).toBeGreaterThan(0);
});

test('moves tried from where an unfinished game stopped, and from a game just played', async ({ page }) => {
  await fakeEngine(page, ['e7e5', 'd8h4']);
  await openGame(page, '/chess/');
  await page.locator('#pgnFile').setInputFiles(file('moves.txt', 'e4 e5 Nf3 Nc6'));
  await reviewed(page);
  await press(page, 'End');
  await move(page, 'f1', 'b5');
  await expect(page.locator('#altGame')).toHaveText('The game stopped here.');
  await expect(page.locator('#altMine')).toHaveText('3. Bb5 · Good move · 0.00 · White’s chances 50%');
  await expect(page.locator('#altVerdict')).toBeHidden();
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal.');
  // Replaying leaves the line.
  await page.locator('#replayBtn').click();
  await expect(alt(page)).toBeHidden();
  await expect(page.locator('#moveNow')).toHaveText('The starting position.');

  // A game just lost: Black's mate, against something else.
  await page.locator('#againBtn').click();
  await start(page);
  await move(page, 'f2', 'f3');
  await move(page, 'g2', 'g4');
  await expect(page.locator('#moveNow')).toHaveText(/^2… Qh4#/);
  await page.locator('#prevBtn').click();
  await move(page, 'd8', 'e7');
  await expect(page.locator('#altVerdict')).toHaveText('Qe7 is worse than the game’s Qh4#: Black’s chances go down from 98% to 50%.');
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: Checkmate — Black wins.');
});

test('the slips are listed with the better move, which can be played instead', async ({ page }) => {
  await fakeEngine(page, ['e7e5', 'd8h4']);
  await openGame(page, '/chess/');
  // In a game the visitor lost, their own slips.
  await start(page);
  await move(page, 'f2', 'f3');
  await move(page, 'g2', 'g4');
  await reviewed(page);
  await expect(page.locator('#momentsNote')).toBeHidden();
  await expect(page.locator('#momentsTitle')).toHaveText('Where you could have done better');
  await expect(page.locator('.moment')).toHaveText(['2. g4?? Blunder. 2. a3 was better: White’s chances fell from 50% to 2%.']);
  await expect(page.locator('.moment')).toHaveClass(/blunder/);
  // Choosing it plays the better move instead, against the game's.
  await page.locator('.moment').click();
  await expect(page.locator('#moveNow')).toHaveText('Your line: 2. a3');
  await expect(page.locator('.mv.on .san')).toHaveText('e5');
  expect(await pieceOn(page, 'a3')).toBe('a3, White pawn');
  await expect(page.locator('#altVerdict')).toHaveText('a3 is better than the game’s g4: White’s chances go up from 2% to 50%.');
  await expect(page.locator('#altNow')).toHaveText('Now: 0.00 · Equal. In the game: Checkmate — Black wins.');
  await expectNoSideScroll(page);

  // In a game opened, both sides' slips; and a game with none says so.
  await page.evaluate(() => { window.hold = true; });
  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await expect(page.locator('#momentsNote')).toHaveText('Looking for slips…');
  await expect(page.locator('.moment')).toHaveCount(0);
  await page.evaluate(() => { window.hold = false; window.release(); });
  await reviewed(page);
  await expect(page.locator('#momentsTitle')).toHaveText('Where it could have gone better');
  await expect(page.locator('.moment')).toHaveText(['2. g4?? Blunder. 2. a3 was better: White’s chances fell from 50% to 2%.']);
  await page.locator('#pgnFile').setInputFiles(file('moves.txt', 'e4 e5 Nf3 Nc6'));
  await reviewed(page);
  await expect(page.locator('.moment')).toHaveCount(0);
  await expect(page.locator('#momentsNote')).toHaveText('None: every move kept the chances.');
});

test('a game can be pasted in, and a game file of any kind picked', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  // Phones won't pick a .pgn file if the picker only asks for known types.
  await expect(page.locator('#pgnFile')).not.toHaveAttribute('accept');
  await page.locator('#pgnFile').setInputFiles({ name: 'game.pgn', mimeType: 'application/octet-stream', buffer: Buffer.from(FOOLS) });
  await expect(page.locator('#reviewTitle')).toHaveText('Ann vs Bob');
  await page.locator('#againBtn').click();

  const paste = page.getByRole('dialog', { name: 'Paste a game' });
  await page.getByRole('button', { name: 'Paste a game' }).click();
  await expect(paste).toBeVisible();
  await expect(page.locator('#pgnText')).toBeFocused();
  await expectNoSideScroll(page);
  // Nothing pasted, or not a game: it says why and stays open.
  await paste.getByRole('button', { name: 'Analyse' }).click();
  await expect(page.locator('#pasteMsg')).toHaveText('Paste a game first.');
  await page.locator('#pgnText').fill('e4 e5 Nf6');
  await paste.getByRole('button', { name: 'Analyse' }).click();
  await expect(page.locator('#pasteMsg')).toHaveText('Couldn’t read a game from that. Move 2. Nf6 isn’t a legal move there.');
  // Keys typed into it stay there: P doesn't pause, Space doesn't start.
  await page.locator('#pgnText').fill('');
  await page.locator('#pgnText').pressSequentially('1. e4 e5 2. Nf3 Nc6 P');
  await expect(page.locator('#ovTitle')).toHaveText('Chess');
  await page.locator('#pgnText').fill('1. e4 e5 2. Nf3 Nc6');
  await paste.getByRole('button', { name: 'Analyse' }).click();
  await expect(paste).toBeHidden();
  await expect(page.locator('#reviewKicker')).toHaveText('Pasted game');
  await expect(page.locator('#reviewTitle')).toHaveText('White vs Black');
  await expect(page.locator('.mv')).toHaveText(['e4', 'e5', 'Nf3', 'Nc6']);
  await reviewed(page);
  await press(page, 'End');

  // From the review too; Escape, Cancel and a click outside close it, and
  // the arrow keys move the cursor in it, not the review.
  await page.locator('#pasteAgainBtn').click();
  await expect(page.locator('#pgnText')).toHaveValue('');
  await page.locator('#pgnText').fill('d4 d5');
  await press(page, 'ArrowLeft');
  await press(page, 'Home');
  await expect(page.locator('#moveNow')).toHaveText('2… Nc6: Good move. Best was a5.');
  await press(page, 'Escape');
  await expect(paste).toBeHidden();
  await expect(page.locator('#pasteAgainBtn')).toBeFocused();
  await page.locator('#pasteAgainBtn').click();
  await paste.getByRole('button', { name: 'Cancel' }).click();
  await expect(paste).toBeHidden();
  await page.locator('#pasteAgainBtn').click();
  await page.mouse.click(2, 2);
  await expect(paste).toBeHidden();
  await expect(page.locator('#reviewKicker')).toHaveText('Pasted game');
  await expect(page.locator('.mv')).toHaveCount(4);
});

// A file of 151 games: 150 that can be read, and a last one that can't.
const DATABASE = Array.from({ length: 150 }, (_, i) =>
  `[Event "${i % 2 ? 'Rapid' : 'Blitz'} Open"]\n[Site "?"]\n[Date "2020.??.??"]\n[Round "${i % 9 + 1}"]\n[White "Player ${i}"]\n[Black "Rival"]\n[Result "${i % 3 ? '1-0' : '1/2-1/2'}"]\n\n1. e4 e5 2. Nf3 ${i % 3 ? '1-0' : '1/2-1/2'}\n`
).join('\n') + '\n[Event "Broken"]\n[White "?"]\n[Black "?"]\n\n1. e4 e5 2. Nf6 *\n';

test('a file of many games lists them to search and pick one from', async ({ page }) => {
  await fakeEngine(page);
  await openGame(page, '/chess/');
  const pick = page.getByRole('dialog', { name: 'Pick a game' });
  const games = page.locator('.pick-game');
  await page.locator('#importBtn').click();
  await page.locator('#pgnFile').setInputFiles(file('games.pgn', DATABASE));
  await expect(pick).toBeVisible();
  await expect(page.locator('#pickAbout')).toHaveText('151 games in games.pgn.');
  await expect(page.locator('#pickSearch')).toBeFocused();
  await expect(games).toHaveCount(100);
  await expect(page.locator('#pickCount')).toHaveText('Showing the first 100 of 151. Search to narrow them down.');
  await expect(games.first()).toHaveText('Player 0 – Rival · ½–½Blitz Open · 2020 · round 1');
  await expect(games.nth(1)).toHaveText('Player 1 – Rival · 1-0Rapid Open · 2020 · round 2');
  await expectNoSideScroll(page);

  // Every word searched for has to be there, in any tag.
  await page.locator('#pickSearch').fill('player 12');
  await expect(games).toHaveCount(12);
  await expect(page.locator('#pickCount')).toBeHidden();
  await page.locator('#pickSearch').fill('RAPID  player 12');
  await expect(games).toHaveCount(5);
  await page.locator('#pickSearch').fill('nobody');
  await expect(games).toHaveCount(0);
  await expect(page.locator('#pickCount')).toHaveText('No games match.');
  // A game with no names or event is shown by its number, and one that
  // can't be read says why, and the list stays.
  await page.locator('#pickSearch').fill('broken');
  await expect(games).toHaveText(['White – BlackBroken']);
  await games.click();
  await expect(page.locator('#pickMsg')).toHaveText('Couldn’t read game 151. Move 2. Nf6 isn’t a legal move there.');
  await expect(pick).toBeVisible();

  // Picking one reviews it.
  await page.locator('#pickSearch').fill('player 7 rival');
  await games.filter({ hasText: 'Player 7 –' }).click();
  await expect(pick).toBeHidden();
  await expect(page.locator('#reviewKicker')).toHaveText('games.pgn · game 8 of 151');
  await expect(page.locator('#reviewTitle')).toHaveText('Player 7 vs Rival');
  await expect(page.locator('#reviewText')).toHaveText('White won · Rapid Open · 3 moves');
  await expect(page.locator('.mv')).toHaveText(['e4', 'e5', 'Nf3']);
  await reviewed(page);

  // Another from the same file: the list as it was left.
  const again = page.getByRole('button', { name: 'Another game from the file' });
  await again.click();
  await expect(page.locator('#pickSearch')).toHaveValue('player 7 rival');
  await expect(page.locator('#pickMsg')).toHaveText('');
  await press(page, 'Escape');
  await expect(pick).toBeHidden();
  await expect(again).toBeFocused();
  await again.click();
  await pick.getByRole('button', { name: 'Cancel' }).click();
  await expect(pick).toBeHidden();
  await again.click();
  await page.mouse.click(2, 2);
  await expect(pick).toBeHidden();
  await again.click();
  await page.locator('#pickSearch').fill('');
  await games.first().click();
  await expect(page.locator('#reviewKicker')).toHaveText('games.pgn · game 1 of 151');
  await expect(page.locator('#reviewText')).toHaveText('Drawn · Blitz Open · 3 moves');

  // A file of one game opens straight away, and isn't one to pick from again.
  await page.locator('#pgnFile').setInputFiles(file('fools.pgn', FOOLS));
  await expect(page.locator('#reviewKicker')).toHaveText('fools.pgn');
  await expect(again).toBeHidden();
  await expect(pick).toBeHidden();

  // Several games pasted are listed the same way.
  await page.locator('#pasteAgainBtn').click();
  await page.locator('#pgnText').fill(FOOLS + '\n' + DATABASE);
  await page.getByRole('dialog', { name: 'Paste a game' }).getByRole('button', { name: 'Analyse' }).click();
  await expect(pick).toBeVisible();
  await expect(page.locator('#pickAbout')).toHaveText('152 games in the games pasted.');
  await page.locator('#pickSearch').fill('ann');
  await games.click();
  await expect(page.locator('#reviewKicker')).toHaveText('the games pasted · game 1 of 152');
  await expect(page.locator('#reviewTitle')).toHaveText('Ann vs Bob');
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
  // A file is only refused when it's far too big to be games (built in the
  // page, as Playwright won't send a file that size).
  await page.evaluate(() => {
    const input = document.querySelector('#pgnFile'), files = new DataTransfer();
    files.items.add(new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'big.pgn'));
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('#ovMsg')).toHaveText('big.pgn is too big to be a game file (over 50 MB).');
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
