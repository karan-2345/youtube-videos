"""Every number in the Short comes from here. Sources: research/notes.md.

Run `python config/facts.py` to print the derived values and run the sanity checks.
"""
import json
import math
import sys

# --- primary values (see research/notes.md for citations) ---
C = 299_792_458.0                 # speed of light, m/s
MU_EARTH = 398_600.4418           # km^3/s^2, Earth's gravitational parameter
R_EARTH_KM = 6371.0               # mean radius
ALT_KM = 550.0                    # Starlink shell altitude (several shells at ~540-570 km)
MIN_ELEV_DEG = 25.0               # minimum elevation the terminal tracks (APNIC/Huston; may be lower now)
DOWNLINK_GHZ = (10.7, 12.7)       # Ku-band receive, 240 MHz channel inside this range
UPLINK_GHZ = (14.0, 14.5)         # Ku-band transmit, 60 MHz channel inside this range
RECONFIG_S = 15                   # global scheduler slot (Pan et al., CoNEXT 2023)
SPACING_LAMBDA = 0.5              # usual element spacing for a steerable array (grating-lobe limit)

# --- derived ---
F_DOWN_MID_GHZ = sum(DOWNLINK_GHZ) / 2
LAMBDA_DOWN_MM = C / (F_DOWN_MID_GHZ * 1e9) * 1e3
LAMBDA_UP_MM = C / (sum(UPLINK_GHZ) / 2 * 1e9) * 1e3
A_KM = R_EARTH_KM + ALT_KM
V_SAT_KMS = math.sqrt(MU_EARTH / A_KM)
V_SAT_KMH = V_SAT_KMS * 3600
PERIOD_MIN = 2 * math.pi * math.sqrt(A_KM ** 3 / MU_EARTH) / 60


def pass_minutes(min_elev_deg=MIN_ELEV_DEG):
    """Time a satellite stays above `min_elev_deg` on an overhead pass (ignores Earth's spin)."""
    el = math.radians(min_elev_deg)
    half = math.acos(R_EARTH_KM * math.cos(el) / A_KM) - el
    return 2 * half / (2 * math.pi) * PERIOD_MIN


def delay_ps(theta_deg, f_ghz=F_DOWN_MID_GHZ, spacing=SPACING_LAMBDA):
    """Extra delay between neighbouring elements that steers the beam theta_deg off broadside."""
    d = spacing * C / (f_ghz * 1e9)
    return d * math.sin(math.radians(theta_deg)) / C * 1e12


def phase_step_deg(theta_deg, spacing=SPACING_LAMBDA):
    return 360 * spacing * math.sin(math.radians(theta_deg))


# --- what the narration and captions say (display, spoken) ---
SAY = {
    "sat_kmh": ("27,000 km/h", "twenty-seven thousand kilometers an hour"),
}


def check():
    ok = True

    def need(cond, msg):
        nonlocal ok
        print(("  ok  " if cond else "  FAIL ") + msg)
        ok = ok and cond

    need(26_500 <= V_SAT_KMH <= 27_800, f"satellite speed {V_SAT_KMH:,.0f} km/h at {ALT_KM:.0f} km (say 'twenty-seven thousand')")
    need(95 <= PERIOD_MIN <= 96.5, f"orbital period {PERIOD_MIN:.1f} min (sources: 'just over 95 minutes')")
    need(2.5 <= pass_minutes() <= 5.0, f"overhead pass above {MIN_ELEV_DEG:.0f} deg: {pass_minutes():.1f} min (say 'a few minutes'; APNIC: max ~3 min)")
    need(24 <= LAMBDA_DOWN_MM <= 26, f"downlink wavelength {LAMBDA_DOWN_MM:.1f} mm at {F_DOWN_MID_GHZ:.1f} GHz (say 'about two and a half centimeters')")
    need(20 <= LAMBDA_UP_MM <= 22, f"uplink wavelength {LAMBDA_UP_MM:.1f} mm at {sum(UPLINK_GHZ) / 2:.2f} GHz")
    lo, hi = delay_ps(10), delay_ps(60)
    need(1 < lo < 100 and 1 < hi < 100, f"neighbour delay {lo:.1f} ps at 10 deg, {hi:.1f} ps at 60 deg ('tens of trillionths of a second')")
    need(abs(delay_ps(90) - 0.5 / (F_DOWN_MID_GHZ * 1e9) * 1e12) < 0.01, f"delay at 90 deg {delay_ps(90):.1f} ps = half a wave period")
    return ok


def export_json(path):
    json.dump({
        "lambda_down_mm": LAMBDA_DOWN_MM, "f_down_ghz": F_DOWN_MID_GHZ, "sat_kmh": V_SAT_KMH, "period_min": PERIOD_MIN,
        "pass_min": pass_minutes(), "reconfig_s": RECONFIG_S, "spacing_lambda": SPACING_LAMBDA,
        "delay_ps": {str(a): round(delay_ps(a), 2) for a in (10, 20, 30, 40, 50, 60)},
    }, open(path, "w"), indent=1)


if __name__ == "__main__":
    print(f"wavelength      down {LAMBDA_DOWN_MM:.2f} mm ({F_DOWN_MID_GHZ:.1f} GHz), up {LAMBDA_UP_MM:.2f} mm")
    print(f"satellite       {V_SAT_KMS:.2f} km/s = {V_SAT_KMH:,.0f} km/h, period {PERIOD_MIN:.1f} min, pass {pass_minutes():.1f} min")
    print("neighbour delay " + ", ".join(f"{a} deg {delay_ps(a):.1f} ps ({phase_step_deg(a):.0f} deg phase)" for a in (10, 20, 30, 45, 60)))
    print("checks:")
    good = check()
    if "--export" in sys.argv:
        export_json(__file__.rsplit("/", 1)[0] + "/facts.json")
    sys.exit(0 if good else 1)
