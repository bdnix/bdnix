import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, plain } from '../../../tests/unit/load.mjs';

const w = load(['shared/chess-core/chess-core.js', 'apps/learn-chess/lessons.js', 'apps/learn-chess/learn-core.js']);
const C = w.bdnixChess, L = w.bdnixLearn, COURSES = w.bdnixCourses;
const here = path.dirname(fileURLToPath(import.meta.url));

// A line and a course to check, made up.
const line = (id, moves, end = 'What next.') => ({ id, name: id, moves, end });
const course = (lines, extra = {}) => ({ id: 'test', name: 'Test', side: 'w', level: 1, about: 'About.', intro: 'Intro.', lines, ...extra });

test('every course is right: legal moves, a note on each, levels in order, no line twice', () => {
  assert.deepEqual(plain(L.problems(COURSES)), []);
  assert.deepEqual(plain(COURSES.map((c) => c.id)), ['italian', 'london', 'scandinavian', 'queens-gambit-declined']);
  assert.deepEqual(plain(COURSES.map((c) => c.side)), ['w', 'w', 'b', 'b']);
  for (const c of COURSES) assert.ok(c.lines.length >= 3, c.id);
});

test('the lines play the openings they name', () => {
  const sans = (c, l) => COURSES.find((x) => x.id === c).lines.find((x) => x.id === l).moves.map((m) => m[0]).join(' ');
  // Each course's line reaches the position its opening is known by: what
  // chess-core.js names it (its table of well-known openings) after its moves.
  const named = (c, l) => {
    const g = C.newGame();
    L.steps(COURSES.find((x) => x.id === c).lines.find((x) => x.id === l)).forEach((s) => C.play(g, s.uci));
    return C.opening(g);
  };
  assert.equal(named('italian', 'giuoco-piano'), 'Italian Game, Giuoco Piano');
  assert.equal(named('italian', 'two-knights'), 'Two Knights Defence');
  assert.equal(named('london', 'against-d5'), 'London System');
  assert.equal(named('scandinavian', 'queen-a5'), 'Scandinavian Defence');
  assert.equal(named('queens-gambit-declined', 'bishop-g5'), 'Queen’s Gambit Declined');
  assert.equal(sans('queens-gambit-declined', 'elephant-trap'), 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8');
});

test('the trap a line warns of is as its note says: the queen hits the knight and g2, and grabbing more is checkmate', () => {
  const note = COURSES[0].lines.find((l) => l.id === 'knight-jump').moves.find((m) => m[0] === 'Nxd4')[1];
  assert.match(note, /queen moves to g5 and attacks your knight and your pawn on g2 at once, and if you keep grabbing, Black can checkmate you/);
  const g = C.newGame();
  const play = (list) => list.split(' ').forEach((san) => {
    const m = C.moves(C.current(g)).find((x) => C.san(C.current(g), x).replace(/[+#]$/, '') === san);
    assert.ok(m, san);
    C.play(g, C.uci(m));
  });
  play('e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5');
  const attacked = C.attacked;
  assert.ok(attacked(C.current(g).board, C.square('e5'), 'b'), 'the knight on e5 is attacked');
  assert.ok(attacked(C.current(g).board, C.square('g2'), 'b'), 'the pawn on g2 is attacked');
  play('Nxf7 Qxg2 Rf1 Qxe4 Be2 Nf3');
  assert.equal(C.status(g).result, 'checkmate');
});

test('the words are for a beginner: no move is written in chess notation', () => {
  const NOTATION = /\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8]\b|\b\d+\.(\.\.)?\s?[a-hKQRBNO]|\.\.\.[a-hKQRBN]|\b[a-h][1-8]-[a-h][1-8]\b|O-O/;
  for (const c of COURSES) {
    for (const s of [c.about, c.intro]) assert.doesNotMatch(s, NOTATION, c.id);
    for (const l of c.lines) {
      for (const s of [l.name, l.end, ...l.moves.map((m) => m[1])]) assert.doesNotMatch(s, NOTATION, `${c.id}/${l.id}: ${s}`);
    }
  }
});

test('steps: each move of a line, with its squares, the piece that moves and the one it takes, side, number and note', () => {
  const s = L.steps(line('x', [['e4', 'a'], ['d5', 'b'], ['exd5', 'c'], ['Qxd5', 'd'], ['Nc3', 'e']]));
  assert.deepEqual(plain(s.map((x) => [x.uci, x.piece, x.take, x.captured, x.color, x.number, x.note])), [
    ['e2e4', 'p', false, '', 'w', 1, 'a'], ['d7d5', 'p', false, '', 'b', 1, 'b'], ['e4d5', 'p', true, 'p', 'w', 2, 'c'],
    ['d8d5', 'q', true, 'p', 'b', 2, 'd'], ['b1c3', 'n', false, '', 'w', 3, 'e']
  ]);
  assert.equal(s[0].from, C.square('e2'));
  assert.equal(s[0].to, C.square('e4'));
  // Castling either way, by its side.
  const castled = L.steps(COURSES[2].lines.find((l) => l.id === 'knight-f3'));
  assert.equal(castled[castled.length - 1].castle, 'q');
  assert.equal(L.steps(COURSES[0].lines[0])[10].castle, 'k');
});

test('steps: a move that isn’t legal, or isn’t written as chess-core writes it, is refused', () => {
  assert.throws(() => L.steps(line('x', [['e4', 'a'], ['e4', 'b']])), /x: move 2, e4, isn’t a legal move there/);
  // Check marks are part of the move as written.
  assert.throws(() => L.steps(line('x', [['e4', 'a'], ['f6', 'b'], ['d4', 'c'], ['g5', 'd'], ['Qh5', 'e']])), /move 5, Qh5/);
  assert.equal(L.steps(line('x', [['e4', 'a'], ['f6', 'b'], ['d4', 'c'], ['g5', 'd'], ['Qh5#', 'e']]))[4].san, 'Qh5#');
});

test('prompt: which piece moves from where to where, what it takes, and where a castling rook goes', () => {
  const s = L.steps(COURSES[0].lines[0]);
  assert.deepEqual(plain(L.prompt(s[0])), { kind: 'move', piece: 'p', from: 'e2', to: 'e4' });
  assert.deepEqual(plain(L.prompt(s[2])), { kind: 'move', piece: 'n', from: 'g1', to: 'f3' });
  assert.deepEqual(plain(L.prompt(s[10])), { kind: 'castle', piece: 'k', from: 'e1', to: 'g1', side: 'k', rookFrom: 'h1', rookTo: 'f1' });
  assert.deepEqual(plain(L.prompt(s[11])), { kind: 'castle', piece: 'k', from: 'e8', to: 'g8', side: 'k', rookFrom: 'h8', rookTo: 'f8' });
  const taking = L.steps(COURSES[2].lines[0]);
  assert.deepEqual(plain(L.prompt(taking[2])), { kind: 'take', piece: 'p', from: 'e4', to: 'd5', captured: 'p' });
  assert.deepEqual(plain(L.prompt(taking[3])), { kind: 'take', piece: 'q', from: 'd8', to: 'd5', captured: 'p' });
  const long = L.steps(COURSES[2].lines.find((l) => l.id === 'knight-f3'));
  assert.deepEqual(plain(L.prompt(long[long.length - 1])), { kind: 'castle', piece: 'k', from: 'e8', to: 'c8', side: 'q', rookFrom: 'a8', rookTo: 'd8' });
  const trap = L.steps(COURSES[3].lines.find((l) => l.id === 'elephant-trap'));
  assert.deepEqual(plain(L.prompt(trap[12])), { kind: 'take', piece: 'b', from: 'g5', to: 'd8', captured: 'q' });
});

test('progress: learned, then mastered with no mistakes, and never back', () => {
  const c = COURSES[0], [a, b, d] = c.lines, p = {};
  assert.equal(L.stateOf(p, c, a), 0);
  assert.deepEqual(plain(L.tally(p, c)), { learned: 0, mastered: 0, total: 3 });
  assert.equal(L.finish(p, c, a, false, 0), L.LEARNED);           // walked through
  assert.equal(L.finish(p, c, a, true, 2), L.LEARNED);            // practised, with mistakes
  assert.equal(L.finish(p, c, a, true, 0), L.MASTERED);           // practised, none
  assert.equal(L.finish(p, c, a, false, 0), L.MASTERED);          // learned again: still mastered
  assert.equal(L.finish(p, c, a, true, 1), L.MASTERED);
  assert.equal(L.finish(p, c, b, true, 0), L.MASTERED);           // practised straight away
  assert.deepEqual(plain(p), { 'italian/giuoco-piano': 2, 'italian/two-knights': 2 });
  assert.deepEqual(plain(L.tally(p, c)), { learned: 2, mastered: 2, total: 3 });
  L.finish(p, c, d, false, 0);
  assert.deepEqual(plain(L.tally(p, c)), { learned: 3, mastered: 2, total: 3 });
  assert.equal(L.key(c, d), 'italian/knight-jump');
});

test('progress read back: only lines that exist, at a state that makes sense', () => {
  assert.deepEqual(plain(L.readProgress(JSON.stringify({ 'italian/giuoco-piano': 2, 'london/queen-b6': 1 }), COURSES)),
    { 'italian/giuoco-piano': 2, 'london/queen-b6': 1 });
  assert.deepEqual(plain(L.readProgress(JSON.stringify({ 'italian/giuoco-piano': 3, 'italian/nope': 1, 'london/queen-b6': '1', x: 2 }), COURSES)), {});
  for (const raw of [null, '', 'not json', '[1,2]', '42', 'null']) assert.deepEqual(plain(L.readProgress(raw, COURSES)), {}, String(raw));
});

test('next line: the next one not mastered, going round, or none', () => {
  const c = COURSES[0], p = {};
  assert.equal(L.nextLine(p, c, 0), 1);
  assert.equal(L.nextLine(p, c, 2), 0);
  p['italian/two-knights'] = 2;
  assert.equal(L.nextLine(p, c, 0), 2);
  p['italian/knight-jump'] = 1;
  assert.equal(L.nextLine(p, c, 0), 2);
  p['italian/knight-jump'] = 2;
  assert.equal(L.nextLine(p, c, 0), null);
  assert.equal(L.nextLine(p, c, 1), 0);
});

test('problems: what’s wrong with a course is found, one line each', () => {
  const ok = line('ok', [['e4', 'a']]);
  assert.deepEqual(plain(L.problems([course([ok])])), []);
  const found = (courses) => plain(L.problems(courses));
  assert.deepEqual(found([course([ok], { id: 'Bad id', side: 'x', level: 2, about: '' })]), [
    'Bad id: its id is lower-case words joined by hyphens', 'Bad id: its side is w or b', 'Bad id: its level is 1, its place in the list', 'Bad id: it has no about',
    'Bad id/ok: it ends on a move of the learner’s'
  ]);
  assert.deepEqual(found([course([ok]), course([ok], { level: 2 })]), ['test: another course has this id']);
  assert.deepEqual(found([course([])]), ['test: it has no lines']);
  assert.deepEqual(found([course([line('a', [['e4', '']], ''), line('a', [['e4', 'b']])])]), [
    'test/a: it has no end', 'test/a: move 1, e4, has no note', 'test/a: another line of the course has this id', 'test/a: it’s the same as a'
  ]);
  assert.deepEqual(found([course([line('a', [['e4', 'a'], ['e5', 'b']])])]), ['test/a: it ends on a move of the learner’s']);
  assert.deepEqual(found([course([line('a', [['e5', 'a']]), { id: 'B', moves: [['e4', 'a']] }])]), [
    'test/a: a: move 1, e5, isn’t a legal move there', 'test/B: its id is lower-case words joined by hyphens', 'test/B: it has no name', 'test/B: it has no end'
  ]);
});

test('every word of every course is translated, in every language the page has', () => {
  const words = new Set();
  for (const c of COURSES) {
    [c.about, c.intro].forEach((s) => words.add(s));
    for (const l of c.lines) {
      words.add(l.name);
      words.add(l.end);
      l.moves.forEach((m) => words.add(m[1]));
    }
  }
  const langs = fs.readdirSync(path.join(here, '../lang')).filter((f) => f.endsWith('.json'));
  assert.ok(langs.length > 0);
  for (const f of langs) {
    const pack = JSON.parse(fs.readFileSync(path.join(here, '../lang', f), 'utf8'));
    assert.deepEqual([...words].filter((s) => typeof pack[s] !== 'string' || !pack[s].trim()), [], f);
  }
});
