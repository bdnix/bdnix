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
  var MAX_FILE = 1024 * 1024;     // a game file bigger than this isn't a game
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
  // answers, and the lines before them, are ignored.
  var engine = null, job = null, stale = 0;
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
    cmds.forEach(post);
  }
  function cancel(){
    if (!job) return;
    job = null;
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
    if (stale) { stale--; return; }
    var j = job;
    job = null;
    if (j) j.done(m[1]);
  }
  // The worker couldn't be loaded: a game pauses (Resume tries again), and a
  // review says so with a button to try again.
  function engineFailed(){
    if (engine) { try { engine.terminate(); } catch (e) {} }
    engine = null; job = null; stale = 0;
    if (state === 'playing') pause(OFFLINE);
    else if (state === 'paused') ovText.textContent = OFFLINE;
    else if (state === 'review') refreshReview();
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
      text: (st.result === 'checkmate' ? 'Checkmate — ' + COLOR[st.winner] + ' wins' : ENDINGS[st.result]) +
        ' · Level ' + lv + (record ? ' — your best yet!' : ''),
      side: side, back: 'start', again: 'Play again'
    });
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
  function mine(sq){
    var p = C.current(game).board[sq];
    return !!p && C.colorOf(p) === side;
  }
  function myTurn(){ return state === 'playing' && C.current(game).turn === side && !job; }
  function targets(from){
    return C.moves(C.current(game)).filter(function(m){ return m.from === from; });
  }

  // A press on a square: picks up a piece of yours, or puts the one picked
  // up down where it can go.
  function pick(sq){
    if (!myTurn()) return;
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
      b.innerHTML = pieceSvg(side === 'w' ? t.toUpperCase() : t);
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
  // (ply), which way up the board is (side), the words at the top (info),
  // and where "back" goes: the start screen, or the game paused before a
  // file was opened.
  function startReview(g, info){
    cancel();
    closePromo();
    state = 'review';
    review = { game: g, evals: [], next: 0, ply: g.moves.length, side: info.side, info: info, summary: null };
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
    buildMoveList();
    resize();
    render();
    updateHud();
    refreshReview();
    persist();
    analyse();
  }
  function closeReview(){
    if (!review) return;
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

  // Looks at each position in turn, one search each, until all are done.
  // A position with no moves left needs no engine: mate or a draw.
  function analyse(){
    var r = review;
    if (!r || job) return;
    var last = r.game.positions.length - 1;
    while (r.next <= last) {
      var i = r.next, pos = r.game.positions[i], st = C.status(upTo(r.game, i));
      if (!C.moves(pos).length || (i === last && st.over)) {
        r.evals[i] = st.result === 'checkmate' ? { mate: 0, lost: pos.turn } : { cp: 0 };
        r.next++;
        continue;
      }
      startEngine();
      if (!engine) { refreshReview(); return; }
      var heard = null;
      search({
        info: function(inf){ heard = inf; },
        done: function(uci){
          if (review !== r) return;
          var e = C.whiteView(heard || { cp: 0 }, pos.turn);
          e.best = uci !== '(none)' ? uci : heard && heard.best;
          r.evals[i] = e;
          r.next++;
          refreshReview();
          analyse();
        }
      }, ['setoption name Skill Level value 20', C.positionCommand(r.game, i), 'go depth ' + REVIEW_DEPTH]);
      refreshReview();
      return;
    }
    refreshReview();
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
    drawGraph();
  }

  // What the review says about the move shown: its evaluation, what kind of
  // move it was, and what the engine would have played.
  function showMove(){
    var r = review, ply = r.ply, e = r.evals[ply];
    $('evalNow').textContent = e ? C.formatEval(e) : '…';
    var text;
    if (!ply) text = 'The starting position.';
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
    $('firstBtn').disabled = $('prevBtn').disabled = ply === 0;
    $('nextBtn').disabled = $('lastBtn').disabled = ply === r.game.moves.length;
  }

  function goTo(ply){
    var r = review;
    if (!r) return;
    ply = Math.max(0, Math.min(r.game.moves.length, ply));
    animate = ply === r.ply + 1 ? r.game.moves[ply - 1] : null;
    r.ply = ply;
    render();
    updateHud();
    refreshReview();
    var on = moveBtns[ply - 1];
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
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

  // ---------- Opening a game file ----------
  function importError(text){
    (state === 'review' ? reviewMsg : ovMsg).textContent = text;
  }
  function openFile(file){
    if (!file) return;
    if (file.size > MAX_FILE) { importError(file.name + ' is too big to be a game (over 1 MB).'); return; }
    file.text().then(function(text){
      var r = C.parsePgn(text);
      if (r.error) { importError('Couldn’t read a game from ' + file.name + '. ' + r.error); return; }
      openGame(r, file.name);
    }, function(){ importError('Couldn’t read ' + file.name + '.'); });
  }
  // Reviews a game read from a file. A game paused before is kept, and
  // "Back to your game" returns to it.
  function openGame(r, fileName){
    var g = r.game, t = r.tags, st = C.status(g), paused = state === 'paused' || (review && review.info.back === 'paused');
    var outcome = r.result !== '*' ? RESULTS[r.result]
      : st.result === 'checkmate' ? 'Checkmate — ' + COLOR[st.winner] + ' wins'
      : st.over ? ENDINGS[st.result] : RESULTS['*'];
    var about = [outcome, t.Event && t.Event !== '?' ? t.Event : '', t.Date && !/\?/.test(t.Date) ? t.Date : '', g.moves.length + (g.moves.length === 1 ? ' move' : ' moves')];
    startReview(g, {
      kicker: fileName,
      title: (t.White && t.White !== '?' ? t.White : 'White') + ' vs ' + (t.Black && t.Black !== '?' ? t.Black : 'Black'),
      text: about.filter(Boolean).join(' · '),
      side: 'w', back: paused ? 'paused' : 'start', again: paused ? 'Back to your game' : 'Play a game'
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
    return review ? upTo(review.game, review.ply) : game;
  }

  function render(){
    var g = shown(), pos = C.current(g), last = g.moves[g.moves.length - 1];
    var check = C.inCheck(pos) ? pos.board.indexOf(pos.turn === 'w' ? 'K' : 'k') : -1;
    var to = selected >= 0 ? targets(selected) : [];
    // In a review, the engine's choice in the position shown.
    var e = review && review.evals[review.ply], hint = e && e.best && C.findMove(pos, e.best);
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
      text = st.result === 'checkmate' ? 'Checkmate — ' + COLOR[st.winner] + ' wins' : st.over ? ENDINGS[st.result] : st.check ? 'Check!' : 'Reviewing';
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
  var NAV = {
    ArrowLeft: function(){ return review.ply - 1; }, ArrowRight: function(){ return review.ply + 1; },
    Home: function(){ return 0; }, End: function(){ return review.game.moves.length; }
  };
  document.addEventListener('keydown', function(e){
    if (e.code === 'Escape' && !promoEl.hidden) { closePromo(); e.preventDefault(); return; }
    if (e.target === levelEl) return;
    if (state === 'review') {
      if (NAV[e.key]) { goTo(NAV[e.key]()); e.preventDefault(); }
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && !overlay.hidden && document.activeElement === document.body) {
      startOrResume(); e.preventDefault();
    }
  });
  window.bdnixUpright.onTurn(function(){ pause(); });

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
    btn.addEventListener('click', function(){ fileEl.click(); });
  });
  fileEl.addEventListener('change', function(){
    var file = fileEl.files[0];
    fileEl.value = '';
    openFile(file);
  });

  // The review's buttons, moves and graph.
  $('firstBtn').addEventListener('click', function(){ goTo(0); });
  $('prevBtn').addEventListener('click', function(){ goTo(review.ply - 1); });
  $('nextBtn').addEventListener('click', function(){ goTo(review.ply + 1); });
  $('lastBtn').addEventListener('click', function(){ goTo(review.game.moves.length); });
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
  $('againBtn').addEventListener('click', leaveReview);
  $('retryBtn').addEventListener('click', analyse);

  window.addEventListener('resize', resize);
  if (compactMQ.addEventListener) compactMQ.addEventListener('change', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  var saved = window.bdnixSave.load('chess');
  if (saved && !restore(saved)) window.bdnixSave.clear('chess');
  render();
  updateHud();
  resize();
})();
