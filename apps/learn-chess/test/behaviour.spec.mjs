import { test, expect, expectNoSideScroll } from '../../../tests/ui/fixtures.mjs';
import { axeProblems } from '../../../tests/ui/checks.mjs';
import { REPLY, STORE, open, sq, move, stepsOf, playMoves, startLine, fakeEngine, commands } from './learn.mjs';

// Learn Chess in use: the courses, learning and practising their lines, the
// progress kept, and playing on against a stand-in for Stockfish
// (fakeEngine). The clock is held still, so the other side moves only when
// a test lets REPLY ms pass.
const notes = (page) => page.locator('#notes li');
const prompt = (page) => page.locator('#prompt');
const msg = (page) => page.locator('#lessonMsg');
const label = (page, name) => sq(page, name).getAttribute('aria-label');
const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), STORE);
const arrowShown = (page) => page.locator('#arrows polygon').count();

test('lists the courses, easiest first, each with how far you are', async ({ page }) => {
  await open(page);
  const courses = page.locator('.course');
  await expect(courses.locator('.course-name')).toHaveText(['Italian Game', 'London System', 'Scandinavian Defence', 'Queen’s Gambit Declined']);
  await expect(courses.locator('.course-meta')).toHaveText(['Level 1 · as White', 'Level 2 · as White', 'Level 3 · as Black', 'Level 4 · as Black']);
  await expect(courses.locator('.course-progress')).toHaveText(Array(4).fill('0 of 3 lines learned · 0 mastered'));
  await expect(courses.getByRole('button')).toHaveText(['Start', 'Start', 'Start', 'Start']);
  await expect(page.locator('#study')).toBeHidden();
  // The guide for someone new to chess, closed until it's asked for.
  const guide = page.locator('.guide');
  await expect(guide.locator('ul')).toBeHidden();
  await guide.getByText('New to chess? Start here').click();
  await expect(guide.locator('li b')).toHaveText(['The board', 'White moves first', 'How the pieces move:', 'Taking:', 'An opening']);
  await expect(guide.locator('li').first()).toContainText('So e4 is the square in column e, row 4.');
  await expectNoSideScroll(page);
});

