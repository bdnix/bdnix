import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const C = load('assets/js/chess-core.js').bdnixChess;

// Plays UCI moves from the start (or a game passed in); fails on an illegal one.
function playAll(list, game = C.newGame()){
  for (const m of list.split(' ').filter(Boolean)) assert.ok(C.play(game, m), 'illegal: ' + m);
  return game;
}
// A game starting from a FEN position.
const from = (fen) => ({ positions: [C.parseFen(fen)], moves: [] });
const sans = (game) => plain(game.moves.map((m) => m.san));

test('perft: the number of positions after each depth matches the known counts', () => {
  const cases = [
    [C.START, [20, 400, 8902]],
    // "Kiwipete": castling, en passant, promotions and pins all at once.
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486]],
    ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079]]
  ];
  for (const [fen, counts] of cases) {
    const pos = C.parseFen(fen);
    counts.forEach((n, i) => assert.equal(C.perft(pos, i + 1), n, fen + ' depth ' + (i + 1)));
  }
  assert.equal(C.perft(C.parseFen(C.START), 0), 1);
});

test('FEN: read and written back unchanged', () => {
  for (const fen of [C.START, 'r3k2r/8/8/8/4Pp2/8/8/R3K2R b KQkq e3 0 23', '8/8/8/8/8/8/k7/7K w - - 12 80']) {
    assert.equal(C.toFen(C.parseFen(fen)), fen);
  }
});

test('FEN: what isn\'t a playable position is refused', () => {
  for (const fen of [
    '', 'nonsense', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0',      // a field missing
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1',                              // seven rows
    'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',                     // nine squares in a row
    'rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',                      // seven squares
    'rnbqkbnr/ppppxppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',                     // not a piece
    'rnbqqbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',                     // no black king
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKKBNR w KQkq - 0 1',                     // two white kings
    'pnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',                     // a pawn on the last row
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNP w KQkq - 0 1',                     // ... or the first
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1',                     // no such side
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KX - 0 1',                       // bad castling
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w  - 0 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq z9 0 1',                    // bad en passant
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1',                    // en passant on the wrong row
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0'
  ]) assert.equal(C.parseFen(fen), null, fen);
});

test('FEN: castling rights without the king and rook at home are dropped', () => {
  assert.equal(C.parseFen('r3k3/8/8/8/8/8/8/4K2R w KQkq - 0 1').castle, 'Kq');
});

test('squares: names and numbers', () => {
  assert.equal(C.name(0), 'a8');
  assert.equal(C.name(63), 'h1');
  assert.equal(C.square('e2'), 52);
  assert.equal(C.square('i9'), -1);
  assert.equal(C.other('w'), 'b');
  assert.equal(C.colorOf('Q'), 'w');
  assert.equal(C.colorOf('q'), 'b');
});

test('move names: pieces, captures, castling, promotion, check and mate', () => {
  const g = playAll('e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6 e1g1');
  assert.deepEqual(sans(g), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'O-O']);

  const mate = playAll('f2f3 e7e5 g2g4 d8h4');
  assert.deepEqual(sans(mate), ['f3', 'e5', 'g4', 'Qh4#']);

  const promo = from('8/1P4k1/8/8/8/8/6K1/8 w - - 0 1');
  assert.equal(C.play(promo, 'b7b8q').san, 'b8=Q');
  const check = from('7k/1P6/8/8/8/8/6K1/8 w - - 0 1');
  assert.equal(C.play(check, 'b7b8q').san, 'b8=Q+');
  const long = from('r3k3/8/8/8/8/8/8/4K3 b q - 0 1');
  assert.equal(C.play(long, 'e8c8').san, 'O-O-O');
});

test('move names: say which of two pieces moves', () => {
  // Knights on b1 and f1 can both reach d2: by file.
  assert.equal(C.play(from('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1'), 'b1d2').san, 'Nbd2');
  // Rooks on a1 and a5 can both reach a3: by rank.
  assert.equal(C.play(from('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1'), 'a1a3').san, 'R1a3');
  // Queens on a1, c1 and a3 can all reach b2: by both.
  assert.equal(C.play(from('4k3/8/8/8/8/Q7/8/Q1Q1K3 w - - 0 1'), 'a1b2').san, 'Qa1b2');
});

test('en passant: allowed just after the double step, not later', () => {
  const g = playAll('e2e4 a7a6 e4e5 d7d5');
  const m = C.play(g, 'e5d6');
  assert.equal(m.san, 'exd6');
  assert.equal(m.ep, true);
  assert.equal(C.current(g).board[C.square('d5')], '');
  const late = playAll('e2e4 a7a6 e4e5 d7d5 h2h3 h7h6');
  assert.equal(C.findMove(C.current(late), 'e5d6'), null);
});

