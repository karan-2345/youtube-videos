"""
scenes/3d/export.py -- write renders/cache/scenes/<SceneId>.json for the web/three.js scenes (chess Short).

Every move a scene shows comes from our own move generator (config/chess.py) and every count from config/facts.py;
the JS side only animates. Event times are phrase anchors on the measured narration (config/events.py), the same
anchors the SFX use, and the sound cues are exported with the scene data (tools/sfx.py reads them).

    python scenes/3d/export.py LookA
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from config import chess as C, events, style  # noqa: E402
from config.facts import F  # noqa: E402

OUT = ROOT / "renders" / "cache" / "scenes"
TIMINGS = ROOT / "renders" / "cache" / "timings.json"
KIND = {C.P: "p", C.N: "n", C.B: "b", C.R: "r", C.Q: "q", C.K: "k"}


def _common(scene_id: str, timing: dict | None = None) -> dict:
    timings = json.loads(TIMINGS.read_text())
    return {"scene": scene_id, "fps": style.FPS, "palette": style.PALETTE, "caption_y": style.CAPTION_Y,
            "safe": {"top": style.SAFE_TOP_PX, "bottom": style.SAFE_BOTTOM_PX, "right": style.SAFE_RIGHT_PX},
            "timing": timing or timings[scene_id]}


def _anchor(tm: dict):
    return lambda beat, phrase=None, off=0.0, end=False: round(events.at(tm, beat, phrase, off, end), 3)


def fr(sq: int) -> list[int]:
    """0x88 square -> [file 0-7 (a-h), rank 0-7 (1-8)]."""
    return [sq & 7, sq >> 4]


# ---------------------------------------------------------------- a game played on the board, with its whole tree
class Game:
    """Plays SAN moves from the start position. Each ply keeps every legal move of the side to move (the branches
    the scene draws), the move actually played, and the number of possible games after it (perft, from facts).
    Pieces get stable ids so the JS can move the same mesh all the way through."""

    def __init__(self):
        self.pos = C.Position()
        self.ids = {}                      # square -> piece id
        self.pieces = []
        for sq in C.SQUARES:
            pc = self.pos.b[sq]
            if pc:
                self.ids[sq] = len(self.pieces)
                self.pieces.append({"id": len(self.pieces), "k": KIND[abs(pc)], "w": pc > 0, "sq": fr(sq),
                                    "keys": []})
        self.plies = []

    def play(self, san: str, t0: float, t1: float):
        """Branches grow from t0; the chosen move slides from t1 - 0.22 s to t1 (and lands at t1)."""
        legal = self.pos.legal()
        branch = [{"pid": self.ids[m[0]], "from": fr(m[0]), "to": fr(m[1]), "k": KIND[abs(self.pos.b[m[0]])]}
                  for m in legal]
        hit = [m for m in legal if self.pos.san(m, legal).rstrip("+#") == san.rstrip("+#")]
        assert len(hit) == 1, san
        m = hit[0]
        played = self.pos.san(m, legal)
        pid = self.ids.pop(m[0])
        assert m[1] not in self.ids, "captures are not animated in this scene"
        self.ids[m[1]] = pid
        p = self.pieces[pid]
        p["keys"].append([round(t1 - 0.22, 3), fr(m[0]), fr(m[1])])
        self.pos.make(m)
        n = len(self.plies) + 1
        count = F["m.first"] if n == 1 else F[f"p.n{n}"]
        self.plies.append({"t0": round(t0, 3), "t1": round(t1, 3), "side": "w" if n % 2 else "b", "branch": branch,
                           "pick": legal.index(m), "san": played, "count": count, "n": len(legal)})

    def export(self) -> dict:
        return {"pieces": self.pieces, "plies": self.plies}


def game_tree(depth: int, line: list[str]) -> dict:
    """The real game tree from the start position, as child counts in breadth-first order for plies 0 .. depth-1
    (the last level's counts are its leaves: 20, 400, 8,902, 197,281 games for depth 4), plus the child index taken
    at each ply by `line`, so a scene can lay out every real game and trace one of them."""
    level, counts = [C.Position()], []
    for ply in range(depth):
        nxt = []
        row = []
        for pos in level:
            moves = pos.legal()
            row.append(len(moves))
            if ply < depth - 1:
                for m in moves:
                    pos.make(m)
                    q = C.Position.__new__(C.Position)
                    q.b, q.side, q.castle, q.ep, q.kings, q.stack = list(pos.b), pos.side, pos.castle, pos.ep, dict(pos.kings), []
                    nxt.append(q)
                    pos.unmake()
        counts.append(row)
        level = nxt
    sizes = [sum(r) for r in counts]
    assert sizes == [F["m.first"]] + [F[f"p.n{k}"] for k in range(2, depth + 1)], sizes
    path, pos = [], C.Position()
    for san in line:
        legal = pos.legal()
        i = [pos.san(m, legal).rstrip("+#") for m in legal].index(san)
        path.append(i)
        pos.make(legal[i])
    return {"counts": counts, "path": path}


# Giuoco Piano: a common, quiet opening, eight plies with no captures
ITALIAN = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6"]


def LookA() -> dict:
    """STOP 1 look test: the hook's first sentence. A real opening is played; on every ply all the legal moves grow
    out as threads, one is played, and the count of possible games jumps; 85 billion lands as it is spoken."""
    tm = json.loads(TIMINGS.read_text())["S00_Hook"]
    at = _anchor(tm)
    end = at("S00.01", end=True) + 0.6
    d = _common("LookA", {"duration": round(end, 3), "beats": {}, "captions": []})
    t_start = at("S00.01", "After just", -0.1)
    t_land = at("S00.01", "85 billion", 0.05)
    per = (t_land - t_start) / len(ITALIAN)
    g = Game()
    for i, san in enumerate(ITALIAN):
        g.play(san, t_start + i * per, t_start + (i + 1) * per - 0.04)
    d.update(g.export())
    d["counter"] = {"label_t": t_start, "land": t_land, "accent_t": t_land}
    d["lichess"] = {"t": at("S00.01", "which is ten times", -0.1), "t2": at("S00.01", "every rated game", -0.1),
                    "games": F["li.games"], "ratio": round(F["li.ratio8"])}
    d["caption"] = [[at("S00.01", "After just", -0.05), "After just <b>four</b> moves each,"],
                    [at("S00.01", "a game of chess", -0.05), "a game of chess can already have gone"],
                    [at("S00.01", "85 billion", -0.05), "<b>85 billion</b> different ways,"],
                    [at("S00.01", "which is ten times", -0.05), "which is <b>ten</b> times more than every"],
                    [at("S00.01", "rated game ever", -0.05), "rated game ever played on Lichess."]]
    # stills after the clip: B the fool's mate, C Shannon's number
    fool = C.Position()
    for s in ("f3", "e5", "g4"):
        fool.play(s)
    qm = [m for m in fool.legal() if fool.san(m) == "Qh4#"][0]
    d["still_b"] = {"t": round(end + 1.0, 3), "moves": [["f2", "f3"], ["e7", "e5"], ["g2", "g4"]],
                    "mate": [fr(qm[0]), fr(qm[1])], "mates": F["s4.mates"], "games": F["p.n4"]}
    d["still_c"] = {"t": round(end + 2.0, 3), "zeros": int(F["sh.zeros"]), "atoms": int(F["u.atoms_exp"])}
    d["tree"] = game_tree(4, ITALIAN[:4])
    d["still_d"] = {"t": round(end + 3.0, 3), "count": F["p.n4"]}
    d["still_e"] = {"t": round(end + 4.0, 3), "zeros": int(F["sh.zeros"]), "atoms": int(F["u.atoms_exp"])}
    d["cues"] = ([[p["t1"], "tok", -9] for p in g.plies]
                 + [[p["t1"] - 0.02, "tick", -20] for p in g.plies]
                 + [[t_land, "thock", -8]])
    return d


# ================================================================ the five scenes (lib/club.js)
import math  # noqa: E402

NOTE = ["before the first move", "possible games after White's first move", "possible games after 1 move each",
        "possible games after White's 2nd move", "possible games after 2 moves each",
        "possible games after White's 3rd move", "possible games after 3 moves each",
        "possible games after White's 4th move", "possible games after 4 moves each"]
LAYOUT = {"num_y": 400, "label_y": 528}       # inside the middle 3:4 (y 240-1680), above the board


def fmt(n: float) -> str:
    return f"{int(n):,}"


def hero(dist: float = 234.0, az: float = -0.06, el: float = 0.74, look=(0, 3, 2)) -> list:
    """The club-room camera: White's side, 42 degrees up (the look test's hero shot)."""
    p = [math.sin(az) * math.cos(el) * dist, math.sin(el) * dist, math.cos(az) * math.cos(el) * dist]
    return [[round(v, 3) for v in p], list(look)]


TREE0 = [[0, 52, 205], [0, 16, -6]]            # facing the tree that grows out of the board
TREE1 = [[0, 64, 262], [0, 28, -6]]
TREE2 = [[0, 74, 292], [0, 36, -6]]
TREE3 = [[0, 72, 282], [0, 36, -6]]
ZEROS_CAM = [hero(196, 0.08)[0], [0, 3, -34]]   # under the zeros: the board drops below the text, the lamp dims
OPEN = hero(234, -0.06)                        # S00's first frame, and S04's last (the loop)


def ply_count(n: int) -> float:
    return 1 if n == 0 else F["m.first"] if n == 1 else F[f"p.n{n}"]


class Board:
    """Real moves on a schedule (from config/chess.py), with the threads that show every legal move. Pieces keep stable
    ids; every move and rewind becomes a key [t, from, to, dur] on its piece, and every landing a sound cue."""

    def __init__(self, fen: str = C.START_FEN):
        self.pos = C.Position(fen)
        self.ids, self.pieces, self.history = {}, [], []
        for sq in C.SQUARES:
            pc = self.pos.b[sq]
            if pc:
                self.ids[sq] = len(self.pieces)
                self.pieces.append({"id": len(self.pieces), "k": KIND[abs(pc)], "w": pc > 0, "sq": fr(sq), "keys": []})
        self.threads, self.cues = [], []

    def branches(self, pos=None, only=None) -> list[dict]:
        pos = pos or self.pos
        out = []
        for m in pos.legal():
            k = KIND[abs(pos.b[m[0]])]
            if only and k not in only:
                continue
            out.append({"from": fr(m[0]), "to": fr(m[1]), "k": k, "san": pos.san(m), "sq": m[0]})
        return out

    def group(self, t0: float, fade: float, branches: list[dict], spread: float = 0.6, pick: int = -1,
              t1: float | None = None, accent=(), tick_db: float | None = None):
        self.threads.append({"t0": round(t0, 3), "fade": round(fade, 3), "spread": round(spread, 3), "pick": pick,
                             "t1": round(t1 if t1 is not None else fade, 3), "accent": list(accent),
                             "branches": [{k: b[k] for k in ("from", "to", "k")} for b in branches]})
        if tick_db is not None:
            n = len(branches)
            self.cues += [[round(t0 + spread * i / max(1, n), 3), "tick", tick_db] for i in range(n)]

    def play(self, san: str, t: float, dur: float = 0.22, threads: bool = False, tok_db: float = -9):
        """Move `san` sliding from t to t + dur. threads=True: every legal move grows out first (from t - 0.5 * ...)."""
        legal = self.pos.legal()
        sans = [self.pos.san(m, legal).rstrip("+#") for m in legal]
        i = sans.index(san.rstrip("+#"))
        m = legal[i]
        pid = self.ids.pop(m[0])
        assert m[1] not in self.ids, "captures are not animated in this Short"
        self.ids[m[1]] = pid
        self.pieces[pid]["keys"].append([round(t, 3), fr(m[0]), fr(m[1]), dur])
        self.history.append((pid, m))
        self.pos.make(m)
        if t >= 0:
            self.cues.append([round(t + dur, 3), "tok", tok_db])
        return i, len(legal)

    def rewind(self, t: float, dur: float = 0.2, tok_db: float = -15):
        pid, m = self.history.pop()
        self.pos.unmake()
        self.ids.pop(m[1])
        self.ids[m[0]] = pid
        self.pieces[pid]["keys"].append([round(t, 3), fr(m[1]), fr(m[0]), dur])
        if t >= 0:
            self.cues.append([round(t + dur, 3), "tok", tok_db])

    def nudge(self, square: str, t: float, dur: float = 0.34, tok_db: float = -22):
        pid = self.ids[C.square(square)]
        here = fr(C.square(square))
        self.pieces[pid]["keys"].append([round(t, 3), here, here, dur])
        self.cues.append([round(t + dur, 3), "tok", tok_db])

    def export(self) -> dict:
        for p in self.pieces:
            p["keys"].sort(key=lambda k: k[0])
        return {"pieces": self.pieces, "threads": self.threads}


def _scene(sid: str):
    d = _common(sid)
    d["layout"] = LAYOUT
    return d, _anchor(d["timing"]), d["timing"]["duration"]


def _counter_cues(counter: list, db: float = -20) -> list:
    return [[c["t"], "tick", db] for c in counter if c["t"] > 0 and c.get("html")]


FOOL_CAM = [[74, 96, 150], [6, 0, -2]]        # the king's side, for the fool's mate


def _italian_board(t: float = -2.0) -> Board:
    """The board after the hook's eight plies (Giuoco Piano), set before the scene starts."""
    B = Board()
    for san in ITALIAN:
        B.play(san, t, 0.01)
    return B


