(function(){
  // The courses Learn Chess teaches, easiest first. Each is a set of lines
  // from the usual start: every move in standard notation (SAN, as
  // chess-core.js writes it) with a sentence on why it's played, and what to aim for once
  // the line ends. The learner plays `side`; the other side's moves are
  // played for them. Lines that start the same way share those moves, so
  // the same words explain them. Every line was checked with Stockfish: the
  // learner's moves are all sound, and a line that teaches a trap says so.
  // learn-core.js checks every move is legal (see its unit tests).

  var ITALIAN = [
    ['e4', 'Push the king’s pawn two squares. It takes space in the centre and opens lines for the queen and the bishop on f1.'],
    ['e5', 'Black does the same, claiming an equal share of the centre.'],
    ['Nf3', 'Bring a knight out, attacking the pawn on e5. Knights belong near the centre, where they reach the most squares.'],
    ['Nc6', 'Black defends e5 by bringing out a knight too.'],
    ['Bc4', 'The Italian bishop. From c4 it aims at f7, the square beside Black’s king that only the king defends.']
  ];

  var LONDON = [
    ['d4', 'Push the queen’s pawn two squares. Unlike a pawn on e4, the pawn on d4 is already defended, by the queen.']
  ];
  var LONDON_D5 = LONDON.concat([
    ['d5', 'Black stops e2-e4 and takes an equal share of the centre.'],
    ['Bf4', 'The key move of the London: bring this bishop out now, before e2-e3 shuts it in.']
  ]);

  var SCANDI = [
    ['e4', 'White opens with the king’s pawn.'],
    ['d5', 'Attack the pawn straight away, so the game goes your way from the first move.']
  ];
  var SCANDI_TAKE = SCANDI.concat([
    ['exd5', 'White takes the pawn, as they nearly always do.'],
    ['Qxd5', 'Take back with the queen. She comes out early, but White can’t easily chase her into trouble.']
  ]);

  var QGD = [
    ['d4', 'White opens with the queen’s pawn.'],
    ['d5', 'Meet it with your own pawn: d4 and d5 block each other, and neither side gets the centre for free.'],
    ['c4', 'The Queen’s Gambit. White offers this pawn to lure Black’s d-pawn away from the centre.'],
    ['e6', 'Decline it: e6 backs up d5, so if White takes, you take back with a pawn. It also opens a path for the bishop on f8.'],
    ['Nc3', 'White adds a second attacker on d5.'],
    ['Nf6', 'Defend d5 again and bring a knight out.']
  ];

  window.bdnixCourses = [
    {
      id: 'italian', name: 'Italian Game', side: 'w', level: 1,
      about: 'Take the centre, bring your pieces out, castle. The classic first opening.',
      intro: 'The Italian Game is one of the oldest openings, and one of the best to start with. White follows three simple rules: take the centre with a pawn, bring the knights and bishops out quickly, and castle to keep the king safe.',
      lines: [
        {
          id: 'giuoco-piano', name: 'The quiet main line',
          moves: ITALIAN.concat([
            ['Bc5', 'Black copies the idea: the bishop on c5 aims at f2.'],
            ['c3', 'A small pawn move with a big plan: it gets ready for d2-d4, and stops Black’s knight settling on d4.'],
            ['Nf6', 'Black brings out the other knight, attacking the pawn on e4.'],
            ['d3', 'Defend e4 calmly. White keeps everything solid and pushes d3-d4 later, when it’s ready.'],
            ['d6', 'Black backs up e5 too, and opens a path for the bishop on c8.'],
            ['O-O', 'Castle. The king is safe behind its pawns, and the rook comes towards the centre.'],
            ['O-O', 'Black castles too.'],
            ['Re1', 'The rook goes to the e-file, behind the pawn on e4, ready to help the push d3-d4.'],
            ['a6', 'Black makes room for the bishop to step back to a7, so a pawn can’t trap it.'],
            ['Bb3', 'Step back before Black chases the bishop with ...b5 or ...Na5. On b3 it still aims at f7.'],
            ['Ba7', 'Black tucks the bishop away too.'],
            ['h3', 'Stop ...Bg4, which would pin the knight to the queen. Now the other knight can come round by d2 and f1 to g3.']
          ]),
          end: 'White’s king is safe and every piece has a job. The plan from here: the knight goes d2, f1 and g3, and when everything is ready, d3-d4 breaks open the centre. Improve one piece at a time, and don’t rush.'
        },
        {
          id: 'two-knights', name: 'Two Knights Defence',
          moves: ITALIAN.concat([
            ['Nf6', 'The Two Knights Defence: Black brings the other knight out and attacks e4 at once.'],
            ['d3', 'Defend e4 calmly. The wilder 4.Ng5, attacking f7, leads to sharp fights; d3 keeps the game simple.'],
            ['Be7', 'Black puts the bishop on a modest, safe square.'],
            ['O-O', 'Castle the king to safety.'],
            ['O-O', 'Black castles too.'],
            ['Re1', 'The rook goes to the e-file, behind the pawn on e4.'],
            ['d6', 'Black backs up e5.'],
            ['c3', 'Make room: the pawn backs up d3-d4 later, and leaves c2 free for the bishop.'],
            ['Na5', 'The knight attacks the bishop on c4.'],
            ['Bb5', 'Keep the bishop. On b3 Black would swap it off; on b5 it’s safe for now.'],
            ['a6', 'Black chases it.'],
            ['Ba4', 'Step back along the diagonal.'],
            ['b5', 'Black chases it again.'],
            ['Bc2', 'Safe at last, behind the pawns. When White pushes d3-d4, the diagonal towards Black’s king opens up.'],
            ['c5', 'Black takes space on the queen’s side.'],
            ['Nbd2', 'The last knight joins in. As in the main line, it can go on to f1 and g3.']
          ]),
          end: 'Both sides are safe and developed. White’s plan: the knight to f1 and g3, then d3-d4 when the time is right, with the bishop on c2 waiting for the diagonal to open.'
        },
        {
          id: 'knight-jump', name: 'Don’t take the bait',
          moves: ITALIAN.concat([
            ['Nd4', 'A tricky knight jump. It breaks an opening rule, moving the same piece twice, and leaves e5 without a defender. It’s a trap.'],
            ['Nxd4', 'Swap knights. Grabbing the pawn with 4.Nxe5? is what Black hopes for: 4...Qg5! attacks the knight and g2, and after 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3 it’s checkmate.'],
            ['exd4', 'Black takes back with the pawn.'],
            ['O-O', 'Castle. White is already ahead in development.'],
            ['Nf6', 'Black attacks the pawn on e4.'],
            ['Re1', 'Defend it with the rook, which belongs on the e-file anyway.'],
            ['d6', 'Black opens a path for the bishop on c8.'],
            ['c3', 'Attack the pawn on d4 and get ready to build a big centre.']
          ]),
          end: 'White is clearly better: White’s pieces are out and the king is safe, while Black has hardly developed and the pawn on d4 is weak. Take on d4 when it suits you, push d2-d4, and bring the queen’s knight and bishop into the game.'
        }
      ]
    },
    {
      id: 'london', name: 'London System', side: 'w', level: 2,
      about: 'One setup against almost anything. Fewer moves to remember.',
      intro: 'In the London System White sets up the same way against almost anything Black plays: pawns on d4, e3 and c3, the bishop out to f4 before e3 shuts it in, the knights to f3 and d2, and castling. There’s less to memorise, so it makes a good second opening.',
      lines: [
        {
          id: 'against-d5', name: 'Against 1...d5',
          moves: LONDON_D5.concat([
            ['Nf6', 'Black brings out a knight.'],
            ['e3', 'Build the pyramid: e3 backs up d4 and opens a path for the other bishop.'],
            ['e6', 'Black backs up d5 and opens a path for the bishop on f8.'],
            ['Nf3', 'Bring out a knight. It watches e5 and helps guard the king later.'],
            ['c5', 'Black hits the pawn on d4 from the side, the usual way to fight the London.'],
            ['c3', 'Back up d4 with another pawn. The chain c3, d4, e3 is very hard to break.'],
            ['Nc6', 'Black adds pressure on d4.'],
            ['Nbd2', 'The other knight goes to d2, since the pawn guarding d4 stands on c3. From d2 it watches e4 and c4.'],
            ['Bd6', 'Black offers to swap bishops.'],
            ['Bg3', 'Keep the bishop. If Black takes on g3, take back with the h-pawn, and the rook on h1 gets the half-open h-file.'],
            ['O-O', 'Black castles.'],
            ['Bd3', 'The last bishop comes out, aiming at Black’s king. White castles next.']
          ]),
          end: 'Castle, and White is fully developed. Good plans from here: the knight jumps to e5, backed up by f2-f4; or the queen goes to e2 and the pawn pushes to e4.'
        },
        {
          id: 'queen-b6', name: 'When the queen attacks b2',
          moves: LONDON_D5.concat([
            ['c5', 'Black strikes at d4 at once.'],
            ['e3', 'Back up d4 and open a path for the other bishop.'],
            ['Nc6', 'Black adds pressure on d4.'],
            ['c3', 'Hold d4 with another pawn.'],
            ['Qb6', 'The queen attacks b2, which the bishop left unguarded when it went to f4.'],
            ['Qb3', 'Meet queen with queen: b2 is guarded again. If Black swaps on b3, take back with the a-pawn, and the rook on a1 gets the half-open a-file.'],
            ['Nf6', 'Black brings out a knight instead of swapping.'],
            ['Nd2', 'Bring the knight out to d2, where it backs up the queen and watches c4 and e4.']
          ]),
          end: 'b2 is safe and White can carry on with the usual setup: the knight to f3, the bishop to d3 or e2, and castling. Don’t fear the queen swap: it gives your rook the half-open a-file.'
        },
        {
          id: 'kings-indian', name: 'Against the fianchetto',
          moves: LONDON.concat([
            ['Nf6', 'Black brings out a knight first, keeping their plans hidden.'],
            ['Bf4', 'The same plan: the bishop comes out first.'],
            ['g6', 'Black makes room for the bishop on g7, a setup called the fianchetto.'],
            ['e3', 'Build the pyramid.'],
            ['Bg7', 'Black’s bishop takes the long diagonal.'],
            ['Nf3', 'Bring out a knight.'],
            ['O-O', 'Black castles.'],
            ['Be2', 'On e2 the bishop is safe from Black’s usual pawn push ...e5-e4, which would hit a bishop on d3.'],
            ['d6', 'Black gets ready to push ...e5.'],
            ['h3', 'Give the bishop a hiding place on h2, so a knight on h5 can’t swap it off.'],
            ['c5', 'Black hits d4 from the side.'],
            ['c3', 'Hold d4 with another pawn.']
          ]),
          end: 'White castles next and finishes the setup with the knight on d2. Keep the pawns on c3, d4 and e3 solid, and Black’s bishop on g7 bites on granite.'
        }
      ]
    },
    {
      id: 'scandinavian', name: 'Scandinavian Defence', side: 'b', level: 3,
      about: 'As Black against 1.e4: hit back at once with 1...d5.',
      intro: 'Playing Black, you need an answer to White’s most popular first move, 1.e4. The Scandinavian is the most direct one: 1...d5 attacks White’s pawn at once. Your queen comes out early, finds a safe square, and your pieces follow quickly. Stockfish rates it a little below the most popular replies, but it’s fully sound and easy to learn.',
      lines: [
        {
          id: 'queen-a5', name: 'The main line: queen to a5',
          moves: SCANDI_TAKE.concat([
            ['Nc3', 'White brings out a knight and attacks your queen, gaining time.'],
            ['Qa5', 'Step aside to a5. The queen is safe there, and watches the diagonal to White’s king.'],
            ['d4', 'White takes the centre. With the d-pawn gone from d2, your queen now pins the knight on c3 to the king.'],
            ['Nf6', 'Bring out a knight.'],
            ['Nf3', 'White develops too.'],
            ['c6', 'A quiet, useful move: it guards b5 and d5 from White’s knights, and gives your queen a way back to c7.'],
            ['Bc4', 'White brings out a bishop.'],
            ['Bf5', 'Bring this bishop out before ...e6 shuts it in.'],
            ['Bd2', 'White unpins the knight. Careful: if the knight moves now, the bishop on d2 attacks your queen.'],
            ['e6', 'Now the pawns on c6 and e6 both guard d5, and the bishop on f8 can come out.']
          ]),
          end: 'Next comes ...Bb4 or ...Be7, then ...Nbd7 and castling. Keep an eye on your queen: if White’s knight moves off c3, step back to c7, b6 or d8. The pawns on c6 and e6 are a wall White finds hard to break.'
        },
        {
          id: 'knight-f3', name: 'When White plays 3.Nf3',
          moves: SCANDI_TAKE.concat([
            ['Nf3', 'White brings out a knight instead of chasing the queen.'],
            ['Bg4', 'Pin the knight to White’s queen.'],
            ['Be2', 'White breaks the pin.'],
            ['Nc6', 'Bring out a knight, aiming at d4 and e5.'],
            ['d4', 'White takes the centre.'],
            ['O-O-O', 'Castle on the queen’s side. The king steps away, and the rook lands on d8, lined up behind your queen against d4.']
          ]),
          end: 'White has to watch the pawn on d4. Carry on with ...e6 or ...e5, then ...Nf6. Your king is safe on the queen’s side; push your king’s-side pawns only when you’re ready to attack.'
        },
        {
          id: 'push-e5', name: 'When White pushes 2.e5',
          moves: SCANDI.concat([
            ['e5', 'White pushes past instead of taking.'],
            ['Bf5', 'Bring this bishop out before ...e6 shuts it in.'],
            ['d4', 'White backs up the pawn on e5.'],
            ['e6', 'Now the pawns on d5 and e6 make a solid chain.'],
            ['Bd3', 'White offers to swap bishops.'],
            ['Bxd3', 'Take it: White’s best attacking bishop leaves the board.'],
            ['Qxd3', 'White takes back.'],
            ['c5', 'Strike at the base of White’s pawn chain, the pawn on d4.'],
            ['c3', 'White holds d4.'],
            ['Nc6', 'More pressure on d4.']
          ]),
          end: 'Black is comfortable. Next comes ...Qb6, a third attacker on d4, then the other knight goes by e7 to f5. Keep hitting d4; White’s whole chain rests on it.'
        }
      ]
    },
    {
      id: 'queens-gambit-declined', name: 'Queen’s Gambit Declined', side: 'b', level: 4,
      about: 'As Black against 1.d4: hold the centre, and don’t fall for the gambit.',
      intro: 'Against 1.d4, Black can copy the first move and hold the centre. When White offers a pawn with 2.c4, the Queen’s Gambit, Black declines it with 2...e6: the pawn on d5 stays rock solid, the bishop on f8 can come out, and Black castles quickly.',
      lines: [
        {
          id: 'bishop-g5', name: 'The main line with 4.Bg5',
          moves: QGD.concat([
            ['Bg5', 'White pins your knight to your queen.'],
            ['Be7', 'Break the pin by putting the bishop in between. Now you’re one move from castling.'],
            ['e3', 'White opens a path for the other bishop.'],
            ['O-O', 'Castle early: the king is safe.'],
            ['Nf3', 'White brings out the other knight.'],
            ['h6', 'Ask the bishop a question: take the knight, or step back.'],
            ['Bh4', 'White steps back, still eyeing your knight.'],
            ['b6', 'Make room for ...Bb7. On the long diagonal, the bishop on c8, often Black’s problem piece in this opening, gets a good job.']
          ]),
          end: 'Next come ...Bb7 and ...Nbd7. Black is solid, and later ...c5 frees the game. If White ever takes your knight on f6, take back with the bishop.'
        },
        {
          id: 'exchange', name: 'The Exchange Variation',
          moves: QGD.concat([
            ['cxd5', 'White swaps pawns in the centre.'],
            ['exd5', 'Take back with the pawn. This opens the diagonal of the bishop on c8.'],
            ['Bg5', 'White pins your knight.'],
            ['c6', 'Back up d5 with a second pawn.'],
            ['e3', 'White opens a path for the other bishop.'],
            ['Be7', 'Unpin, and get ready to castle.'],
            ['Bd3', 'White’s bishop aims at your king’s side.'],
            ['O-O', 'Castle.'],
            ['Qc2', 'White lines up the queen behind the bishop, aiming at h7.'],
            ['Nbd7', 'Bring out the last knight. The usual plan is ...Re8 and ...Nf8, where the knight guards h7.']
          ]),
          end: 'Black’s position is solid. Play ...Re8, ...Nf8 and perhaps ...Ne4 to swap pieces; the bishop on c8 can come out to g4 or e6.'
        },
        {
          id: 'elephant-trap', name: 'The Elephant Trap',
          moves: QGD.concat([
            ['Bg5', 'White pins your knight to your queen.'],
            ['Nbd7', 'Another way to develop, and it sets a famous trap.'],
            ['cxd5', 'White swaps pawns in the centre.'],
            ['exd5', 'Take back with the pawn.'],
            ['Nxd5', 'White grabs the pawn, thinking the knight on f6 can’t take back because it’s pinned. It’s a mistake.'],
            ['Nxd5', 'Take it anyway! White can take your queen now, but look what follows.'],
            ['Bxd8', 'White takes your queen…'],
            ['Bb4+', '…and you check the king. White can only block with the queen.'],
            ['Qd2', 'White blocks.'],
            ['Bxd2+', 'Take the queen, with check.'],
            ['Kxd2', 'White takes back.'],
            ['Kxd8', 'And take back the bishop. The queens are gone, and you’re a knight up: that’s the Elephant Trap.']
          ]),
          end: 'You’ve won a piece. Many players have fallen for this trap, so it’s worth knowing. With an extra knight, swap pieces, keep your king safe, and the win will come.'
        }
      ]
    }
  ];
})();
