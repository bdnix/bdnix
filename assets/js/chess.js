(function(){
  // The rules live in chess-core.js; this file draws the board, handles
  // input, plays the other side with Stockfish and reviews finished games
  // (and games opened from a PGN or text file) with it. Stockfish runs in a
  // web worker (assets/vendor/stockfish) fetched the first time it's needed.
  var C = window.bdnixChess;
  var ENGINE = '/assets/vendor/stockfish/stockfish-19-lite-single.js?v=19.0.0';
  // Each level: Stockfish's skill (0 to 20) and how many moves ahead it looks.
  var LEVELS = [
    { skill: 0, depth: 1 }, { skill: 2, depth: 2 }, { skill: 4, depth: 3 }, { skill: 6, depth: 4 },
    { skill: 8, depth: 5 }, { skill: 10, depth: 6 }, { skill: 13, depth: 8 }, { skill: 16, depth: 10 },
    { skill: 18, depth: 12 }, { skill: 20, depth: 15 }
  ];
  var REVIEW_DEPTH = 16;          // how deep a review looks at each position
  var PLAY_DEPTH = 12;            // how deep Stockfish looks playing on from a move tried
  var PLAY_ON = 60;               // how many moves it plays on before it stops
  var REPLAY_STEP = 1000;         // ms between moves when a game is replayed
  var MAX_FILE = 50 * 1024 * 1024; // a game file bigger than this isn't one (a few hundred thousand games)
  var PICK_SHOW = 100;            // how many games of a file the list to pick from shows
  var NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var COLOR = { w: 'White', b: 'Black' };
  var ENDINGS = {
    stalemate: 'Draw by stalemate',
    repetition: 'Draw by threefold repetition',
    fifty: 'Draw by the fifty-move rule',
    material: 'Draw by insufficient material'
  };
  var KINDS = {
    best: { name: 'Best move', mark: '' },
    good: { name: 'Good move', mark: '' },
    inaccuracy: { name: 'Inaccuracy', mark: '?!' },
    mistake: { name: 'Mistake', mark: '?' },
    blunder: { name: 'Blunder', mark: '??' }
  };
  var RESULTS = { '1-0': 'White won', '0-1': 'Black won', '1/2-1/2': 'Drawn', '*': 'Unfinished' };
  var INTRO = 'Play against Stockfish, one of the strongest chess engines there is. Pick a side and a level, or open a game to analyse.';
  var OFFLINE = 'Couldn’t load the chess engine. Check your connection and try again.';

  function $(id){ return document.getElementById(id); }
  var boardEl = $('board'), gameEl = $('game'), promoEl = $('promo');
  var overlay = $('overlay'), ovKicker = $('ovKicker'), ovTitle = $('ovTitle'), ovText = $('ovText'), ovMsg = $('ovMsg');
  var startBtn = $('startBtn'), newBtn = $('newBtn'), fileEl = $('pgnFile');
  var restartBtn = $('restartBtn'), undoBtn = $('undoBtn'), levelEl = $('level');
  var reviewEl = $('review'), movesEl = $('moves'), graph = $('graph'), reviewMsg = $('reviewMsg');
  var sideInputs = document.querySelectorAll('input[name=side]');
  var compactMQ = window.matchMedia('(max-width:700px),(pointer:coarse)');

  var sound = window.bdnixSound;
  // This game's sounds, beside the ones every game shares (sound.js).
  var tone = sound.tone, notes = sound.notes;
  sound.add({
    move: [tone(520, 380, 0.06, 'triangle', 0.5)],
    capture: [tone(0, 0, 0.07, 'noise', 0.25), tone(330, 180, 0.12, 'triangle', 0.5)],
    check: [tone(880, 880, 0.08, 'square', 0.16), tone(1175, 1175, 0.12, 'square', 0.16, 0.09)],
    win: notes([523, 659, 784, 1047], 0.1, 0.16, 'square', 0.17)
  });

  // 'idle' (the start screen), 'playing', 'paused' or 'review'.
  var state = 'idle';
  var game = C.newGame();
  var side = 'w';                 // the visitor's side
  var selected = -1;              // the square of the piece picked up, or -1
  var animate = null;             // the move to slide into place on the next draw
  var review = null;              // the game being reviewed (see startReview)
  var best = 0;                   // the highest level beaten
  try { best = parseInt(localStorage.getItem('bdnix_chess_best'), 10) || 0; } catch (e) {}
  if (!(best >= 1 && best <= LEVELS.length)) best = 0;

  // ---------- The engine ----------
  // One search at a time: `job` hears its lines (info) and its answer (done).
  // A search that's stopped still ends with a bestmove, so the next `stale`
  // answers, and the lines before them, are ignored. Stockfish crashes when
  // a search starts before a stopped one has answered, so a search asked
  // for then waits (`queued`) until it has.
  var engine = null, job = null, stale = 0, queued = null;
  function post(cmd){ engine.postMessage(cmd); }
  function startEngine(){
    if (engine) return;
    try { engine = new Worker(ENGINE); } catch (e) { engineFailed(); return; }
    engine.onmessage = function(e){ heardEngine(String(e.data)); };
    engine.onerror = function(e){ if (e && e.preventDefault) e.preventDefault(); engineFailed(); };
    post('uci');
    post('ucinewgame');
  }
  function search(j, cmds){
    job = j;
    if (stale) queued = cmds;
    else cmds.forEach(post);
  }
  function cancel(){
    if (!job) return;
    job = null;
    if (queued) { queued = null; return; }     // never sent, so nothing to stop
    stale++;
    post('stop');
  }
  function heardEngine(line){
    if (/^info /.test(line)) {
      var info = C.parseInfo(line);
      if (info && !stale && job && job.info) job.info(info);
      return;
    }
    var m = /^bestmove (\S+)/.exec(line);
    if (!m) return;
    if (stale) {
      if (!--stale && queued) {
        var q = queued;
        queued = null;
        q.forEach(post);
      }
      return;
    }
    var j = job;
    job = null;
    if (j) j.done(m[1]);
  }
  // The worker couldn't be loaded: a game pauses (Resume tries again), and a
  // review says so with a button to try again.
  function engineFailed(){
    if (engine) { try { engine.terminate(); } catch (e) {} }
    engine = null; job = null; stale = 0; queued = null;
    if (state === 'playing') pause(OFFLINE);
    else if (state === 'paused') ovText.textContent = OFFLINE;
    else if (state === 'review') {
      if (review.alt) review.alt.auto = false;
      refreshReview();
    }
    updateHud();
  }

  // Asks for a move when it's the engine's turn in a game being played.
  function think(){
    if (state !== 'playing' || job || C.current(game).turn === side || C.status(game).over) return;
    startEngine();
    if (!engine) return;
    var lv = LEVELS[level() - 1];
    search({ done: function(uci){
      if (state !== 'playing') return;
      var m = C.play(game, uci);
      if (m) moved(m);
      else updateHud();
    } }, ['setoption name Skill Level value ' + lv.skill, C.positionCommand(game), 'go depth ' + lv.depth]);
    updateHud();
  }

  function level(){ return Math.max(1, Math.min(LEVELS.length, parseInt(levelEl.value, 10) || 1)); }
  function chosenSide(){
    for (var i = 0; i < sideInputs.length; i++) if (sideInputs[i].checked) return sideInputs[i].value;
    return 'w';
  }
  function setSide(s){
    for (var i = 0; i < sideInputs.length; i++) sideInputs[i].checked = sideInputs[i].value === s;
  }

  // ---------- Game flow ----------
  function newGame(){
    cancel();
    closeReview();
    side = chosenSide();
    game = C.newGame();
    selected = -1; animate = null;
    closePromo();
    state = 'playing';
    overlay.hidden = true;
    ovMsg.textContent = '';
    window.bdnixGamebar.setPaused(false);
    startBtn.blur();
    sound.play('start');
    startEngine();
    if (engine) post('ucinewgame');
    render();
    updateHud();
    persist();
    think();
  }

  // After either side moves: the sound, the board, and the end if it's over.
  function moved(m){
    selected = -1; animate = m;
    var st = C.status(game);
    sound.play(st.check ? 'check' : m.captured ? 'capture' : 'move');
    render();
    updateHud();
    if (st.over) gameOver(st);
    else think();
  }

  // The game is over: the result, a new best, and straight into its review.
  function gameOver(st){
    cancel();
    var won = st.winner === side, lv = level(), record = won && lv > best;
    if (record) {
      best = lv;
      try { localStorage.setItem('bdnix_chess_best', best); } catch (e) {}
      sound.play('best');
    } else sound.play(won ? 'win' : 'over');
    startReview(game, {
      kicker: st.result === 'checkmate' ? 'Checkmate' : 'Draw',
      title: st.result !== 'checkmate' ? 'Draw' : won ? 'You win!' : 'Stockfish wins',
      text: ending(st) + ' · Level ' + lv + (record ? ' — your best yet!' : ''),
      outcome: ending(st), side: side, mine: side, back: 'start', again: 'Play again'
    });
  }

  // How a game that's over ended, in words.
  function ending(st){
    return st.result === 'checkmate' ? 'Checkmate — ' + COLOR[st.winner] + ' wins' : ENDINGS[st.result];
  }

  function showOverlay(start, showNew){
    startBtn.textContent = start;
    newBtn.hidden = !showNew;
    overlay.hidden = false;
    closePromo();
    startBtn.focus();
  }
  // The start screen: pick a side and start, or open a game file.
  function showStart(){
    cancel();
    state = 'idle';
    game = C.newGame();
    side = chosenSide();
    selected = -1;
    ovKicker.textContent = 'bdnix arcade';
    ovTitle.textContent = 'Chess';
    ovText.textContent = INTRO;
    showOverlay('Start game', false);
    window.bdnixGamebar.setPaused(false);
    render();
    updateHud();
  }

  function pause(text){
    if (state !== 'playing') return;
    cancel();
    state = 'paused';
    selected = -1;
    showPaused(text || 'Take a breather.');
    persist();
  }
  function showPaused(text){
    ovKicker.textContent = 'bdnix arcade';
    ovTitle.textContent = 'Paused';
    ovText.textContent = text;
    showOverlay('Resume', true);
    window.bdnixGamebar.setPaused(true);
    render();
    updateHud();
  }
  function resume(){
    if (state !== 'paused') return;
    state = 'playing';
    overlay.hidden = true;
    ovMsg.textContent = '';
    window.bdnixGamebar.setPaused(false);
    render();
    updateHud();
    think();
  }
  function togglePause(){
    if (state === 'paused') resume();
    else pause();
  }
  function startOrResume(){
    if (state === 'paused') resume();
    else if (state === 'idle') newGame();
  }

  // Takes back the visitor's last move, and the engine's reply to it.
  function undo(){
    if (!canUndo()) return;
    cancel();
    closePromo();
    if (C.current(game).turn === side) C.undo(game);   // the engine's reply
    C.undo(game);                                       // the visitor's move
    selected = -1; animate = null;
    render();
    updateHud();
    persist();
    think();
  }
  // Whether the visitor has a move to take back.
  function canUndo(){
    if (state !== 'playing') return false;
    var mine = side === 'w' ? 1 : 2;     // Black's first move is the second
    return game.moves.length >= mine;
  }

  // ---------- The visitor's moves ----------
  // In a game, the visitor moves their own side's pieces on their turn. In a
  // review, either side's, to try a different move (see tryOut), unless
  // the game shown is over or Stockfish is playing on.
  function mover(){ return C.current(shown()).turn; }
  function mine(sq){
    var p = C.current(shown()).board[sq];
    return !!p && C.colorOf(p) === mover();
  }
  function myTurn(){
    if (state === 'review') return !(review.alt && review.alt.auto) && !C.status(shown()).over;
    return state === 'playing' && C.current(game).turn === side && !job;
  }
  function targets(from){
    return C.moves(C.current(shown())).filter(function(m){ return m.from === from; });
  }

  // A press on a square: picks up a piece of yours, or puts the one picked
  // up down where it can go. Picking up a piece stops a replay.
  function pick(sq){
    if (!myTurn()) return;
    stopReplay();
    if (selected >= 0 && tryMove(selected, sq)) return;
    selected = mine(sq) && selected !== sq ? sq : -1;
    render();
  }
  // Moves from `from` to `to` if that's legal. A pawn reaching the far side
  // asks what it should become first.
  function tryMove(from, to){
    var list = targets(from).filter(function(m){ return m.to === to; });
    if (!list.length) return false;
    if (list.length > 1) { openPromo(from, to); return true; }
    finish(C.uci(list[0]));
    return true;
  }
  function finish(uci){
    if (state === 'review') { tryOut(uci); return; }
    var m = C.play(game, uci);
    if (m) moved(m);
  }

  var promoFrom = -1, promoTo = -1;
  function openPromo(from, to){
    promoFrom = from; promoTo = to;
    var box = promoEl.querySelector('.promo-pieces');
    box.innerHTML = '';
    ['q', 'r', 'b', 'n'].forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', NAMES[t].charAt(0).toUpperCase() + NAMES[t].slice(1));
      b.innerHTML = pieceSvg(mover() === 'w' ? t.toUpperCase() : t);
      b.addEventListener('click', function(){
        var uci = C.name(promoFrom) + C.name(promoTo) + t;
        closePromo();
        finish(uci);
      });
      box.appendChild(b);
    });
    promoEl.hidden = false;
    box.firstChild.focus();
  }
  function closePromo(){
    if (promoEl.hidden) return;
    promoEl.hidden = true;
    promoFrom = promoTo = -1;
    selected = -1;
    render();
  }

  // ---------- Reviewing a game ----------
  // `review` holds the game, the engine's evaluation of each position found
  // so far (evals), the next position to look at (next), the move shown
  // (ply), which way up the board is (side), whether it's being replayed
  // (playing), the words at the top (info), and where "back" goes: the start
  // screen, or the game paused before a file was opened. A game that's just
  // ended opens at its last move; a game from a file at its first, replaying.
  function startReview(g, info){
    cancel();
    closePromo();
    state = 'review';
    review = { game: g, evals: [], next: 0, ply: info.replay ? 0 : g.moves.length, side: info.side, info: info, summary: null, playing: false };
    selected = -1;
    document.body.classList.add('reviewing');
    overlay.hidden = true;
    reviewEl.hidden = false;
    ovMsg.textContent = reviewMsg.textContent = '';
    window.bdnixGamebar.setPaused(false);
    $('reviewKicker').textContent = info.kicker;
    $('reviewTitle').textContent = info.title;
    $('reviewText').textContent = info.text;
    $('againBtn').textContent = info.again;
    $('pickAgainBtn').hidden = !info.picked;
    $('momentsTitle').textContent = info.mine ? 'Where you could have done better' : 'Where it could have gone better';
    moments = null;
    buildMoveList();
    resize();
    render();
    updateHud();
    refreshReview();
    persist();
    work();
    showReplay();
    if (info.replay) startReplay();
  }
  function closeReview(){
    if (!review) return;
    stopReplay();
    cancel();
    review = null;
    document.body.classList.remove('reviewing');
    reviewEl.hidden = true;
    reviewMsg.textContent = '';
    resize();
  }
  // "Play again" / "Back to your game": where the review was opened from.
  function leaveReview(){
    var back = review && review.info.back;
    closeReview();
    if (back === 'paused') {
      state = 'paused';
      showPaused('Your game is just as you left it.');
    } else showStart();
  }

  // The game up to move `ply`, for asking how it stood there.
  function upTo(g, ply){
    return { positions: g.positions.slice(0, ply + 1), moves: g.moves.slice(0, ply), start: g.start };
  }

  // The engine's evaluation of the position after `i` moves of `g`: White's
  // view, with its choice of move as `best`, passed to done(). A position
  // with no moves left needs no engine: mate or a draw. Returns false if the
  // engine can't be had.
  function evaluate(g, i, depth, done){
    var pos = g.positions[i], st = C.status(upTo(g, i));
    if (!C.moves(pos).length || (i === g.positions.length - 1 && st.over)) {
      done(st.result === 'checkmate' ? { mate: 0, lost: pos.turn } : { cp: 0 });
      return true;
    }
    startEngine();
    if (!engine) return false;
    var heard = null;
    search({
      info: function(inf){ heard = inf; },
      done: function(uci){
        var e = C.whiteView(heard || { cp: 0 }, pos.turn);
        e.best = uci !== '(none)' ? uci : heard && heard.best;
        done(e);
      }
    }, ['setoption name Skill Level value 20', C.positionCommand(g, i), 'go depth ' + depth]);
    return true;
  }

  // What the engine does next in a review, one search at a time: playing on
  // from a move tried, then looking at the positions of a move tried, then
  // at the game's own, each in turn until all are done.
  function work(){
    var r = review;
    if (!r || job) return;
    var a = r.alt;
    if (a && a.auto) { playOn(a); return; }
    var k = a ? nextOf(a) : -1;
    if (k >= 0) {
      evaluate(a.game, k, REVIEW_DEPTH, function(e){
        if (review !== r || r.alt !== a) return;
        a.evals[k] = e;
        refreshReview();
        work();
      });
    } else if (r.next < r.game.positions.length) {
      var i = r.next;
      evaluate(r.game, i, REVIEW_DEPTH, function(e){
        if (review !== r) return;
        r.evals[i] = e;
        r.next++;
        refreshReview();
        work();
      });
    }
    refreshReview();
  }
  // The first position of a line tried that's still to be looked at, or -1.
  function nextOf(a){
    for (var k = a.base; k < a.game.positions.length; k++) if (!a.evals[k]) return k;
    return -1;
  }

  // ---------- Trying other moves ----------
  // In a review, a piece moved on the board starts a line of the visitor's
  // own from the position shown. `review.alt` holds it: the move it branches
  // off after (base), the game up to there and the moves tried since (game),
  // the engine's look at each of its positions (evals), whether Stockfish is
  // playing it on (auto) and how many moves it has played on (played).
  // Playing the game's own move just steps on to it.
  function tryOut(uci){
    var r = review;
    stopReplay();
    if (!r.alt) {
      var next = r.game.moves[r.ply];
      if (next && C.uci(next) === uci) { goTo(r.ply + 1); return; }
      r.alt = { base: r.ply, game: upTo(r.game, r.ply), evals: r.evals.slice(0, r.ply + 1), auto: false, played: 0 };
    }
    var m = C.play(r.alt.game, uci);
    if (!m) return;
    r.alt.played = 0;
    altMoved(m);
  }
  function altMoved(m){
    var st = C.status(review.alt.game);
    selected = -1; animate = m;
    sound.play(st.check ? 'check' : m.captured ? 'capture' : 'move');
    if (st.over) review.alt.auto = false;
    afterAlt();
  }
  // The line has changed: the board, the panels, and what the engine does.
  function afterAlt(){
    cancel();
    render();
    updateHud();
    refreshReview();
    work();
  }
  // Takes back the last move tried; taking back the first goes back to the game.
  function takeBack(){
    var a = review.alt;
    C.undo(a.game);
    a.auto = false;
    a.played = 0;
    a.evals.length = a.game.positions.length;
    selected = -1; animate = null;
    if (a.game.moves.length === a.base) closeAlt();
    afterAlt();
  }
  // Leaves the line tried for the game's own moves.
  function closeAlt(){
    if (!review || !review.alt) return;
    review.alt = null;
    selected = -1;
    cancel();
  }
  function backToGame(){
    closeAlt();
    afterAlt();
  }

  // Stockfish plays the line on, both sides, a move at a time, until the
  // game is over or it has played PLAY_ON moves. Its look at each position
  // stands as that position's evaluation.
  function playOn(a){
    var r = review, g = a.game, k = g.positions.length - 1, pos = C.current(g);
    if (C.status(g).over || a.played >= PLAY_ON) { a.auto = false; updateHud(); work(); return; }
    startEngine();
    if (!engine) { a.auto = false; refreshReview(); return; }
    var heard = null;
    search({
      info: function(inf){ heard = inf; },
      done: function(uci){
        if (review !== r || r.alt !== a || !a.auto) return;
        if (!a.evals[k]) {
          a.evals[k] = C.whiteView(heard || { cp: 0 }, pos.turn);
          a.evals[k].best = uci;
        }
        var m = C.play(g, uci);
        if (!m) { a.auto = false; afterAlt(); return; }
        a.played++;
        altMoved(m);
      }
    }, ['setoption name Skill Level value 20', C.positionCommand(g), 'go depth ' + PLAY_DEPTH]);
  }
  function togglePlayOn(){
    var a = review.alt;
    if (!a) return;
    a.auto = !a.auto;
    if (a.auto) a.played = 0;
    selected = -1;
    afterAlt();
  }

  // The panel about the line tried: the move it tried against the game's,
  // and where the line has got to, against how the game itself ended.
  function showAlt(){
    var r = review, a = r.alt;
    $('alt').hidden = !a;
    $('altTip').hidden = !!a || C.status(shown()).over;
    if (!a) return;
    var g = a.game, base = a.base, last = g.positions.length - 1, st = C.status(g);
    var mine = C.reviewGame(g, a.evals).moves[base], color = mine.color;
    var real = r.summary.moves[base], eReal = r.evals[base + 1], eMine = a.evals[base + 1];
    $('altGame').textContent = real ? about(moveName(r.game, base), real.kind, eReal, color) : 'The game stopped here.';
    $('altMine').textContent = about(moveName(g, base), mine.kind, eMine, color);
    var verdict = '';
    if (real && (!eReal || !eMine)) verdict = 'Working out how it compares…';
    else if (real) {
      var was = C.winChance(eReal, color), now = C.winChance(eMine, color);
      verdict = Math.abs(now - was) < 2 ? mine.san + ' is about as good as the game’s ' + real.san + '.'
        : mine.san + ' is ' + (now > was ? 'better' : 'worse') + ' than the game’s ' + real.san + ': ' +
          COLOR[color] + '’s chances go ' + (now > was ? 'up' : 'down') + ' from ' + was + '% to ' + now + '%.';
    }
    $('altVerdict').textContent = verdict;
    var e = a.evals[last], where;
    if (st.over) where = ending(st);
    else if (a.auto) where = 'Stockfish is playing on…';
    else where = e ? C.formatEval(e) + ' · ' + C.outlook(e) : 'Analysing…';
    $('altNow').textContent = (a.played && !a.auto ? 'After ' + a.played + ' more ' + (a.played === 1 ? 'move' : 'moves') + ' by Stockfish: ' : 'Now: ') +
      where + (/…$/.test(where) ? '' : '.') + (r.info.outcome ? ' In the game: ' + r.info.outcome + '.' : '');
    var play = $('playOnBtn');
    play.textContent = a.auto ? 'Stop' : 'Stockfish plays on';
    play.disabled = st.over;
  }
  // The moves tried, numbered as people write them; a long line keeps its
  // first two moves and its last three.
  function lineOf(a){
    var g = a.game, from = a.base, to = g.moves.length, parts = [];
    var say = function(i, j){
      for (var k = i; k < j; k++) parts.push(k > i && g.positions[k].turn === 'b' ? g.moves[k].san : moveName(g, k));
    };
    if (to - from > 6) {
      say(from, from + 2);
      parts.push('…');
      say(to - 3, to);
    } else say(from, to);
    return parts.join(' ');
  }
  // A move, what kind of move it was, and how the game stood after it.
  function about(name, kind, e, color){
    return name + (kind ? ' · ' + KINDS[kind].name : '') +
      (e ? ' · ' + C.formatEval(e) + ' · ' + COLOR[color] + '’s chances ' + C.winChance(e, color) + '%' : ' · analysing…');
  }

  // The move list: a row per move number, a button per move.
  var moveBtns = [];
  function buildMoveList(){
    movesEl.innerHTML = '';
    moveBtns = [];
    var g = review.game, row = null;
    g.moves.forEach(function(m, i){
      var pos = g.positions[i];
      if (pos.turn === 'w' || !row) {
        row = document.createElement('li');
        var num = document.createElement('span');
        num.className = 'num';
        num.textContent = pos.full + (pos.turn === 'w' ? '.' : '…');
        row.appendChild(num);
        // A game that starts with Black to move leaves White's place empty.
        if (pos.turn === 'b') row.appendChild(document.createElement('span'));
        movesEl.appendChild(row);
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mv';
      b.setAttribute('data-ply', i + 1);
      b.innerHTML = '<span class="san"></span><span class="mark" aria-hidden="true"></span>';
      b.querySelector('.san').textContent = m.san;
      row.appendChild(b);
      moveBtns.push(b);
    });
  }
  function moveName(g, i){
    var pos = g.positions[i];
    return pos.full + (pos.turn === 'w' ? '. ' : '… ') + g.moves[i].san;
  }

  // Everything the review shows that depends on what's been worked out so far.
  function refreshReview(){
    var r = review;
    if (!r) return;
    var sum = r.summary = C.reviewGame(r.game, r.evals), n = r.game.positions.length;
    var done = r.next >= n, offline = !engine && !done && !job;
    $('reviewProgress').textContent = offline ? OFFLINE : done
      ? 'Analysed by Stockfish, ' + REVIEW_DEPTH + ' moves deep.'
      : 'Analysing… ' + r.next + ' of ' + n + ' positions';
    $('retryBtn').hidden = !offline;
    ['w', 'b'].forEach(function(c){
      var s = sum[c], k = c.toUpperCase();
      $('acc' + k).textContent = s.accuracy === null ? '—' : s.accuracy + '%';
      $('inaccuracy' + k).textContent = s.inaccuracy;
      $('mistake' + k).textContent = s.mistake;
      $('blunder' + k).textContent = s.blunder;
    });
    sum.moves.forEach(function(mv, i){
      var b = moveBtns[i], kind = KINDS[mv.kind];
      b.className = 'mv' + (mv.kind ? ' ' + mv.kind : '') + (i + 1 === r.ply ? ' on' : '');
      b.querySelector('.mark').textContent = kind ? kind.mark : '';
      b.setAttribute('aria-label', moveName(r.game, i) + (kind ? ', ' + kind.name.toLowerCase() : ''));
      if (i + 1 === r.ply) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    showMove();
    showAlt();
    showMoments();
    drawGraph();
  }

  // The slips worth a second look, each with the engine's better move: the
  // visitor's in a game they played, both sides' in a game opened. Choosing
  // one plays the better move instead (see tryOut), to see how it compares.
  var moments = null;
  function showMoments(){
    var r = review, sum = r.summary, list = [];
    sum.moves.forEach(function(mv, i){
      if (mv.kind && KINDS[mv.kind].mark && mv.best && (!r.info.mine || mv.color === r.info.mine)) list.push(i);
    });
    var done = r.next >= r.game.positions.length;
    $('momentsNote').textContent = list.length ? '' : !done ? 'Looking for slips…'
      : r.info.mine ? 'None: every move you made kept your chances.' : 'None: every move kept the chances.';
    var key = list.join(' ');
    if (key === moments) return;
    moments = key;
    var ol = $('moments');
    ol.innerHTML = '';
    list.forEach(function(i){
      var mv = sum.moves[i], pos = r.game.positions[i];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'moment ' + mv.kind;
      b.setAttribute('data-ply', i);
      b.innerHTML = '<b></b> <span class="why"></span>';
      b.querySelector('b').textContent = moveName(r.game, i);
      var mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = KINDS[mv.kind].mark;
      b.querySelector('b').appendChild(mark);
      b.querySelector('.why').textContent = KINDS[mv.kind].name + '. ' + pos.full + (pos.turn === 'w' ? '. ' : '… ') + mv.bestSan +
        ' was better: ' + COLOR[mv.color] + '’s chances fell from ' + C.winChance(r.evals[i], mv.color) + '% to ' +
        C.winChance(r.evals[i + 1], mv.color) + '%.';
      var li = document.createElement('li');
      li.appendChild(b);
      ol.appendChild(li);
    });
  }

  // What the review says about the move shown: its evaluation, what kind of
  // move it was, and what the engine would have played.
  function showMove(){
    var r = review, ply = r.ply, a = r.alt, e = a ? a.evals[a.game.positions.length - 1] : r.evals[ply];
    $('evalNow').textContent = e ? C.formatEval(e) : '…';
    var text;
    if (a) text = 'Your line: ' + lineOf(a);
    else if (!ply) text = 'The starting position.';
    else {
      var mv = r.summary.moves[ply - 1];
      text = moveName(r.game, ply - 1) + ': ';
      if (!mv.kind) text += 'not analysed yet.';
      else {
        text += KINDS[mv.kind].name + '.';
        if (mv.kind !== 'best' && mv.bestSan) text += ' Best was ' + mv.bestSan + '.';
      }
    }
    $('moveNow').textContent = text;
    $('firstBtn').disabled = ply === 0;
    $('prevBtn').disabled = ply === 0 && !a;
    $('nextBtn').disabled = $('lastBtn').disabled = ply === r.game.moves.length;
  }

  // Shows the position after `ply` moves of the game, leaving a line tried.
  // Stepping by hand stops a replay; a step forward slides the piece and
  // plays the move's sound.
  function goTo(ply, replaying){
    var r = review;
    if (!r) return;
    if (!replaying) stopReplay();
    var wasAlt = !!r.alt;
    closeAlt();
    ply = Math.max(0, Math.min(r.game.moves.length, ply));
    animate = ply === r.ply + 1 && !wasAlt ? r.game.moves[ply - 1] : null;
    if (animate) {
      var g = upTo(r.game, ply);
      sound.play(C.inCheck(C.current(g)) ? 'check' : animate.captured ? 'capture' : 'move');
    }
    r.ply = ply;
    render();
    updateHud();
    refreshReview();
    if (wasAlt) work();
    var on = moveBtns[ply - 1];
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  // One step back: the last move tried taken back, or the game's move before.
  function back(){
    if (review.alt) takeBack();
    else goTo(review.ply - 1);
  }

  // ---------- Replaying a game ----------
  // Plays the game through on the board, a move every REPLAY_STEP, from the
  // start if it's at the end. Stops at the last move or at any step by hand.
  var replayTimer = null;
  function startReplay(){
    var r = review;
    if (!r) return;
    if (r.alt) goTo(r.ply);
    if (r.ply >= r.game.moves.length) goTo(0);
    r.playing = true;
    replayTimer = setTimeout(replayStep, REPLAY_STEP);
    showReplay();
  }
  function replayStep(){
    var r = review;
    replayTimer = null;
    if (!r || !r.playing) return;
    goTo(r.ply + 1, true);
    if (r.ply >= r.game.moves.length) stopReplay();
    else replayTimer = setTimeout(replayStep, REPLAY_STEP);
  }
  function stopReplay(){
    if (replayTimer) clearTimeout(replayTimer);
    replayTimer = null;
    if (!review || !review.playing) return;
    review.playing = false;
    showReplay();
  }
  function toggleReplay(){
    if (review && review.playing) stopReplay();
    else startReplay();
  }
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
  function showReplay(){
    var btn = $('replayBtn'), on = !!(review && review.playing);
    btn.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    btn.setAttribute('aria-label', on ? 'Pause the replay' : 'Replay the moves');
    updateHud();
  }

  // The evaluation over the game: White's share of the chances shaded light
  // from the bottom, the slips marked in their colours, and the move shown.
  var MARKS = { inaccuracy: '#facc15', mistake: '#fb923c', blunder: '#f43f5e' };
  function drawGraph(){
    var r = review, dpr = window.devicePixelRatio || 1;
    var w = graph.clientWidth || 240, h = graph.clientHeight || 72;
    if (graph.width !== Math.round(w * dpr) || graph.height !== Math.round(h * dpr)) {
      graph.width = Math.round(w * dpr);
      graph.height = Math.round(h * dpr);
    }
    var g = graph.getContext('2d'), n = r.game.positions.length;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1b2036';
    g.fillRect(0, 0, w, h);
    var x = function(i){ return n > 1 ? i / (n - 1) * w : w / 2; };
    var y = function(e){ return h / 2 - C.chances(e) * h * 0.45; };
    var known = r.evals.length;
    if (known) {
      g.fillStyle = '#d6d9ee';
      g.beginPath();
      g.moveTo(0, h);
      for (var i = 0; i < known; i++) g.lineTo(x(i), y(r.evals[i]));
      g.lineTo(x(known - 1), h);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(142,151,171,.6)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    r.summary.moves.forEach(function(mv, k){
      if (!MARKS[mv.kind]) return;
      g.fillStyle = MARKS[mv.kind];
      g.beginPath(); g.arc(x(k + 1), y(r.evals[k + 1]), 3.5, 0, Math.PI * 2); g.fill();
    });
    g.strokeStyle = '#22d3ee';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x(r.ply), 0); g.lineTo(x(r.ply), h); g.stroke();
    var s = r.summary;
    graph.setAttribute('aria-label', 'How the evaluation changed over the game' +
      (s.w.accuracy === null ? '' : '. Accuracy: White ' + s.w.accuracy + '%, Black ' + (s.b.accuracy === null ? '—' : s.b.accuracy + '%')));
  }

  // ---------- Opening a game file, or pasting one ----------
  // Any file can be picked (browsers that don't know .pgn files won't let
  // them be picked otherwise); what's in it decides whether it's a game. A
  // file (or text) of several games lists them to pick one from.
  function importError(text){
    (state === 'review' ? reviewMsg : ovMsg).textContent = text;
  }
  // The games in a file or text: { games } when there are several, or else
  // the one game read (parsePgn).
  function readGames(text){
    var games = C.splitPgn(text);
    return games.length > 1 ? { games: games } : C.parsePgn(text);
  }
  var fileFrom = null;
  function openFile(file){
    if (!file) return;
    if (file.size > MAX_FILE) { importError(file.name + ' is too big to be a game file (over 50 MB).'); return; }
    file.text().then(function(text){
      var r = readGames(text);
      if (r.error) importError('Couldn’t read a game from ' + file.name + '. ' + r.error);
      else if (r.games) pickFrom(r.games, file.name, fileFrom);
      else openGame(r, file.name);
    }, function(){ importError('Couldn’t read ' + file.name + '.'); });
  }

  // The boxes over the page, for pasting a game and picking one: one at a
  // time, closed by Escape, Cancel or a click outside, which puts the focus
  // back on the button that opened it.
  var modal = null, modalFrom = null;
  function openModal(el, from, focus){
    stopReplay();
    modal = el;
    modalFrom = from;
    el.hidden = false;
    focus.focus();
  }
  function hideModal(){
    if (!modal) return;
    modal.hidden = true;
    modal = null;
  }
  function closeModal(){
    hideModal();
    if (modalFrom && !modalFrom.closest('[hidden]')) modalFrom.focus();
  }

  // The box to paste a game into, for a game copied from somewhere else.
  var pasteEl = $('paste'), pasteText = $('pgnText'), pasteMsg = $('pasteMsg');
  function openPaste(e){
    pasteMsg.textContent = '';
    openModal(pasteEl, e.currentTarget, pasteText);
  }
  function readPasted(){
    var text = pasteText.value;
    if (!text.trim()) { pasteMsg.textContent = 'Paste a game first.'; return; }
    if (text.length > MAX_FILE) { pasteMsg.textContent = 'That’s too long to be a game (over 50 MB).'; return; }
    var r = readGames(text);
    if (r.error) { pasteMsg.textContent = 'Couldn’t read a game from that. ' + r.error; return; }
    hideModal();
    pasteText.value = '';
    if (r.games) pickFrom(r.games, 'the games pasted', modalFrom);
    else openGame(r, 'Pasted game');
  }

  // The list of a file's games to pick one from, searched by the words in
  // its tags (players, event, place, date, round, result, opening), showing
  // the first PICK_SHOW that match. A game is only read once it's picked.
  var pickEl = $('pick'), pickSearch = $('pickSearch'), picking = null;
  function pickFrom(games, name, from){
    picking = {
      games: games, name: name,
      words: games.map(function(g){
        var t = g.tags;
        return [t.White, t.Black, t.Event, t.Site, t.Date, t.Round, t.Result, t.ECO].join(' ').toLowerCase();
      })
    };
    $('pickAbout').textContent = games.length.toLocaleString('en') + ' games in ' + name + '.';
    pickSearch.value = '';
    $('pickMsg').textContent = '';
    listPicks();
    openModal(pickEl, from, pickSearch);
  }
  function known(v){ return v && !/^[?.\s]*$/.test(v) ? v.replace(/\.\?\?/g, '') : ''; }
  function listPicks(){
    var want = pickSearch.value.toLowerCase().split(/\s+/).filter(Boolean), found = [];
    picking.words.forEach(function(w, i){
      if (want.every(function(x){ return w.indexOf(x) >= 0; })) found.push(i);
    });
    var ol = $('pickList');
    ol.innerHTML = '';
    found.slice(0, PICK_SHOW).forEach(function(i){
      var t = picking.games[i].tags, b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick-game';
      b.setAttribute('data-game', i);
      b.innerHTML = '<b></b><span></span>';
      b.querySelector('b').textContent = (known(t.White) || 'White') + ' – ' + (known(t.Black) || 'Black') +
        (t.Result && t.Result !== '*' ? ' · ' + t.Result.replace('1/2-1/2', '½–½') : '');
      b.querySelector('span').textContent = [known(t.Event), known(t.Date), known(t.Round) ? 'round ' + t.Round : '']
        .filter(Boolean).join(' · ') || 'Game ' + (i + 1);
      var li = document.createElement('li');
      li.appendChild(b);
      ol.appendChild(li);
    });
    $('pickCount').textContent = !found.length ? 'No games match.'
      : found.length > PICK_SHOW ? 'Showing the first ' + PICK_SHOW + ' of ' + found.length.toLocaleString('en') + '. Search to narrow them down.' : '';
  }
  function choose(i){
    var r = C.parsePgn(picking.games[i].text), n = picking.games.length;
    if (r.error) { $('pickMsg').textContent = 'Couldn’t read game ' + (i + 1) + '. ' + r.error; return; }
    hideModal();
    openGame(r, picking.name + ' · game ' + (i + 1).toLocaleString('en') + ' of ' + n.toLocaleString('en'), true);
  }

  // Reviews a game read from a file. A game paused before is kept, and
  // "Back to your game" returns to it. A game picked from a file of several
  // can be swapped for another of them.
  function openGame(r, fileName, picked){
    var g = r.game, t = r.tags, st = C.status(g), paused = state === 'paused' || (review && review.info.back === 'paused');
    var outcome = r.result !== '*' ? RESULTS[r.result]
      : st.result === 'checkmate' ? 'Checkmate — ' + COLOR[st.winner] + ' wins'
      : st.over ? ENDINGS[st.result] : RESULTS['*'];
    var about = [outcome, t.Event && t.Event !== '?' ? t.Event : '', t.Date && !/\?/.test(t.Date) ? t.Date : '', g.moves.length + (g.moves.length === 1 ? ' move' : ' moves')];
    startReview(g, {
      kicker: fileName, outcome: outcome === RESULTS['*'] ? null : outcome,
      title: (t.White && t.White !== '?' ? t.White : 'White') + ' vs ' + (t.Black && t.Black !== '?' ? t.Black : 'Black'),
      text: about.filter(Boolean).join(' · '),
      side: 'w', back: paused ? 'paused' : 'start', again: paused ? 'Back to your game' : 'Play a game', replay: true, picked: !!picked
    });
  }

  // ---------- Drawing ----------
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
  // is turned round when the visitor plays Black (or turns it in a review).
  function up(){ return review ? review.side : side; }
  function at(v){ return up() === 'w' ? v : 63 - v; }
  function placeOf(sq){ return up() === 'w' ? sq : 63 - sq; }

  function pieceSvg(p){
    return '<svg class="pc ' + C.colorOf(p) + '" viewBox="0 0 45 45" aria-hidden="true"><use href="#pc-' + p.toLowerCase() + '"/></svg>';
  }
  function describe(sq, p){
    return C.name(sq) + (p ? ', ' + COLOR[C.colorOf(p)] + ' ' + NAMES[p.toLowerCase()] : '');
  }
  // The game on the board, up to the move shown.
  function shown(){
    if (!review) return game;
    return review.alt ? review.alt.game : upTo(review.game, review.ply);
  }

  function render(){
    var g = shown(), pos = C.current(g), last = g.moves[g.moves.length - 1];
    var check = C.inCheck(pos) ? pos.board.indexOf(pos.turn === 'w' ? 'K' : 'k') : -1;
    var to = selected >= 0 ? targets(selected) : [];
    // In a review, the engine's choice in the position shown.
    var e = review && (review.alt ? review.alt.evals[g.positions.length - 1] : review.evals[review.ply]), hint = e && e.best && C.findMove(pos, e.best);
    for (var v = 0; v < 64; v++) {
      var sq = at(v), p = pos.board[sq], el = squares[v];
      var dark = ((sq >> 3) + (sq & 7)) % 2 === 1;
      var target = to.some(function(m){ return m.to === sq; });
      el.className = 'sq' + (dark ? ' dark' : '') +
        (last && (last.from === sq || last.to === sq) ? ' last' : '') +
        (hint && (hint.from === sq || hint.to === sq) ? ' hint' : '') +
        (sq === selected ? ' sel' : '') + (sq === check ? ' check' : '') +
        (target ? ' to' + (p ? ' take' : '') : '');
      el.setAttribute('data-sq', C.name(sq));
      el.setAttribute('aria-label', describe(sq, p) + (sq === selected ? ', picked up' : '') + (target ? ', can move here' : ''));
      var html = p ? pieceSvg(p) : '';
      if (v % 8 === 0) html += '<span class="coord rank" aria-hidden="true">' + C.name(sq)[1] + '</span>';
      if (v >= 56) html += '<span class="coord file" aria-hidden="true">' + C.name(sq)[0] + '</span>';
      el.innerHTML = html;
    }
    if (animate) slide(animate);
    animate = null;
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

  // The status panel, the captures and the buttons.
  function updateHud(){
    var g = shown(), st = C.status(g), pos = C.current(g), text, whose = COLOR[pos.turn];
    if (state === 'review') {
      text = st.result === 'checkmate' ? 'Checkmate — ' + COLOR[st.winner] + ' wins' : st.over ? ENDINGS[st.result] : st.check ? 'Check!'
        : review.alt ? (review.alt.auto ? 'Stockfish is playing on…' : 'Trying a move') : review.playing ? 'Replaying' : 'Reviewing';
    } else {
      if (state !== 'idle') whose += pos.turn === side ? ' · you' : ' · Stockfish';
      if (state === 'idle') text = 'Pick a side';
      else if (state === 'paused') text = 'Paused';
      else if (st.check) text = 'Check!';
      else if (pos.turn === side) text = 'Your move';
      else text = 'Stockfish is thinking…';
    }
    $('turn').textContent = st.over ? '—' : whose;
    $('status').textContent = text;
    $('best').textContent = best ? 'Level ' + best : 'None yet';

    var mat = C.material(game), them = C.other(side);
    var lead = side === 'w' ? mat.diff : -mat.diff;
    $('capYou').innerHTML = mat[side].map(function(t){ return pieceSvg(them === 'w' ? t.toUpperCase() : t); }).join('');
    $('capThem').innerHTML = mat[them].map(function(t){ return pieceSvg(side === 'w' ? t.toUpperCase() : t); }).join('');
    $('advYou').textContent = lead > 0 ? '+' + lead : '';
    $('advThem').textContent = lead < 0 ? '+' + -lead : '';
    $('capYou').setAttribute('aria-label', taken(mat[side]));
    $('capThem').setAttribute('aria-label', taken(mat[them]));
    undoBtn.disabled = !canUndo();
  }
  function taken(list){
    return list.length ? 'Taken: ' + list.map(function(t){ return NAMES[t]; }).join(', ') : 'Nothing taken yet';
  }

  // ---------- Sizing ----------
  // The biggest whole-pixel squares that fit beside (or, on a phone, between)
  // the panels. A review on a phone scrolls, so only the width counts.
  function resize(){
    var cs = getComputedStyle(gameEl);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var gap = parseFloat(cs.rowGap) || 0, availW, availH;
    if (compactMQ.matches) {
      availW = gameEl.clientWidth - padX;
      availH = review ? availW : gameEl.clientHeight - padY - document.querySelector('.stats').offsetHeight - document.querySelector('.side').offsetHeight - gap * 2;
    } else {
      availW = gameEl.clientWidth - padX - 190 - (review ? 320 : 190) - (parseFloat(cs.columnGap) || 0) * 2;
      availH = gameEl.clientHeight - padY;
    }
    var sq = Math.max(24, Math.min(84, Math.floor((Math.min(availW, availH) - 2) / 8)));
    boardEl.parentNode.style.setProperty('--sq', sq + 'px');
    boardEl.parentNode.style.setProperty('--cell', Math.max(16, sq * 0.6) + 'px');
    if (review && review.summary) drawGraph();
  }

  // ---------- Saving ----------
  // A game in progress is kept as the side, the level and the moves played,
  // also while a game file is being looked at.
  function snapshot(){
    var live = state === 'playing' || state === 'paused' || (state === 'review' && review.info.back === 'paused');
    if (!live || !game.moves.length) return null;
    return { side: side, level: level(), moves: game.moves.map(C.uci) };
  }
  var persist = window.bdnixSave.keep('chess', snapshot);

  // Replays a saved game; every move must be legal and the game not over.
  function restore(s){
    if ((s.side !== 'w' && s.side !== 'b') || !window.bdnixSave.num(s.level) || s.level !== Math.floor(s.level) ||
      s.level < 1 || s.level > LEVELS.length || !Array.isArray(s.moves) || !s.moves.length || s.moves.length > 2000) return false;
    var g = C.newGame();
    for (var i = 0; i < s.moves.length; i++) {
      if (typeof s.moves[i] !== 'string' || !C.play(g, s.moves[i])) return false;
    }
    if (C.status(g).over) return false;
    game = g; side = s.side;
    setSide(side);
    levelEl.value = String(s.level);
    state = 'playing';
    pause('Picked up where you left off.');
    return true;
  }

  // ---------- Input ----------
  // Dragging a piece: it follows the pointer and drops on the square under it.
  var press = null, dragged = false;
  boardEl.addEventListener('pointerdown', function(e){
    var el = e.target.closest('.sq');
    if (!el || e.button > 0 || !myTurn()) return;
    var sq = C.square(el.getAttribute('data-sq'));
    if (!mine(sq)) return;
    press = { sq: sq, x: e.clientX, y: e.clientY, pc: el.querySelector('.pc'), drag: false };
  });
  boardEl.addEventListener('pointermove', function(e){
    if (!press) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.drag && Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
    if (!press.drag) {
      press.drag = true;
      stopReplay();
      selected = press.sq;
      render();
      press.pc = squares[placeOf(press.sq)].querySelector('.pc');
      press.pc.classList.add('drag');
      try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
    }
    press.pc.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
  function drop(e){
    var p = press;
    press = null;
    if (!p || !p.drag) return;
    dragged = true;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    el = el && el.closest('.sq');
    var to = el && boardEl.contains(el) ? C.square(el.getAttribute('data-sq')) : -1;
    if (to < 0 || !tryMove(p.sq, to)) { selected = -1; render(); }
  }
  boardEl.addEventListener('pointerup', drop);
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
    e.stopPropagation();
    var n = v + d;
    if (n < 0 || n > 63 || (Math.abs(d) === 1 && (n >> 3) !== (v >> 3))) return;
    squares[v].tabIndex = -1;
    squares[n].tabIndex = 0;
    squares[n].focus();
  });

  // In a review, ← and → step through the moves, Home and End jump to the ends.
  // ← takes back a move tried, and Escape goes back to the game from one.
  var NAV = {
    ArrowRight: function(){ return review.ply + 1; },
    Home: function(){ return 0; }, End: function(){ return review.game.moves.length; }
  };
  document.addEventListener('keydown', function(e){
    if (modal) {
      if (e.code === 'Escape') { closeModal(); e.preventDefault(); }
      return;
    }
    if (e.code === 'Escape' && !promoEl.hidden) { closePromo(); e.preventDefault(); return; }
    if (e.target === levelEl) return;
    if (state === 'review') {
      if (NAV[e.key]) { goTo(NAV[e.key]()); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { back(); e.preventDefault(); }
      else if (e.code === 'Escape' && review.alt) { backToGame(); e.preventDefault(); }
      // Space plays or pauses the replay, unless it's pressing a button.
      else if (e.code === 'Space' && !/^(BUTTON|SELECT|INPUT)$/.test(document.activeElement.tagName)) { toggleReplay(); e.preventDefault(); }
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && !overlay.hidden && document.activeElement === document.body) {
      startOrResume(); e.preventDefault();
    }
  });
  window.bdnixUpright.onTurn(function(){ pause(); stopReplay(); });

  startBtn.addEventListener('click', startOrResume);
  newBtn.addEventListener('click', newGame);
  $('pauseBtn').addEventListener('click', togglePause);
  // Before the first game the board turns round to show the side picked.
  [].forEach.call(sideInputs, function(input){
    input.addEventListener('change', function(){
      if (state !== 'idle') return;
      side = chosenSide();
      render();
    });
  });
  // New game from the panel: asks first if a game is being played.
  restartBtn.addEventListener('click', function(){
    if (state === 'playing') pause('Pick a side for a new game, or resume this one.');
    else newGame();
  });
  undoBtn.addEventListener('click', undo);
  // A new level counts from the engine's next move.
  levelEl.addEventListener('change', function(){ persist(); levelEl.blur(); });

  // Game files: the buttons open the file picker.
  [$('importBtn'), $('anotherBtn')].forEach(function(btn){
    btn.addEventListener('click', function(){ fileFrom = btn; fileEl.click(); });
  });
  $('pasteBtn').addEventListener('click', openPaste);
  $('pasteAgainBtn').addEventListener('click', openPaste);
  $('pasteGo').addEventListener('click', readPasted);
  $('pasteCancel').addEventListener('click', closeModal);
  $('pickCancel').addEventListener('click', closeModal);
  [pasteEl, pickEl].forEach(function(el){
    el.addEventListener('click', function(e){ if (e.target === el) closeModal(); });
  });
  pickSearch.addEventListener('input', listPicks);
  $('pickList').addEventListener('click', function(e){
    var btn = e.target.closest('.pick-game');
    if (btn) choose(parseInt(btn.getAttribute('data-game'), 10));
  });
  $('pickAgainBtn').addEventListener('click', function(e){
    $('pickMsg').textContent = '';
    openModal(pickEl, e.currentTarget, pickSearch);
  });
  fileEl.addEventListener('change', function(){
    var file = fileEl.files[0];
    fileEl.value = '';
    openFile(file);
  });

  // The review's buttons, moves and graph.
  $('firstBtn').addEventListener('click', function(){ goTo(0); });
  $('prevBtn').addEventListener('click', back);
  $('nextBtn').addEventListener('click', function(){ goTo(review.ply + 1); });
  $('lastBtn').addEventListener('click', function(){ goTo(review.game.moves.length); });
  $('replayBtn').addEventListener('click', toggleReplay);
  $('flipBtn').addEventListener('click', function(){
    review.side = C.other(review.side);
    render();
  });
  movesEl.addEventListener('click', function(e){
    var btn = e.target.closest('.mv');
    if (btn) goTo(parseInt(btn.getAttribute('data-ply'), 10));
  });
  graph.addEventListener('click', function(e){
    var box = graph.getBoundingClientRect(), n = review.game.moves.length;
    goTo(Math.round((e.clientX - box.left) / box.width * n));
  });
  $('moments').addEventListener('click', function(e){
    var btn = e.target.closest('.moment');
    if (!btn) return;
    var i = parseInt(btn.getAttribute('data-ply'), 10), mv = review.summary.moves[i];
    goTo(i);
    tryOut(mv.best);
  });
  $('againBtn').addEventListener('click', leaveReview);
  $('playOnBtn').addEventListener('click', togglePlayOn);
  $('altUndoBtn').addEventListener('click', takeBack);
  $('altBackBtn').addEventListener('click', backToGame);
  $('retryBtn').addEventListener('click', work);

  window.addEventListener('resize', resize);
  if (compactMQ.addEventListener) compactMQ.addEventListener('change', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  var saved = window.bdnixSave.load('chess');
  if (saved && !restore(saved)) window.bdnixSave.clear('chess');
  render();
  updateHud();
  resize();
})();