test('learns a line: an arrow shows each move, the other side replies, every move is explained, and the line is learned', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Start Italian Game' }).click();
  await expect(page.locator('#courseTitle')).toHaveText('Italian Game');
  await expect(page.locator('#courseTitle')).toBeFocused();
  await expect(page.locator('#courseSide')).toHaveText('Level 1 · you play White');
  await expect(page.locator('#about')).toBeHidden();
  await expect(page.locator('.line-name')).toHaveText(['The calm main line', 'When Black brings out both knights', 'Don’t fall for the trap']);
  await expect(page.locator('.line-state')).toHaveText(['New', 'New', 'New']);

  await page.getByRole('button', { name: 'Learn: The calm main line' }).click();
  await expect(page.locator('#lessonMode')).toHaveText('Learning');
  await expect(page.locator('#lessonTitle')).toHaveText('The calm main line');
  await expect(page.locator('#hintBtn')).toBeHidden();
  await expect(prompt(page)).toHaveText('Your move: move your pawn from e2 to e4.');
  await expect(page.locator('#how')).toHaveText('To move, tap a piece and then the square it goes to, or drag it. The yellow arrow shows the move.');
  expect(await arrowShown(page)).toBe(1);
  await expect(sq(page, 'e2')).toHaveClass(/\bhint\b/);
  await expect(sq(page, 'e4')).toHaveClass(/\bhint\b/);

  // Not the move: the piece stays, and the arrow still shows the way.
  await move(page, 'd2', 'd4');
  await expect(msg(page)).toHaveText('Not quite. Follow the yellow arrow: move your pawn from e2 to e4.');
  expect(await label(page, 'd2')).toBe('d2, White pawn');
  await expect(notes(page)).toHaveCount(0);
  // A black piece can't be picked up.
  await sq(page, 'e7').click();
  await expect(sq(page, 'e7')).not.toHaveClass(/\bsel\b/);

  // The move: it's played and explained, and Black replies after a moment.
  await sq(page, 'e2').click();
  expect(await label(page, 'e2')).toBe('e2, White pawn, picked up');
  expect(await label(page, 'e4')).toBe('e4, can move here');
  await sq(page, 'e4').click();
  await expect(msg(page)).toHaveText('');
  await expect(notes(page)).toHaveText(['Move 1 You moved your pawn from e2 to e4. Start by pushing the pawn in front of your king two squares. It grabs space in the middle of the board, and opens a path for your queen and one of your bishops.']);
  await expect(prompt(page)).toHaveText('Black is moving…');
  expect(await arrowShown(page)).toBe(0);
  await sq(page, 'd2').click();            // not your turn: nothing happens
  await expect(sq(page, 'd2')).not.toHaveClass(/\bsel\b/);
  await page.clock.runFor(REPLY);
  await expect(notes(page).first()).toHaveText('Move 1 Black moved their pawn from e7 to e5. Black does exactly the same, so both sides have a pawn in the middle.');
  await expect(sq(page, 'e5')).toHaveClass(/\blast\b/);
  await expect(prompt(page)).toHaveText('Your move: move your knight from g1 to f3.');

  // The rest of the line, up to castling, which is asked for as castling.
  const steps = await stepsOf(page, 'italian', 'giuoco-piano');
  await playMoves(page, steps, 'w', 2, 10);
  await expect(prompt(page)).toHaveText('Your move: castle. Move your king from e1 to g1, and the rook jumps over it, from h1 to f1.');
  await playMoves(page, steps, 'w', 10, steps.length);
  await expect(notes(page)).toHaveCount(steps.length);
  await expect(notes(page).first()).toHaveText(/^Move 9 You moved your pawn from h2 to h3\. A small pawn move next to your king\./);
  // Castling, said in words: the learner's and Black's.
  await expect(notes(page).filter({ hasText: 'You castled' })).toHaveText(/^Move 6 You castled: your king went to g1 and your rook to f1\. Castle! In this special move/);
  await expect(notes(page).filter({ hasText: 'Black castled' })).toHaveText(/^Move 6 Black castled: their king went to g8 and their rook to f8\. Black castles too/);

  // Learned: what next, and the progress kept.
  await expect(page.locator('#doneView')).toBeVisible();
  await expect(page.locator('#doneTitle')).toHaveText('Line learned');
  await expect(page.locator('#doneTitle')).toBeFocused();
  await expect(page.locator('#doneText')).toHaveText('Now practise it from memory. Play it with no mistakes and it’s mastered.');
  await expect(page.locator('#endText')).toHaveText(/^Well done: your king is safe and your pieces are out\. What to do next:/);
  await expect(page.locator('#nextBtn')).toBeVisible();
  expect(await saved(page)).toEqual({ 'italian/giuoco-piano': 1 });

  await page.locator('#doneLinesBtn').click();
  await expect(page.locator('.line-state')).toHaveText(['Learned', 'New', 'New']);
  await page.locator('#allBtn').click();
  await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('.course-progress').first()).toHaveText('1 of 3 lines learned · 0 mastered');
  await expect(page.locator('.course').first().getByRole('button')).toHaveText('Carry on');
  await expect(page.getByRole('button', { name: 'Carry on with Italian Game' })).toBeVisible();
  await expectNoSideScroll(page);
});