test('castling: not out of, through or into check, nor after the king or rook has moved', () => {
  const free = C.parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const castles = (pos) => plain(C.moves(pos).filter((m) => m.castle).map((m) => m.castle).sort());
  assert.deepEqual(castles(free), ['K', 'Q']);
  assert.deepEqual(castles(C.parseFen('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1')), []);          // in check
  assert.deepEqual(castles(C.parseFen('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1')), ['Q']);        // through check
  assert.deepEqual(castles(C.parseFen('2r3k1/8/8/8/8/8/8/R3K2R w KQ - 0 1')), ['K']);       // into check
  assert.deepEqual(castles(C.parseFen('6k1/8/8/8/8/8/8/RN2K2R w KQ - 0 1')), ['K']);        // a piece between
  const g = from('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  C.play(g, 'h1h2');
  assert.equal(C.current(g).castle, 'Qkq');
  C.play(g, 'a8a1');                                    // takes the rook on a1
  assert.equal(C.current(g).castle, 'k');
  C.play(g, 'e1d2');
  assert.equal(C.current(g).castle, 'k');
  const castled = C.play(from('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1g1');
  assert.equal(castled.castle, 'K');
});

test('a pinned piece can\'t move, and a king in check must get out of it', () => {
  const pinned = C.parseFen('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1');
  assert.equal(C.moves(pinned).filter((m) => m.piece === 'N').length, 0);
  const check = C.parseFen('4k3/8/8/8/8/8/3q4/4K3 w - - 0 1');
  assert.ok(C.inCheck(check));
  assert.deepEqual(plain(C.moves(check).map(C.uci).sort()), ['e1d2', 'e1f1']);
});

test('the clocks: the half-move count resets on pawn moves and captures', () => {
  const g = playAll('g1f3 g8f6');
  assert.equal(C.current(g).half, 2);
  assert.equal(C.current(g).full, 2);
  C.play(g, 'e2e4');
  assert.equal(C.current(g).half, 0);
  assert.equal(C.current(g).ep, C.square('e3'));
});

test('status: checkmate, and who won', () => {
  const g = playAll('f2f3 e7e5 g2g4 d8h4');
  assert.deepEqual(plain(C.status(g)), { turn: 'w', check: true, over: true, result: 'checkmate', winner: 'b' });
  const scholar = playAll('e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f7');
  assert.equal(C.status(scholar).winner, 'w');
});

test('status: playing on, and check', () => {
  assert.deepEqual(plain(C.status(C.newGame())), { turn: 'w', check: false, over: false, result: null, winner: null });
  const g = playAll('e2e4 f7f6 d1h5');
  assert.deepEqual(plain(C.status(g)), { turn: 'b', check: true, over: false, result: null, winner: null });
});

test('status: stalemate', () => {
  const g = from('7k/8/6Q1/8/8/8/8/K7 w - - 0 1');
  C.play(g, 'g6f7');
  assert.equal(C.status(g).result, 'stalemate');
  assert.equal(C.status(g).winner, null);
});

test('status: threefold repetition', () => {
  const g = playAll('g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
  assert.equal(C.status(g).over, false);              // the start position has been seen twice
  C.play(g, 'f6g8');
  assert.equal(C.status(g).result, 'repetition');
});

test('repetition: an en passant square only counts when it can be used', () => {
  const g = playAll('e2e4');
  assert.match(C.key(C.current(g)), / b KQkq -$/);
  const ep = playAll('e2e4 a7a6 e4e5 d7d5');
  assert.match(C.key(C.current(ep)), / w KQkq d6$/);
});

test('status: the fifty-move rule', () => {
  const g = from('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
  assert.equal(C.status(g).over, false);
  C.play(g, 'a1a2');
  assert.equal(C.status(g).result, 'fifty');
  // A mate on the hundredth half-move still counts as a win.
  const mate = from('7k/R7/6K1/8/8/8/8/8 w - - 99 80');
  C.play(mate, 'a7a8');
  assert.equal(C.status(mate).result, 'checkmate');
});

test('status: not enough material to mate', () => {
  const draw = ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/8/8/8/4KN2 w - - 0 1', '4k3/8/8/8/8/8/8/4KB2 w - - 0 1',
    '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1'];                 // bishops on the same colour
  for (const fen of draw) assert.equal(C.status(from(fen)).result, 'material', fen);
  const play = ['4k3/8/8/8/8/8/8/4KR2 w - - 0 1', '4k3/8/8/8/8/8/8/3NKN2 w - - 0 1', '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
    '4kb2/8/8/8/8/8/8/3BK3 w - - 0 1'];                  // bishops on different colours
  for (const fen of play) assert.equal(C.status(from(fen)).over, false, fen);
});

test('material: what each side has taken, and who is ahead', () => {
  const g = playAll('e2e4 d7d5 e4d5 d8d5 b1c3 d5a2 a1a2');
  const m = C.material(g);
  assert.deepEqual(plain(m), { w: ['q', 'p'], b: ['p', 'p'], diff: 8 });
  assert.deepEqual(plain(C.material(C.newGame())), { w: [], b: [], diff: 0 });
  // A promotion counts for the piece the pawn became.
  const promo = from('8/1P4k1/8/8/8/8/6K1/8 w - - 0 1');
  C.play(promo, 'b7b8q');
  assert.equal(C.material(promo).diff, 9);
});

test('play and undo: illegal moves are refused, and moves are taken back in order', () => {
  const g = C.newGame();
  assert.equal(C.play(g, 'e2e5'), null);
  assert.equal(C.play(g, 'nonsense'), null);
  assert.equal(C.undo(g), null);
  C.play(g, 'e2e4');
  C.play(g, 'e7e5');
  assert.equal(C.undo(g).san, 'e5');
  assert.equal(g.moves.length, 1);
  assert.equal(C.toFen(C.current(g)), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  // A promotion has to say what the pawn becomes.
  const promo = from('8/1P4k1/8/8/8/8/6K1/8 w - - 0 1');
  assert.equal(C.play(promo, 'b7b8'), null);
  assert.equal(C.play(promo, 'b7b8n').san, 'b8=N');
});

test('make leaves the position it was given as it was', () => {
  const pos = C.parseFen(C.START);
  const before = C.toFen(pos);
  C.make(pos, C.findMove(pos, 'e2e4'));
  assert.equal(C.toFen(pos), before);
  assert.equal(C.attacked(pos.board, C.square('f3'), 'w'), true);
  assert.equal(C.attacked(pos.board, C.square('e4'), 'w'), false);
});

test('a game from a FEN: started there, and set up for the engine that way', () => {
  const g = C.newGame('7k/1P6/8/8/8/8/6K1/8 w - - 0 1');
  assert.equal(g.start, '7k/1P6/8/8/8/8/6K1/8 w - - 0 1');
  assert.equal(C.positionCommand(g), 'position fen 7k/1P6/8/8/8/8/6K1/8 w - - 0 1');
  C.play(g, 'b7b8q');
  assert.equal(C.positionCommand(g), 'position fen 7k/1P6/8/8/8/8/6K1/8 w - - 0 1 moves b7b8q');
  assert.equal(C.positionCommand(g, 0), 'position fen 7k/1P6/8/8/8/8/6K1/8 w - - 0 1');
  assert.equal(C.newGame(C.START).start, null);
  assert.equal(C.newGame('nonsense'), null);
  const usual = playAll('e2e4 e7e5');
  assert.equal(C.positionCommand(usual), 'position startpos moves e2e4 e7e5');
  assert.equal(C.positionCommand(usual, 1), 'position startpos moves e2e4');
  assert.equal(C.positionCommand(C.newGame()), 'position startpos');
});

const OPERA = `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl \\"the\\" Count"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 {This is a weak move
already.} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5
11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+! Nxb8 17. Rd8# 1-0

[Event "The next game, not read"]
[Result "*"]

1. d4 *
`;

test('PGN: tags, comments and the moves of the first game', () => {
  const r = C.parsePgn(OPERA);
  assert.equal(r.error, undefined);
  assert.equal(r.tags.White, 'Paul Morphy');
  assert.equal(r.tags.Black, 'Duke Karl "the" Count');
  assert.equal(r.tags.Event, 'Paris Opera');
  assert.equal(r.result, '1-0');
  assert.equal(r.game.moves.length, 33);
  assert.equal(r.game.moves[22].san, 'O-O-O');
  assert.equal(C.status(r.game).result, 'checkmate');
});

test('PGN: variations, NAGs, annotations, ; comments, escapes and Windows line ends are read past', () => {
  const r = C.parsePgn('﻿[White "A"]\r\n\r\n1. f3 $2 e5 (1... d5 2. e4 (2. g4 dxe4)) 2. g4?? ; the end\r\n% escaped line\r\n2... Qh4# 0-1\r\n');
  assert.deepEqual(plain(r.game.moves.map((m) => m.san)), ['f3', 'e5', 'g4', 'Qh4#']);
  assert.equal(r.result, '0-1');
  assert.equal(r.tags.White, 'A');
});

test('text files: just the moves, in SAN (loosely written) or UCI', () => {
  const sanText = C.parsePgn('e4 e5 Ngf3 Nc6 Bb5 a6 Bxc6 dxc6 0-0');
  assert.deepEqual(plain(sanText.game.moves.map((m) => m.san)), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'O-O']);
  assert.equal(sanText.result, '*');
  const uciText = C.parsePgn('e2e4\ne7e5\ng1f3');
  assert.equal(uciText.game.moves.length, 3);
  const promo = C.parsePgn('[FEN "7k/1P6/8/8/8/8/6K1/8 w - - 0 1"]\n[SetUp "1"]\n\n1. b8Q+ Kh7 2. Qb7+ ½-½');
  assert.deepEqual(plain(promo.game.moves.map((m) => m.san)), ['b8=Q+', 'Kh7', 'Qb7+']);
  assert.equal(promo.result, '1/2-1/2');
  assert.equal(C.parsePgn('1. e4 e5 2. Nf3 e.p.').error, 'Move 2... e.p. isn’t a legal move there.');
});

test('PGN: what can\'t be read says why', () => {
  assert.equal(C.parsePgn('').error, 'There are no moves in it.');
  assert.equal(C.parsePgn('[Event "x"]\n\n*').error, 'There are no moves in it.');
  assert.equal(C.parsePgn('1. e4 e5 2. Nf6').error, 'Move 2. Nf6 isn’t a legal move there.');
  assert.equal(C.parsePgn('1. e4 e5 2. Ke2 Ke7 3. Bh9').error, 'Move 3. Bh9 isn’t a legal move there.');
  assert.equal(C.parsePgn('[FEN "8/8/8 w - - 0 1"]\n1. e4').error, 'The starting position (FEN) isn’t one that can be played.');
  assert.equal(C.parsePgn('hello world').error, 'Move 1. hello isn’t a legal move there.');
  assert.equal(C.readMove(C.parseFen(C.START), '+'), null);
  // A FEN tag counts unless SetUp says not to.
  assert.equal(C.parsePgn('[SetUp "0"]\n[FEN "7k/1P6/8/8/8/8/6K1/8 w - - 0 1"]\n1. e4').game.start, null);
});

test('engine output: the score and best line of an info line', () => {
  assert.deepEqual(plain(C.parseInfo('info depth 16 seldepth 20 multipv 1 score cp -34 nodes 100 nps 1 pv e7e5 g1f3')), { depth: 16, best: 'e7e5', cp: -34 });
  assert.deepEqual(plain(C.parseInfo('info depth 5 score mate -2 pv f2f3')), { depth: 5, best: 'f2f3', mate: -2 });
  assert.deepEqual(plain(C.parseInfo('info depth 1 score cp 12')), { depth: 1, best: null, cp: 12 });
  assert.equal(C.parseInfo('info depth 9 score cp 50 lowerbound pv e2e4'), null);
  assert.equal(C.parseInfo('info string NNUE evaluation'), null);
  assert.equal(C.parseInfo('bestmove e2e4'), null);
});

test('evaluations: from White\'s view, as centipawns, chances and words', () => {
  assert.deepEqual(plain(C.whiteView({ cp: 30 }, 'w')), { cp: 30 });
  assert.deepEqual(plain(C.whiteView({ cp: 30 }, 'b')), { cp: -30 });
  assert.deepEqual(plain(C.whiteView({ mate: 2 }, 'b')), { mate: -2 });
  assert.deepEqual(plain(C.whiteView({ mate: 0 }, 'b')), { mate: 0, lost: 'b' });
  assert.equal(C.centipawns({ cp: 55 }), 55);
  assert.equal(C.centipawns({ mate: 3 }), 9970);
  assert.equal(C.centipawns({ mate: -1 }), -9990);
  assert.equal(C.centipawns({ mate: 0, lost: 'w' }), -10000);
  assert.equal(C.centipawns({ mate: 0, lost: 'b' }), 10000);
  assert.equal(C.chances({ cp: 0 }), 0);
  assert.ok(C.chances({ cp: 300 }) > 0.4 && C.chances({ cp: 300 }) < 0.6);
  assert.equal(C.chances({ mate: 5 }), C.chances({ cp: 1000 }));
  assert.ok(Math.abs(C.chances({ cp: -5000 }) + C.chances({ cp: 5000 })) < 1e-12);
  assert.equal(C.formatEval({ cp: 85 }), '+0.85');
  assert.equal(C.formatEval({ cp: -120 }), '-1.20');
  assert.equal(C.formatEval({ cp: 0 }), '0.00');
  assert.equal(C.formatEval({ mate: 3 }), 'M3');
  assert.equal(C.formatEval({ mate: -2 }), '-M2');
  assert.equal(C.formatEval({ mate: 0, lost: 'w' }), '#');
  assert.equal(Math.round(C.moveAccuracy(0.2, 0.2)), 100);
  assert.equal(Math.round(C.moveAccuracy(0.2, 0.5)), 100);      // getting better costs nothing
  assert.ok(C.moveAccuracy(0, -0.2) < 70);
  assert.equal(C.moveAccuracy(1, -1), 0);
});

test('evaluations: each side\'s winning chances, and how a position stands in words', () => {
  assert.equal(C.winChance({ cp: 0 }, 'w'), 50);
  assert.equal(C.winChance({ cp: 0 }, 'b'), 50);
  assert.equal(C.winChance({ cp: 300 }, 'w') + C.winChance({ cp: 300 }, 'b'), 100);
  assert.ok(C.winChance({ cp: 300 }, 'w') > 70);
  assert.equal(C.winChance({ mate: -1 }, 'w'), 2);              // as low as it goes
  assert.equal(C.winChance({ mate: -1 }, 'b'), 98);
  assert.equal(C.winChance({ mate: 0, lost: 'b' }, 'w'), 98);

  assert.equal(C.outlook({ cp: 0 }), 'Equal');
  assert.equal(C.outlook({ cp: -50 }), 'Equal');
  assert.equal(C.outlook({ cp: 60 }), 'White is slightly better');
  assert.equal(C.outlook({ cp: -200 }), 'Black is better');
  assert.equal(C.outlook({ cp: 400 }), 'White is winning');
  assert.equal(C.outlook({ cp: -900 }), 'Black is winning');
  assert.equal(C.outlook({ mate: 3 }), 'White mates in 3');
  assert.equal(C.outlook({ mate: -1 }), 'Black mates in 1');
  assert.equal(C.outlook({ mate: 0, lost: 'w' }), 'Black has won');
  assert.equal(C.outlook({ mate: 0, lost: 'b' }), 'White has won');
});

test('review: each move\'s kind, the better move, and each side\'s accuracy', () => {
  const g = playAll('f2f3 e7e5 g2g4 d8h4');
  const evals = [
    { cp: 20, best: 'e2e4' },
    { cp: -10, best: 'e7e5' },     // after f3: a small slip
    { cp: -40, best: 'd2d4' },     // after e5
    { mate: -1, best: 'd8h4' },    // after g4: mated next move
    { mate: 0, lost: 'w' }         // after Qh4#
  ];
  const r = C.reviewGame(g, evals);
  assert.deepEqual(plain(r.moves.map((m) => [m.san, m.color, m.kind, m.bestSan])), [
    ['f3', 'w', 'good', 'e4'], ['e5', 'b', 'best', 'e5'], ['g4', 'w', 'blunder', 'd4'], ['Qh4#', 'b', 'best', 'Qh4#']
  ]);
  assert.ok(r.moves[2].loss > 0.8);
  assert.equal(r.moves[1].loss, 0);
  assert.deepEqual(plain({ ...r.w, accuracy: undefined }), { inaccuracy: 0, mistake: 0, blunder: 1, moves: 2 });
  assert.equal(r.b.accuracy, 100);
  assert.ok(r.w.accuracy > 40 && r.w.accuracy < 60, String(r.w.accuracy));

  // Inaccuracies and mistakes by how much the chances fell.
  const s = playAll('e2e4 e7e5 d2d4');
  const k = C.reviewGame(s, [{ cp: 0, best: 'd2d4' }, { cp: -80, best: 'c7c5' }, { cp: 60, best: 'g1f3' }, { cp: -150 }]).moves;
  assert.deepEqual(plain(k.map((m) => m.kind)), ['inaccuracy', 'mistake', 'blunder']);
  // Moves not looked at yet have no kind, and a side with no moves no accuracy.
  const part = C.reviewGame(s, [{ cp: 0 }]);
  assert.equal(part.moves[0].kind, null);
  assert.equal(part.w.accuracy, null);
  // A best move the engine gives that isn't legal there is left out.
  assert.equal(C.reviewGame(playAll('e2e4'), [{ cp: 0, best: 'e2e5' }, { cp: 0 }]).moves[0].bestSan, null);
});
