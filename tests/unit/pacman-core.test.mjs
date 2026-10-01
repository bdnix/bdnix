import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const P = load('assets/js/pacman-core.js').bdnixPacman;
const { UP, LEFT, DOWN, RIGHT } = P;
const ghost = (name, changes = {}) => ({
  def: P.GHOSTS.find((d) => d.name === name), x: 13, y: 23, dir: LEFT, state: 'active', fright: false, bob: 0, ...changes
});
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the maze: walls, the door, the open tunnel and 286 dots with 4 pellets', () => {
  assert.equal(P.MAP.length, P.ROWS);
  assert.ok(P.MAP.every((row) => row.length === P.COLS));
  assert.equal(P.isWall(0, 0), true);
  assert.equal(P.isWall(1, 1), false);                  // a pellet
  assert.equal(P.isWall(13, 12), true);                 // the ghost-house door
  assert.equal(P.isWall(-1, P.TUNNEL_ROW), false);      // out through the tunnel
  assert.equal(P.isWall(P.COLS, P.TUNNEL_ROW), false);
  assert.equal(P.isWall(-1, 1), true);                  // off the board elsewhere
  assert.equal(P.isWall(5, P.ROWS), true);
  const { dots, count } = P.newDots();
  assert.equal(count, 286);
  assert.deepEqual([dots[1][1], dots[1][2], dots[0][0], dots[23][13]], [2, 1, 0, 0]);
  assert.equal(dots.flat().filter((v) => v === 2).length, 4);
});

test('speeds and points follow the level', () => {
  assert.equal(P.pacSpeed(1), 7.6);
  assert.ok(near(P.pacSpeed(3), 8.2));
  assert.equal(P.pacSpeed(20), 9.5);
  const g = ghost('blinky');
  assert.equal(P.ghostSpeed(g, 1), 7.1);
  assert.equal(P.ghostSpeed(g, 30), 9.2);
  assert.ok(near(P.ghostSpeed({ ...g, fright: true }, 1), 7.1 * 0.55));
  assert.ok(near(P.ghostSpeed({ ...g, x: 3, y: P.TUNNEL_ROW }, 1), 7.1 * 0.45));   // slow in the tunnel
  assert.equal(P.ghostSpeed({ ...g, state: 'eaten' }, 1), 15);
  assert.equal(P.ghostSpeed({ ...g, state: 'house' }, 1), 4);
  assert.deepEqual([1, 5, 6, 9].map(P.frightDuration), [6, 2, 1.5, 1.5]);
  assert.deepEqual([1, 7, 80].map(P.fruitPoints), [100, 700, 5000]);
  assert.deepEqual([0, 1, 2, 3, 4].map(P.ghostPoints), [200, 400, 800, 1600, 1600]);
});

test('moving: along a corridor, stopping at a wall, and through the tunnel', () => {
  const p = { x: 13.5, y: 23, dir: LEFT, face: LEFT, chomp: 0 };
  P.advance(p, 2, (e) => P.pacChoose(e, LEFT));
  assert.deepEqual([p.x, p.y, p.chomp], [11.5, 23, 2]);
  // Up from (12, 23) is a wall: wanting up keeps it going left.
  P.advance(p, 0.5, (e) => P.pacChoose(e, UP));
  assert.equal(p.x, 11);
  // At the corner it stops.
  const q = { x: 2, y: 23, dir: LEFT, face: LEFT, chomp: 0 };
  P.advance(q, 3, (e) => P.pacChoose(e, LEFT));
  assert.deepEqual([q.x, q.dir, plain(q.face)], [1, null, plain(LEFT)]);
  // Off the left end of the tunnel and back on at the right.
  const t = { x: -1, y: P.TUNNEL_ROW, dir: LEFT };
  P.advance(t, 1.5, () => {});
  assert.equal(t.x, P.COLS - 0.5);
  assert.equal(t.chomp, undefined);                     // only the player chomps
});