test('practises a line from memory: mistakes count, a second wrong move or a hint shows the move, and no mistakes masters it', async ({ page }) => {
  await open(page);
  await startLine(page, 'Start Italian Game', 'Practise: Don’t fall for the trap');
  await expect(page.locator('#lessonMode')).toHaveText('Practising');
  await expect(prompt(page)).toHaveText('Your move. Which move comes next in this line?');
  await expect(page.locator('#how')).toHaveText('To move, tap a piece and then the square it goes to, or drag it.');
  expect(await arrowShown(page)).toBe(0);
  await expect(page.locator('#hintBtn')).toBeVisible();

  // A wrong move, then another: the second shows the move.
  await move(page, 'd2', 'd4');
  await expect(msg(page)).toHaveText('That’s not the move in this line. Have another go.');
  expect(await arrowShown(page)).toBe(0);
  await move(page, 'c2', 'c4');
  await expect(msg(page)).toHaveText('Not that one either. Here’s the move: move your pawn from e2 to e4.');
  expect(await arrowShown(page)).toBe(1);
  await move(page, 'e2', 'e4');
  await expect(msg(page)).toHaveText('');
  await page.clock.runFor(REPLY);

  // Right first time.
  await move(page, 'g1', 'f3');
  await expect(msg(page)).toHaveText('Right, well done!');
  await page.clock.runFor(REPLY);

  // A hint, asked for once: it counts once.
  await page.locator('#hintBtn').click();
  await expect(msg(page)).toHaveText('Here’s the move: move your bishop from f1 to c4.');
  expect(await arrowShown(page)).toBe(1);
  await page.locator('#hintBtn').click();
  const steps = await stepsOf(page, 'italian', 'knight-jump');
  await playMoves(page, steps, 'w', 4, steps.length);

  await expect(page.locator('#doneTitle')).toHaveText('Practised, with 3 mistakes');
  await expect(page.locator('#doneText')).toHaveText('Practise it again with no mistakes to master it.');
  expect(await saved(page)).toEqual({ 'italian/knight-jump': 1 });

  // Again, with no mistakes: mastered.
  await page.locator('#practiseBtn').click();
  await expect(notes(page)).toHaveCount(0);
  await playMoves(page, steps, 'w');
  await expect(page.locator('#doneTitle')).toHaveText('Line mastered: no mistakes!');
  await expect(page.locator('#doneText')).toHaveText('You know this line. Try another, or play on against Stockfish.');
  expect(await saved(page)).toEqual({ 'italian/knight-jump': 2 });

  // A mistake now doesn't take mastery away.
  await page.locator('#practiseBtn').click();
  await move(page, 'a2', 'a3');
  await playMoves(page, steps, 'w');
  await expect(page.locator('#doneTitle')).toHaveText('Practised, with 1 mistake');
  await expect(page.locator('#doneText')).toHaveText('You’ve mastered this line before. Keep it fresh.');
  expect(await saved(page)).toEqual({ 'italian/knight-jump': 2 });

  // Next line: the first one after it not mastered, learned if it's new.
  await page.locator('#nextBtn').click();
  await expect(page.locator('#lessonTitle')).toHaveText('The calm main line');
  await expect(page.locator('#lessonMode')).toHaveText('Learning');
  await page.locator('#linesBtn').click();
  await expect(page.locator('.line-state')).toHaveText(['New', 'New', 'Mastered']);
});

test('next line is practice for a line already learned, and gone once every other line is mastered', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ 'london/against-d5': 1, 'london/queen-b6': 2 })), STORE);
  await open(page);
  await expect(page.locator('.course-progress').nth(1)).toHaveText('2 of 3 lines learned · 1 mastered');
  await startLine(page, 'Carry on with London System', 'Learn: When Black plays g6');
  const steps = await stepsOf(page, 'london', 'kings-indian');
  await playMoves(page, steps, 'w');
  await page.locator('#nextBtn').click();
  await expect(page.locator('#lessonTitle')).toHaveText('When Black copies your first move');
  await expect(page.locator('#lessonMode')).toHaveText('Practising');
  await playMoves(page, await stepsOf(page, 'london', 'against-d5'), 'w');
  await expect(page.locator('#nextBtn')).toBeVisible();   // the fianchetto line is learned, not mastered
  await page.locator('#doneLinesBtn').click();
  await page.getByRole('button', { name: 'Practise: When Black plays g6' }).click();
  await playMoves(page, steps, 'w');
  await expect(page.locator('#doneTitle')).toHaveText('Line mastered: no mistakes!');
  await expect(page.locator('#nextBtn')).toBeHidden();
});

test('as Black, the board is turned round and White moves first', async ({ page }) => {
  await open(page);
  await startLine(page, 'Start Scandinavian Defence', 'Learn: Main line: your queen goes to a5');
  await expect(page.locator('#courseSide')).toHaveText('Level 3 · you play Black');
  await expect(page.locator('#board .sq').first()).toHaveAttribute('data-sq', 'h1');
  await expect(page.locator('#board .sq').last()).toHaveAttribute('data-sq', 'a8');
  await expect(prompt(page)).toHaveText('White is moving…');
  await page.clock.runFor(REPLY);
  await expect(notes(page)).toHaveText(['Move 1 White moved their pawn from e2 to e4. White starts by pushing the pawn in front of their king two squares.']);
  await expect(prompt(page)).toHaveText('Your move: move your pawn from d7 to d5.');
  await move(page, 'd7', 'd5');
  await page.clock.runFor(REPLY);
  // Taking, said in words: White's, then the learner's.
  await expect(notes(page).first()).toHaveText('Move 2 White took your pawn on d5 with their pawn. White takes your pawn.');
  await expect(prompt(page)).toHaveText('Your move: take the pawn on d5 with your queen from d8.');
  await move(page, 'd8', 'd5');
  await expect(notes(page).first()).toHaveText(/^Move 2 You took the pawn on d5 with your queen\. Take back with your queen\./);
  const steps = await stepsOf(page, 'scandinavian', 'queen-a5');
  await playMoves(page, steps, 'b', 4, steps.length);
  await expect(page.locator('#doneTitle')).toHaveText('Line learned');
  await expect(page.locator('#endText')).toHaveText(/^Next, bring out your other bishop \(to b4 or e7\)/);
});

