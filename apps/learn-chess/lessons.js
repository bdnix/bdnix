(function(){
  // The courses Learn Chess teaches, easiest first. Each is a set of lines
  // from the usual start: every move in standard notation (SAN, as
  // chess-core.js writes it) with a sentence on why it's played, and what to
  // aim for once the line ends. The words are for someone who has never
  // learned an opening: no notation and no chess jargon, every piece and
  // square named, and the reason for each move in plain words. (The page
  // says which piece moved where; a note says why.) The learner plays
  // `side`; the other side's moves are played for them. Lines that start the
  // same way share those moves, so the same words explain them. Every line
  // was checked with Stockfish: the learner's moves are all sound, and a
  // line that teaches a trap says so. learn-core.js checks every move is
  // legal (see its unit tests).

  var CASTLE = 'Castle! In this special move your king steps two squares towards the rook, and the rook jumps over to the king’s other side. Your king is now tucked away safely behind its pawns.';

  var ITALIAN = [
    ['e4', 'Start by pushing the pawn in front of your king two squares. It grabs space in the middle of the board, and opens a path for your queen and one of your bishops.'],
    ['e5', 'Black does exactly the same, so both sides have a pawn in the middle.'],
    ['Nf3', 'Bring out a knight. Knights jump in an L shape, and from here it attacks Black’s pawn on e5. Knights are strongest near the middle of the board.'],
    ['Nc6', 'Black brings out a knight too, to protect the pawn on e5.'],
    ['Bc4', 'Bring out your bishop. Bishops move along slanting lines, and this one points at f7: a weak square next to Black’s king, guarded only by the king itself.']
  ];

  var LONDON = [
    ['d4', 'Push the pawn in front of your queen two squares. Unlike a pawn on e4, this one is already protected, by your queen.']
  ];
  var LONDON_D5 = LONDON.concat([
    ['d5', 'Black blocks it with a pawn of their own. Now neither pawn can move forward.'],
    ['Bf4', 'The key move of the London System: bring this bishop out now, before your next pawn move blocks it in.']
  ]);

  var SCANDI = [
    ['e4', 'White starts by pushing the pawn in front of their king two squares.'],
    ['d5', 'Attack it straight away with the pawn in front of your queen. From the very first move, the game goes your way.']
  ];
  var SCANDI_TAKE = SCANDI.concat([
    ['exd5', 'White takes your pawn.'],
    ['Qxd5', 'Take back with your queen. Bringing the queen out early is usually risky, but here White can’t easily chase her into trouble.']
  ]);

  var QGD = [
    ['d4', 'White starts by pushing the pawn in front of their queen two squares.'],
    ['d5', 'Do the same. The two pawns now block each other, so neither side owns the middle.'],
    ['c4', 'White offers you a pawn. This is the Queen’s Gambit (a gambit means offering something to get an advantage): White hopes you’ll take it and give up the middle.'],
    ['e6', 'Don’t take it. This pawn move protects your pawn on d5, so if White takes it, you can take back. It also opens a path for one of your bishops.'],
    ['Nc3', 'White brings out a knight, which attacks your pawn on d5 a second time.'],
    ['Nf6', 'Bring out a knight. It protects d5 once more.']
  ];

  window.bdnixCourses = [
    {
      id: 'italian', name: 'Italian Game', side: 'w', level: 1,
      about: 'Take the middle, bring out your pieces, castle. The perfect first opening.',
      intro: 'One of the oldest and friendliest openings. Playing White, you follow three simple rules: put a pawn in the middle of the board, bring out your knights and bishops, and castle to keep your king safe.',
      lines: [
        {
          id: 'giuoco-piano', name: 'The calm main line',
          moves: ITALIAN.concat([
            ['Bc5', 'Black copies you: their bishop now points at f2, the weak square next to your king.'],
            ['c3', 'A quiet pawn move with a plan. It gets ready to push your pawn from d2 to d4 later, and it stops Black’s knight from settling on d4.'],
            ['Nf6', 'Black brings out their other knight. It attacks your pawn on e4.'],
            ['d3', 'Protect the pawn on e4 by moving the pawn in front of your queen one square. Slow and solid: you’ll push it on to d4 later, when you’re ready.'],
            ['d6', 'Black protects their pawn on e5 the same way. This also opens a path for their other bishop.'],
            ['O-O', CASTLE],
            ['O-O', 'Black castles too, so both kings are safe.'],
            ['Re1', 'Move your rook next to your king’s old square. From there it backs up your pawn on e4, and helps when you push your pawn to d4 later.'],
            ['a6', 'Black makes a little escape square for their bishop, so a pawn can’t trap it.'],
            ['Bb3', 'Step your bishop back one square before Black can chase it with a pawn. From here it still points at f7.'],
            ['Ba7', 'Black tucks their bishop away too.'],
            ['h3', 'A small pawn move next to your king. It stops Black’s bishop coming to g4, where it would pin your knight to your queen (your knight couldn’t move without letting the bishop take your queen).']
          ]),
          end: 'Well done: your king is safe and your pieces are out. What to do next: bring your last knight from b1 to d2, then f1, then g3, close to your king. When everything is ready, push your pawn from d3 to d4 to open up the middle. Improve one piece at a time, and don’t rush.'
        },
        {
          id: 'two-knights', name: 'When Black brings out both knights',
          moves: ITALIAN.concat([
            ['Nf6', 'Black brings out their other knight straight away, and it attacks your pawn on e4. This is called the Two Knights Defence.'],
            ['d3', 'Protect your pawn on e4 by moving the pawn in front of your queen one square. (Attacking with your knight on g5 is possible too, but it starts a wild fight. This keeps things simple.)'],
            ['Be7', 'Black puts their bishop on a quiet, safe square, ready to castle.'],
            ['O-O', CASTLE],
            ['O-O', 'Black castles too.'],
            ['Re1', 'Move your rook next to your king’s old square, behind your pawn on e4.'],
            ['d6', 'Black protects their pawn on e5.'],
            ['c3', 'A useful pawn move. It leaves the square c2 free for your bishop to hide on later, and helps you push your pawn to d4 one day.'],
            ['Na5', 'Black’s knight jumps to the edge of the board to attack your bishop.'],
            ['Bb5', 'Move your bishop out of the way, to b5. (Back on b3, Black’s knight could take it.)'],
            ['a6', 'Black chases your bishop with a pawn.'],
            ['Ba4', 'Step back along the same slanting line.'],
            ['b5', 'Black chases it again with another pawn.'],
            ['Bc2', 'Tuck your bishop away behind your pawns, where Black’s pawns can’t reach it. It will come to life later, once the pawns in front of it move.'],
            ['c5', 'Black pushes a pawn to grab more space on the other side of the board.'],
            ['Nbd2', 'Bring out your last knight. As in the calm main line, it can travel on to f1 and g3, close to your king.']
          ]),
          end: 'Both kings are safe and nearly every piece is out. Your plan: bring your knight on to f1 and then g3, and when the time is right, push your pawn from d3 to d4. Your bishop on c2 wakes up once the pawns in front of it move.'
        },
        {
          id: 'knight-jump', name: 'Don’t fall for the trap',
          moves: ITALIAN.concat([
            ['Nd4', 'Careful, this is a trap! Black’s knight jumps forward, leaving the pawn on e5 unprotected. It looks like a free pawn. It isn’t.'],
            ['Nxd4', 'Swap knights: take Black’s knight. Don’t take the pawn on e5! If your knight takes it, Black’s queen moves to g5 and attacks your knight and your pawn on g2 at once, and if you keep grabbing, Black can checkmate you within a few moves.'],
            ['exd4', 'Black takes back with a pawn.'],
            ['O-O', CASTLE],
            ['Nf6', 'Black brings out a knight, which attacks your pawn on e4.'],
            ['Re1', 'Protect the pawn with your rook. The rook is happy on this line anyway.'],
            ['d6', 'Black opens a path for their bishop.'],
            ['c3', 'Attack Black’s pawn on d4 with your pawn. Once it’s gone, you can build a strong middle.']
          ]),
          end: 'You’re clearly better: your king is safe and your pieces are out, while Black has hardly started and their pawn on d4 is weak. Take that pawn when you can, then bring out your other knight and bishop.'
        }
      ]
    },
    {
      id: 'london', name: 'London System', side: 'w', level: 2,
      about: 'One setup against almost anything Black does. Less to remember.',
      intro: 'In the London System you set up your pieces the same way, whatever Black does: pawns on d4, e3 and c3, your bishop out to f4 early, knights on f3 and d2, then castle. There’s less to remember, so it makes a great second opening.',
      lines: [
        {
          id: 'against-d5', name: 'When Black copies your first move',
          moves: LONDON_D5.concat([
            ['Nf6', 'Black brings out a knight.'],
            ['e3', 'Move the pawn in front of your king one square. It supports your pawn on d4, and opens a path for your other bishop.'],
            ['e6', 'Black does the same: it supports their pawn on d5 and opens a path for their bishop.'],
            ['Nf3', 'Bring out a knight. It watches the square e5, and later it helps guard your king.'],
            ['c5', 'Black attacks your pawn on d4 from the side. This is Black’s usual plan against the London.'],
            ['c3', 'Protect d4 with another pawn. Your pawns on c3, d4 and e3 now make a strong chain that’s very hard to break.'],
            ['Nc6', 'Black puts more pressure on your pawn on d4.'],
            ['Nbd2', 'Bring out your other knight, to d2 (your pawn already stands on c3). From d2 it watches the squares e4 and c4.'],
            ['Bd6', 'Black offers to swap bishops.'],
            ['Bg3', 'Step your bishop back to g3. If Black swaps, take back with the pawn from h2, and your rook in the corner gets a path up the board.'],
            ['O-O', 'Black castles.'],
            ['Bd3', 'Bring out your last bishop. It points towards Black’s king. Castle next, and every piece is ready.']
          ]),
          end: 'Castle next, and your setup is complete. Two plans to try from here: jump your knight to e5 and back it up by pushing your pawn from f2 to f4; or move your queen to e2 and push your pawn to e4.'
        },
        {
          id: 'queen-b6', name: 'When Black’s queen attacks b2',
          moves: LONDON_D5.concat([
            ['c5', 'Black attacks your pawn on d4 straight away.'],
            ['e3', 'Support d4, and open a path for your other bishop.'],
            ['Nc6', 'Black puts more pressure on d4.'],
            ['c3', 'Protect d4 with another pawn.'],
            ['Qb6', 'Black’s queen attacks your pawn on b2. Your bishop used to guard it, but it left for f4.'],
            ['Qb3', 'Meet the queen with your queen: b2 is protected again. If Black swaps queens, take back with the pawn from a2, and your rook in the corner gets a path up the board.'],
            ['Nf6', 'Black brings out a knight instead of swapping queens.'],
            ['Nd2', 'Bring out your knight to d2. It protects your queen, and watches the squares c4 and e4.']
          ]),
          end: 'Your pawn on b2 is safe. Carry on with the usual London setup: a knight to f3, your bishop to d3 or e2, then castle. Don’t be scared of the queen swap: it opens a path for your rook.'
        },
        {
          id: 'kings-indian', name: 'When Black plays g6',
          moves: LONDON.concat([
            ['Nf6', 'Black brings out a knight first, keeping their plans secret.'],
            ['Bf4', 'Same plan as always: bring this bishop out first.'],
            ['g6', 'Black moves a pawn to make room for their bishop on g7. A bishop there is called a fianchetto.'],
            ['e3', 'Move the pawn in front of your king one square. It supports your pawn on d4.'],
            ['Bg7', 'Black’s bishop goes to g7, aiming along the long slanting line across the board.'],
            ['Nf3', 'Bring out a knight.'],
            ['O-O', 'Black castles.'],
            ['Be2', 'Bring out your bishop to e2, a safe square. On d3, Black’s pawns could push it around later.'],
            ['d6', 'Black gets ready to push a pawn to e5.'],
            ['h3', 'Give your bishop on f4 a hiding square on h2, so a black knight can’t come to h5 and swap it off.'],
            ['c5', 'Black attacks your pawn on d4 from the side.'],
            ['c3', 'Protect d4 with another pawn.']
          ]),
          end: 'Castle next, and bring your other knight out to d2. Keep your pawns on c3, d4 and e3 solid, and Black’s bishop on g7 just hits a wall.'
        }
      ]
    },
    {
      id: 'scandinavian', name: 'Scandinavian Defence', side: 'b', level: 3,
      about: 'Playing Black when White starts with the king’s pawn: hit back straight away.',
      intro: 'When you play Black, White moves first. White’s most popular first move is pushing the pawn in front of their king two squares. The Scandinavian answers by attacking that pawn at once. Your queen comes out early, finds a safe square, and the rest of your pieces follow. Stockfish rates it slightly below Black’s most popular answers, but it’s completely sound and easy to learn.',
      lines: [
        {
          id: 'queen-a5', name: 'Main line: your queen goes to a5',
          moves: SCANDI_TAKE.concat([
            ['Nc3', 'White brings out a knight, which attacks your queen. She has to move.'],
            ['Qa5', 'Move your queen to a5. She’s safe here, and she looks along the slanting line towards White’s king.'],
            ['d4', 'White pushes a pawn into the middle. That leaves White’s knight on c3 pinned: it can’t move, because that would put White’s own king in check from your queen.'],
            ['Nf6', 'Bring out a knight.'],
            ['Nf3', 'White brings out a knight too.'],
            ['c6', 'A quiet but useful pawn move. It stops White’s knights jumping to b5 or d5, and gives your queen a way back to c7 if she needs it.'],
            ['Bc4', 'White brings out a bishop.'],
            ['Bf5', 'Bring out this bishop now, before your next pawn move blocks it in.'],
            ['Bd2', 'White moves a bishop to d2, so the knight on c3 is no longer pinned. Watch out: if that knight moves now, the bishop on d2 attacks your queen.'],
            ['e6', 'Move this pawn one square. Now the pawns on c6 and e6 both guard d5, and your other bishop can come out.']
          ]),
          end: 'Next, bring out your other bishop (to b4 or e7) and your last knight (to d7), then castle. Keep an eye on your queen: if White’s knight leaves c3, move her back to c7, b6 or d8. Your pawns on c6 and e6 make a wall that’s hard to break.'
        },
        {
          id: 'knight-f3', name: 'When White brings out a knight first',
          moves: SCANDI_TAKE.concat([
            ['Nf3', 'White brings out a knight instead of chasing your queen.'],
            ['Bg4', 'Bring out your bishop to g4. Now White’s knight is pinned: if it moved, your bishop could take White’s queen.'],
            ['Be2', 'White puts a bishop in between, so the knight is free again.'],
            ['Nc6', 'Bring out a knight. It eyes the squares d4 and e5, in the middle.'],
            ['d4', 'White pushes a pawn into the middle.'],
            ['O-O-O', 'Castle the other way! Your king steps two squares, to c8, and your rook jumps over it to d8. The rook now lines up behind your queen, putting extra pressure on White’s pawn on d4.']
          ]),
          end: 'White has to keep protecting the pawn on d4. Next, push a pawn to e6 or e5 and bring out your other knight, to f6. Your king is safe where it is.'
        },
        {
          id: 'push-e5', name: 'When White pushes past your pawn',
          moves: SCANDI.concat([
            ['e5', 'White doesn’t take your pawn. Instead, they push their pawn one square further.'],
            ['Bf5', 'Bring out your bishop now, before your next pawn move blocks it in.'],
            ['d4', 'White supports their pawn on e5 with another pawn.'],
            ['e6', 'Move this pawn one square. Your pawns on d5 and e6 now make a solid chain.'],
            ['Bd3', 'White offers to swap bishops.'],
            ['Bxd3', 'Take White’s bishop. It was one of White’s best attacking pieces.'],
            ['Qxd3', 'White takes back with the queen.'],
            ['c5', 'Attack White’s pawn on d4. It holds up White’s whole chain of pawns, so it’s the best target.'],
            ['c3', 'White protects d4 with another pawn.'],
            ['Nc6', 'Bring out a knight, and put more pressure on d4.']
          ]),
          end: 'You’re comfortable. Next, move your queen to b6 to attack d4 a third time, then bring your other knight round by e7 to f5. Keep hitting d4: White’s whole chain depends on it.'
        }
      ]
    },
    {
      id: 'queens-gambit-declined', name: 'Queen’s Gambit Declined', side: 'b', level: 4,
      about: 'Playing Black when White starts with the queen’s pawn: hold the middle and stay solid.',
      intro: 'When White starts by pushing the pawn in front of their queen, you can do the same and hold the middle. Next, White often offers you a pawn: the Queen’s Gambit. You politely say no: your pawn in the middle stays strong, your bishop can come out, and you castle quickly.',
      lines: [
        {
          id: 'bishop-g5', name: 'Main line: White’s bishop goes to g5',
          moves: QGD.concat([
            ['Bg5', 'White’s bishop pins your knight: if the knight moved, the bishop could take your queen behind it.'],
            ['Be7', 'Put your bishop in between. Your knight is free again, and you’re ready to castle.'],
            ['e3', 'White opens a path for their other bishop.'],
            ['O-O', CASTLE],
            ['Nf3', 'White brings out their other knight.'],
            ['h6', 'Ask the bishop a question with your pawn: will it take your knight, or go back?'],
            ['Bh4', 'White steps back, still looking at your knight.'],
            ['b6', 'Make room for your other bishop to come out on b7. In this opening that bishop is often hard to get going, and from b7 it gets a long slanting line.']
          ]),
          end: 'Next, bring that bishop to b7 and your last knight to d7. Your position is solid, and later a pawn push to c5 gives your pieces more room. If White ever takes your knight on f6, take back with your bishop.'
        },
        {
          id: 'exchange', name: 'When White swaps pawns',
          moves: QGD.concat([
            ['cxd5', 'White swaps pawns in the middle.'],
            ['exd5', 'Take back with your pawn. This also opens a slanting path for your bishop on c8.'],
            ['Bg5', 'White’s bishop pins your knight to your queen.'],
            ['c6', 'Support your pawn on d5 with another pawn.'],
            ['e3', 'White opens a path for their other bishop.'],
            ['Be7', 'Put your bishop in between, so your knight is free, and get ready to castle.'],
            ['Bd3', 'White’s bishop aims at the side where your king will be.'],
            ['O-O', CASTLE],
            ['Qc2', 'White puts their queen behind the bishop. Together they aim at your pawn on h7, next to your king.'],
            ['Nbd7', 'Bring out your last knight. A good plan now is to move your rook to e8, then this knight to f8, where it guards h7.']
          ]),
          end: 'Your position is solid. Next, move your rook to e8 and your knight to f8. Your bishop on c8 can come out to g4 or e6 later.'
        },
        {
          id: 'elephant-trap', name: 'The Elephant Trap',
          moves: QGD.concat([
            ['Bg5', 'White’s bishop pins your knight to your queen.'],
            ['Nbd7', 'Bring out your other knight. This sets a famous trap.'],
            ['cxd5', 'White swaps pawns in the middle.'],
            ['exd5', 'Take back with your pawn.'],
            ['Nxd5', 'White grabs your pawn with their knight, thinking your knight on f6 can’t take back because it’s pinned. That’s a mistake.'],
            ['Nxd5', 'Take the knight anyway! Yes, White’s bishop can now take your queen. Watch what happens next.'],
            ['Bxd8', 'White takes your queen…'],
            ['Bb4+', '…and your bishop checks White’s king. White’s only move is to block with their queen.'],
            ['Qd2', 'White blocks with the queen.'],
            ['Bxd2+', 'Take the queen, with check.'],
            ['Kxd2', 'White’s king takes your bishop.'],
            ['Kxd8', 'Now take White’s bishop with your king. Both queens are gone, and you have an extra knight. That’s the Elephant Trap!']
          ]),
          end: 'You’ve won a whole piece. Many players fall for this trap, so it’s great to know. With an extra knight, swap pieces when you can and keep your king safe: the win will come.'
        }
      ]
    }
  ];
})();