def _sub_n(key: str) -> str:
    return f"<b>{fmt(F[key])}</b>"


def S00_Hook() -> dict:
    """A real opening played ply by ply with every legal move as a thread; the count snaps to each exact value and
    lands on 84,998,978,956 as '85 billion' is spoken; the Lichess comparison; the game rewinds to the start, and
    White's twenty first moves light up on '... just twenty moves'."""
    d, at, end = _scene("S00_Hook")
    t_start, t_land = at("S00.01", "After just", -0.1), at("S00.01", "85 billion", 0.05)
    per = (t_land - t_start) / len(ITALIAN)
    B = Board()
    counter = [{"t": 0, "html": "1", "label": NOTE[0]}]
    for i, san in enumerate(ITALIAN):
        t0, t1 = t_start + i * per, t_start + (i + 1) * per - 0.04
        br = B.branches()
        idx, _ = B.play(san, t1 - 0.22)
        B.group(t0, t1 - 0.2, br, spread=0.34 * (t1 - t0), pick=idx, t1=t1)
        counter.append({"t": round(t1, 3), "html": fmt(ply_count(i + 1)), "label": NOTE[i + 1], "accent": i == 7})
    t_rw = at("S00.02", "And by the end", 0.15)
    for k in range(len(ITALIAN)):
        t = t_rw + k * 0.26
        B.rewind(t)
        n = len(ITALIAN) - 1 - k
        counter.append({"t": round(t + 0.2, 3), "html": fmt(ply_count(n)), "label": NOTE[n]})
    t20 = at("S00.02", "twenty moves", -0.1)
    first = B.branches()
    B.group(t20, end - 0.45, first, spread=0.8, tick_db=-27)
    counter.append({"t": t20, "html": fmt(F["m.first"]), "label": "White's first moves"})
    t_li, t_li2 = at("S00.01", "which is ten times", -0.1), at("S00.01", "every rated game", -0.1)
    d["texts"] = [
        {"html": f"<b>{round(F['li.ratio8'])} \u00d7</b> every rated game", "cls": "lb", "x": 540, "y": 604,
         "anchor": "c", "t0": t_li, "t1": t_rw - 0.1, "fade": 0.3},
        {"html": f"ever played on Lichess: <b>{fmt(F['li.games'])}</b>", "cls": "sub", "x": 540, "y": 650,
         "anchor": "c", "t0": t_li2, "t1": t_rw - 0.1, "fade": 0.3},
    ]
    d.update(B.export(), counter=counter, cam=[[0, *OPEN], [end, *hero(224, 0.04)]])
    d["cues"] = B.cues + _counter_cues(counter) + [[t_land, "thock", -8]]
    return d