test('the other side’s move waits for no one who has left: starting again, or going back to the lines', async ({ page }) => {
  await open(page);
  await startLine(page, 'Start Italian Game', 'Learn: When Black brings out both knights');
  await move(page, 'e2', 'e4');
  await page.locator('#restartBtn').click();
  await page.clock.runFor(REPLY);
  await expect(notes(page)).toHaveCount(0);
  await expect(prompt(page)).toHaveText('Your move: move your pawn from e2 to e4.');
  expect(await label(page, 'e7')).toBe('e7, Black pawn');
  await move(page, 'e2', 'e4');
  await page.locator('#linesBtn').click();
  await page.clock.runFor(REPLY);
  await expect(page.locator('#linesView')).toBeVisible();
  expect(await label(page, 'e2')).toBe('e2, White pawn');   // the board is back at the start
  expect(await saved(page)).toBeNull();
});

test('progress is kept between visits, and a save that makes no sense is ignored', async ({ page }) => {
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('again')) {
      sessionStorage.setItem('again', '1');
      localStorage.setItem(k, JSON.stringify({ 'scandinavian/push-e5': 2, 'scandinavian/nope': 1, 'italian/two-knights': 7 }));
    }
  }, STORE);
  await open(page);
  await expect(page.locator('.course-progress')).toHaveText([
    '0 of 3 lines learned · 0 mastered', '0 of 3 lines learned · 0 mastered', '1 of 3 lines learned · 1 mastered', '0 of 3 lines learned · 0 mastered'
  ]);
  await page.evaluate((k) => localStorage.setItem(k, '{broken'), STORE);
  await page.reload();
  await expect(page.locator('.course-progress').nth(2)).toHaveText('0 of 3 lines learned · 0 mastered');
});

test('a piece can be dragged to its square, and the keys move round the board', async ({ page }) => {
  await open(page);
  await startLine(page, 'Start Italian Game', 'Learn: The calm main line');
  const from = await sq(page, 'e2').boundingBox(), to = await sq(page, 'e4').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(notes(page)).toHaveCount(1);
  await page.clock.runFor(REPLY);
  // A drag that ends off the board puts the piece back.
  const n = await sq(page, 'g1').boundingBox();
  await page.mouse.move(n.x + n.width / 2, n.y + n.height / 2);
  await page.mouse.down();
  await page.mouse.move(n.x + n.width / 2, n.y - n.height * 9, { steps: 5 });
  await page.mouse.up();
  expect(await label(page, 'g1')).toBe('g1, White knight');

  // From a1, the only square in the tab order: → to g1, Enter, ↑↑ to g3,
  // ← to f3, Enter.
  await sq(page, 'a1').focus();
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'Enter']) await page.keyboard.press(key);
  await expect(notes(page)).toHaveCount(3);
  await expect(notes(page).first()).toHaveText(/^Move 2 You moved your knight from g1 to f3\. /);
  await expect(sq(page, 'f3')).toHaveAttribute('tabindex', '0');
  // The keys stop at the edge of the board.
  await sq(page, 'h1').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(sq(page, 'h1')).toBeFocused();
});

