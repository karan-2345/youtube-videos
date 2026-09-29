"""Every number in the Short comes from here. Sources: research/notes.md.

Run `python config/facts.py` to print the derived values and run the sanity checks.
"""
import math

# --- primary values (see research/notes.md for citations) ---
R_EQ_KM = 6378.137            # Earth equatorial radius, NASA Earth Fact Sheet
SIDEREAL_DAY_H = 23.9345      # Earth sidereal rotation period, NASA Earth Fact Sheet
V_ORBIT_KMS = 29.78           # Earth mean orbital velocity, NASA Earth Fact Sheet
V_ORBIT_MAX_KMS, V_ORBIT_MIN_KMS = 30.29, 29.29
V_SUN_GAL_KMH_NASA = 828_000  # Sun around the Milky Way centre, NASA StarChild
V_SUN_GAL_KMH_RANGE = (782_000, 900_000)  # spread of published estimates (notes: EarthSky, Eilers 2019, Reid 2019)
V_CIRC_EILERS_KMS = 229.0     # circular speed at the Sun, Eilers et al. 2019
V_CIRC_REID_KMS, R0_REID_KPC = 236.0, 8.15  # Reid et al. 2019
GAL_YEAR_MYR_NASA = 230       # NASA StarChild
GAL_YEAR_MYR_RANGE = (210, 250)  # Reid 2019 geometry (~212) to EarthSky's 225-250
FIRST_DINOS_MYA = (231, 245)  # Ischigualasto dinosaurs ~231 Mya; NHM "about 245 million years ago"
JET_CRUISE_KMH = 903          # Boeing 787 typical cruise, Mach 0.85 (EASA via Simple Flying)
MARATHON_KM = 42.195          # World Athletics
G = 9.80665
KPC_KM = 3.0857e16

# --- derived ---
V_SPIN_EQ_KMH = 2 * math.pi * R_EQ_KM / SIDEREAL_DAY_H
V_ORBIT_KMH = V_ORBIT_KMS * 3600
V_SUN_GAL_KMS = V_SUN_GAL_KMH_NASA / 3600
EARTH_DIAMETER_KM = 2 * R_EQ_KM
MARATHON_S = MARATHON_KM / V_ORBIT_KMS
SPIN_ACCEL_G = ((2 * math.pi / (SIDEREAL_DAY_H * 3600)) ** 2 * R_EQ_KM * 1000) / G
JET_RATIO = V_SPIN_EQ_KMH / JET_CRUISE_KMH
GAL_YEAR_REID_MYR = 2 * math.pi * R0_REID_KPC * KPC_KM / V_CIRC_REID_KMS / (3.15576e7 * 1e6)


def spin_at_lat(lat_deg):
    return V_SPIN_EQ_KMH * math.cos(math.radians(lat_deg))


def dist_orbit_km(t_s):
    """How far Earth moves around the Sun in t seconds."""
    return V_ORBIT_KMS * t_s


def dist_gal_km(t_s, kmh=V_SUN_GAL_KMH_NASA):
    return kmh / 3600 * t_s


# --- what the narration and captions say (display, spoken) ---
SAY = {
    "spin_kmh": ("1,670", "sixteen hundred and seventy"),
    "orbit_kmh": ("100,000", "a hundred thousand"),
    "gal_kmh": ("800,000", "eight hundred thousand"),
    "gal_year": ("230 million", "two hundred and thirty million"),
    "payoff_km": ("2,000", "two thousand"),
}


def check(payoff_t_s=None):
    ok = True

    def need(cond, msg):
        nonlocal ok
        print(("  ok  " if cond else "  FAIL ") + msg)
        ok = ok and cond

    need(abs(V_SPIN_EQ_KMH - 1674.4) < 0.5, f"equator spin {V_SPIN_EQ_KMH:.1f} km/h (say 'about 1,670')")
    need(1.8 < JET_RATIO < 2.0, f"equator / jet = {JET_RATIO:.2f} ('nearly twice')")
    need(V_ORBIT_KMH > 100_000, f"orbit {V_ORBIT_KMH:,.0f} km/h ('more than 100,000')")
    need(1.3 < MARATHON_S < 1.6, f"marathon in {MARATHON_S:.2f} s ('about a second and a half')")
    need(V_SUN_GAL_KMH_RANGE[0] <= 800_000 * 1.03 and V_SUN_GAL_KMH_RANGE[0] >= 800_000 * 0.95,
         f"galaxy speed range {V_SUN_GAL_KMH_RANGE} vs 'about 800,000'")
    need(GAL_YEAR_MYR_RANGE[0] <= GAL_YEAR_MYR_NASA <= GAL_YEAR_MYR_RANGE[1],
         f"galactic year {GAL_YEAR_MYR_NASA} Myr in {GAL_YEAR_MYR_RANGE} (Reid geometry {GAL_YEAR_REID_MYR:.0f})")
    need(FIRST_DINOS_MYA[0] <= GAL_YEAR_MYR_NASA + 15 and GAL_YEAR_MYR_NASA - 15 <= FIRST_DINOS_MYA[1],
         f"one lap ago (~{GAL_YEAR_MYR_NASA} Myr) overlaps the first dinosaurs {FIRST_DINOS_MYA} Mya")
    need(0.003 < SPIN_ACCEL_G < 0.004, f"spin acceleration at equator {SPIN_ACCEL_G*100:.2f}% of g ('about 0.3%')")
    if payoff_t_s is not None:
        d = dist_orbit_km(payoff_t_s)
        need(1850 <= d <= 2200, f"payoff at {payoff_t_s:.1f} s: {d:,.0f} km around the Sun ('about 2,000')")
        lo = dist_gal_km(payoff_t_s, V_SUN_GAL_KMH_RANGE[0])
        need(lo > EARTH_DIAMETER_KM, f"galaxy distance at lowest estimate {lo:,.0f} km > Earth's width {EARTH_DIAMETER_KM:,.0f} km")
    return ok


if __name__ == "__main__":
    import sys
    t = float(sys.argv[1]) if len(sys.argv) > 1 else None
    print(f"spin at equator  {V_SPIN_EQ_KMH:,.1f} km/h; 30° {spin_at_lat(30):,.0f}; 60° {spin_at_lat(60):,.0f}")
    print(f"orbit            {V_ORBIT_KMH:,.0f} km/h")
    print(f"galaxy (NASA)    {V_SUN_GAL_KMH_NASA:,} km/h = {V_SUN_GAL_KMS:.0f} km/s")
    print(f"Earth diameter   {EARTH_DIAMETER_KM:,.0f} km")
    print("checks:")
    sys.exit(0 if check(t) else 1)


def export_json(path):
    import json
    json.dump({
        "spin_eq_kmh": V_SPIN_EQ_KMH, "spin_30_kmh": spin_at_lat(30), "spin_60_kmh": spin_at_lat(60),
        "orbit_kms": V_ORBIT_KMS, "orbit_kmh": V_ORBIT_KMH,
        "gal_kmh": V_SUN_GAL_KMH_NASA, "gal_kms": V_SUN_GAL_KMS, "gal_range_kmh": V_SUN_GAL_KMH_RANGE,
        "gal_year_myr": GAL_YEAR_MYR_NASA, "gal_year_range": GAL_YEAR_MYR_RANGE, "dinos_mya": FIRST_DINOS_MYA,
        "jet_kmh": JET_CRUISE_KMH, "marathon_km": MARATHON_KM, "marathon_s": MARATHON_S,
        "earth_diameter_km": EARTH_DIAMETER_KM, "spin_accel_pct_g": SPIN_ACCEL_G * 100,
    }, open(path, "w"), indent=1)
