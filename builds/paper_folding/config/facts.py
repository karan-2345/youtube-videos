"""Every number shown on screen comes from here (brief: recompute, don't paste)."""
import math

T = 0.1e-3                 # paper thickness, m (brief: assume 0.1 mm)
MOON_M = 384_400e3         # mean Earth-Moon distance, m
LY_M = 9.4607304725808e15  # light year, m (IAU: 365.25 d x c)
MILKY_WAY_LY = 100_000     # disc diameter, commonly quoted
AU_M = 1.495978707e11
SUN_R_M = 6.957e8
EARTH_R_M = 6.371e6
MOON_R_M = 1.7374e6
ROLL_2002_M = 1200          # Gallivan's toilet-paper roll, ~4,000 ft
TAPE_2011_M = 16_000        # St Mark's School 2011, ~10 miles


def stack(n):            # height of n folds, m
    return T * 2 ** n


def layers(n):
    return 2 ** n


def gallivan(n, t=T):    # minimum strip length for n single-direction folds, m
    return math.pi * t / 6 * (2 ** n + 4) * (2 ** n - 1)


def table(nmax=42):
    return [{"n": n, "layers": layers(n), "stack_m": stack(n), "length_m": gallivan(n)} for n in range(nmax + 1)]


def checks():
    r = {
        "fold7_layers": layers(7), "fold7_mm": stack(7) * 1e3,
        "fold22_m": stack(22), "fold42_km": stack(42) / 1e3,
        "L22_km": gallivan(22) / 1e3, "L42_m": gallivan(42), "L42_ly": gallivan(42) / LY_M,
        "L12_m": gallivan(12), "L13_m": gallivan(13),
    }
    assert r["fold7_layers"] == 128 and abs(r["fold7_mm"] - 12.8) < 1e-9
    assert abs(r["fold22_m"] - 419.43) < 0.01
    assert abs(r["fold42_km"] - 439_804.65) < 0.1
    assert r["fold42_km"] * 1e3 > MOON_M
    assert abs(r["L22_km"] - 921_000) / 921_000 < 0.002 and r["L22_km"] * 1e3 > MOON_M
    assert abs(r["L42_m"] - 1.01e21) / 1.01e21 < 0.01
    assert abs(r["L42_ly"] - 107_000) / 107_000 < 0.01 and r["L42_ly"] > MILKY_WAY_LY
    return r


if __name__ == "__main__":
    for k, v in checks().items():
        print(f"{k:14s} {v:,.6g}")
    print("all checks pass")
