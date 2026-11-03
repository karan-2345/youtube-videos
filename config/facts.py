"""
config/facts.py -- the single source of truth for every number in the Short.

Rules
  * An INPUT is a published value or a design choice, and carries a source.
    Source tags ([CPW], [A048987], [SHAN50], ...) are listed in research/notes.md.
  * Everything else is COMPUTED here: the move counts by our own move generator (config/chess.py, slow parts cached
    by config/tree.py), the atoms by config/cosmos.py; never typed in.
  * Scenes, narration and captions read values from here; nothing is duplicated.

Results are cached in renders/cache/facts.json, keyed on a hash of config/*.py.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "renders" / "cache" / "facts.json"


# ==========================================================================
# Registry
# ==========================================================================

@dataclass
class Fact:
    key: str
    value: float
    unit: str
    desc: str
    kind: str          # "input" | "computed"
    fmt: str = ",.4g"
    source: str = ""
    section: str = ""


class Facts:
    def __init__(self):
        self._d: dict[str, Fact] = {}
        self._section = ""

    def input(self, key, value, unit, desc, source, fmt=",.4g"):
        return self._add(Fact(key, float(value), unit, desc, "input", fmt, source, self._section))

    def calc(self, key, value, unit, desc, fmt=",.4g"):
        return self._add(Fact(key, float(value), unit, desc, "computed", fmt, "", self._section))

    def _add(self, fact):
        assert fact.key not in self._d, f"duplicate fact {fact.key}"
        assert math.isfinite(fact.value), f"{fact.key} is not finite"
        self._d[fact.key] = fact
        return fact.value

    def __getitem__(self, key) -> float:
        return self._d[key].value

    def __contains__(self, key):
        return key in self._d

    def fact(self, key) -> Fact:
        return self._d[key]

    def fmt(self, key, spec=None) -> str:
        f = self._d[key]
        return format(f.value, spec or f.fmt)

    def items(self):
        return self._d.items()

    def by_section(self):
        out: dict[str, list[Fact]] = {}
        for f in self._d.values():
            out.setdefault(f.section, []).append(f)
        return out


SECTIONS: list = []


def section(title, blurb=""):
    def deco(fn):
        SECTIONS.append((title, blurb, fn))
        return fn
    return deco


def _tree():
    from config import tree
    return tree.counts()


# Published counts of possible games after n plies, n = 7..15 (too many for this laptop; n <= 6 is computed here)
PUBLISHED_PERFT = {
    7: 3_195_901_860, 8: 84_998_978_956, 9: 2_439_530_234_167, 10: 69_352_859_712_417,
    11: 2_097_651_003_696_806, 12: 62_854_969_236_701_747, 13: 1_981_066_775_000_396_239,
    14: 61_885_021_521_585_529_237, 15: 2_015_099_950_053_364_471_960,
}


# ==========================================================================
# 1. The first move
# ==========================================================================

@section("The first move", "Every legal first move for White, from our own move generator (config/chess.py): each of "
                           "the eight pawns one or two squares, each knight to two squares, nothing else. Black then "
                           "has the same twenty replies whatever White did.")
def _first(f: Facts):
    t = _tree()
    f.calc("m.first", t["perft"]["1"], "moves", "White's legal first moves", ",.0f")
    f.calc("m.pawn", t["first_by_piece"]["pawn"], "moves", "of them pawn moves (8 pawns x one or two squares)", ",.0f")
    from config import chess as C
    start = C.Position()
    f.calc("m.pawns", sum(1 for s in C.SQUARES if start.b[s] == C.P), "", "pawns per side", ".0f")
    f.calc("m.knight", t["first_by_piece"]["knight"], "moves", "of them knight moves (2 knights x 2 squares)", ",.0f")
    f.calc("m.other", t["first_by_piece"].get("other", 0), "moves", "first moves by any other piece", ",.0f")
    assert t["black_first"] == [20], t["black_first"]
    f.calc("m.black_first", t["black_first"][0], "moves", "Black's replies, after any of White's 20", ",.0f")
    f.calc("p.n2", t["perft"]["2"], "games", "possible games after one move each (2 plies)", ",.0f")


# ==========================================================================
# 2. Why the third ply is not times twenty
# ==========================================================================

@section("Not times twenty", "If every position still allowed 20 moves, ply 3 would give 400 x 20 = 8,000 games. Our "
                             "count is 8,902: each pawn move opens lines for the pieces behind it.")
def _third(f: Facts):
    t = _tree()
    n3 = f.calc("p.n3", t["perft"]["3"], "games", "possible games after White's second move (3 plies)", ",.0f")
    f.calc("p.naive3", t["perft"]["2"] * 20, "games", "what twenty choices every time would give", ",.0f")
    f.calc("p.extra3", n3 - t["perft"]["2"] * 20, "games", "how many more there really are", ",.0f")
    w2 = t["white_second"]
    f.calc("w2.min", min(w2.values()), "moves", "fewest choices White can have on move two", ",.0f")
    f.calc("w2.max", max(w2.values()), "moves", "most choices White can have on move two", ",.0f")
    f.calc("w2.e4e5", w2["e4 e5"], "moves", "White's choices after 1. e4 e5", ",.0f")
    f.calc("w2.mean", n3 / t["perft"]["2"], "moves", "average choices on White's second move", ".2f")
    for d in range(1, 15):
        nd = t["perft"][str(d)] if d <= 6 else PUBLISHED_PERFT[d]
        nn = t["perft"][str(d + 1)] if d + 1 <= 6 else PUBLISHED_PERFT[d + 1]
        f.calc(f"br.{d}", nn / nd, "moves", f"average legal moves after {d} plies (count {d + 1} / count {d})", ".2f")


# ==========================================================================
# 3. Two moves each, and the fastest checkmate
# ==========================================================================

@section("Two moves each", "Ply 4 counted move by move, with the counters of the chessprogramming.org table: 8 of the "
                           "197,281 games are already checkmate, all of them versions of the fool's mate (White "
                           "pushes the f- and g-pawns, Black's queen mates on h4).")
def _two(f: Facts):
    t = _tree()
    st = t["stats"]["4"]
    f.calc("p.n4", t["perft"]["4"], "games", "possible games after two moves each (4 plies)", ",.0f")
    f.calc("s4.captures", st["captures"], "games", "of them ending with a capture", ",.0f")
    f.calc("s4.checks", st["checks"], "games", "of them ending with a check", ",.0f")
    f.calc("s4.mates", st["mates"], "games", "of them ending in checkmate", ",.0f")
    mates = t["mates4"]
    assert len(mates) == st["mates"]
    assert all(g[3] == "Qh4#" and set(g[0::2]) <= {"f3", "f4", "g4"} and g[1] in ("e5", "e6") for g in mates), mates
    f.calc("s4.mate_share", st["mates"] / t["perft"]["4"], "", "share of two-move games that are mate", ".2e")
    f.calc("s4.one_in", t["perft"]["4"] / st["mates"], "", "one game in this many", ",.0f")
    st5 = t["stats"]["5"]
    f.calc("s5.mates", st5["mates"], "games", "checkmates after 5 plies", ",.0f")
    f.calc("s5.checks", st5["checks"], "games", "checks after 5 plies", ",.0f")
    f.calc("s5.ep", st5["ep"], "games", "en passant captures on ply 5", ",.0f")
    f.calc("pos.d3", t["distinct"]["3"], "positions", "different positions after 3 plies (games can transpose)",
           ",.0f")
    f.calc("pos.d4", t["distinct"]["4"], "positions", "different positions after 4 plies", ",.0f")


# ==========================================================================
# 4. The runaway
# ==========================================================================

@section("The runaway", "Plies 5 and 6 are computed here (ply 6 on four cores); plies 7-15 are published counts "
                        "computed by others with far more computer time [A048987, CPW] (FLAG 2).")
def _runaway(f: Facts):
    t = _tree()
    f.calc("p.n5", t["perft"]["5"], "games", "possible games after 5 plies", ",.0f")
    f.calc("p.n6", t["perft"]["6"], "games", "possible games after three moves each (6 plies)", ",.0f")
    for d, n in PUBLISHED_PERFT.items():
        f.input(f"p.n{d}", n, "games", f"possible games after {d} plies", "[A048987] [CPW]", ",.0f")
    lich = f.input("li.games", 8_220_312_882, "games", "standard rated games in the Lichess database (2013-01 to "
                   "2026-09, read 2026-11-01)", "[LICHESS]", ",.0f")
    cross = min(d for d in range(2, 16) if f[f"p.n{d}"] > lich)
    f.calc("li.ply", cross, "plies", "first ply where the possible games outnumber every rated game on Lichess",
           ".0f")
    f.calc("li.moves_each", cross / 2, "moves", "the same, in moves each", ".0f")
    f.calc("li.ratio8", f["p.n8"] / lich, "", "possible 4-move-each games per rated Lichess game", ".1f")
    f.calc("li.ratio10", f["p.n10"] / lich, "", "possible 5-move-each games per rated Lichess game", ",.0f")
    f.calc("p.digits15", len(str(PUBLISHED_PERFT[15])), "digits", "digits in the 15-ply count", ".0f")


# ==========================================================================
# 5. Shannon's estimate
# ==========================================================================

@section("Shannon's estimate", "Shannon (1950): about 30 legal moves in a typical position, so about 10^3 for a move "
                               "by White and one by Black, over a typical 40-move game: (10^3)^40 = 10^120 [SHAN50].")
def _shannon(f: Facts):
    f.input("sh.year", 1950, "", "Shannon's paper", "[SHAN50]", ".0f")
    w = f.input("sh.moves", 30, "moves", "legal moves in a typical position (Shannon, after de Groot)", "[SHAN50]",
                ".0f")
    f.calc("sh.pair_exact", w * w, "", "a move each: 30 x 30", ",.0f")
    pair = f.input("sh.pair", 1000, "", "Shannon rounds that to 10^3", "[SHAN50]", ",.0f")
    g = f.input("sh.game", 40, "moves", "a typical game, to resignation", "[SHAN50]", ".0f")
    e = f.calc("sh.exp", round(g * math.log10(pair)), "", "Shannon's number = 10^this", ".0f")
    f.calc("sh.zeros", e, "zeros", "a one followed by this many zeros", ".0f")
    f.calc("sh.exact_exp", g * math.log10(w * w), "", "with 900 instead of 1,000 per move pair: 10^this", ".1f")
    f.input("sh.pos_exp", 43, "", "Shannon's estimate of positions: about 10^43", "[SHAN50]", ".0f")


# ==========================================================================
# 6. Atoms and the impossible computer
# ==========================================================================

@section("Atoms", "Atoms in the observable universe from Planck 2018 (config/cosmos.py), and a thought experiment: "
                  "every one of them a computer playing a billion games a second since the Big Bang.")
def _atoms(f: Facts):
    from config import cosmos
    atoms = f.calc("u.atoms", cosmos.atoms(), "atoms", "atoms (nuclei) in the observable universe", ".2e")
    f.calc("u.atoms_exp", round(math.log10(atoms)), "", "the usual round figure: 10^this", ".0f")
    f.calc("u.horizon_gly", cosmos.horizon_m() / cosmos.LY / 1e9, "billion ly", "radius of the observable universe",
           ".1f")
    age = f.calc("u.age_gyr", cosmos.age_gyr(), "billion years", "age of the universe", ".2f")
    rate = f.input("u.rate", 1e9, "games/s", "each atom-computer plays a billion games a second (a design choice: "
                   "far beyond any real computer)", "[DESIGN]", ".0e")
    games = f.calc("u.games", atoms * rate * age * cosmos.GYR, "games", "games all of them play since the Big Bang",
                   ".2e")
    f.calc("u.short", 10 ** f["sh.exp"] / games, "", "how many times short of Shannon's number", ".2e")
    f.calc("sh.over_atoms_exp", f["sh.exp"] - f["u.atoms_exp"], "", "Shannon's number / atoms = 10^this", ".0f")


# ==========================================================================
# 7. The real count is bigger still
# ==========================================================================

@section("All legal games", "Shannon's 10^120 counts typical 40-move games. Under the automatic 75-move and fivefold "
                            "repetition rules (FIDE, 2014) chess is finite: the longest possible game is 8,848.5 moves, "
                            "and the number of possible games is between 10^29,241 and 10^34,082 [LAB15].")
def _labelle(f: Facts):
    f.input("lab.longest", 8848.5, "moves", "the longest possible game", "[LAB15]", ",.1f")
    f.input("lab.longest_whole", 8848, "moves", "said as 'eight thousand eight hundred and forty-eight and a half'",
            "[LAB15]", ",.0f")
    lo = f.input("lab.lo_exp", 29241, "", "at least 10^this possible games (Monte Carlo)", "[LAB15]", ",.0f")
    f.input("lab.hi_exp", 34082, "", "at most 10^this", "[LAB15]", ",.0f")
    f.calc("lab.digits", lo + 1, "digits", "so the count has at least this many digits", ",.0f")
    f.input("tromp.positions", 4.822e44, "positions", "legal chess positions, estimated (+-0.028e44, 95 %)",
            "[TROMP22]", ".3e")


# ==========================================================================
# Sanity checks against published values
# ==========================================================================

EXPECTED = [
    ("CPW / A048987: 20 games after 1 ply", "m.first", 20, 0, "games"),
    ("CPW / A048987: 400 after 2 plies", "p.n2", 400, 0, "games"),
    ("CPW / A048987: 8,902 after 3 plies", "p.n3", 8902, 0, "games"),
    ("CPW / A048987: 197,281 after 4 plies", "p.n4", 197281, 0, "games"),
    ("CPW / A048987: 4,865,609 after 5 plies", "p.n5", 4865609, 0, "games"),
    ("CPW / A048987: 119,060,324 after 6 plies", "p.n6", 119060324, 0, "games"),
    ("CPW: 1,576 captures at ply 4", "s4.captures", 1576, 0, ""),
    ("CPW: 469 checks at ply 4", "s4.checks", 469, 0, ""),
    ("CPW: 8 checkmates at ply 4", "s4.mates", 8, 0, ""),
    ("CPW: 347 checkmates at ply 5", "s5.mates", 347, 0, ""),
    ("CPW: 27,351 checks at ply 5", "s5.checks", 27351, 0, ""),
    ("CPW: 258 en passant captures at ply 5", "s5.ep", 258, 0, ""),
    ("A083276: 5,362 distinct positions after 3 plies", "pos.d3", 5362, 0, ""),
    ("A083276: 72,078 distinct positions after 4 plies", "pos.d4", 72078, 0, ""),
    ("Shannon: 10^120", "sh.exp", 120, 0, ""),
    ("Atoms in the observable universe: about 10^80 (Wikipedia, Shannon number)", "u.atoms_exp", 80, 0, ""),
    ("Planck 2018: age 13.8 billion years", "u.age_gyr", 13.8, 0.05, "Gyr"),
    ("Observable universe radius 46.5 billion light years (Wikipedia, Observable universe)", "u.horizon_gly", 46.5, 0.5,
     "Gly"),
]


def run_checks(F: Facts):
    rows = []
    for label, key, expected, tol, unit in EXPECTED:
        got = F[key]
        rows.append((label, key, expected, got, tol, unit, abs(got - expected) <= tol))
    return rows


# ==========================================================================
# Build / cache
# ==========================================================================

def _source_hash():
    h = hashlib.sha256()
    for p in sorted((ROOT / "config").glob("*.py")):
        if p.name not in ("style.py", "events.py"):
            h.update(p.read_bytes())
    return h.hexdigest()[:16]


def build() -> Facts:
    F = Facts()
    for title, _blurb, fn in SECTIONS:
        F._section = title
        fn(F)
    F._section = ""
    return F


def load(force=False) -> Facts:
    key = _source_hash()
    if not force and CACHE.exists():
        data = json.loads(CACHE.read_text())
        if data.get("hash") == key:
            F = Facts()
            for d in data["facts"]:
                F._d[d["key"]] = Fact(**d)
            return F
    F = build()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps({"hash": key, "facts": [asdict(x) for _, x in F.items()]}, indent=1))
    return F


F = load()