def S01_First() -> dict:
    """Count the twenty: each pawn's two moves (16), each knight's two (4); the other pieces try and can't; Black's
    twenty; 400."""
    d, at, end = _scene("S01_First")
    B = Board()
    tp, t16 = at("S01.01", "each of your eight pawns", -0.1), at("S01.01", "sixteen moves", -0.05)
    tn, t4 = at("S01.01", "each knight", -0.1), at("S01.01", "four more", -0.05)
    t_none, t_box = at("S01.02", "nothing else", -0.1), at("S01.02", "boxed in", -0.3)
    tb, t400 = at("S01.02", "once Black", -0.1), at("S01.02", "400 possible", 0.0)
    pawns, knights = B.branches(only="p"), B.branches(only="n")
    assert len(pawns) == F["m.pawn"] and len(knights) == F["m.knight"]
    B.group(tp, t_none, pawns, spread=2.4, tick_db=-26)
    B.group(tn, t_none, knights, spread=0.7, tick_db=-24)
    for k, sqn in enumerate(["a1", "c1", "d1", "e1", "f1", "h1"]):
        B.nudge(sqn, t_box + k * 0.16)
    black = B.branches(C.Position(C.START_FEN.replace(" w ", " b ")))
    assert len(black) == F["m.black_first"]
    B.group(tb, end - 0.7, black, spread=1.2, tick_db=-27)
    n20 = fmt(F["m.first"])
    lab = "White's first moves"
    counter = [{"t": 0, "html": n20, "label": lab},
               {"t": t16, "html": n20, "label": lab, "sub": f"{_sub_n('m.pawn')} pawn moves"},
               {"t": t4, "html": n20, "label": lab,
                "sub": f"{_sub_n('m.pawn')} pawn moves + {_sub_n('m.knight')} knight moves"},
               {"t": t_box, "html": n20, "label": lab, "sub": "everything else is boxed in"},
               {"t": tb, "html": fmt(F["m.black_first"]), "label": "Black's replies"},
               {"t": t400, "html": fmt(F["p.n2"]), "label": NOTE[2]}]
    d.update(B.export(), counter=counter, cam=[[0, *hero(224, 0.04)], [end, *hero(204, 0.0)]])
    d["cues"] = B.cues + _counter_cues(counter)
    return d


