// Chess rules: the board, every legal move, check, checkmate and the draws,
// move names (SAN) and the FEN and UCI notation the engine (Stockfish)
// speaks. No DOM, so it can be unit tested.
//
// Squares are numbered 0 to 63 from a8 to h1, row by row as the board looks
// from White's side. A piece is one letter as in FEN: upper case for White
// (P N B R Q K), lower case for Black, and '' for an empty square.
(function(){
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var FILES = 'abcdefgh';
  var VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  var PROMOTIONS = ['q', 'r', 'b', 'n'];

  // Steps as [rows, files].
  var KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  // Castling: the king's and rook's squares for each right.
  var CASTLE = {
    K: { king: 60, to: 62, rook: 63, rookTo: 61, empty: [61, 62], safe: [60, 61, 62] },
    Q: { king: 60, to: 58, rook: 56, rookTo: 59, empty: [57, 58, 59], safe: [60, 59, 58] },
    k: { king: 4, to: 6, rook: 7, rookTo: 5, empty: [5, 6], safe: [4, 5, 6] },
    q: { king: 4, to: 2, rook: 0, rookTo: 3, empty: [1, 2, 3], safe: [4, 3, 2] }
  };
  // The right lost when anything moves from or to each corner.
  var CORNER = { 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };

  function at(r, f){ return r >= 0 && r < 8 && f >= 0 && f < 8 ? r * 8 + f : -1; }
  function name(sq){ return FILES[sq & 7] + (8 - (sq >> 3)); }
  function square(s){
    return /^[a-h][1-8]$/.test(s) ? (8 - Number(s[1])) * 8 + FILES.indexOf(s[0]) : -1;
  }
  function colorOf(p){ return p === p.toUpperCase() ? 'w' : 'b'; }
  function other(c){ return c === 'w' ? 'b' : 'w'; }
  function piece(c, t){ return c === 'w' ? t.toUpperCase() : t; }

  // ---------- FEN ----------
  // A position from FEN, or null if it isn't one we can play from: eight rows
  // of eight squares, one king a side, no pawns on the first or last row.
  function parseFen(fen){
    var parts = String(fen).trim().split(/\s+/);
    if (parts.length !== 6) return null;
    var rows = parts[0].split('/'), board = [];
    if (rows.length !== 8) return null;
    for (var r = 0; r < 8; r++) {
      var n = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i];
        if (/[1-8]/.test(ch)) { for (var k = 0; k < Number(ch); k++) board.push(''); n += Number(ch); }
        else if (/[pnbrqkPNBRQK]/.test(ch)) { board.push(ch); n++; }
        else return null;
      }
      if (n !== 8) return null;
    }
    if (count(board, 'K') !== 1 || count(board, 'k') !== 1) return null;
    for (var f = 0; f < 8; f++) {
      if (/p/i.test(board[f]) || /p/i.test(board[56 + f])) return null;
    }
    if (!/^[wb]$/.test(parts[1]) || !/^(-|K?Q?k?q?)$/.test(parts[2]) || !parts[2]) return null;
    var ep = parts[3] === '-' ? -1 : square(parts[3]);
    if (ep < 0 && parts[3] !== '-') return null;
    if (ep >= 0 && (ep >> 3) !== (parts[1] === 'w' ? 2 : 5)) return null;
    if (!/^\d+$/.test(parts[4]) || !/^[1-9]\d*$/.test(parts[5])) return null;
    var castle = parts[2] === '-' ? '' : parts[2];
    // A right only counts while its king and rook are still at home.
    castle = castle.split('').filter(function(c){
      var s = CASTLE[c];
      return board[s.king] === piece(c === c.toUpperCase() ? 'w' : 'b', 'k') && board[s.rook] === piece(c === c.toUpperCase() ? 'w' : 'b', 'r');
    }).join('');
    return { board: board, turn: parts[1], castle: castle, ep: ep, half: Number(parts[4]), full: Number(parts[5]) };
  }
  function count(board, p){
    var n = 0;
    for (var i = 0; i < 64; i++) if (board[i] === p) n++;
    return n;
  }

  function toFen(pos){
    return placement(pos.board) + ' ' + pos.turn + ' ' + (pos.castle || '-') + ' ' +
      (pos.ep >= 0 ? name(pos.ep) : '-') + ' ' + pos.half + ' ' + pos.full;
  }
  function placement(board){
    var rows = [];
    for (var r = 0; r < 8; r++) {
      var s = '', empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = board[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        s += p;
      }
      rows.push(s + (empty || ''));
    }
    return rows.join('/');
  }

  // ---------- Attacks ----------
  // Whether side `by` attacks square `sq`.
  function attacked(board, sq, by){
    var r = sq >> 3, f = sq & 7, i, s, d;
    // A white pawn attacks the row above it, a black pawn the row below.
    var pr = by === 'w' ? r + 1 : r - 1, pawn = piece(by, 'p');
    if (board[at(pr, f - 1)] === pawn || board[at(pr, f + 1)] === pawn) return true;
    for (i = 0; i < 8; i++) {
      if (board[at(r + KNIGHT[i][0], f + KNIGHT[i][1])] === piece(by, 'n')) return true;
      if (board[at(r + KING[i][0], f + KING[i][1])] === piece(by, 'k')) return true;
    }
    function slides(dirs, a, b){
      for (var j = 0; j < 4; j++) {
        d = dirs[j];
        for (var k = 1; ; k++) {
          s = at(r + d[0] * k, f + d[1] * k);
          if (s < 0) break;
          if (board[s]) {
            if (board[s] === a || board[s] === b) return true;
            break;
          }
        }
      }
      return false;
    }
    return slides(ROOK, piece(by, 'r'), piece(by, 'q')) || slides(BISHOP, piece(by, 'b'), piece(by, 'q'));
  }

  function kingOf(board, c){ return board.indexOf(piece(c, 'k')); }
  function inCheck(pos){ return attacked(pos.board, kingOf(pos.board, pos.turn), other(pos.turn)); }

  // ---------- Moves ----------
  // A move: from and to squares, the piece that moves, what it takes ('' for
  // nothing), the piece a pawn becomes (lower case, or ''), and whether it's
  // castling ('K', 'Q', 'k' or 'q') or an en passant capture.
  function mv(pos, from, to, extra){
    var m = { from: from, to: to, piece: pos.board[from], captured: pos.board[to], promo: '', castle: '', ep: false };
    for (var k in extra) m[k] = extra[k];
    return m;
  }

  // Every move the side to move could make if its own king's safety didn't matter.
  function pseudo(pos){
    var b = pos.board, c = pos.turn, list = [];
    function add(from, to){
      var t = b[to];
      if (t && colorOf(t) === c) return false;
      list.push(mv(pos, from, to));
      return !t;
    }
    for (var sq = 0; sq < 64; sq++) {
      var p = b[sq];
      if (!p || colorOf(p) !== c) continue;
      var r = sq >> 3, f = sq & 7, t = p.toLowerCase(), i, s;
      if (t === 'p') pawnMoves(pos, sq, list);
      else if (t === 'n' || t === 'k') {
        var steps = t === 'n' ? KNIGHT : KING;
        for (i = 0; i < 8; i++) {
          s = at(r + steps[i][0], f + steps[i][1]);
          if (s >= 0) add(sq, s);
        }
      } else {
        var dirs = t === 'r' ? ROOK : t === 'b' ? BISHOP : ROOK.concat(BISHOP);
        for (i = 0; i < dirs.length; i++) {
          for (var k = 1; ; k++) {
            s = at(r + dirs[i][0] * k, f + dirs[i][1] * k);
            if (s < 0 || !add(sq, s)) break;
          }
        }
      }
    }
    // Castling: the king and rook at home with the right still held, nothing
    // between them, and the king not in, through or into check.
    var rights = c === 'w' ? ['K', 'Q'] : ['k', 'q'];
    rights.forEach(function(right){
      var cs = CASTLE[right];
      if (pos.castle.indexOf(right) < 0 || b[cs.king] !== piece(c, 'k') || b[cs.rook] !== piece(c, 'r')) return;
      if (cs.empty.some(function(e){ return b[e]; })) return;
      if (cs.safe.some(function(e){ return attacked(b, e, other(c)); })) return;
      list.push(mv(pos, cs.king, cs.to, { castle: right }));
    });
    return list;
  }

  function pawnMoves(pos, sq, list){
    var b = pos.board, c = pos.turn, r = sq >> 3, f = sq & 7;
    var dir = c === 'w' ? -1 : 1, home = c === 'w' ? 6 : 1, last = c === 'w' ? 0 : 7;
    function push(to, extra){
      if ((to >> 3) === last) {
        PROMOTIONS.forEach(function(p){
          var m = mv(pos, sq, to, extra);
          m.promo = p;
          list.push(m);
        });
      } else list.push(mv(pos, sq, to, extra));
    }
    var one = at(r + dir, f);
    if (one >= 0 && !b[one]) {
      push(one);
      var two = at(r + 2 * dir, f);
      if (r === home && !b[two]) push(two);
    }
    [f - 1, f + 1].forEach(function(cf){
      var to = at(r + dir, cf);
      if (to < 0) return;
      if (b[to] && colorOf(b[to]) !== c) push(to);
      else if (to === pos.ep && !b[to]) push(to, { ep: true, captured: piece(other(c), 'p') });
    });
  }

  // The position after a move (the one passed in is left as it was).
  function make(pos, m){
    var b = pos.board.slice(), c = pos.turn;
    b[m.to] = m.promo ? piece(c, m.promo) : m.piece;
    b[m.from] = '';
    if (m.ep) b[(m.from & ~7) + (m.to & 7)] = '';
    if (m.castle) {
      var cs = CASTLE[m.castle];
      b[cs.rookTo] = b[cs.rook];
      b[cs.rook] = '';
    }
    var castle = pos.castle;
    if (m.piece.toLowerCase() === 'k') castle = castle.replace(c === 'w' ? /[KQ]/g : /[kq]/g, '');
    if (CORNER[m.from]) castle = castle.replace(CORNER[m.from], '');
    if (CORNER[m.to]) castle = castle.replace(CORNER[m.to], '');
    var pawn = m.piece.toLowerCase() === 'p';
    return {
      board: b,
      turn: other(c),
      castle: castle,
      ep: pawn && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1,
      half: pawn || m.captured ? 0 : pos.half + 1,
      full: pos.full + (c === 'b' ? 1 : 0)
    };
  }

  // Every legal move: the ones that don't leave the mover's own king in check.
  function moves(pos){
    var c = pos.turn;
    return pseudo(pos).filter(function(m){
      var next = make(pos, m);
      return !attacked(next.board, kingOf(next.board, c), other(c));
    });
  }

  // ---------- Notation ----------
  function uci(m){ return name(m.from) + name(m.to) + m.promo; }

  // The legal move written in UCI (e2e4, e7e8q), or null.
  function findMove(pos, s){
    var list = moves(pos);
    for (var i = 0; i < list.length; i++) if (uci(list[i]) === s) return list[i];
    return null;
  }

  // The move's name in standard algebraic notation, as in Nf3, exd5, O-O, e8=Q+ or Qh4#.
  function san(pos, m){
    var s;
    if (m.castle) s = m.castle.toLowerCase() === 'k' ? 'O-O' : 'O-O-O';
    else {
      var t = m.piece.toLowerCase();
      var capture = m.captured ? 'x' : '';
      if (t === 'p') s = (capture ? FILES[m.from & 7] + 'x' : '') + name(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      else {
        // Another piece of the same kind that could go to the same square:
        // say which one by its file, else its rank, else both.
        var rivals = moves(pos).filter(function(o){ return o.piece === m.piece && o.to === m.to && o.from !== m.from; });
        var from = '';
        if (rivals.length) {
          var sameFile = rivals.some(function(o){ return (o.from & 7) === (m.from & 7); });
          var sameRank = rivals.some(function(o){ return (o.from >> 3) === (m.from >> 3); });
          if (!sameFile) from = FILES[m.from & 7];
          else if (!sameRank) from = name(m.from)[1];
          else from = name(m.from);
        }
        s = t.toUpperCase() + from + capture + name(m.to);
      }
    }
    var next = make(pos, m);
    if (inCheck(next)) s += moves(next).length ? '+' : '#';
    return s;
  }

  // ---------- A game ----------
  // A game is the list of positions from the start and the moves between them.
  // It starts from the usual position, or from a FEN (`start` keeps it).
  function newGame(fen){
    var pos = parseFen(fen || START);
    if (!pos) return null;
    return { positions: [pos], moves: [], start: fen && fen !== START ? toFen(pos) : null };
  }
  function current(game){ return game.positions[game.positions.length - 1]; }

  // Plays a move written in UCI. Returns the move (with its name, `san`), or
  // null if it isn't legal.
  function play(game, s){
    var pos = current(game), m = findMove(pos, s);
    if (!m) return null;
    m.san = san(pos, m);
    game.moves.push(m);
    game.positions.push(make(pos, m));
    return m;
  }
  // Takes back the last move; returns it, or null at the start.
  function undo(game){
    if (!game.moves.length) return null;
    game.positions.pop();
    return game.moves.pop();
  }

  // What makes a position the same for repetition: the pieces, whose turn it
  // is, the castling rights, and an en passant square only if it can be used.
  function key(pos){
    var ep = pos.ep >= 0 && moves(pos).some(function(m){ return m.ep; }) ? name(pos.ep) : '-';
    return placement(pos.board) + ' ' + pos.turn + ' ' + (pos.castle || '-') + ' ' + ep;
  }

  // Neither side can ever mate: kings alone, a king and one knight or bishop
  // against a king, or only bishops that all stand on the same colour.
  function insufficient(board){
    var rest = [];
    for (var i = 0; i < 64; i++) {
      if (board[i] && board[i].toLowerCase() !== 'k') rest.push(i);
    }
    if (!rest.length) return true;
    if (rest.length === 1 && /[nb]/i.test(board[rest[0]])) return true;
    var shade = function(sq){ return ((sq >> 3) + (sq & 7)) % 2; };
    return rest.every(function(sq){ return /b/i.test(board[sq]) && shade(sq) === shade(rest[0]); });
  }

  // How the game stands: whose turn, whether they're in check, and once it's
  // over, how it ended ('checkmate', 'stalemate', 'repetition', 'fifty' or
  // 'material') and who won ('w', 'b', or null for a draw).
  function status(game){
    var pos = current(game), check = inCheck(pos), res = null, winner = null;
    if (!moves(pos).length) {
      res = check ? 'checkmate' : 'stalemate';
      if (check) winner = other(pos.turn);
    } else if (insufficient(pos.board)) res = 'material';
    else if (pos.half >= 100) res = 'fifty';
    else {
      var k = key(pos), seen = 0;
      game.positions.forEach(function(p){ if (key(p) === k) seen++; });
      if (seen >= 3) res = 'repetition';
    }
    return { turn: pos.turn, check: check, over: !!res, result: res, winner: winner };
  }

  // What each side has taken (lower case, most valuable first) and how far
  // ahead White is in material (negative when Black is ahead). Promotions
  // count, so it's worked out from the pieces on the board.
  function material(game){
    var taken = { w: [], b: [] }, diff = 0, board = current(game).board;
    game.moves.forEach(function(m){
      if (m.captured) taken[colorOf(m.piece)].push(m.captured.toLowerCase());
    });
    var order = 'qrbnp';
    ['w', 'b'].forEach(function(c){
      taken[c].sort(function(a, b){ return order.indexOf(a) - order.indexOf(b); });
    });
    for (var i = 0; i < 64; i++) {
      var p = board[i];
      if (p) diff += (colorOf(p) === 'w' ? 1 : -1) * VALUE[p.toLowerCase()];
    }
    return { w: taken.w, b: taken.b, diff: diff };
  }

  // How many positions are reached in `depth` moves: the standard check
  // that move generation is right.
  function perft(pos, depth){
    if (!depth) return 1;
    var list = moves(pos);
    if (depth === 1) return list.length;
    var n = 0;
    for (var i = 0; i < list.length; i++) n += perft(make(pos, list[i]), depth - 1);
    return n;
  }

  // The UCI command that sets up the position after the first `ply` moves
  // (all of them if `ply` is left out).
  function positionCommand(game, ply){
    var list = game.moves.slice(0, ply === undefined ? game.moves.length : ply).map(uci).join(' ');
    return 'position ' + (game.start ? 'fen ' + game.start : 'startpos') + (list ? ' moves ' + list : '');
  }

  // ---------- Reading a game: PGN, or just its moves ----------
  // A tag pair, as in [White "Ann"].
  var TAG = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]$/;
  // The first game in a PGN file, or in a text file that only lists moves
  // (SAN as in "1. e4 e5 2. Nf3", or UCI as in "e2e4 e7e5"). Tags, comments,
  // variations, annotations and move numbers are read past. Returns
  // { game, tags, result } or { error }.
  function parsePgn(text){
    text = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var tags = {}, lines = text.split('\n'), moveText = [], started = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var tag = TAG.exec(line);
      if (tag) {
        if (started) break;                 // the next game's tags
        tags[tag[1]] = tag[2].replace(/\\(.)/g, '$1');
        continue;
      }
      if (/^%/.test(line)) continue;        // an escaped line
      if (line) { moveText.push(line); started = true; }
    }
    var body = moveText.join('\n')
      .replace(/\{[^}]*\}/g, ' ')            // {comments}
      .replace(/;[^\n]*/g, ' ');             // ; comments to the end of the line
    // (variations), which can hold variations of their own.
    var depth = 0, flat = '';
    for (i = 0; i < body.length; i++) {
      var ch = body[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (!depth) flat += ch;
    }
    var result = tags.Result && /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tags.Result) ? tags.Result : '*';
    var tokens = flat.replace(/\$\d+/g, ' ').replace(/(\d+)\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean);
    var game = newGame(tags.SetUp !== '0' && tags.FEN ? tags.FEN : null);
    if (!game) return { error: 'The starting position (FEN) isn’t one that can be played.' };
    for (i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(t)) {
        result = t === '½-½' ? '1/2-1/2' : t;
        break;
      }
      var pos = current(game), m = readMove(pos, t);
      if (!m) {
        var n = pos.full + (pos.turn === 'w' ? '. ' : '... ');
        return { error: 'Move ' + n + t + ' isn’t a legal move there.' };
      }
      play(game, uci(m));
    }
    if (!game.moves.length) return { error: 'There are no moves in it.' };
    return { game: game, tags: tags, result: result };
  }
  // The games in a file of several (a PGN database), without reading their
  // moves: each game's tags and its text, for parsePgn once one is picked.
  // A game starts at its first tag, or at moves with no tags before them;
  // tags with no moves after them aren't a game.
  function splitPgn(text){
    var lines = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    var games = [], cur = null, moves = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim(), tag = TAG.exec(line);
      if ((tag && (!cur || moves)) || (!cur && line && !/^%/.test(line))) {
        cur = { tags: {}, lines: [], moves: false };
        games.push(cur);
        moves = false;
      }
      if (!cur) continue;
      if (tag) cur.tags[tag[1]] = tag[2].replace(/\\(.)/g, '$1');
      else if (line && !/^%/.test(line)) moves = cur.moves = true;
      cur.lines.push(lines[i]);
    }
    return games.filter(function(g){ return g.moves; }).map(function(g){
      return { tags: g.tags, text: g.lines.join('\n') };
    });
  }

  // The legal move a token from a game file stands for: its SAN, give or take
  // check marks, annotations, 0-0 for O-O and e8Q for e8=Q; or its UCI.
  function readMove(pos, t){
    var want = bare(t), list = moves(pos);
    if (!want) return null;
    for (var i = 0; i < list.length; i++) {
      if (bare(san(pos, list[i])) === want) return list[i];
    }
    // A move given with more detail than it needed (Ngf3 for Nf3).
    var full = /^([NBRQK])([a-h])?([1-8])?x?([a-h][1-8])$/.exec(want);
    if (full) {
      var hits = list.filter(function(m){
        var from = name(m.from);
        return m.piece.toUpperCase() === full[1] && name(m.to) === full[4] &&
          (!full[2] || from[0] === full[2]) && (!full[3] || from[1] === full[3]);
      });
      if (hits.length === 1) return hits[0];
    }
    return findMove(pos, t.toLowerCase());
  }
  function bare(t){
    return t.replace(/[+#!?]+$/, '').replace(/e\.?p\.?$/i, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O')
      .replace(/([a-h][18])=?([NBRQnbrq])$/, function(all, sq, p){ return sq + '=' + p.toUpperCase(); });
  }

  // ---------- Reviewing a game ----------
  // A line of engine output: { depth, cp | mate, best } with the score from
  // the side to move's view, or null for anything else.
  function parseInfo(line){
    var m = /^info .*?\bdepth (\d+)\b.*?\bscore (cp|mate) (-?\d+)/.exec(line);
    if (!m || / (lowerbound|upperbound)\b/.test(line)) return null;
    var pv = / pv (\S+)/.exec(line), r = { depth: Number(m[1]), best: pv ? pv[1] : null };
    r[m[2]] = Number(m[3]);
    return r;
  }

  // An evaluation is { cp } in centipawns or { mate } in moves, from White's
  // view: positive is good for White, mate 3 is White mating in three, and
  // mate 0 is a side already mated (`lost` says which). A mate counts as far
  // more than any lead in material, more the sooner it comes.
  function centipawns(e){
    if (e.mate === undefined) return e.cp;
    if (e.mate === 0) return e.lost === 'w' ? -10000 : 10000;
    return (e.mate > 0 ? 1 : -1) * (10000 - Math.abs(e.mate) * 10);
  }
  // Turns a score from the side to move's view into White's.
  function whiteView(score, turn){
    var e = {}, k = turn === 'w' ? 1 : -1;
    if (score.mate !== undefined) {
      e.mate = score.mate * k;
      if (score.mate === 0) { e.mate = 0; e.lost = turn; }
    } else e.cp = score.cp * k;
    return e;
  }
  // White's winning chances from -1 (lost) to 1 (won), as lichess reckons them.
  function chances(e){
    var cp = Math.max(-1000, Math.min(1000, centipawns(e)));
    return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
  }
  // How well a move kept the mover's chances, from 0 to 100 (lichess's formula).
  function moveAccuracy(before, after){
    var drop = Math.max(0, (before - after) * 50);    // in winning-percentage points
    return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
  }
  // A side's chances of winning, as a percentage from 0 to 100.
  function winChance(e, c){
    return Math.round(50 + 50 * chances(e) * (c === 'w' ? 1 : -1));
  }
  // How a position stands, in words: who mates in how many, or who's ahead
  // and by how much (from White's chances: under 0.1 either way is equal).
  function outlook(e){
    if (e.mate !== undefined) {
      if (e.mate === 0) return (e.lost === 'w' ? 'Black' : 'White') + ' has won';
      return (e.mate > 0 ? 'White' : 'Black') + ' mates in ' + Math.abs(e.mate);
    }
    var c = chances(e), a = Math.abs(c), who = c > 0 ? 'White' : 'Black';
    if (a < 0.1) return 'Equal';
    return who + (a < 0.3 ? ' is slightly better' : a < 0.6 ? ' is better' : ' is winning');
  }
  // An evaluation as people write it: +0.85, -1.20, M3 or -M3, # once mated.
  function formatEval(e){
    if (e.mate !== undefined) return e.mate === 0 ? '#' : (e.mate > 0 ? 'M' : '-M') + Math.abs(e.mate);
    var v = e.cp / 100;
    return (v > 0 ? '+' : '') + v.toFixed(2);
  }

  // The review of a game from the engine's look at each position: evals[i]
  // is the evaluation (White's view) of the position after i moves, with the
  // engine's best move there in UCI (`best`). For every move: its name, how
  // it changed the mover's chances, what kind of move it was ('best', 'good',
  // 'inaccuracy', 'mistake' or 'blunder') and the engine's choice instead;
  // for each side: its accuracy and how many of each slip it made.
  function reviewGame(game, evals){
    var sides = {};
    ['w', 'b'].forEach(function(c){ sides[c] = { accuracy: null, inaccuracy: 0, mistake: 0, blunder: 0, moves: 0, total: 0 }; });
    var list = game.moves.map(function(m, i){
      var before = evals[i], after = evals[i + 1], pos = game.positions[i];
      var c = colorOf(m.piece), k = c === 'w' ? 1 : -1;
      var r = { san: m.san, uci: uci(m), color: c, kind: null, best: null, bestSan: null, loss: null };
      if (!before || !after) return r;
      var lost = (chances(before) - chances(after)) * k;
      r.loss = Math.max(0, lost);
      var bm = before.best && findMove(pos, before.best);
      if (bm) { r.best = before.best; r.bestSan = san(pos, bm); }
      r.kind = r.best === r.uci ? 'best' : lost >= 0.3 ? 'blunder' : lost >= 0.2 ? 'mistake' : lost >= 0.1 ? 'inaccuracy' : 'good';
      var s = sides[c];
      if (s[r.kind] !== undefined) s[r.kind]++;
      s.moves++;
      s.total += moveAccuracy(chances(before) * k, chances(after) * k);
      return r;
    });
    ['w', 'b'].forEach(function(c){
      var s = sides[c];
      s.accuracy = s.moves ? Math.round(s.total / s.moves) : null;
      delete s.total;
    });
    return { moves: list, w: sides.w, b: sides.b };
  }

  // ---------- Openings ----------
  // Well-known openings by their moves (SAN, check marks left off). A game
  // is named after the longest that it starts with.
  var OPENINGS = [
    ['e4', 'King’s Pawn Opening'], ['d4', 'Queen’s Pawn Opening'], ['c4', 'English Opening'],
    ['Nf3', 'Réti Opening'], ['f4', 'Bird’s Opening'], ['b3', 'Nimzo-Larsen Attack'],
    ['e4 e5', 'Open Game'], ['e4 e5 Nf3 Nc6 Bb5', 'Ruy Lopez'], ['e4 e5 Nf3 Nc6 Bb5 a6', 'Ruy Lopez, Morphy Defence'],
    ['e4 e5 Nf3 Nc6 Bb5 Nf6', 'Ruy Lopez, Berlin Defence'], ['e4 e5 Nf3 Nc6 Bc4', 'Italian Game'],
    ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'Italian Game, Giuoco Piano'], ['e4 e5 Nf3 Nc6 Bc4 Bc5 b4', 'Evans Gambit'],
    ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'Two Knights Defence'], ['e4 e5 Nf3 Nc6 d4', 'Scotch Game'],
    ['e4 e5 Nf3 Nc6 Nc3 Nf6', 'Four Knights Game'], ['e4 e5 Nf3 Nf6', 'Petrov’s Defence'],
    ['e4 e5 Nf3 d6', 'Philidor Defence'], ['e4 e5 f4', 'King’s Gambit'], ['e4 e5 Nc3', 'Vienna Game'],
    ['e4 e5 Bc4', 'Bishop’s Opening'], ['e4 e5 d4 exd4 c3', 'Danish Gambit'],
    ['e4 c5', 'Sicilian Defence'], ['e4 c5 Nc3', 'Sicilian Defence, Closed'], ['e4 c5 c3', 'Sicilian Defence, Alapin Variation'],
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian Defence, Najdorf Variation'],
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', 'Sicilian Defence, Dragon Variation'],
    ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5', 'Sicilian Defence, Sveshnikov Variation'],
    ['e4 e6', 'French Defence'], ['e4 e6 d4 d5 e5', 'French Defence, Advance Variation'],
    ['e4 e6 d4 d5 Nd2', 'French Defence, Tarrasch Variation'], ['e4 e6 d4 d5 Nc3 Bb4', 'French Defence, Winawer Variation'],
    ['e4 c6', 'Caro-Kann Defence'], ['e4 c6 d4 d5 e5', 'Caro-Kann Defence, Advance Variation'],
    ['e4 d5', 'Scandinavian Defence'], ['e4 d6', 'Pirc Defence'], ['e4 g6', 'Modern Defence'], ['e4 Nf6', 'Alekhine’s Defence'],
    ['d4 d5', 'Closed Game'], ['d4 d5 c4', 'Queen’s Gambit'], ['d4 d5 c4 e6', 'Queen’s Gambit Declined'],
    ['d4 d5 c4 dxc4', 'Queen’s Gambit Accepted'], ['d4 d5 c4 c6', 'Slav Defence'],
    ['d4 d5 Bf4', 'London System'], ['d4 d5 Nf3 Nf6 Bf4', 'London System'], ['d4 Nf6 Bf4', 'London System'],
    ['d4 Nf6', 'Indian Defence'], ['d4 Nf6 Bg5', 'Trompowsky Attack'],
    ['d4 Nf6 c4 g6 Nc3 Bg7', 'King’s Indian Defence'], ['d4 Nf6 c4 g6 Nc3 d5', 'Grünfeld Defence'],
    ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian Defence'], ['d4 Nf6 c4 e6 Nf3 b6', 'Queen’s Indian Defence'],
    ['d4 Nf6 c4 e6 g3', 'Catalan Opening'], ['d4 Nf6 c4 c5', 'Benoni Defence'], ['d4 Nf6 c4 c5 d5 b5', 'Benko Gambit'],
    ['d4 f5', 'Dutch Defence'], ['c4 e5', 'English Opening, Reversed Sicilian'], ['c4 c5', 'English Opening, Symmetrical Variation']
  ].map(function(o){ return { moves: o[0].split(' '), name: o[1] }; });
  // The opening a game from the usual start played, or null.
  function opening(game){
    if (game.start) return null;
    var found = null;
    OPENINGS.forEach(function(o){
      if (o.moves.length > game.moves.length || (found && found.moves.length >= o.moves.length)) return;
      for (var i = 0; i < o.moves.length; i++) {
        if (game.moves[i].san.replace(/[+#]$/, '') !== o.moves[i]) return;
      }
      found = o;
    });
    return found && found.name;
  }

  // ---------- Writing a game ----------
  // A game as PGN: the seven usual tags (unknown ones as "?"), any others
  // given, the set-up position if it didn't start from the usual one, and
  // the moves, in lines of at most 80 characters.
  function toPgn(game, tags, result){
    var t = {}, k, lines = [], words = [], line = '';
    var roster = { Event: '?', Site: '?', Date: '????.??.??', Round: '?', White: '?', Black: '?' };
    for (k in roster) t[k] = roster[k];
    for (k in tags || {}) if (tags[k]) t[k] = tags[k];
    t.Result = result || t.Result || '*';
    if (game.start) { t.SetUp = '1'; t.FEN = game.start; }
    var order = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
    for (k in t) if (order.indexOf(k) < 0) order.push(k);
    order.forEach(function(k){ lines.push('[' + k + ' "' + String(t[k]).replace(/[\\"]/g, '\\$&') + '"]'); });
    game.moves.forEach(function(m, i){
      var pos = game.positions[i];
      if (pos.turn === 'w') words.push(pos.full + '.');
      else if (!i) words.push(pos.full + '...');
      words.push(m.san);
    });
    words.push(t.Result);
    var text = [];
    words.forEach(function(w){
      if (line && line.length + 1 + w.length > 80) { text.push(line); line = w; }
      else line = line ? line + ' ' + w : w;
    });
    text.push(line);
    return lines.join('\n') + '\n\n' + text.join('\n') + '\n';
  }

  window.bdnixChess = {
    START: START, VALUE: VALUE,
    name: name, square: square, colorOf: colorOf, other: other,
    parseFen: parseFen, toFen: toFen,
    attacked: attacked, inCheck: inCheck, moves: moves, make: make,
    uci: uci, findMove: findMove, san: san,
    newGame: newGame, current: current, play: play, undo: undo,
    key: key, insufficient: insufficient, status: status, material: material, perft: perft,
    positionCommand: positionCommand, parsePgn: parsePgn, splitPgn: splitPgn, readMove: readMove,
    parseInfo: parseInfo, whiteView: whiteView, centipawns: centipawns, chances: chances,
    moveAccuracy: moveAccuracy, winChance: winChance, outlook: outlook, formatEval: formatEval, reviewGame: reviewGame,
    opening: opening, toPgn: toPgn
  };
})();
