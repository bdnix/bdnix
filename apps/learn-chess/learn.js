(function(){
  // Learn Chess: pick a course, then a line of it, and play it on the board.
  // Learning, an arrow shows each of the learner's moves and a note says why
  // it's played; practising, they play it from memory. The other side's
  // moves are played for them, each with its note. From the end of a line
  // they can play on against Stockfish, which runs in a web worker (the
  // stockfish module) started only then. The courses are in lessons.js, the
  // rules of learning in learn-core.js and the rules of chess in
  // chess-core.js.
  var C = window.bdnixChess, L = window.bdnixLearn, COURSES = window.bdnixCourses;
  var Lang = window.bdnixLang, t = Lang.t;
  var ENGINE = '/assets/vendor/stockfish/stockfish-19-lite-single.js?v=19.0.0';
  var STORE = 'bdnix_learn_chess';
  var REPLY = 700;                // ms before the other side's move is played
  var NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var COLOR = { w: 'White', b: 'Black' };
  var ENDINGS = {
    stalemate: 'Draw by stalemate',
    repetition: 'Draw by threefold repetition',
    fifty: 'Draw by the fifty-move rule',
    material: 'Draw by insufficient material'
  };
  var OFFLINE = 'Couldn’t load the chess engine. Check your connection and try again.';

  function $(id){ return document.getElementById(id); }
  var coursesEl = $('courses'), studyEl = $('study'), boardEl = $('board');
  var views = { lines: $('linesView'), lesson: $('lessonView'), done: $('doneView'), play: $('playView') };
  var notesEl = $('notes'), promptEl = $('prompt'), msgEl = $('lessonMsg'), hintBtn = $('hintBtn');
  var statusEl = $('playStatus');

  var progress = {};
  try { progress = L.readProgress(localStorage.getItem(STORE), COURSES); } catch (e) {}
  function save(){
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) {}
  }

  // What's shown: 'courses' (the list), or a course's 'lines', a 'lesson',
  // a line 'done', or 'play' (on against Stockfish).
  var view = 'courses';
  var course = null;              // the course open
  var lineAt = -1;                // the index of its line being played
  var mode = 'learn';             // 'learn' or 'practice'
  var steps = [];                 // the line's moves (learn-core.js)
  var ply = 0;                    // how many of them have been played
  var mistakes = 0;               // wrong moves and hints, practising
  var wrong = 0;                  // wrong moves at this point of the line
  var shown = false;              // whether the arrow shows the move to play
  var game = C.newGame();         // the game on the board
  var selected = -1;              // the square of the piece picked up, or -1
  var animate = null;             // the move to slide into place on the next draw
  var timer = 0;                  // the other side's move, waiting to be played

  function colorName(c){ return t(COLOR[c]); }
  function piece(p){ return t(NAMES[p]); }

  // ---------- The courses ----------
  function showCourses(){
    leave();
    view = 'courses';
    course = null;
    studyEl.hidden = true;
    coursesEl.hidden = false;
    $('about').hidden = false;
    var list = $('courseList');
    list.innerHTML = '';
    COURSES.forEach(function(c){
      var n = L.tally(progress, c), li = document.createElement('li');
      li.className = 'course panel';
      li.innerHTML = '<p class="label course-meta"></p><h3 class="course-name" translate="no"></h3><p class="course-about"></p>' +
        '<p class="course-progress"></p><button type="button" class="btn btn-primary"></button>';
      li.querySelector('.course-meta').textContent = t('Level {n} · as {color}', { n: c.level, color: colorName(c.side) });
      li.querySelector('.course-name').textContent = c.name;
      li.querySelector('.course-about').textContent = c.about;
      li.querySelector('.course-progress').textContent = t('{learned} of {total} lines learned · {mastered} mastered', { learned: n.learned, total: n.total, mastered: n.mastered });
      var b = li.querySelector('button');
      b.textContent = n.learned ? t('Carry on') : t('Start');
      b.setAttribute('aria-label', n.learned ? t('Carry on with {course}', { course: c.name }) : t('Start {course}', { course: c.name }));
      b.addEventListener('click', function(){ openCourse(c); });
      list.appendChild(li);
    });
  }

  function openCourse(c){
    course = c;
    coursesEl.hidden = true;
    $('about').hidden = true;
    studyEl.hidden = false;
    $('courseTitle').textContent = c.name;
    $('courseSide').textContent = t('Level {n} · you play {color}', { n: c.level, color: colorName(c.side) });
    $('courseIntro').textContent = c.intro;
    showLines();
    // The course's board at the top of the screen, its title read out.
    window.scrollTo(0, 0);
    $('courseTitle').focus({ preventScroll: true });
  }

  // ---------- A course's lines ----------
  function show(name){
    view = name;
    for (var k in views) views[k].hidden = k !== name;
  }
  function showLines(){
    leave();
    show('lines');
    game = C.newGame();
    selected = -1;
    render();
    var list = $('lineList');
    list.innerHTML = '';
    course.lines.forEach(function(line, i){
      var state = L.stateOf(progress, course, line), li = document.createElement('li');
      li.className = 'line' + (state === L.MASTERED ? ' mastered' : state ? ' learned' : '');
      li.innerHTML = '<div class="line-head"><b class="line-name"></b><span class="line-state"></span></div><div class="line-actions">' +
        '<button type="button" class="btn btn-ghost learn"></button><button type="button" class="btn btn-ghost practise"></button></div>';
      li.querySelector('.line-name').textContent = line.name;
      li.querySelector('.line-state').textContent = t(state === L.MASTERED ? 'Mastered' : state ? 'Learned' : 'New');
      var learn = li.querySelector('.learn'), practise = li.querySelector('.practise');
      learn.textContent = t('Learn');
      practise.textContent = t('Practise');
      learn.setAttribute('aria-label', t('Learn: {line}', { line: t(line.name) }));
      practise.setAttribute('aria-label', t('Practise: {line}', { line: t(line.name) }));
      if (!state) learn.className = 'btn btn-primary learn';
      learn.addEventListener('click', function(){ startLine(i, 'learn'); });
      practise.addEventListener('click', function(){ startLine(i, 'practice'); });
      list.appendChild(li);
    });
  }

  // ---------- Playing a line ----------
  function line(){ return course.lines[lineAt]; }
  function startLine(i, how){
    leave();
    lineAt = i;
    mode = how;
    steps = L.steps(line());
    ply = 0; mistakes = 0; wrong = 0; shown = false;
    game = C.newGame();
    selected = -1;
    notesEl.innerHTML = '';
    msgEl.textContent = '';
    show('lesson');
    $('lessonMode').textContent = t(how === 'learn' ? 'Learning' : 'Practising');
    $('lessonTitle').textContent = line().name;
    hintBtn.hidden = how !== 'practice';
    render();
    $('lessonTitle').focus({ preventScroll: true });
    next();
  }

  // What comes next: the other side's move after a moment, the learner's
  // move, or the end of the line.
  function next(){
    if (ply >= steps.length) { finishLine(); return; }
    var step = steps[ply];
    if (step.color !== course.side) {
      promptEl.textContent = t('{color} plays…', { color: colorName(step.color) });
      timer = setTimeout(function(){ timer = 0; playStep(); }, REPLY);
      return;
    }
    wrong = 0;
    shown = mode === 'learn';
    promptEl.textContent = mode === 'learn' ? t('Your move: {what}', { what: describeMove(step) }) : t('Your move. Play the move from the line.');
    render();
  }

  // The move the learner is asked for, in words.
  function describeMove(step){
    var p = L.prompt(step);
    if (p.kind === 'castle') return t(p.side === 'k' ? 'castle on the king’s side.' : 'castle on the queen’s side.');
    if (p.kind === 'take') return t('take on {square} with the {piece}.', { square: p.square, piece: piece(p.piece) });
    return t('move the {piece} to {square}.', { piece: piece(p.piece), square: p.square });
  }

  // Plays the line's next move, with its note.
  function playStep(){
    var step = steps[ply];
    var m = C.play(game, step.uci);
    animate = m;
    ply++;
    shown = false;
    selected = -1;
    var li = document.createElement('li');
    li.className = step.color === course.side ? 'mine' : 'theirs';
    li.innerHTML = '<b translate="no"></b> <span></span>';
    li.querySelector('b').textContent = L.label(step);
    li.querySelector('span').textContent = step.note;
    notesEl.insertBefore(li, notesEl.firstChild);
    notesEl.scrollTop = 0;
    render();
    next();
  }

  // The learner moved a piece: the line's move, or not.
  function tried(uci){
    var step = steps[ply];
    if (uci === step.uci) {
      msgEl.textContent = mode === 'practice' && wrong === 0 ? t('Right!') : '';
      playStep();
      return;
    }
    selected = -1;
    wrong++;
    if (mode === 'learn') msgEl.textContent = t('Not that one. Follow the arrow.');
    else {
      mistakes++;
      if (wrong >= 2) {
        shown = true;
        msgEl.textContent = t('Not that one either. Here’s the move: follow the arrow.');
      } else msgEl.textContent = t('That’s not the move in this line. Try again.');
    }
    render();
  }

  // Practising: show the move to play. It counts as a mistake.
  function showMove(){
    if (view !== 'lesson' || mode !== 'practice' || shown || ply >= steps.length || steps[ply].color !== course.side) return;
    shown = true;
    mistakes++;
    msgEl.textContent = t('Here’s the move: follow the arrow.');
    render();
  }

  function finishLine(){
    var practised = mode === 'practice';
    var state = L.finish(progress, course, line(), practised, mistakes);
    save();
    show('done');
    var title, text;
    if (!practised) {
      title = t('Line learned');
      text = t('Now practise it from memory. Play it with no mistakes and it’s mastered.');
    } else if (!mistakes) {
      title = t('Line mastered: no mistakes!');
      text = t('You know this line. Try another, or play on against Stockfish.');
    } else {
      title = Lang.count(mistakes, 'Practised, with {n} mistake', 'Practised, with {n} mistakes');
      text = state === L.MASTERED ? t('You’ve mastered this line before. Keep it fresh.') : t('Practise it again with no mistakes to master it.');
    }
    $('doneTitle').textContent = title;
    $('doneText').textContent = text;
    $('endText').textContent = line().end;
    var after = L.nextLine(progress, course, lineAt);
    $('nextBtn').hidden = after === null;
    render();
    $('doneTitle').focus({ preventScroll: true });
  }

  // Stops whatever's under way: the other side's move, Stockfish.
  function leave(){
    if (timer) { clearTimeout(timer); timer = 0; }
    stopEngine();
  }

  // ---------- Playing on against Stockfish ----------
  // The engine is started when the learner plays on, and stopped when they
  // leave, so there's never an answer from an old position to ignore.
  var engine = null, thinking = false;
  function level(){
    var v = document.querySelector('input[name=level]:checked');
    return L.LEVELS[v ? v.value : 'easy'];
  }
  function startPlay(){
    leave();
    show('play');
    game = C.newGame();
    steps.forEach(function(s){ C.play(game, s.uci); });
    selected = -1;
    render();
    updatePlay();
    $('playTitle').focus({ preventScroll: true });
    think();
  }
  function startEngine(){
    if (engine) return true;
    try { engine = new Worker(ENGINE); } catch (e) { engineFailed(); return false; }
    engine.onmessage = function(e){ heard(String(e.data)); };
    engine.onerror = function(e){ if (e && e.preventDefault) e.preventDefault(); engineFailed(); };
    engine.postMessage('uci');
    engine.postMessage('ucinewgame');
    return true;
  }
  function stopEngine(){
    thinking = false;
    if (!engine) return;
    engine.terminate();
    engine = null;
  }
  function engineFailed(){
    stopEngine();
    statusEl.textContent = t(OFFLINE);
  }
  // Stockfish's turn: it looks for a move, at the level picked.
  function think(){
    if (view !== 'play' || thinking || C.status(game).over || C.current(game).turn === course.side) return;
    if (!startEngine()) return;
    var lv = level();
    thinking = true;
    updatePlay();
    engine.postMessage('setoption name Skill Level value ' + lv.skill);
    engine.postMessage(C.positionCommand(game));
    engine.postMessage('go depth ' + lv.depth);
  }
  function heard(text){
    var m = /^bestmove (\S+)/.exec(text);
    if (!m || !thinking) return;
    thinking = false;
    var played = C.play(game, m[1]);
    if (played) animate = played;
    render();
    updatePlay();
  }
  function updatePlay(){
    var st = C.status(game), text;
    if (st.result === 'checkmate') text = st.winner === course.side ? t('Checkmate: you win!') : t('Checkmate: Stockfish wins.');
    else if (st.over) text = t(ENDINGS[st.result]);
    else if (thinking) text = t('Stockfish is thinking…');
    else text = st.check ? t('Check! Your move.') : t('Your move.');
    statusEl.textContent = text;
  }

  // ---------- The board ----------
  var squares = [];
  for (var v = 0; v < 64; v++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sq';
    b.tabIndex = v === 56 ? 0 : -1;
    boardEl.appendChild(b);
    squares.push(b);
  }
  // The square shown at place `v` (0 top left, 63 bottom right): the board
  // is turned round when the learner plays Black.
  function up(){ return course ? course.side : 'w'; }
  function at(v){ return up() === 'w' ? v : 63 - v; }
  function placeOf(sq){ return up() === 'w' ? sq : 63 - sq; }

  function pieceSvg(p){
    return '<svg class="pc ' + C.colorOf(p) + '" viewBox="0 0 45 45" aria-hidden="true"><use href="#pc-' + p.toLowerCase() + '"/></svg>';
  }
  function describe(sq, p){
    return C.name(sq) + (p ? ', ' + t('{color} {piece}', { color: colorName(C.colorOf(p)), piece: piece(p.toLowerCase()) }) : '');
  }

  // Whether the learner can move now, and which moves.
  function myTurn(){
    if (C.current(game).turn !== up()) return false;
    if (view === 'lesson') return !timer && ply < steps.length;
    return view === 'play' && !thinking && !C.status(game).over;
  }
  function mine(sq){
    var p = C.current(game).board[sq];
    return !!p && C.colorOf(p) === up();
  }
  function targets(from){
    return C.moves(C.current(game)).filter(function(m){ return m.from === from; });
  }

  function render(){
    var pos = C.current(game), last = game.moves[game.moves.length - 1];
    var check = C.inCheck(pos) ? pos.board.indexOf(pos.turn === 'w' ? 'K' : 'k') : -1;
    var to = selected >= 0 ? targets(selected) : [];
    var arrow = shown && view === 'lesson' && ply < steps.length ? steps[ply] : null;
    for (var v = 0; v < 64; v++) {
      var sq = at(v), p = pos.board[sq], el = squares[v];
      var dark = ((sq >> 3) + (sq & 7)) % 2 === 1;
      var target = to.some(function(m){ return m.to === sq; });
      el.className = 'sq' + (dark ? ' dark' : '') +
        (last && (last.from === sq || last.to === sq) ? ' last' : '') +
        (sq === selected ? ' sel' : '') + (sq === check ? ' check' : '') +
        (arrow && (arrow.from === sq || arrow.to === sq) ? ' hint' : '') +
        (target ? ' to' + (p ? ' take' : '') : '');
      el.setAttribute('data-sq', C.name(sq));
      var label = describe(sq, p);
      if (sq === selected) label = t('{square}, picked up', { square: label });
      if (target) label = t('{square}, can move here', { square: label });
      el.setAttribute('aria-label', label);
      var html = p ? pieceSvg(p) : '';
      if (v % 8 === 0) html += '<span class="coord rank" aria-hidden="true">' + C.name(sq)[1] + '</span>';
      if (v >= 56) html += '<span class="coord file" aria-hidden="true" translate="no">' + C.name(sq)[0] + '</span>';
      el.innerHTML = html;
    }
    if (animate) slide(animate);
    animate = null;
    drawArrow(arrow);
  }

  // An arrow from one square to another, in board squares (the SVG is 8 × 8).
  function drawArrow(m){
    var svg = $('arrows');
    if (!m) { svg.innerHTML = ''; return; }
    var a = placeOf(m.from), b = placeOf(m.to);
    var x = (a & 7) + 0.5, y = (a >> 3) + 0.5, dx = (b & 7) + 0.5 - x, dy = (b >> 3) + 0.5 - y;
    var len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
    var end = len - 0.1, neck = end - 0.34, w = 0.09, hw = 0.24;
    var pt = function(along, across){ return (x + ux * along - uy * across).toFixed(3) + ',' + (y + uy * along + ux * across).toFixed(3); };
    svg.innerHTML = '<polygon points="' + [pt(0.15, w), pt(neck, w), pt(neck, hw), pt(end, 0), pt(neck, -hw), pt(neck, -w), pt(0.15, -w)].join(' ') + '"/>';
  }

  // Slides the piece that just moved from where it was (no rAF, so it also
  // works while the page's clock is held still).
  function slide(m){
    var pc = squares[placeOf(m.to)].querySelector('.pc');
    if (!pc) return;
    var a = placeOf(m.from), b = placeOf(m.to), size = squares[0].offsetWidth;
    pc.style.transform = 'translate(' + ((a % 8) - (b % 8)) * size + 'px,' + ((a >> 3) - (b >> 3)) * size + 'px)';
    void pc.getBoundingClientRect();
    pc.classList.add('slide');
    pc.style.transform = '';
  }

  // ---------- The learner's moves ----------
  // A press on a square: picks up a piece of theirs, or puts the one picked
  // up down where it can go.
  function pick(sq){
    if (!myTurn()) return;
    if (selected >= 0 && tryMove(selected, sq)) return;
    selected = mine(sq) && selected !== sq ? sq : -1;
    render();
  }
  // Moves from `from` to `to` if that's legal; a pawn reaching the far side
  // becomes a queen.
  function tryMove(from, to){
    var list = targets(from).filter(function(m){ return m.to === to; });
    if (!list.length) return false;
    var m = list.filter(function(x){ return !x.promo || x.promo === 'q'; })[0];
    moved(C.uci(m));
    return true;
  }
  function moved(uci){
    if (view === 'lesson') { tried(uci); return; }
    var m = C.play(game, uci);
    selected = -1;
    animate = m;
    render();
    updatePlay();
    think();
  }

  // Dragging a piece: it follows the pointer and drops on the square under it.
  var press = null, dragged = false;
  boardEl.addEventListener('pointerdown', function(e){
    var el = e.target.closest('.sq');
    if (!el || e.button > 0 || !myTurn()) return;
    var sq = C.square(el.getAttribute('data-sq'));
    if (!mine(sq)) return;
    press = { sq: sq, x: e.clientX, y: e.clientY, pc: null, drag: false };
  });
  boardEl.addEventListener('pointermove', function(e){
    if (!press) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.drag && Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
    if (!press.drag) {
      press.drag = true;
      selected = press.sq;
      render();
      press.pc = squares[placeOf(press.sq)].querySelector('.pc');
      press.pc.classList.add('drag');
      try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
    }
    press.pc.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
  boardEl.addEventListener('pointerup', function(e){
    var p = press;
    press = null;
    if (!p || !p.drag) return;
    dragged = true;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    el = el && el.closest('.sq');
    var to = el && boardEl.contains(el) ? C.square(el.getAttribute('data-sq')) : -1;
    if (to < 0 || !tryMove(p.sq, to)) { selected = -1; render(); }
  });
  boardEl.addEventListener('pointercancel', function(){ press = null; selected = -1; render(); });
  boardEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  // A click (or Enter or Space on a square) picks up or puts down. The click
  // that ends a drag is already done with.
  boardEl.addEventListener('click', function(e){
    if (dragged) { dragged = false; return; }
    var el = e.target.closest('.sq');
    if (el) pick(C.square(el.getAttribute('data-sq')));
  });
  // The arrow keys move round the board; only one square is in the tab order.
  var STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
  boardEl.addEventListener('keydown', function(e){
    var d = STEP[e.key], v = squares.indexOf(document.activeElement);
    if (d === undefined || v < 0) return;
    e.preventDefault();
    var n = v + d;
    if (n < 0 || n > 63 || (Math.abs(d) === 1 && (n >> 3) !== (v >> 3))) return;
    squares[v].tabIndex = -1;
    squares[n].tabIndex = 0;
    squares[n].focus();
  });

  // ---------- Buttons ----------
  $('allBtn').addEventListener('click', showCourses);
  ['linesBtn', 'doneLinesBtn', 'playLinesBtn'].forEach(function(id){ $(id).addEventListener('click', showLines); });
  $('restartBtn').addEventListener('click', function(){ startLine(lineAt, mode); });
  hintBtn.addEventListener('click', showMove);
  $('practiseBtn').addEventListener('click', function(){ startLine(lineAt, 'practice'); });
  $('nextBtn').addEventListener('click', function(){
    var after = L.nextLine(progress, course, lineAt);
    if (after !== null) startLine(after, L.stateOf(progress, course, course.lines[after]) ? 'practice' : 'learn');
  });
  $('playBtn').addEventListener('click', startPlay);
  $('againBtn').addEventListener('click', startPlay);
  // A new level counts from Stockfish's next move.
  document.querySelectorAll('input[name=level]').forEach(function(r){ r.addEventListener('change', think); });

  showCourses();
})();