def S02_Open() -> dict:
    """Not twenty times again: 1. e4 e5 and the doors that open for the bishop and queen (8,902, not 8,000); then the
    opening carries on, the number of choices climbing each move, to a position with 34 legal moves ('about 30')."""
    d, at, end = _scene("S02_Open")
    B = Board()
    t_exp = at("S02.01", "the next move", -0.2)
    B.play("e4", t_exp, 0.3)
    B.play("e5", t_exp + 0.55, 0.3)
    t_door, t_more = at("S02.01", "opens a door", -0.25), at("S02.02", "So the more", -0.2)
    doors = B.branches()
    accent = [i for i, b in enumerate(doors) if b["sq"] in (C.square("f1"), C.square("d1"))]
    assert len(doors) == F["w2.e4e5"] and accent
    B.group(t_door, t_more, doors, spread=1.1, accent=accent, tick_db=-27)
    counter = [{"t": 0, "html": fmt(F["p.n2"]), "label": NOTE[2]},
               {"t": at("S02.01", "by twenty again", -0.1), "html": fmt(F["p.n2"]), "label": NOTE[2],
                "sub": f"\u00d7 20 = <b>{fmt(F['p.naive3'])}</b>?"},
               {"t": at("S02.01", "8,902", -0.05), "html": fmt(F["p.n3"]), "label": NOTE[3]},
               {"t": at("S02.01", "not 8,000", -0.05), "html": fmt(F["p.n3"]), "label": NOTE[3],
                "sub": f"not 20 \u00d7 400 = <b>{fmt(F['p.naive3'])}</b>"}]
    # the opening goes on: each move's choices as threads, the count of choices beside it
    t_typ = at("S02.02", "a typical position", -0.2)
    rest = ITALIAN[2:]
    per = (t_typ - 0.3 - (t_more + 0.25)) / len(rest)
    for i, san in enumerate(rest):
        t0 = t_more + 0.25 + i * per
        br = B.branches()
        idx, n = B.play(san, t0 + per - 0.26, 0.22)
        B.group(t0, t0 + per - 0.24, br, spread=0.3 * per, pick=idx, t1=t0 + per - 0.04)
        side = "White" if i % 2 == 0 else "Black"
        counter.append({"t": round(t0, 3), "html": fmt(n), "label": f"choices for {side} this move"})
    moves = B.branches()
    t30 = at("S02.02", "about 30", -0.1)
    B.group(t_typ, end - 0.5, moves, spread=1.0, tick_db=-27)
    counter += [{"t": t_typ, "html": fmt(len(moves)), "label": "choices for White this move"},
                {"t": t30, "html": f"~{fmt(F['sh.moves'])}", "label": "legal moves in a typical position",
                 "sub": f"in this position: <b>{len(moves)}</b>"}]
    d.update(B.export(), counter=counter, cam=[[0, *hero(204, 0.0)], [end, *hero(196, 0.06)]])
    d["cues"] = B.cues + _counter_cues(counter)
    return d


