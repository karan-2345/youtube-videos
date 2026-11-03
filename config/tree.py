"""
config/tree.py -- the slower counts behind the Short, cached in renders/cache/tree.json (keyed on the source of
config/chess.py and this file), so editing the script or the scenes never re-runs them.

    counts()      perft 1-6 from the start position (6 comes from config/chess.perft_cached, ~5 min on 4 cores),
                  the counter table to depth 5, the 8 two-move mates, White's choices after each of the 400
                  one-move-each games, distinct positions after 3 and 4 plies.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "renders" / "cache" / "tree.json"


def _hash() -> str:
    h = hashlib.sha256()
    for name in ("chess.py", "tree.py"):
        h.update((ROOT / "config" / name).read_bytes())
    return h.hexdigest()[:16]


def _compute() -> dict:
    from config import chess as C
    pos = C.Position()
    first = pos.legal()
    by_piece: dict[str, int] = {}
    for m in first:
        p = "pawn" if abs(pos.b[m[0]]) == C.P else "knight" if abs(pos.b[m[0]]) == C.N else "other"
        by_piece[p] = by_piece.get(p, 0) + 1
    first_san = [pos.san(m, first) for m in first]
    # White's number of choices on move two, in each of the 400 games after one move each
    second: dict[str, int] = {}
    for m1 in first:
        s1 = pos.san(m1, first)
        pos.make(m1)
        replies = pos.legal()
        for m2 in replies:
            s2 = pos.san(m2, replies)
            pos.make(m2)
            second[f"{s1} {s2}"] = len(pos.legal())
            pos.unmake()
        pos.unmake()
    return {
        "hash": _hash(),
        "perft": {str(d): C.perft_cached(d) for d in range(1, 7)},
        "stats": {str(d): C.perft_stats(C.Position(), d) for d in range(1, 6)},
        "first_by_piece": by_piece,
        "first_san": first_san,
        "black_first": sorted({len(_after(C, s).legal()) for s in first_san}),
        "white_second": second,
        "mates4": C.mated_games(4),
        "distinct": {str(d): C.distinct_positions(d) for d in (1, 2, 3, 4)},
    }


def _after(C, *sans):
    return C.Position().play(*sans)


def counts(force: bool = False) -> dict:
    if not force and CACHE.exists():
        data = json.loads(CACHE.read_text(encoding="utf-8"))
        if data.get("hash") == _hash():
            return data
    data = _compute()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(data, indent=1), encoding="utf-8")
    return data


if __name__ == "__main__":
    import sys
    import time
    sys.path.insert(0, str(ROOT))
    t0 = time.perf_counter()
    d = counts(force="--force" in sys.argv)
    print({k: v for k, v in d.items() if k in ("perft", "first_by_piece", "black_first", "distinct")})
    print(f"{time.perf_counter() - t0:.0f} s")