test('plays on against Stockfish from the end of a line, at the level picked, and can win', async ({ page }) => {
  await fakeEngine(page, ['f3e5', 'e2c4']);
  await open(page);
  await startLine(page, 'Start Scandinavian Defence', 'Learn: When White brings out a knight first');
  await playMoves(page, await stepsOf(page, 'scandinavian', 'knight-f3'), 'b');
  expect(await page.evaluate(() => window.engines)).toBe(0);   // not started until it's needed

  await page.locator('#playBtn').click();
  await expect(page.locator('#playTitle')).toBeFocused();
  // White (Stockfish) moves first: 6.Ne5, at the easy level.
  await expect(page.locator('#playStatus')).toHaveText('Your move.');
  expect(await commands(page)).toEqual(['uci', 'ucinewgame', 'setoption name Skill Level value 2',
    'position startpos moves e2e4 d7d5 e4d5 d8d5 g1f3 c8g4 f1e2 b8c6 d2d4 e8c8', 'go depth 2']);
  expect(await label(page, 'e5')).toBe('e5, White knight');

  // A harder level counts from Stockfish's next move.
  await page.locator('.level-seg').getByText('Hard').click();
  await move(page, 'd5', 'd4');
  await expect(page.locator('#playStatus')).toHaveText('Your move.');
  expect((await commands(page)).slice(-2)).toEqual(['position startpos moves e2e4 d7d5 e4d5 d8d5 g1f3 c8g4 f1e2 b8c6 d2d4 e8c8 f3e5 d5d4', 'go depth 10']);
  expect(await commands(page)).toEqual([]);

  await move(page, 'd4', 'd1');
  await expect(page.locator('#playStatus')).toHaveText('Checkmate: you win!');
  await sq(page, 'a7').click();
  await expect(sq(page, 'a7')).not.toHaveClass(/\bsel\b/);   // the game is over
  expect(await commands(page)).toEqual([]);

  // Again from the line's end: a new engine, and the board as the line left it.
  await page.locator('#againBtn').click();
  expect(await label(page, 'd1')).toBe('d1, White queen');
  await page.locator('#playLinesBtn').click();
  await expect(page.locator('#linesView')).toBeVisible();
  expect(await page.evaluate(() => window.engines)).toBe(0);   // stopped on leaving
});

test('Stockfish can win too', async ({ page }) => {
  await fakeEngine(page, ['g5f6', 'd3h7']);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ 'queens-gambit-declined/exchange': 1 })), STORE);
  await open(page);
  await startLine(page, 'Carry on with Queen’s Gambit Declined', 'Practise: When White swaps pawns');
  await playMoves(page, await stepsOf(page, 'queens-gambit-declined', 'exchange'), 'b');
  await page.locator('#playBtn').click();
  await expect(page.locator('#playStatus')).toHaveText('Your move.');
  await move(page, 'g7', 'g5');
  await expect(page.locator('#playStatus')).toHaveText('Checkmate: Stockfish wins.');
});

test('check is said', async ({ page }) => {
  await fakeEngine(page, ['d3h7']);
  await open(page);
  await startLine(page, 'Start Queen’s Gambit Declined', 'Learn: When White swaps pawns');
  await playMoves(page, await stepsOf(page, 'queens-gambit-declined', 'exchange'), 'b');
  await page.locator('#playBtn').click();
  await expect(page.locator('#playStatus')).toHaveText('Check! Your move.');
  await expect(sq(page, 'g8')).toHaveClass(/\bcheck\b/);
});

test('if the engine can’t be loaded, it says so', async ({ page }) => {
  await fakeEngine(page, [], { fail: true });
  await open(page);
  await startLine(page, 'Start Queen’s Gambit Declined', 'Learn: The Elephant Trap');
  await playMoves(page, await stepsOf(page, 'queens-gambit-declined', 'elephant-trap'), 'b');
  await expect(page.locator('#endText')).toHaveText(/^You’ve won a whole piece\./);
  await page.locator('#playBtn').click();
  await expect(page.locator('#playStatus')).toHaveText('Couldn’t load the chess engine. Check your connection and try again.');
});

test('no accessibility problems while learning, done, or playing on', async ({ page }) => {
  // Not open(): axe needs a running clock.
  await fakeEngine(page);
  await page.goto('/learn-chess/');
  await startLine(page, 'Start London System', 'Learn: When Black’s queen attacks b2');
  await move(page, 'd2', 'd4');
  await sq(page, 'd4').click();
  expect(await axeProblems(page)).toEqual([]);
  await playMoves(page, await stepsOf(page, 'london', 'queen-b6'), 'w', 1, undefined, { running: true });
  expect(await axeProblems(page)).toEqual([]);
  await page.locator('#playBtn').click();
  await expect(page.locator('#playStatus')).toHaveText('Your move.');
  expect(await axeProblems(page)).toEqual([]);
  await expectNoSideScroll(page);
});
