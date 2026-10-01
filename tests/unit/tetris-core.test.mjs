import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const T = load('assets/js/tetris-core.js').bdnixTetris;

// The shapes as blocks.js defines them.
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]]
};

// A board from strings, top row first: '.' is empty, a letter a piece's cell.
// Rows not given are empty, and the given rows sit at the bottom.
function board(...rows){
  const grid = T.emptyGrid();
  rows.forEach((row, i) => {
    grid[T.ROWS - rows.length + i] = [...row].map((c) => (c === '.' ? null : c));
  });
  return grid;
}
const rowsOf = (grid, n) => plain(grid.slice(T.ROWS - n)).map((r) => r.map((c) => c || '.').join(''));

test('an empty board is 20 rows of 10 empty cells, each row its own', () => {
  const g = T.emptyGrid();
  assert.equal(g.length, 20);
  assert.ok(g.every((r) => r.length === 10 && r.every((c) => c === null)));
  g[0][0] = 'I';
  assert.equal(g[1][0], null);
});

test('a bag holds each piece once, in an order set by the random numbers', () => {
  // Always the first choice: each swap brings the front piece to the end.
  assert.deepEqual(plain(T.bag(SHAPES, () => 0)), ['O', 'T', 'J', 'L', 'S', 'Z', 'I']);
  // Always the last choice: nothing moves.
  assert.deepEqual(plain(T.bag(SHAPES, () => 0.999)), ['I', 'O', 'T', 'J', 'L', 'S', 'Z']);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 20; i++) assert.deepEqual(plain(T.bag(SHAPES, rand)).sort(), Object.keys(SHAPES).sort());
});

test('new pieces start centred at the top; the I piece a row higher', () => {
  assert.deepEqual(plain(T.makePiece(SHAPES, 'T')), { type: 'T', m: SHAPES.T, x: 3, y: 0 });
  assert.deepEqual(plain(T.makePiece(SHAPES, 'O')), { type: 'O', m: SHAPES.O, x: 4, y: 0 });
  assert.deepEqual(plain(T.makePiece(SHAPES, 'I')), { type: 'I', m: SHAPES.I, x: 3, y: -1 });
  // A copy: changing the piece doesn't change the shape.
  const p = T.makePiece(SHAPES, 'L');
  p.m[0][0] = 1;
  assert.equal(SHAPES.L[0][0], 0);
});

test('rotating turns the matrix a quarter either way, and four turns go round', () => {
  assert.deepEqual(plain(T.rotateMatrix(SHAPES.T, 1)), [[0,1,0],[0,1,1],[0,1,0]]);
  assert.deepEqual(plain(T.rotateMatrix(SHAPES.T, -1)), [[0,1,0],[1,1,0],[0,1,0]]);
  assert.deepEqual(plain(T.rotateMatrix(T.rotateMatrix(SHAPES.J, 1), -1)), SHAPES.J);
  let m = SHAPES.I;
  for (let i = 0; i < 4; i++) m = T.rotateMatrix(m, 1);
  assert.deepEqual(plain(m), SHAPES.I);
});

test('a piece collides with the walls, the floor and filled cells, but not the sky', () => {
  const g = board('X.........');
  const t = SHAPES.T;
  assert.equal(T.collides(g, t, 3, 0), false);
  assert.equal(T.collides(g, t, -1, 0), true);    // left wall
  assert.equal(T.collides(g, t, 8, 0), true);     // right wall
  assert.equal(T.collides(g, t, 7, 0), false);    // flush with it
  assert.equal(T.collides(g, t, 3, 19), true);    // through the floor
  assert.equal(T.collides(g, t, 3, 18), false);   // its bottom row is empty
  assert.equal(T.collides(g, t, 0, 18), true);    // onto the filled cell
  assert.equal(T.collides(g, t, 3, -2), false);   // partly above the board
  // Empty cells of the matrix may hang over a wall.
  assert.equal(T.collides(g, SHAPES.I, -1, 0), true);
  assert.equal(T.collides(T.emptyGrid(), T.rotateMatrix(SHAPES.I, 1), -2, 0), false);
});

test('a piece is on the ground when it can\'t fall any further', () => {
  const g = board('XXXXXXXXX.');
  assert.equal(T.onGround(g, { type: 'O', m: SHAPES.O, x: 4, y: 17 }), true);
  assert.equal(T.onGround(g, { type: 'O', m: SHAPES.O, x: 4, y: 16 }), false);
  assert.equal(T.onGround(g, { type: 'O', m: SHAPES.O, x: 8, y: 17 }), true);   // one cell over the gap
});

