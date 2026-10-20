// Helpers for Learn Chess's specs: opening the page on a held clock, playing
// a lesson's moves on the board, and a stand-in for Stockfish.
import { expect } from '../../../tests/ui/fixtures.mjs';
import { openGame } from '../../../tests/ui/games.mjs';

export const REPLY = 700;          // ms before the other side's move (learn.js)
export const STORE = 'bdnix_learn_chess';

// Opens the page with the clock held still (openGame), so the other side
// moves only when the test lets time pass.
export const open = (page) => openGame(page, '/learn-chess/');

export const sq = (page, name) => page.locator(`#board [data-sq="${name}"]`);
export async function move(page, from, to){
  await sq(page, from).click();
  await sq(page, to).click();
}

// A line's moves as the page has them (learn-core.js): from and to squares,
// and who plays each.
export function stepsOf(page, course, line){
  return page.evaluate(([c, l]) => {
    const C = window.bdnixChess, k = window.bdnixCourses.find((x) => x.id === c);
    return window.bdnixLearn.steps(k.lines.find((x) => x.id === l)).map((s) => ({ from: C.name(s.from), to: C.name(s.to), color: s.color, uci: s.uci }));
  }, [course, line]);
}

// Plays a line's moves from ply `from` up to (not including) ply `to`: the
// learner's on the board, the other side's by letting time pass (or, on a
// running clock, waiting for it).
export async function playMoves(page, steps, side, from = 0, to = steps.length, { running = false } = {}){
  for (let i = from; i < to; i++) {
    const s = steps[i];
    if (s.color === side) await move(page, s.from, s.to);
    else if (!running) await page.clock.runFor(REPLY);
    await expect(page.locator('#notes li')).toHaveCount(i + 1);
  }
}

// Opens a course and starts one of its lines, learning or practising.
export async function startLine(page, courseButton, lineButton){
  await page.getByRole('button', { name: courseButton }).click();
  await page.getByRole('button', { name: lineButton, exact: true }).click();
  await expect(page.locator('#lessonView')).toBeVisible();
}

// Replaces Worker before the page loads, as a stand-in for Stockfish:
// window.uci records every command the page sends, and each search answers
// with the next of window.replies, or else the first legal move in UCI
// order. With fail set, starting it throws, as when the engine can't load.
export async function fakeEngine(page, replies = [], { fail = false } = {}){
  await page.addInitScript(([list, broken]) => {
    window.uci = [];
    window.replies = list;
    window.engines = 0;
    window.Worker = class {
      constructor(){
        if (broken) throw new Error('no engine');
        window.engines++;
        this.setup = null;
      }
      postMessage(cmd){
        window.uci.push(cmd);
        if (/^position /.test(cmd)) this.setup = cmd;
        if (!/^go /.test(cmd)) return;
        const C = window.bdnixChess, m = /^position (?:startpos|fen (.+?))(?: moves (.*))?$/.exec(this.setup);
        const g = C.newGame(m[1]);
        if (m[2]) m[2].split(' ').forEach((u) => C.play(g, u));
        const reply = window.replies.shift() || C.moves(C.current(g)).map(C.uci).sort()[0];
        Promise.resolve().then(() => this.onmessage({ data: 'info depth 1 score cp 0 nodes 1 pv ' + reply }))
          .then(() => this.onmessage({ data: 'bestmove ' + reply }));
      }
      terminate(){ window.engines--; }
    };
  }, [replies, fail]);
}
export const commands = (page) => page.evaluate(() => window.uci.splice(0));
