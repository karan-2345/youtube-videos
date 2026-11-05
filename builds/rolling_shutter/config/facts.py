"""config/facts.py -- every number the Short shows or uses, recomputed here and checked against the brief.

The one shape parameter everywhere is K = turns per sweep = rotation rate (turns/s) x sweep time (s).
Run: python config/facts.py
"""
RPM = 2400                       # S02.03
RATE_HZ = RPM / 60               # turns per second
SWEEP_S = 1 / 70                 # S02.03: "a seventieth of a second"
K_S02 = RATE_HZ * SWEEP_S        # turns per sweep in the worked example
DEG_S02 = K_S02 * 360

K_PHOTO = 2.39                   # S05.02: the real photo analysed (turns per sweep), 3 blades
BLADES_PHOTO = 3

E2_HZ = 82.41                    # low E string, E2 = 440 * 2**(-29/12)
E2_EQUAL = 440 * 2 ** (-29 / 12)

# Shots that are not the worked example (choices of this film, used by the simulation; see REPORT.md)
VIDEO_SWEEP_S = 1 / 30           # S01, S04: a phone in video mode reads out in roughly one frame time
CAR_KMH = 90                     # S01 car speed
FAN_RPM = 1200                   # S04 desk fan
FAN_HZ = FAN_RPM / 60
K_FAN = FAN_HZ * VIDEO_SWEEP_S
STRING_CYCLES = E2_HZ * VIDEO_SWEEP_S   # vibrations per sweep: the number of waves along the string
K_S03 = 1.6                      # S03: faster rotation, enough that a blade is caught a second time
K_RANGE = (0.1, 5.0)             # S05 count


def checks():
    assert RATE_HZ == 40, RATE_HZ
    assert abs(SWEEP_S * 1000 - 14.2857) < 1e-3
    assert abs(K_S02 - 0.5714) < 1e-3 and round(K_S02, 2) == 0.57
    assert abs(DEG_S02 - 205.7) < 0.1          # the brief says "about 204 degrees"; 0.5714 x 360 = 205.7 (see REPORT.md)
    assert abs(E2_EQUAL - 82.41) < 0.01
    return {"RATE_HZ": RATE_HZ, "SWEEP_MS": SWEEP_S * 1000, "K_S02": K_S02, "DEG_S02": DEG_S02, "PCT_S02": K_S02 * 100,
            "K_PHOTO": K_PHOTO, "E2_HZ": E2_HZ, "K_FAN": K_FAN, "STRING_CYCLES": STRING_CYCLES}


if __name__ == "__main__":
    for k, v in checks().items():
        print(f"{k:14s} {v:.4f}")