def S03_Runaway() -> dict:
    """The real game tree grows out of the board (20, 400, 8,902, then 197,281 games as one dot each), then a fog for
    what can't be drawn: 119 million, 85 billion, 69 trillion (8,437 for every game Lichess has stored)."""
    d, at, end = _scene("S03_Runaway")
    B = Board()
    t_g = 0.6
    t197, t119 = at("S03.01", "197,281", -0.05), at("S03.01", "119 million", -0.05)
    t85, t69 = at("S03.02", "85 billion", -0.05), at("S03.02", "69 trillion", -0.05)
    t_li = at("S03.02", "over 8 thousand", -0.1)
    grow = [t_g + 0.6, t_g + 1.4, t_g + 2.2, t197]
    d["tree"] = {**game_tree(4, ITALIAN[:4]), "show": [t_g, 1e9], "grow": grow, "path_t": t197 + 0.6,
                 "fog": [[t119, 0.0], [t119 + 0.9, 0.25], [t85 - 0.1, 0.25], [t85 + 0.8, 0.55], [t69 - 0.1, 0.55],
                         [t69 + 1.2, 1.0]]}
    beyond = "beyond 2 moves each: too many to draw"
    counter = [{"t": 0, "html": "1", "label": NOTE[0], "fade": 0.3},
               {"t": grow[0], "html": fmt(F["m.first"]), "label": NOTE[1]},
               {"t": grow[1], "html": fmt(F["p.n2"]), "label": NOTE[2]},
               {"t": grow[2], "html": fmt(F["p.n3"]), "label": NOTE[3]},
               {"t": t197, "html": fmt(F["p.n4"]), "label": NOTE[4], "sub": "every branch is a real game"},
               {"t": t119, "html": fmt(F["p.n6"]), "label": NOTE[6], "sub": beyond},
               {"t": t85, "html": fmt(F["p.n8"]), "label": NOTE[8], "sub": beyond},
               {"t": t69, "html": fmt(F["p.n10"]), "label": "possible games after 5 moves each", "sub": beyond,
                "accent": True},
               {"t": t_li, "html": fmt(F["p.n10"]), "label": "possible games after 5 moves each", "accent": True,
                "sub": f"<b>{round(F['li.ratio10']):,}</b> for every game Lichess has stored"}]
    d.update(B.export(), counter=counter,
             cam=[[0, *hero(200, 0.02)], [t_g, *hero(200, 0.02)], [t_g + 1.4, *TREE0], [t119, *TREE0],
                  [t119 + 1.2, *TREE1], [t69, *TREE1], [t69 + 1.4, *TREE2], [end, *TREE3]])
    d["cues"] = B.cues + _counter_cues(counter) + [[t69, "thock", -8]]
    return d


