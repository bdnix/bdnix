(function(){
  // Learn Chess's rules, apart from the page: the moves of a lesson's line,
  // what the learner is asked to play, what's learned and mastered, and the
  // checks every course passes (its unit tests run them). The moves are
  // played with chess-core.js; the courses are in lessons.js.
  var C = window.bdnixChess;

  // How strong Stockfish plays when the learner plays on from a line's end:
  // its skill (0 to 20) and how many moves ahead it looks.
  var LEVELS = {
    easy: { skill: 2, depth: 2 },
    medium: { skill: 8, depth: 5 },
    hard: { skill: 16, depth: 10 }
  };

  // The progress kept for each line: 1 learned (walked through once), 2
  // mastered (practised from memory with no mistake and no hint).
  var LEARNED = 1, MASTERED = 2;

  // A line's moves played out from the start: for each, what the page needs
  // (its UCI, its squares, the piece that moves, whether it takes or
  // castles, the side that plays it and its note). Throws if a move isn't
  // legal, or isn't written as chess-core writes it.
  function steps(line){
    var game = C.newGame(), out = [];
    line.moves.forEach(function(m, i){
      var pos = C.current(game), found = null;
      C.moves(pos).forEach(function(x){ if (C.san(pos, x) === m[0]) found = x; });
      if (!found) throw new Error(line.id + ': move ' + (i + 1) + ', ' + m[0] + ', isn’t a legal move there');
      out.push({
        san: m[0], note: m[1], uci: C.uci(found), from: found.from, to: found.to,
        piece: found.piece.toLowerCase(), take: !!found.captured,
        castle: found.castle ? found.castle.toLowerCase() : '',
        color: pos.turn, number: pos.full
      });
      C.play(game, C.uci(found));
    });
    return out;
  }

  // How a move is written for the learner, before they play it: 3.Bc4 for
  // White's third move, 3...Bc5 for Black's.
  function label(step){
    return step.number + (step.color === 'w' ? '.' : '...') + step.san;
  }

  // What the learner is asked to do, in words the page puts in their
  // language: castle on a side, take on a square with a piece, or move a
  // piece to a square.
  function prompt(step){
    if (step.castle) return { kind: 'castle', side: step.castle };
    return { kind: step.take ? 'take' : 'move', piece: step.piece, square: C.name(step.to) };
  }

  // ---------- Progress ----------
  function key(course, line){ return course.id + '/' + line.id; }

  // Progress read back from storage: only lines that exist, at a state
  // that makes sense. Anything else is dropped.
  function readProgress(raw, courses){
    var saved = null, out = {};
    try { saved = JSON.parse(raw); } catch (e) { saved = null; }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
    courses.forEach(function(course){
      course.lines.forEach(function(line){
        var k = key(course, line), v = saved[k];
        if (v === LEARNED || v === MASTERED) out[k] = v;
      });
    });
    return out;
  }

  function stateOf(progress, course, line){ return progress[key(course, line)] || 0; }

  // A line finished: walked through (learn), or practised, with or without
  // a mistake. A line never goes back: mastered stays mastered. Returns its
  // state now.
  function finish(progress, course, line, practised, mistakes){
    var k = key(course, line), was = progress[k] || 0;
    var now = practised && !mistakes ? MASTERED : LEARNED;
    progress[k] = Math.max(was, now);
    return progress[k];
  }

  // How far the learner is through a course.
  function tally(progress, course){
    var t = { learned: 0, mastered: 0, total: course.lines.length };
    course.lines.forEach(function(line){
      var s = stateOf(progress, course, line);
      if (s >= LEARNED) t.learned++;
      if (s === MASTERED) t.mastered++;
    });
    return t;
  }

  // The line to go on to after the one at index `after`: the next one that
  // isn't mastered, going round to the start, or null when every other line
  // is mastered.
  function nextLine(progress, course, after){
    var n = course.lines.length;
    for (var i = 1; i < n; i++) {
      var j = (after + i) % n;
      if (stateOf(progress, course, course.lines[j]) !== MASTERED) return j;
    }
    return null;
  }

  // ---------- Checking the courses ----------
  // What's wrong with the courses, one line each (none when they're right):
  // ids, names, sides and levels in order, every line's moves legal and
  // written as chess-core writes them, every move with its note, every line
  // with its end, and no two lines of a course the same.
  function problems(courses){
    var out = [], ids = {};
    courses.forEach(function(course, ci){
      var where = course.id || ('course ' + (ci + 1));
      if (!/^[a-z][a-z-]*$/.test(course.id || '')) out.push(where + ': its id is lower-case words joined by hyphens');
      if (ids[course.id]) out.push(where + ': another course has this id');
      ids[course.id] = true;
      if (course.side !== 'w' && course.side !== 'b') out.push(where + ': its side is w or b');
      if (course.level !== ci + 1) out.push(where + ': its level is ' + (ci + 1) + ', its place in the list');
      ['name', 'about', 'intro'].forEach(function(f){ if (!course[f]) out.push(where + ': it has no ' + f); });
      if (!course.lines || !course.lines.length) { out.push(where + ': it has no lines'); return; }
      var lineIds = {}, seen = {};
      course.lines.forEach(function(line){
        var at = where + '/' + line.id;
        if (!/^[a-z][a-z0-9-]*$/.test(line.id || '')) out.push(at + ': its id is lower-case words joined by hyphens');
        if (lineIds[line.id]) out.push(at + ': another line of the course has this id');
        lineIds[line.id] = true;
        if (!line.name) out.push(at + ': it has no name');
        if (!line.end) out.push(at + ': it has no end');
        var list;
        try { list = steps(line); } catch (e) { out.push(at + ': ' + e.message); return; }
        list.forEach(function(s, i){ if (!s.note) out.push(at + ': move ' + (i + 1) + ', ' + s.san + ', has no note'); });
        if (!list.length || list[list.length - 1].color !== course.side) out.push(at + ': it ends on a move of the learner’s');
        var moves = list.map(function(s){ return s.uci; }).join(' ');
        if (seen[moves]) out.push(at + ': it’s the same as ' + seen[moves]);
        seen[moves] = line.id;
      });
    });
    return out;
  }

  window.bdnixLearn = {
    LEVELS: LEVELS, LEARNED: LEARNED, MASTERED: MASTERED,
    steps: steps, label: label, prompt: prompt,
    key: key, readProgress: readProgress, stateOf: stateOf, finish: finish, tally: tally, nextLine: nextLine,
    problems: problems
  };
})();
