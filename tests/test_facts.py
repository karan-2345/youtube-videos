"""pytest: the move generator against the published perft tables, and the story the Short tells."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import chess as C  # noqa: E402
from config.facts import EXPECTED, F, run_checks  # noqa: E402

# chessprogramming.org "Perft Results" test positions [CPW]: tricky castling, en passant, promotions, pins
CPW_POSITIONS = [
    ("kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -", [48, 2039, 97862]),
    ("position 3", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238, 674624]),
    ("position 4", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467, 422333]),
    ("position 4 mirrored", "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1", [6, 264, 9467]),
    ("position 5", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]),
    ("position 6", "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", [46, 2079, 89890]),
]


@pytest.mark.parametrize("row", run_checks(F), ids=[e[0] for e in EXPECTED])
def test_expected_values(row):
    label, key, expected, got, tol, unit, ok = row
    assert ok, f"{label}: expected {expected} +/- {tol} {unit}, got {got}"


@pytest.mark.parametrize("name,fen,counts", CPW_POSITIONS, ids=[p[0] for p in CPW_POSITIONS])
def test_cpw_positions(name, fen, counts):
    for depth, want in enumerate(counts, 1):
        assert C.perft(C.Position(fen), depth) == want, (name, depth)


def test_every_input_has_a_source():
    missing = [k for k, f in F.items() if f.kind == "input" and not f.source]
    assert not missing, missing


def test_make_unmake_restores_everything():
    pos = C.Position("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -")
    before = (list(pos.b), pos.side, pos.castle, pos.ep, dict(pos.kings))
    for m in pos.legal():
        pos.make(m)
        pos.unmake()
        assert (list(pos.b), pos.side, pos.castle, pos.ep, dict(pos.kings)) == before, m


def test_notation():
    pos = C.Position()
    assert sorted(pos.san(m) for m in pos.legal()) == sorted(
        [f + r for f in "abcdefgh" for r in "34"] + ["Na3", "Nc3", "Nf3", "Nh3"])
    p = C.Position().play("f3", "e5", "g4")
    assert "Qh4#" in [p.san(m) for m in p.legal()]


def test_the_story_holds():
    assert F["m.pawn"] + F["m.knight"] == F["m.first"] == 20 and F["m.other"] == 0
    assert F["m.pawn"] == 2 * F["m.pawns"]
    assert F["p.n2"] == F["m.first"] * F["m.black_first"] == 400
    assert F["p.n3"] > F["p.naive3"]                          # more than twenty times, not fewer
    assert F["li.moves_each"] == 4                            # four moves each beats every rated Lichess game
    assert F["p.n7"] < F["li.games"] < F["p.n8"]
    assert F["u.short"] > 1e12                                # even the atom-computers fall trillions short
    assert F["lab.digits"] > F["sh.exp"]