def S04_Shannon() -> dict:
    """Shannon (1950) on a real position: about thirty moves, x1,000 a pair of moves, 1,000^40, a one and 120 zeros;
    the atoms are the first 80 of them; every atom a computer since the Big Bang still falls 30 trillion times short."""
    d, at, end = _scene("S04_Shannon")
    B = _italian_board()
    moves = B.branches()
    t30, t1000 = at("S04.02", "about 30", -0.1), at("S04.02", "about a thousand", -0.1)
    t40, t_one, t120 = at("S04.02", "typical 40", -0.1), at("S04.02", "a one followed", -0.1), at("S04.02", "120 zeros", 0.0)
    t_at, t_80 = at("S04.03", "atoms in the", -0.1), at("S04.03", "80 zeros", 0.1)
    t_comp, t_bang, t_short = at("S04.04", "a computer", -0.1), at("S04.04", "since the Big Bang", -0.1), \
        at("S04.04", "30 trillion", -0.1)
    B.group(t30, t_one, moves, spread=1.2, tick_db=-27)
    counter = [{"t": at("S04.01", "Claude Shannon", -0.1), "html": fmt(F["sh.year"]).replace(",", ""),
                "label": "Claude Shannon", "sub": "Programming a computer for playing chess", "fade": 0.3},
               {"t": t30, "html": f"~{fmt(F['sh.moves'])}", "label": "choices in a typical position",
                "sub": f"in this position: <b>{len(moves)}</b>"},
               {"t": t1000, "html": fmt(F["sh.pair"]), "label": "for each pair of moves",
                "sub": f"{fmt(F['sh.moves'])} \u00d7 {fmt(F['sh.moves'])} = {fmt(F['sh.pair_exact'])}, about "
                       f"{fmt(F['sh.pair'])}"},
               {"t": t40, "html": f"{fmt(F['sh.pair'])}<sup>{fmt(F['sh.game'])}</sup>",
                "label": f"over a typical {fmt(F['sh.game'])}-move game"},
               {"t": t120, "html": f"10<sup>{fmt(F['sh.exp'])}</sup>", "label": "Shannon's estimate for a typical game",
                "size": 250}]
    atoms, zeros = int(F["u.atoms_exp"]), int(F["sh.zeros"])
    comp = int(math.log10(F["u.games"]))                      # the atom-computers' games: about 3 x 10^106
    d["zeros"] = {"t0": t_one, "t_full": t120 - 0.05, "zeros": zeros, "atoms": atoms, "y": 620,
                  "t_out": 1e9, "phases": [[t_at, atoms, 999], [t_80, atoms, atoms], [t_bang + 0.6, comp, comp]]}
    games = f"{F['u.games']:.1e}".split("e+")
    d["texts"] = [
        {"html": f"atoms in the observable universe: about 10<sup>{atoms}</sup>", "cls": "lb", "x": 540, "y": 880,
         "anchor": "c", "t0": t_at, "t1": t_comp - 0.3, "fade": 0.3},
        {"html": f"Shannon's estimate: <i>{fmt(F['sh.over_atoms_exp'])} more zeros</i>", "cls": "sub", "x": 540,
         "y": 928, "anchor": "c", "t0": t_80, "t1": t_comp - 0.3, "fade": 0.3},
        {"html": f"every atom: <b>{fmt(F['u.rate'] / 1e9)} billion</b> games a second", "cls": "lb",
         "x": 540, "y": 880, "anchor": "c", "t0": t_comp, "t1": 1e9, "fade": 0.3},
        {"html": f"for {F['u.age_gyr']:.1f} billion years: about <b>{round(float(games[0]))} \u00d7 10<sup>"
                 f"{int(games[1])}</sup></b> games", "cls": "sub", "x": 540, "y": 928, "anchor": "c",
         "t0": t_bang, "t1": 1e9, "fade": 0.3},
        {"html": f"still <i>about {round(F['u.short'] / 1e12, -1):.0f} trillion times short</i>", "cls": "sub",
         "x": 540, "y": 972, "anchor": "c", "t0": t_short, "t1": 1e9, "fade": 0.3},
    ]
    d.update(B.export(), counter=counter,
             cam=[[0, *hero(212, -0.02)], [t_one, *hero(198, 0.07)], [t_one + 1.0, *ZEROS_CAM]],
             exposure=[[t_one, 1.0], [t_one + 0.8, 0.2]])
    groups = zeros // 3
    d["cues"] = (B.cues + _counter_cues(counter)
                 + [[round(t_one + (t120 - t_one) * i / groups, 3), "tick", -28] for i in range(groups)]
                 + [[t120, "thock", -10], [t_80, "tick", -18], [t_short, "thock", -12]])
    return d


