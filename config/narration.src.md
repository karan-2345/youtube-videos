# Narration source: how fast chess explodes (vertical Short)

> Edit this file, then `python build.py narration`. One line = one beat (a paragraph; 0.8 s after it).
> Sentences inside a beat get 0.4 s. `@pause N` adds silence after the previous beat. `@lead N` adds a picture-only
> moment before the next beat. Every number is a {{fact}} token, and no decimal is ever spoken.
> v1 (2026-11-01). Rules carried over: the hook lands in the first sentence; every sentence starts with a connective
> or an explicit link to the one before; no fragments, colon reveals or mic-drop kickers; one number per idea.
> "Moves each" = one move by White and one by Black (two plies). "Games" = move sequences, as in the perft tables
> (research/notes.md FLAG 1).
> Spine: four moves each already beats every rated game on Lichess -> it starts at 20 (count them) -> 400 -> not
> times 20 but more, because pieces come out -> the runaway (197,281; 119 million; 85 billion; 69 trillion) ->
> Shannon's 10^120 vs 10^80 atoms -> even atom-computers since the Big Bang fall 30 trillion times short -> and the
> true count is bigger still -> the shortest game, the fool's mate: watch for it; count the 20 yourself (loops).

## S00 · Four moves each
@scene S00_Hook
@lead 0.4
After just {{li.moves_each|word}} moves each, a game of chess can already have gone {{p.n8|sigwords:2}} different ways, which is {{li.ratio8|round:0|word}} times more than every rated game ever played on Lichess.
And by the end of a game, there are more possible games than atoms in the universe, even though it all starts with just {{m.first|word}} moves.

## S01 · Count them yourself
@scene S01_First
And you can check those {{m.first|word}} on any board, because each of your {{m.pawns|word}} pawns can step forward one square or two, which makes {{m.pawn|word}} moves, and each knight can hop to two squares, which makes {{m.knight|word}} more.
But nothing else can move yet, since every other piece is boxed in behind the pawns, and once Black has the same {{m.black_first|word}} replies, there are {{p.n2}} possible games after one move each.

## S02 · More than twenty times
@scene S02_Open
Now you might expect the next move to multiply that by twenty again, but instead it brings the count to {{p.n3}}, not {{p.naive3}}, because every pawn that steps forward opens a door for the bishop or queen behind it.
So the more pieces come out, the more choices each move has, until a typical position has about {{sh.moves}} legal moves.

## S03 · The runaway
@scene S03_Runaway
And that's why it runs away so fast, because after two moves each there are {{p.n4}} possible games, and after three moves each there are {{p.n6|sigwords:3}}.
Then after four, it's {{p.n8|sigwords:2}}, and after five, it's {{p.n10|sigwords:2}}, which is over {{li.ratio10|sigwords:1}} possible games for every game Lichess has ever stored.

## S04 · Shannon's number
@scene S04_Shannon
That explosion is what Claude Shannon ran into in {{sh.year}}, while he was working out how a computer could play chess, so he made a rough estimate of the whole tree.
Since a typical position has about {{sh.moves}} moves, one move by each player multiplies the count by about a thousand, and over a typical {{sh.game}}-move game, that gives a one followed by {{sh.zeros}} zeros.
And that's far beyond the atoms in the observable universe, which come to about a one followed by {{u.atoms_exp}} zeros.
So even if every one of those atoms were a computer playing {{u.rate|sigwords:1}} games a second since the Big Bang, they'd still fall about {{u.short|sigwords:1}} times short.

## S05 · The shortest game
@scene S05_TryIt
And even that's an underestimate, because the rules let a game run for up to {{lab.longest_whole}} and a half moves, so the count of every legal game has more than {{lab.digits|sigwords:2}} digits.
But out of all those two-move games, only {{s4.mates|word}} end in checkmate, and they're all the same trap, where White pushes the pawns on f and g, and Black's queen slides out to h4.
So watch out for it the next time you play, or just set up a board and count those {{m.first|word}} first moves for yourself.
@pause 1.0
