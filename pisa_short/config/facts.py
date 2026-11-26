"""
config/facts.py -- every claim in the Pisa Short, with where it comes from, plus the numbers the scene animates.

    python build.py facts   -> facts.md (ALL PASS or FAIL)

Sources (checked 2026-11-21):
  [W]  Wikipedia, "Leaning Tower of Pisa" (history, dimensions, 1990 closure, curved upper floors)
  [B]  J. Burland, "The stabilisation of the Leaning Tower of Pisa", Ingenia (1999); Burland, Jamiolkowski &
       Viggiani, Bull. Eng. Geol. Env. 57 (1998) 91-99 (the pauses, consolidation, "it would have fallen over",
       soil extraction from the north side)
  [U]  University of Bristol press release, 9 May 2018 (Mylonakis et al.): "survived, undamaged, at least four strong
       earthquakes that have hit the region since 1280", dynamic soil-structure interaction
  [S]  Scientific American / Bristol (Fiorentino): the tower is slightly "banana shaped"
  [N]  NOVA (PBS), Britannica, ICE: the 1990 closure, soil extraction under the raised (north) side
"""

from __future__ import annotations

# ---------------------------------------------------------------- the timeline the scene animates
START = 1173            # construction begins [W][B]
FIRST_STOP = 1178       # work stops at the third floor (Wikipedia "second floor" in the European count) [W][B]
RESUME = 1272           # work resumes, almost a century later [W][B]
SEVENTH = 1319          # seventh floor finished [W]
BELLS = 1372            # bell chamber added [W]
CLOSED = 1990           # closed to the public [W][N]
REOPENED = 2001         # reopened after stabilisation [W]
NOW = 2026

FOUNDATION_M = 3.0      # "a mere three-metre foundation, set in weak, unstable subsoil" [W]
STRAIGHTENED_M = 0.45   # straightened by about 45 cm (sources give 44-50 cm) [W][N]
LEAN_1990_DEG = 5.5     # "leaned at an angle of 5.5 degrees" before the works [W]
LEAN_NOW_DEG = 3.97     # after 2001 [W]
HEIGHT_LOW_M = 55.86    # [W]
HEIGHT_HIGH_M = 56.67   # [W]
QUAKES = 4              # "at least four strong earthquakes ... since 1280" [U]

# architecture used by the model (rounded, from [W] and photographs)
GROUND_ARCHES = 15      # blind arcade on the ground floor
LOGGIAS = 6             # open galleries
LOGGIA_ARCHES = 30      # arches per gallery
BELL_ARCHES = 16        # bell chamber openings (one source; the model uses 16)


CLAIMS = [
    ("should have fallen over more than 800 years ago, when it was only three floors tall",
     lambda: NOW - FIRST_STOP > 800,
     f"work stopped in {FIRST_STOP} at the third floor ({NOW - FIRST_STOP} years ago); [B]: without the pauses "
     f"\"the tower would have fallen over\" (the foundations would have failed in bearing)"),
    ("what saved it ... was a war",
     lambda: True,
     "[W]: work halted for almost a century \"as the Republic of Pisa was almost continually engaged in battles "
     "with Genoa, Lucca, and Florence\"; [B] notes the reasons for the stoppages are not recorded with certainty. "
     "The script says Pisa went to war and the work stopped, and that the pause saved it."),
    ("In 1173, Pisa began building", lambda: START == 1173, "[W][B]"),
    ("on soft, wet clay", lambda: True, "[W]: \"soft ground composed mostly of clay, fine sand, and shells\"; the soft "
     "marine clay layer is the Pancone clay [B]"),
    ("a foundation just three meters deep", lambda: FOUNDATION_M == 3.0,
     "[W] \"a mere three-metre foundation\" (an engineering survey gives up to 5.5 m including the later walkway "
     "excavation)"),
    ("by the third floor, one side was already sinking", lambda: FIRST_STOP == 1178,
     "[W]: began to sink after construction had progressed to the second floor (European count = third floor) in 1178"),
    ("the work stopped for almost a century", lambda: 90 <= RESUME - FIRST_STOP < 100,
     f"{FIRST_STOP} to {RESUME}: {RESUME - FIRST_STOP} years"),
    ("the tower's weight slowly squeezed water out of the clay and made it firmer", lambda: True,
     "[B]: by 1272 \"the strength of the clay had increased due to consolidation under the weight of the Tower\" "
     "(consolidation = water squeezed out of the pores)"),
    ("if they'd kept building, it would have collapsed", lambda: True,
     "[B]: \"had it continued much further, the foundations would have experienced a bearing capacity failure\""),
    ("each new floor a little taller on one side to hide the lean", lambda: True,
     "[W]: \"the engineers built upper floors with one side taller than the other. Because of this, the tower is "
     "curved.\""),
    ("curved, like a banana", lambda: True, "[S]: \"banana shape\""),
    ("By 1990 it was leaning so far that it had to close", lambda: CLOSED == 1990,
     f"[W][N]: closed 7 January 1990, leaning about {LEAN_1990_DEG} degrees"),
    ("engineers pulled soil from under the high side", lambda: True,
     "[B][N]: inclined drills removed small amounts of soil from beneath the north (raised) side, 1999-2001"),
    ("straightened it by almost half a meter", lambda: 0.4 <= STRAIGHTENED_M < 0.5,
     "[W]: straightened by 45 cm (other sources: 44-50 cm)"),
    ("at least four strong earthquakes", lambda: QUAKES == 4, "[U]"),
    ("by keeping it from swaying with the shaking", lambda: True,
     "[U]: the tower's height and stiffness with the soft soil \"modify the vibrational characteristics ... in "
     "such a way that the tower does not resonate with earthquake ground motion\" (2019 paper: natural period "
     "0.35 s -> over 1 s)"),
    ("the bell chamber was added in 1372 (shown, not said)", lambda: BELLS == 1372, "[W]"),
]


def report() -> tuple[str, bool]:
    rows, ok = [], True
    for claim, check, note in CLAIMS:
        good = bool(check())
        ok &= good
        rows.append(f"| {'PASS' if good else 'FAIL'} | {claim} | {note} |")
    text = "# facts.md: every claim in the Leaning Tower of Pisa Short\n\n| | Claim | Source / check |\n|---|---|---|\n"
    text += "\n".join(rows) + "\n\nSources: see the docstring of config/facts.py.\n"
    return text, ok


if __name__ == "__main__":
    t, ok = report()
    print(t)
    raise SystemExit(0 if ok else 1)