def S05_TryIt() -> dict:
    """Even that is an underestimate (the longest game, a count with 29,242 digits); the shortest game: the eight
    two-move mates, all the fool's mate, played on the board; then back to the start and the twenty first moves,
    ending on S00's first frame (the Short loops)."""
    d, at, end = _scene("S05_TryIt")
    B = _italian_board()
    t_rules, t29 = at("S05.01", "the rules let", -0.1), at("S05.01", "29 thousand", -0.1)
    assert F["lab.longest"] - int(F["lab.longest"]) == 0.5
    for k in range(len(ITALIAN)):
        B.rewind(at("S05.01", "8,848", 0.0) + k * 0.2, 0.18, tok_db=-18)
    t_two, t8 = at("S05.02", "two-move games", -0.1), at("S05.02", "only eight", -0.1)
    t_f, t_g = at("S05.02", "pawns on f", -0.1), at("S05.02", "and g", -0.1)
    t_q = at("S05.02", "queen slides", -0.1)
    B.play("f3", t_f, 0.3)
    B.play("e5", t_f + 0.55, 0.3)
    B.play("g4", t_g, 0.3)
    mate = [b for b in B.branches() if b["san"] == "Qh4#"]
    assert len(mate) == 1 and F["s4.mates"] == 8
    t_reset, t20 = at("S05.03", "set up a board", -0.2), at("S05.03", "twenty first moves", -0.1)
    B.group(t_q - 0.2, t_reset, mate, spread=0.0, accent=[0])
    B.play("Qh4", t_q + 0.3, 0.45, tok_db=-6)
    for k in range(4):
        B.rewind(t_reset + k * 0.2, 0.18, tok_db=-18)
    first = B.branches()
    t_last = round(end - 0.55, 3)
    B.group(t20, t_last - 0.25, first, spread=0.8, tick_db=-27)
    counter = [{"t": 0, "html": f"10<sup>{fmt(F['sh.exp'])}</sup>", "label": "Shannon's estimate for a typical game",
                "size": 250},
               {"t": t_rules, "html": f"{int(F['lab.longest']):,}\u00bd", "label": "moves in the longest possible game",
                "sub": "under FIDE's automatic 75-move rule"},
               {"t": t29, "html": fmt(F["lab.digits"]), "label": "digits in the count of every legal game",
                "sub": f"at least; Shannon's estimate has <b>{fmt(F['sh.exp'] + 1)}</b>"},
               {"t": t_two, "html": fmt(F["p.n4"]), "label": "two-move games"},
               {"t": t8, "html": fmt(F["s4.mates"]), "label": f"of {fmt(F['p.n4'])} two-move games end in mate"},
               {"t": t_q + 0.75, "html": fmt(F["s4.mates"]), "label": f"of {fmt(F['p.n4'])} two-move games end in mate",
                "sub": "the fool's mate: f3, e5, g4, <i>Queen h4</i>"},
               {"t": t20, "html": fmt(F["m.first"]), "label": "White's first moves", "fade": 0.25, "out": t_last - 0.3},
               {"t": t_last, "html": "1", "label": NOTE[0], "fade": 0.25}]
    d["zeros"] = {"t0": -1.0, "t_full": -0.5, "zeros": int(F["sh.zeros"]), "atoms": int(F["u.atoms_exp"]), "y": 620,
                  "t_out": t_rules, "phases": [[0, int(F["u.atoms_exp"]), int(F["u.atoms_exp"])]]}
    d.update(B.export(), counter=counter,
             cam=[[0, *ZEROS_CAM], [t_rules, *ZEROS_CAM], [t_rules + 1.2, *hero(214, 0.0)], [t_f - 0.6, *hero(214, 0.0)],
                  [t_f + 0.4, *FOOL_CAM], [t_reset, *FOOL_CAM], [t_reset + 1.2, *hero(224, -0.03)], [end - 0.6, *OPEN]],
             exposure=[[0, 0.2], [t_rules, 0.2], [t_rules + 0.9, 1.0]])
    d["cues"] = B.cues + _counter_cues(counter) + [[t_q + 0.75, "thock", -9]]
    return d


EXPORTERS = {f.__name__: f for f in (LookA, S00_Hook, S01_First, S02_Open, S03_Runaway, S04_Shannon, S05_TryIt)}


def export(scene_id: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{scene_id}.json"
    path.write_text(json.dumps(EXPORTERS[scene_id](), separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return path


if __name__ == "__main__":
    for sid in sys.argv[1:] or EXPORTERS:
        print(" ", export(sid).relative_to(ROOT))