test('a turned piece kicks off a wall, and the O piece never turns', () => {
  const g = T.emptyGrid();
  const free = T.rotated(g, T.makePiece(SHAPES, 'T'), 1);
  assert.deepEqual(plain(free), { m: [[0,1,0],[0,1,1],[0,1,0]], x: 3, y: 0 });
  // An upright I against the left wall has to move right to lie flat.
  const upright = { type: 'I', m: T.rotateMatrix(SHAPES.I, 1), x: -2, y: 5 };
  const kicked = T.rotated(g, upright, 1);
  assert.deepEqual(plain(kicked.m), [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]]);
  assert.equal(kicked.x, 0);
  assert.equal(T.rotated(g, T.makePiece(SHAPES, 'O'), 1), null);
  // Walled in, nothing fits.
  const tight = board(...Array(20).fill('XXXX...XXX'));
  const inside = { type: 'I', m: T.rotateMatrix(SHAPES.I, 1), x: 3, y: 0 };
  assert.equal(T.collides(tight, inside.m, inside.x, inside.y), false);
  assert.equal(T.rotated(tight, inside, 1), null);
});

test('drop distance is how far the piece falls to land', () => {
  assert.equal(T.dropDistance(T.emptyGrid(), T.makePiece(SHAPES, 'O')), 18);
  assert.equal(T.dropDistance(T.emptyGrid(), T.makePiece(SHAPES, 'I')), 19);
  assert.equal(T.dropDistance(board('....X.....', '..........'), T.makePiece(SHAPES, 'O')), 16);
  assert.equal(T.dropDistance(T.emptyGrid(), { type: 'O', m: SHAPES.O, x: 4, y: 18 }), 0);
});

test('placing writes the piece into the board, and says when it stuck out the top', () => {
  const g = T.emptyGrid();
  assert.equal(T.place(g, { type: 'T', m: SHAPES.T, x: 0, y: 18 }), false);
  assert.deepEqual(rowsOf(g, 2), ['.T........', 'TTT.......']);
  const h = T.emptyGrid();
  assert.equal(T.place(h, { type: 'J', m: SHAPES.J, x: 0, y: -1 }), true);
  assert.deepEqual(plain(h[0].slice(0, 3)), ['J', 'J', 'J']);   // what fits is still written
});

test('full rows are found and cleared, and the rows above drop down', () => {
  const g = board('.....L....', 'XXXXXXXXXX', 'X.XXXXXXXX', 'XXXXXXXXXX');
  assert.deepEqual(plain(T.fullRows(g)), [17, 19]);
  T.clearRows(g, T.fullRows(g));
  assert.deepEqual(rowsOf(g, 3), ['..........', '.....L....', 'X.XXXXXXXX']);
  assert.equal(g.length, 20);
  assert.deepEqual(plain(T.fullRows(T.emptyGrid())), []);
});

test('scores, levels and speed', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => T.lineScore(n, 1)), [0, 100, 300, 500, 800]);
  assert.equal(T.lineScore(4, 3), 2400);
  assert.deepEqual([0, 9, 10, 19, 25, 100].map(T.levelFor), [1, 1, 2, 2, 3, 11]);
  assert.equal(T.dropInterval(1), 1000);
  assert.equal(Math.round(T.dropInterval(2)), 793);
  for (let l = 1; l < 30; l++) assert.ok(T.dropInterval(l + 1) <= T.dropInterval(l), `level ${l}`);
  assert.equal(T.dropInterval(40), 30);                            // never faster than 30 ms a row
});

test('a save is checked field by field before it is used', () => {
  const good = {
    grid: T.emptyGrid(), bag: ['I', 'O'], queue: ['T', 'J', 'L', 'S', 'Z'],
    piece: T.makePiece(SHAPES, 'T'), held: null, canHold: true,
    score: 10, lines: 0, level: 1, clearing: null, dropAcc: 0, lockAcc: 0, lockResets: 0
  };
  const copy = (changes) => ({ ...plain(good), ...changes });
  assert.equal(T.validSave(copy({}), SHAPES), true);
  assert.equal(T.validSave(copy({ held: 'I' }), SHAPES), true);
  assert.equal(T.validSave(copy({ piece: null, clearing: { rows: [18, 19], t: 40 } }), SHAPES), true);

  for (const [why, changes] of [
    ['short board', { grid: T.emptyGrid().slice(1) }],
    ['narrow row', { grid: [...T.emptyGrid().slice(1), ['I']] }],
    ['unknown cell', { grid: [...T.emptyGrid().slice(1), Array(10).fill('Q')] }],
    ['short queue', { queue: ['T', 'J'] }],
    ['unknown in bag', { bag: ['X'] }],
    ['inherited name', { held: 'toString' }],
    ['bad piece matrix', { piece: { type: 'T', m: [[1, 1]], x: 3, y: 0 } }],
    ['piece off the numbers', { piece: { type: 'T', m: SHAPES.T, x: null, y: 0 } }],
    ['neither piece nor clearing', { piece: null }],
    ['clearing off the board', { piece: null, clearing: { rows: [20], t: 0 } }],
    ['score not a number', { score: '10' }],
    ['missing timer', { lockResets: undefined }]
  ]) assert.equal(T.validSave(copy(changes), SHAPES), false, why);
  assert.equal(T.validSave(null, SHAPES), false);
  assert.equal(T.validSave('save', SHAPES), false);
});
