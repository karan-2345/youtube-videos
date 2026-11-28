"""
config/facts.py -- every number the Buffon's needle Short says or shows, computed here and checked.

    python -m config.facts          print the checks and write facts.md

Setup used throughout the video: needles exactly as long as the floorboards are wide (l = t), so a needle crosses
a crack with probability 2/pi and pi ~ 2 * drops / crossings.

Lazzarini (1901): needle 2.5 cm, lines 3 cm apart (l/t = 5/6), 3,408 drops, 1,808 crossings.
  Sources: Wikipedia "Buffon's needle problem"; L. Badger, "Lazzarini's Lucky Approximation of pi",
  Mathematics Magazine 67 (1994) 83-91; Nature 370 (1994) 323 editorial; S. Lototsky, USC notes.
355/113 (Milu): Zu Chongzhi, 5th century China (c. AD 480), so over 1,400 years old in 1901.
"""

from __future__ import annotations

import math
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ---------------------------------------------------------------- Lazzarini
LAZ_DROPS, LAZ_CROSS = 3408, 1808
LAZ_L, LAZ_T = Fraction(5, 2), Fraction(3)          # cm
LAZ_YEAR = 1901
ZU_YEAR = 480                                        # Zu Chongzhi's 355/113, about AD 480


def lazzarini_estimate() -> Fraction:
    """pi ~ 2 l N / (t C)."""
    return 2 * LAZ_L * LAZ_DROPS / (LAZ_T * LAZ_CROSS)


def decimals_right(x: float, digits: int = 10) -> int:
    """How many decimal places of x agree with pi (truncated, not rounded)."""
    a, b = f"{x:.{digits + 2}f}", f"{math.pi:.{digits + 2}f}"
    n = 0
    for ca, cb in zip(a[2:], b[2:]):
        if ca != cb:
            break
        n += 1
    return n


# ---------------------------------------------------------------- honest runs (l = t)
def binom_pmf(n: int, k: int, p: float) -> float:
    return math.exp(math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)
                    + k * math.log(p) + (n - k) * math.log(1 - p))


def honest_decimals(n: int, ratio: float = 1.0) -> dict[int, float]:
    """Exact distribution of decimals_right for an honest run of n drops (needle/gap = ratio)."""
    p = 2 * ratio / math.pi
    out: dict[int, float] = {}
    for c in range(1, n + 1):
        w = binom_pmf(n, c, p)
        if w < 1e-15:
            continue
        d = decimals_right(2 * ratio * n / c)
        out[d] = out.get(d, 0.0) + w
    return out


def lazzarini_exact_hit() -> float:
    """Chance an honest 3,408-drop run with his needle gives exactly 1,808 crossings (the only count that is
    within 0.001 of pi)."""
    return binom_pmf(LAZ_DROPS, LAZ_CROSS, 2 * float(LAZ_L / LAZ_T) / math.pi)


# ---------------------------------------------------------------- the simulated rain shown in the video
RAIN_N = 3000
RAIN_SEED = 10          # picked by pick_rain_seed(): a typical honest run (first decimal right, second wrong)


def crosses(xc: float, theta: float, length: float = 1.0) -> bool:
    """Cracks at every integer x (boards 1 wide); needle centre xc, direction theta from the x axis."""
    h = 0.5 * length * abs(math.cos(theta))
    return math.floor(xc - h) != math.floor(xc + h)


def rain(seed: int, n: int = RAIN_N, x_range=(-3.0, 3.0), z_range=(-3.0, 3.0)) -> list[dict]:
    import random
    r = random.Random(seed)
    out = []
    for _ in range(n):
        x, z, th = r.uniform(*x_range), r.uniform(*z_range), r.uniform(0, math.pi)
        out.append({"x": x, "z": z, "th": th, "c": crosses(x, th)})
    return out


def running_estimate(needles: list[dict]) -> list[float]:
    c, out = 0, []
    for i, nd in enumerate(needles, 1):
        c += nd["c"]
        out.append(2 * i / c if c else float("inf"))
    return out


def pick_rain_seed(lo: float = 3.115, hi: float = 3.13) -> int:
    for s in range(1, 5000):
        est = running_estimate(rain(s))
        if lo <= est[-1] <= hi and 2.8 < est[9] < 3.6 and min(est[300:]) > 3.0:
            return s
    raise RuntimeError("no seed")


# ---------------------------------------------------------------- report
def report() -> tuple[str, bool]:
    rows, ok = [], True

    def check(name, cond, detail):
        nonlocal ok
        ok &= bool(cond)
        rows.append(f"| {'PASS' if cond else 'FAIL'} | {name} | {detail} |")

    est = lazzarini_estimate()
    check("Lazzarini's estimate is exactly 355/113", est == Fraction(355, 113), f"{est} = {float(est):.10f}")
    check("...which gets six decimal places of pi right", decimals_right(float(est)) == 6,
          f"pi = {math.pi:.10f}; {decimals_right(float(est))} decimals agree")
    check("3,408 = 16 x 213 and 1,808 = 16 x 113", LAZ_DROPS == 16 * 213 and LAZ_CROSS == 16 * 113,
          "with l/t = 5/6, pi_hat = (5/3) N / C = 355/113 needs N/C = 213/113")
    check("355/113 was over a thousand years old in 1901", LAZ_YEAR - ZU_YEAR > 1000,
          f"Zu Chongzhi c. AD {ZU_YEAR}: {LAZ_YEAR - ZU_YEAR} years")
    pc = 2 / math.pi
    check("crossing chance with l = t is 2/pi", abs(pc - 0.63662) < 1e-5, f"2/pi = {pc:.5f}")
    dist = honest_decimals(3000)
    one_only = dist.get(1, 0.0)
    two_plus = sum(v for k, v in dist.items() if k >= 2)
    check("an honest 3,000-drop run usually gets only one decimal place right", one_only > 0.5,
          f"exactly one decimal right: {one_only:.1%}; two or more: {two_plus:.1%}; none: {dist.get(0, 0):.1%}")
    six = sum(v for k, v in dist.items() if k >= 6)
    check("six decimals by honest luck (3,000 drops) is rare", six < 0.02, f"{six:.2%}")
    hit = lazzarini_exact_hit()
    check("an honest run with his own setup lands on 1,808 crossings about 1 time in 70", 0.01 < hit < 0.02,
          f"P(C = 1808 | N = 3408, l/t = 5/6) = {hit:.2%}; but he chose N = 16 x 213 to make the fraction land")
    needles = rain(RAIN_SEED)
    est_r = running_estimate(needles)
    ncross = sum(n["c"] for n in needles)
    check("the video's rain is a typical honest run", decimals_right(est_r[-1]) == 1,
          f"seed {RAIN_SEED}: {RAIN_N} drops, {ncross} crossings, 2N/C = {est_r[-1]:.4f}")
    md = ["# facts.md: every number in the Buffon's needle Short", "", "| | Check | Detail |", "|---|---|---|",
          *rows, ""]
    return "\n".join(md), ok


if __name__ == "__main__":
    import sys
    if "--pick" in sys.argv:
        print(pick_rain_seed())
        raise SystemExit
    text, ok = report()
    (ROOT / "facts.md").write_text(text, encoding="utf-8")
    print(text)
    print("ALL PASS" if ok else "SOME CHECKS FAIL")