test('the player turns the wanted way when it opens up', () => {
  const p = { x: 4, y: 23, dir: LEFT, face: LEFT };
  P.pacChoose(p, UP);                                   // (4, 22) is open
  assert.deepEqual(plain(p.dir), plain(UP));
  const q = { x: 6, y: 23, dir: LEFT, face: LEFT };
  P.pacChoose(q, UP);                                   // (6, 22) isn't: it carries on
  assert.deepEqual(plain(q.dir), plain(LEFT));
  assert.deepEqual(plain(p.dir), plain(UP));
  assert.deepEqual(plain(p.face), plain(UP));
});

test('scripted moves go across, then up or down, and say when they arrive', () => {
  const g = { x: 11.5, y: 14, dir: UP };
  assert.equal(P.moveToward(g, 13.5, 11, 1), false);
  assert.deepEqual([g.x, g.y, plain(g.dir)], [12.5, 14, plain(RIGHT)]);
  assert.equal(P.moveToward(g, 13.5, 11, 2), false);
  assert.deepEqual([g.x, g.y, plain(g.dir)], [13.5, 13, plain(UP)]);
  assert.equal(P.moveToward(g, 13.5, 11, 5), true);
  assert.equal(g.y, 11);
  P.reverse(g);
  assert.deepEqual(plain(g.dir), plain(DOWN));
});

test('each ghost hunts the player its own way', () => {
  const pac = { x: 13.6, y: 23, face: LEFT };
  const blinky = ghost('blinky', { x: 20, y: 11 });
  assert.deepEqual(plain(P.ghostTarget(blinky, pac, blinky, true)), { x: 14, y: 23 });
  assert.deepEqual(plain(P.ghostTarget(ghost('pinky'), pac, blinky, true)), { x: 10, y: 23 });
  // Two ahead is (12, 23); doubled from blinky at (20, 11): (4, 35).
  assert.deepEqual(plain(P.ghostTarget(ghost('inky'), pac, blinky, true)), { x: 4, y: 35 });
  assert.deepEqual(plain(P.ghostTarget(ghost('clyde', { x: 1, y: 1 }), pac, blinky, true)), { x: 14, y: 23 });
  assert.deepEqual(plain(P.ghostTarget(ghost('clyde', { x: 14, y: 20 }), pac, blinky, true)), { x: 0, y: 32 });
  // Scattering, each goes to its corner; eaten, home.
  assert.deepEqual(plain(P.ghostTarget(ghost('pinky'), pac, blinky, false)), { x: 2, y: -3 });
  assert.deepEqual(plain(P.ghostTarget(ghost('pinky', { state: 'eaten' }), pac, blinky, false)), { x: 13, y: 11 });
});

test('a ghost takes the way nearest its target, never back, and wanders when frightened', () => {
  const pac = { x: 1, y: 29, face: LEFT };
  // At (6, 4), heading right: down and right are open, up is a wall and left is behind it.
  const g = ghost('blinky', { x: 6, y: 4, dir: RIGHT });
  P.ghostChoose(g, pac, g, true, () => 0);
  assert.deepEqual(plain(g.dir), plain(DOWN));
  const s = ghost('blinky', { x: 6, y: 4, dir: RIGHT });
  P.ghostChoose(s, pac, s, false, () => 0);             // scatter: its corner is top right
  assert.deepEqual(plain(s.dir), plain(RIGHT));
  const f = ghost('blinky', { x: 6, y: 4, dir: RIGHT, fright: true });
  P.ghostChoose(f, pac, f, true, () => 0);              // the first open way, in UP, LEFT, DOWN, RIGHT order
  assert.deepEqual(plain(f.dir), plain(DOWN));
  P.ghostChoose(f, pac, f, true, () => 0.99);           // now heading down: left, down or right, and the last
  assert.deepEqual(plain(f.dir), plain(RIGHT));
  // Eaten, at the door it goes in.
  const e = ghost('pinky', { x: 13, y: 11, state: 'eaten' });
  P.ghostChoose(e, pac, e, true, () => 0);
  assert.deepEqual([e.state, e.dir], ['entering', null]);
  // With nowhere else to go it turns back (the maze has no dead ends, so this
  // one is inside the corner wall).
  const d = ghost('blinky', { x: 0, y: 0, dir: DOWN });
  P.ghostChoose(d, pac, d, true, () => 0);
  assert.deepEqual(plain(d.dir), plain(UP));
});

