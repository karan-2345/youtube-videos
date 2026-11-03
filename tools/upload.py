"""
tools/upload.py -- renders/final/upload.md for the chess Short: title options, the YouTube Shorts description and the
Instagram Reels caption (numbers from config/facts.py), and the sources list (read from the sources table in
research/notes.md, so it can't drift from the research).

    python build.py upload
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402
from config.facts import F  # noqa: E402
from tools.assemble import XFADE, probe_duration  # noqa: E402

NAME = "chess_short"
TITLE = "85 Billion Chess Games After Just 4 Moves"
USED = ("[CPW]", "[A048987]", "[A083276]", "[SHAN50]", "[LAB15]", "[LICHESS]", "[PLANCK18]", "[FIX09]", "[PDG-BBN]",
        "[WIKI-SN]")


def total() -> float:
    t = 0.0
    for sc in style.SCENE_ORDER:
        t += probe_duration(ROOT / "renders" / "scenes" / f"{sc}.mp4") - XFADE
    return t + XFADE


def sources() -> list[str]:
    """Rows of the '## Sources' table in research/notes.md used by this Short -> '- source'."""
    text = (ROOT / "research" / "notes.md").read_text(encoding="utf-8")
    sec = text.split("## Sources", 1)[1].split("\n## ", 1)[0]
    out = []
    for line in sec.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 3 or cells[0] not in USED:
            continue
        out.append("- " + re.sub(r"\s*\(saved:[^)]*\)", "", re.sub(r"\*\*|`|\*", "", cells[1])))
    return out


def n(key: str) -> str:
    return f"{int(F[key]):,}"


def write() -> Path:
    tt = total()
    titles = [TITLE, "Chess Has More Games Than the Universe Has Atoms",
              "How Many Chess Games Are Possible? (We Counted the First Ones)"]
    assert F["lab.longest"] - int(F["lab.longest"]) == 0.5
    body = f"""White has {n('m.first')} possible first moves ({n('m.pawn')} for the pawns, {n('m.knight')} for the knights), and Black has {n('m.black_first')} replies, so after one move each there are {n('p.n2')} possible games. It doesn't stay at "times twenty": every pawn that moves opens a door for the bishop or queen behind it, so White's second move brings it to {n('p.n3')}, not {n('p.naive3')}. After two moves each: {n('p.n4')}. After three: {n('p.n6')}. After four: {n('p.n8')}, about {round(F['li.ratio8'])} times every rated game ever played on Lichess ({n('li.games')}). After five: {n('p.n10')}.

In 1950 Claude Shannon, working out how a computer could play chess, made a rough estimate for a whole game: about {n('sh.moves')} legal moves in a typical position, about 1,000 per pair of moves, over a typical {n('sh.game')}-move game: about 10^{n('sh.exp')}. The atoms in the observable universe come to about 10^{n('u.atoms_exp')}. Even if every atom were a computer playing a billion games a second since the Big Bang, they'd have played about {F['u.games']:.0e} games, still about {round(F['u.short'] / 1e12, -1):.0f} trillion times short.

And that's an underestimate: under FIDE's automatic 75-move rule the longest possible game is {int(F['lab.longest']):,} and a half moves, and the count of every legal game has at least {n('lab.digits')} digits (Labelle). Of the {n('p.n4')} two-move games, only {n('s4.mates')} end in checkmate, all versions of the fool's mate: 1. f3 e5 2. g4 Qh4#.

How it was made
- The counts up to three moves each were computed for this video by our own chess move generator, and match the published tables (perft) exactly: {n('m.first')}, {n('p.n2')}, {n('p.n3')}, {n('p.n4')}, {n('p.n5')}, {n('p.n6')}, including the {n('s4.mates')} checkmates after two moves each. The counts after four and five moves each are the published values (OEIS A048987).
- "Games" here means different sequences of moves, as in those tables (different games can reach the same position).
- Shannon's 10^120 is his estimate for typical games, not a count of every legal game.
- The atom count was worked out from the Planck 2018 cosmological parameters (about 7 x 10^79, so about 10^80); "a billion games a second for every atom" is a thought experiment.
- Every branch of the tree in the video is a real game to two moves each ({n('p.n4')} of them). The highlighted one is 1. e4 e5 2. Nf3 Nc6, from the opening played in the first seconds (a Giuoco Piano).

Sources
""" + "\n".join(sources()) + """

Voice: Kokoro (af_heart, Apache-2.0). Music and sound effects: generated in code for this video. Type: Inter and Archivo (SIL Open Font License). The board, pieces and lighting are rendered in three.js, made for this video.
"""
    md = f"""# Upload: {TITLE}

Files (all 1080 x 1920, 60 fps, {tt:.1f} s, -14 LUFS):
- `renders/final/{NAME}.mp4`: captions burned in (use this one for Instagram Reels and YouTube Shorts)
- `renders/final/{NAME}_clean.mp4`: no captions (if you'd rather use the platform's own captions with the .srt)
- `renders/final/captions/{NAME}.srt`
- `renders/final/cover.png`: Reels cover (everything inside the middle 1080 x 1440, so the 3:4 grid crop keeps it)

The last frame matches the first (the start position, "1 before the first move"), so the Short loops cleanly. Every
number, label, board and caption sits inside the middle 3:4 of the frame.

## Title options

1. {titles[0]}
2. {titles[1]}
3. {titles[2]}

## YouTube Shorts description

```text
{body}
#shorts #chess #math #maths #chesstok #numbers #shannonnumber
```

## Instagram Reels caption

```text
After just four moves each, a game of chess can already have gone {n('p.n8')} different ways, about {round(F['li.ratio8'])} times every rated game ever played on Lichess. It starts with {n('m.first')} first moves.

Counted with our own move generator (it matches the published tables exactly). Sources in the YouTube description.

Which first move do you play?

#chess #math #maths #chessfacts #numbers #didyouknow #chesstok
```

## Pinned comment

```text
Count them on a real board: each of the 8 pawns can move one square or two (16), and each knight has 2 squares (4). That's all {n('m.first')}. And watch out for the fastest checkmate there is: if White plays f3 and g4, Black's queen goes to h4 and it's over in two moves.
```
"""
    out = ROOT / "renders" / "final" / "upload.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    return out


if __name__ == "__main__":
    print(write())
