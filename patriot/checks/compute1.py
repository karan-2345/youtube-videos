"""Every number in the Patriot Short, computed with exact fractions.

    python checks/compute1.py          # prints each section and exits 1 if any check fails

Sources are in research/notes.md (GAO IMTEC-92-26, Skeel SIAM News 1992).
"""
import sys
from fractions import Fraction as Fr

OK = True


def need(cond, msg):
    global OK
    print(("  ok    " if cond else "  FAIL  ") + msg)
    OK = OK and bool(cond)


# ------------------------------------------------------------------ FLOAT
print("FLOAT (IEEE 754 doubles, what a laptop prints)")
s = 0.1 + 0.2
need(repr(s) == "0.30000000000000004", f"0.1 + 0.2 = {s!r}")
digits = repr(s).split(".")[1]
need(digits[1:16] == "0" * 15 and digits[16] == "4", "three, then fifteen zeros, then a four")
need(Fr(0.1) != Fr(1, 10), f"0.1 is stored as {Fr(0.1)} (not 1/10)")

# ------------------------------------------------------------------ BINARY
print("BINARY (1/10 never ends in base 2)")
bits, x = [], Fr(1, 10)
for _ in range(32):
    x *= 2
    bits.append(int(x >= 1))
    x -= int(x >= 1)
b = "".join(map(str, bits))
print("  1/10 = 0." + b + "...")
need(b.startswith("0" + "0011" * 7), "pattern 0.0 0011 0011 0011 ... (repeats forever)")

# ------------------------------------------------------------------ PATRIOT
print("PATRIOT (24-bit fixed point, 23 bits after the binary point, truncated)")
STORED = Fr(int(Fr(1, 10) * 2 ** 23), 2 ** 23)  # chop after bit 23
ERR = Fr(1, 10) - STORED
print(f"  stored 0.1 = {STORED} = {float(STORED):.12f}; error {float(ERR):.4e}")
need(ERR == Fr(1, 10) * Fr(1, 2 ** 20), "error is exactly 0.1 x 2^-20 (Skeel: stored = 0.1 x (1 - 2^-20))")
REL = ERR / Fr(1, 10)
need(0.9e-6 < float(REL) < 1.0e-6, f"relative error {float(REL):.3e}: 'about one part in a million'")


def drift(hours):
    ticks = hours * 3600 * 10
    return ticks * ERR


GAO_TABLE = {8: 0.0275, 20: 0.0687, 48: 0.1648, 72: 0.2472, 100: 0.3433}  # GAO IMTEC-92-26, Appendix II
for h, g in GAO_TABLE.items():
    d = float(drift(h))
    need(abs(d - g) < 0.00006, f"{h:3d} h: drift {d:.4f} s (GAO {g})")
need(abs(float(drift(100)) - 0.34) < 0.005, "on screen: 0.34 s at 100 h; spoken 'about a third of a second'")

# The visual's hour counter stops: 8, 20, 48, 72, 100.
print("RANGE (the 687 m is GAO's figure for the range-gate shift at 100 h)")
MACH5 = 5 * 340.0  # m/s, sea-level speed of sound is about 340 m/s; GAO quotes Mach 5 / ~1,676 m/s
moved = MACH5 * float(drift(100))
need(moved > 500, f"a Scud at Mach 5 moves {moved:.0f} m in 0.3433 s (Skeel: 'more than half a km')")
need(687 > 500, "GAO's range-gate shift at 100 h: 687 m (used as is, not recomputed)")

# ------------------------------------------------------------------ DATES
print("DATES")
need(25 - 11 == 14, "Israeli data 11 Feb, failure 25 Feb: 'two weeks earlier'")
need(26 - 25 == 1, "software reached Dhahran 26 Feb: 'one day too late'")
need(90 <= 90, "reboot 60-90 s (GAO): 'about a minute and a half at most'")

print("\nALL CHECKS PASS" if OK else "\nSOME CHECKS FAILED")
sys.exit(0 if OK else 1)
