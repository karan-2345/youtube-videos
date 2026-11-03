"""
config/chess.py -- a small, self-contained legal move generator, written for this Short so every count it shows is
computed here and checked against the published tables (config/facts.py EXPECTED, tests/).

0x88 board (square = 16 * rank + file, a1 = 0, h8 = 119). Pieces: +1..+6 white P N B R Q K, -1..-6 black, 0 empty.
Moves are tuples (from, to, promo, flag); flag 0 normal, 1 double pawn push, 2 en passant, 3 castle king side,
4 castle queen side. Legality: every pseudo-legal move is made and kept only if the mover's king is not attacked.

    perft(pos, depth)          number of move sequences ("possible games") of exactly `depth` plies [CPW, A048987]
    perft_stats(pos, depth)    the same leaves split into captures, en passant, castles, promotions, checks, mates
    perft_cached(depth)        the start-position count, cached in renders/cache/perft.json (depth 6 takes minutes)

    python -m config.chess perft 5          time a count
    python -m config.chess cache 6          fill the cache (4 processes)
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "renders" / "cache" / "perft.json"

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
P, N, B, R, Q, K = 1, 2, 3, 4, 5, 6
LETTER = {P: "", N: "N", B: "B", R: "R", Q: "Q", K: "K"}
FEN_PIECE = {"p": P, "n": N, "b": B, "r": R, "q": Q, "k": K}
SQUARES = [r * 16 + f for r in range(8) for f in range(8)]
N_OFF = (33, 31, 18, 14, -33, -31, -18, -14)
B_DIR = (17, 15, -17, -15)
R_DIR = (16, -16, 1, -1)
K_OFF = B_DIR + R_DIR
# castling rights: 1 = white king side, 2 = white queen side, 4 = black king side, 8 = black queen side
CR_MASK = [15] * 128
CR_MASK[0], CR_MASK[4], CR_MASK[7] = 15 & ~2, 15 & ~3, 15 & ~1
CR_MASK[112], CR_MASK[116], CR_MASK[119] = 15 & ~8, 15 & ~12, 15 & ~4


def name(sq: int) -> str:
    return "abcdefgh"[sq & 7] + str((sq >> 4) + 1)


def square(s: str) -> int:
    return (int(s[1]) - 1) * 16 + "abcdefgh".index(s[0])


class Position:
    __slots__ = ("b", "side", "castle", "ep", "kings", "stack")

    def __init__(self, fen: str = START_FEN):
        rows, side, castle, ep, *_ = fen.split() + ["-", "-"]
        self.b = [0] * 128
        self.kings = {1: -1, -1: -1}
        for i, row in enumerate(rows.split("/")):
            f = 0
            for ch in row:
                if ch.isdigit():
                    f += int(ch)
                    continue
                sq = (7 - i) * 16 + f
                pc = FEN_PIECE[ch.lower()] * (1 if ch.isupper() else -1)
                self.b[sq] = pc
                if abs(pc) == K:
                    self.kings[1 if pc > 0 else -1] = sq
                f += 1
        self.side = 1 if side == "w" else -1
        self.castle = sum(v for c, v in (("K", 1), ("Q", 2), ("k", 4), ("q", 8)) if c in castle)
        self.ep = -1 if ep == "-" else square(ep)
        self.stack = []

    # ------------------------------------------------------------ attacks
    def attacked(self, sq: int, by: int) -> bool:
        b = self.b
        if by == 1:
            for s in (sq - 15, sq - 17):
                if not s & 0x88 and b[s] == 1:
                    return True
        else:
            for s in (sq + 15, sq + 17):
                if not s & 0x88 and b[s] == -1:
                    return True
        kn, kg = N * by, K * by
        for o in N_OFF:
            s = sq + o
            if not s & 0x88 and b[s] == kn:
                return True
        for o in K_OFF:
            s = sq + o
            if not s & 0x88 and b[s] == kg:
                return True
        bb, rr, qq = B * by, R * by, Q * by
        for d in B_DIR:
            s = sq + d
            while not s & 0x88:
                pc = b[s]
                if pc:
                    if pc == bb or pc == qq:
                        return True
                    break
                s += d
        for d in R_DIR:
            s = sq + d
            while not s & 0x88:
                pc = b[s]
                if pc:
                    if pc == rr or pc == qq:
                        return True
                    break
                s += d
        return False

    def in_check(self, side: int | None = None) -> bool:
        side = self.side if side is None else side
        return self.attacked(self.kings[side], -side)

    # ------------------------------------------------------------ move generation
    def pseudo(self) -> list:
        b, us, out = self.b, self.side, []
        add = out.append
        fwd = 16 * us
        start, last = (1, 7) if us == 1 else (6, 0)
        for sq in SQUARES:
            pc = b[sq] * us
            if pc <= 0:
                continue
            if pc == P:
                to = sq + fwd
                if not to & 0x88 and not b[to]:
                    if to >> 4 == last:
                        for pr in (Q, R, B, N):
                            add((sq, to, pr, 0))
                    else:
                        add((sq, to, 0, 0))
                        if sq >> 4 == start and not b[to + fwd]:
                            add((sq, to + fwd, 0, 1))
                for to in (sq + fwd - 1, sq + fwd + 1):
                    if to & 0x88:
                        continue
                    if b[to] * us < 0:
                        if to >> 4 == last:
                            for pr in (Q, R, B, N):
                                add((sq, to, pr, 0))
                        else:
                            add((sq, to, 0, 0))
                    elif to == self.ep:
                        add((sq, to, 0, 2))
            elif pc == N or pc == K:
                for o in (N_OFF if pc == N else K_OFF):
                    to = sq + o
                    if not to & 0x88 and b[to] * us <= 0:
                        add((sq, to, 0, 0))
            else:
                dirs = B_DIR if pc == B else R_DIR if pc == R else K_OFF
                for d in dirs:
                    to = sq + d
                    while not to & 0x88:
                        t = b[to] * us
                        if t > 0:
                            break
                        add((sq, to, 0, 0))
                        if t < 0:
                            break
                        to += d
        # castling: king and rook unmoved (the rights track that), squares between empty, king never crosses check
        e = 4 if us == 1 else 116
        ks, qs = (1, 2) if us == 1 else (4, 8)
        if self.castle & (ks | qs) and b[e] == K * us and not self.attacked(e, -us):
            if self.castle & ks and not b[e + 1] and not b[e + 2] and not self.attacked(e + 1, -us) \
                    and not self.attacked(e + 2, -us):
                add((e, e + 2, 0, 3))
            if self.castle & qs and not b[e - 1] and not b[e - 2] and not b[e - 3] and not self.attacked(e - 1, -us) \
                    and not self.attacked(e - 2, -us):
                add((e, e - 2, 0, 4))
        return out

    def make(self, m) -> None:
        frm, to, promo, flag = m
        b, us = self.b, self.side
        pc = b[frm]
        cap_sq = to - 16 * us if flag == 2 else to
        captured = b[cap_sq]
        self.stack.append((m, captured, self.castle, self.ep))
        b[cap_sq] = 0
        b[to] = promo * us if promo else pc
        b[frm] = 0
        if flag == 3:
            b[frm + 1], b[frm + 3] = b[frm + 3], 0
        elif flag == 4:
            b[frm - 1], b[frm - 4] = b[frm - 4], 0
        if pc == K * us:
            self.kings[us] = to
        self.castle &= CR_MASK[frm] & CR_MASK[to]
        self.ep = frm + 16 * us if flag == 1 else -1
        self.side = -us

    def unmake(self) -> None:
        (frm, to, promo, flag), captured, self.castle, self.ep = self.stack.pop()
        b = self.b
        us = self.side = -self.side
        pc = P * us if promo else b[to]
        b[frm] = pc
        b[to] = 0
        b[to - 16 * us if flag == 2 else to] = captured
        if flag == 3:
            b[frm + 3], b[frm + 1] = b[frm + 1], 0
        elif flag == 4:
            b[frm - 4], b[frm - 1] = b[frm - 1], 0
        if pc == K * us:
            self.kings[us] = frm

    def legal(self) -> list:
        out = []
        us = self.side
        for m in self.pseudo():
            self.make(m)
            if not self.attacked(self.kings[us], -us):
                out.append(m)
            self.unmake()
        return out

    def captures(self, m) -> bool:
        return m[3] == 2 or self.b[m[1]] != 0

    # ------------------------------------------------------------ notation
    def san(self, m, legal: list | None = None) -> str:
        frm, to, promo, flag = m
        pc = abs(self.b[frm])
        if flag == 3:
            s = "O-O"
        elif flag == 4:
            s = "O-O-O"
        else:
            cap = self.captures(m)
            if pc == P:
                s = (name(frm)[0] + "x" if cap else "") + name(to) + ("=" + LETTER[promo] if promo else "")
            else:
                legal = self.legal() if legal is None else legal
                rivals = [x for x in legal if x[1] == to and x[0] != frm and abs(self.b[x[0]]) == pc]
                dis = ""
                if rivals:
                    if all((x[0] & 7) != (frm & 7) for x in rivals):
                        dis = name(frm)[0]
                    elif all((x[0] >> 4) != (frm >> 4) for x in rivals):
                        dis = name(frm)[1]
                    else:
                        dis = name(frm)
                s = LETTER[pc] + dis + ("x" if cap else "") + name(to)
        self.make(m)
        if self.in_check():
            s += "#" if not self.legal() else "+"
        self.unmake()
        return s

    def play(self, *sans: str) -> "Position":
        """Play moves given in SAN (e.g. 'e4', 'Nf3', 'Qh4#'); returns self."""
        for s in sans:
            legal = self.legal()
            hit = [m for m in legal if self.san(m, legal).rstrip("+#") == s.rstrip("+#")]
            assert len(hit) == 1, (s, [self.san(m, legal) for m in legal])
            self.make(hit[0])
        return self

    def key(self) -> tuple:
        """Position identity for counting distinct positions: board, side, castling, and the en passant square
        only when an en passant capture is actually legal (the convention of OEIS A083276)."""
        ep = self.ep
        if ep >= 0 and not any(m[3] == 2 for m in self.legal()):
            ep = -1
        return (tuple(self.b[s] for s in SQUARES), self.side, self.castle, ep)


# ---------------------------------------------------------------- counting
def perft(pos: Position, depth: int) -> int:
    """Leaf count of the legal move tree, with the last ply counted in bulk."""
    moves = pos.legal()
    if depth == 1:
        return len(moves)
    if depth == 0:
        return 1
    n = 0
    for m in moves:
        pos.make(m)
        n += perft(pos, depth - 1)
        pos.unmake()
    return n


def perft_stats(pos: Position, depth: int) -> dict:
    """Leaves of the tree at exactly `depth` plies, with the counters of the chessprogramming.org table."""
    st = {"nodes": 0, "captures": 0, "ep": 0, "castles": 0, "promotions": 0, "checks": 0, "mates": 0}

    def walk(d):
        for m in pos.legal():
            if d == 1:
                st["nodes"] += 1
                st["captures"] += pos.captures(m)
                st["ep"] += m[3] == 2
                st["castles"] += m[3] in (3, 4)
                st["promotions"] += m[2] != 0
                pos.make(m)
                if pos.in_check():
                    st["checks"] += 1
                    st["mates"] += not pos.legal()
                pos.unmake()
            else:
                pos.make(m)
                walk(d - 1)
                pos.unmake()

    walk(depth)
    return st


def mated_games(depth: int) -> list[list[str]]:
    """Every game of exactly `depth` plies from the start that ends in checkmate, in SAN."""
    pos, out, line = Position(), [], []

    def walk(d):
        legal = pos.legal()
        if d == 0:
            if not legal and pos.in_check():
                out.append(list(line))
            return
        for m in legal:
            line.append(pos.san(m, legal))
            pos.make(m)
            walk(d - 1)
            pos.unmake()
            line.pop()

    walk(depth)
    return out


def distinct_positions(depth: int) -> int:
    """Different positions (A083276 convention) after exactly `depth` plies."""
    level = {Position().key(): Position()}
    for _ in range(depth):
        nxt = {}
        for pos in level.values():
            for m in pos.legal():
                pos.make(m)
                k = pos.key()
                if k not in nxt:
                    q = Position.__new__(Position)
                    q.b, q.side, q.castle, q.ep = list(pos.b), pos.side, pos.castle, pos.ep
                    q.kings, q.stack = dict(pos.kings), []
                    nxt[k] = q
                pos.unmake()
        level = nxt
    return len(level)


def branching(depth: int) -> list[int]:
    """Number of legal moves in each position reached after exactly `depth` plies (one entry per game)."""
    pos, out = Position(), []

    def walk(d):
        moves = pos.legal()
        if d == 0:
            out.append(len(moves))
            return
        for m in moves:
            pos.make(m)
            walk(d - 1)
            pos.unmake()

    walk(depth)
    return out


# ---------------------------------------------------------------- cache for the slow counts
def _src_hash() -> str:
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:16]


def _sub(args):
    fen_moves, depth = args
    pos = Position()
    for s in fen_moves:
        pos.play(s)
    return perft(pos, depth)


def perft_parallel(depth: int, workers: int = 4) -> int:
    from multiprocessing import Pool
    pos = Position()
    legal = pos.legal()
    jobs = [([pos.san(m, legal)], depth - 1) for m in legal]
    with Pool(workers) as pool:
        return sum(pool.map(_sub, jobs))


def perft_cached(depth: int) -> int:
    """Start-position perft from renders/cache/perft.json; depths not cached are computed here (depth <= 5) or
    in a separate process with 4 workers (depth 6, about a quarter of an hour on this laptop)."""
    data = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    if data.get("hash") != _src_hash():
        data = {"hash": _src_hash(), "perft": {}}
    key = str(depth)
    if key not in data["perft"]:
        if depth <= 5:
            data["perft"][key] = perft(Position(), depth)
        else:
            import subprocess
            subprocess.run([sys.executable, "-m", "config.chess", "cache", str(depth)], cwd=ROOT, check=True)
            return perft_cached(depth)
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(data, indent=1))
    return data["perft"][key]


def _cli():
    cmd, depth = sys.argv[1], int(sys.argv[2])
    t0 = time.perf_counter()
    if cmd == "perft":
        n = perft(Position(), depth)
    elif cmd == "cache":
        n = perft_parallel(depth)
        data = json.loads(CACHE.read_text()) if CACHE.exists() else {}
        if data.get("hash") != _src_hash():
            data = {"hash": _src_hash(), "perft": {}}
        data["perft"][str(depth)] = n
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(data, indent=1))
    else:
        raise SystemExit(f"unknown command {cmd}")
    print(f"perft({depth}) = {n:,}  ({time.perf_counter() - t0:.1f} s)")


if __name__ == "__main__":
    _cli()