test('ghosts wait in the house, leave through the door, and go back in when eaten', () => {
  const w = { level: 1, lifeTime: 0, dotsEaten: 0, pac: { x: 13.5, y: 23, face: LEFT }, chase: false, rand: () => 0 };
  const inky = ghost('inky', { x: 11.5, y: P.HOUSE_Y, state: 'house', dir: UP });
  w.blinky = inky;
  P.updateGhost(inky, 0.1, w);
  assert.equal(inky.state, 'house');
  assert.ok(Math.abs(inky.y - P.HOUSE_Y) <= 0.35);
  P.updateGhost(inky, 0.1, { ...w, dotsEaten: 30 });   // enough dots eaten
  assert.equal(inky.state, 'leaving');
  const clyde = ghost('clyde', { x: 15.5, y: P.HOUSE_Y, state: 'house', dir: UP });
  P.updateGhost(clyde, 0.1, { ...w, lifeTime: 9 });    // or long enough
  assert.equal(clyde.state, 'leaving');

  // Across to the door, then up and out, heading left.
  for (let i = 0; i < 40 && inky.state === 'leaving'; i++) P.updateGhost(inky, 0.1, w);
  assert.deepEqual([inky.state, inky.x, inky.y, plain(inky.dir)], ['active', 13.5, 11, plain(LEFT)]);

  // Entering: over to the door, down into the house, then out again.
  const e = ghost('pinky', { x: 13, y: 11, state: 'entering', dir: null });
  for (let i = 0; i < 40 && e.state === 'entering'; i++) P.updateGhost(e, 0.1, w);
  assert.deepEqual([e.state, e.x, e.y], ['leaving', 13.5, P.HOUSE_Y]);

  // Active ghosts move along the maze.
  const b = ghost('blinky', { x: 13.5, y: 11, dir: LEFT });
  P.updateGhost(b, 0.1, { ...w, blinky: b });
  assert.ok(near(b.x, 13.5 - 0.71));
});

test('a save is checked field by field before it is used', () => {
  const good = {
    state: 'playing', stateTime: 1, dots: P.newDots().dots, dotsLeft: 286, dotsEaten: 0, totalDots: 286,
    pac: { x: 13.5, y: 23, dir: LEFT, face: LEFT, moving: true, chomp: 0 }, wanted: LEFT,
    ghosts: P.GHOSTS.map((d) => ({ x: d.start.x, y: d.start.y, dir: UP, state: d.inHouse ? 'house' : 'active', fright: false, bob: 0 })),
    score: 0, level: 1, lives: 3, extraLifeGiven: false, modeIndex: 0, modeTime: 0, frightTime: 0, frightCombo: 0,
    lifeTime: 0, freeze: 0, fruit: null, popups: []
  };
  const copy = (changes) => ({ ...plain(good), ...changes });
  assert.equal(P.validSave(copy({})), true);
  assert.equal(P.validSave(copy({ fruit: { x: 13.5, y: 17, t: 3 }, wanted: null, popups: [{ x: 1, y: 2, t: 0.5, text: 200 }] })), true);
  const dots = plain(good.dots);
  dots[23][13] = 1;                                     // a dot where the maze has none
  for (const [why, changes] of [
    ['paused is never saved', { state: 'paused' }],
    ['dot off the maze', { dots }],
    ['short dots', { dots: dots.slice(1) }],
    ['diagonal direction', { pac: { ...good.pac, face: { x: 2, y: 0 } } }],
    ['no pac', { pac: null }],
    ['three ghosts', { ghosts: good.ghosts.slice(1) }],
    ['unknown ghost state', { ghosts: good.ghosts.map((g, i) => (i ? g : { ...g, state: 'lost' })) }],
    ['bad fruit', { fruit: { x: 1, y: 1 } }],
    ['bad popup', { popups: [null] }],
    ['score not a number', { score: null }]
  ]) assert.equal(P.validSave(copy(changes)), false, why);
  assert.equal(P.validSave(null), false);
});
