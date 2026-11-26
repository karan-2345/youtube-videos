"""
config/facts.py -- every claim in the "where does the fat go" Short, with where it comes from, plus the numbers the
scene animates (the atoms are counted, so the picture is exact too).

    python build.py facts   -> facts.md (ALL PASS or FAIL)

Sources (checked 2026-11-22):
  [M]  R. Meerman & A. J. Brown, "When somebody loses weight, where does the fat go?", BMJ 2014;349:g7257
       (PubMed 25516540): the chemistry, the 84 % / 16 % split, 10 kg -> 8.4 kg exhaled, 29 kg O2 in,
       28 kg CO2 + 11 kg H2O out; the lungs are the primary excretory organ for fat; hyperventilating does not
       make the body burn fat (it causes dizziness and hypocapnia); per-breath and per-day numbers.
  [U]  UNSW Sydney press release (16 Dec 2014) on [M]: the survey of 150 family doctors, dietitians and personal
       trainers (50 of each); only 3 gave the right answer; most said the fat turns into energy or heat.
  [N]  NPR "Shots" (16 Dec 2014), ScienceDaily (16 Dec 2014): the 84 % / 16 % split; 29 kg O2, 28 kg CO2, 11 kg H2O.
  [R]  Meerman's own notes (rubenmeerman.com, TEDxBundaberg 2019): hyperventilating removes more CO2 than you make
       and leads to hypocapnia; it does not burn more fat.
"""

from __future__ import annotations

# ---------------------------------------------------------------- the chemistry the scene animates
# Human fat is mostly triglycerides; [M] uses the average C55H104O6 (e.g. one palmitate, one oleate and one stearate
# on a glycerol backbone -- which is the molecule the scene builds, atom for atom).
FAT = {"C": 55, "H": 104, "O": 6}
O2_IN = 78                         # C55H104O6 + 78 O2 -> 55 CO2 + 52 H2O + energy  [M]
CO2_OUT = 55
H2O_OUT = 52
MASS = {"C": 12.011, "H": 1.008, "O": 15.999}

LOSS_KG = 10.0                     # the worked example in [M]
EXHALED_KG = 8.4                   # [M][N]
WATER_KG = 1.6                     # [M][N]
O2_KG = 29.0                       # [M][N]
CO2_KG = 28.0                      # [M][N]
H2O_KG = 11.0                      # [M][N]

SURVEYED = 150                     # 50 family doctors, 50 dietitians, 50 personal trainers  [U]
CORRECT = 3                        # [U]

BREATHS_PER_MIN = 12               # a resting 70-75 kg adult  [M]
CARBON_PER_BREATH_MG = 8.9         # of 33 mg CO2 per breath  [M]


def _mass(c=0, h=0, o=0):
    return c * MASS["C"] + h * MASS["H"] + o * MASS["O"]


def fat_split() -> tuple[float, float]:
    """Share of the fat's own mass that leaves as CO2 and as water. All its carbon leaves as CO2 and all its hydrogen
    as water; its 6 oxygen atoms follow the products in proportion (110 O in the CO2, 52 in the water), as in [M]:
    4 to CO2, 2 to water."""
    o_total = 2 * CO2_OUT + H2O_OUT
    o_co2 = FAT["O"] * (2 * CO2_OUT) / o_total
    to_co2 = _mass(c=FAT["C"]) + o_co2 * MASS["O"]
    to_h2o = _mass(h=FAT["H"]) + (FAT["O"] - o_co2) * MASS["O"]
    tot = to_co2 + to_h2o
    return to_co2 / tot, to_h2o / tot


def balanced() -> bool:
    c = FAT["C"] == CO2_OUT
    h = FAT["H"] == 2 * H2O_OUT
    o = FAT["O"] + 2 * O2_IN == 2 * CO2_OUT + H2O_OUT
    return c and h and o


CLAIMS = [
    ("the fat doesn't melt away or turn into muscle, and you don't sweat it out either", lambda: True,
     "[M]: fat is oxidised to CO2 and water; it cannot become muscle (different tissue, different molecules); "
     "the misconceptions listed in [U] include energy/heat, muscle and excretion through the colon"),
    ("most of it leaves your body every time you breathe out", lambda: fat_split()[0] > 0.5,
     "[M]: \"the lungs are the primary excretory organ for weight loss\""),
    ("scientists asked 150 doctors, dietitians and personal trainers ... only three got it right",
     lambda: SURVEYED == 150 and CORRECT == 3, "[U]: 50 family doctors, 50 dietitians and 50 personal trainers in "
     "Australia; only 3 answered correctly"),
    ("fat is made of just three kinds of atoms, carbon, hydrogen and oxygen", lambda: set(FAT) == {"C", "H", "O"},
     "triglyceride C55H104O6 [M]"),
    ("it breaks the fat apart with the oxygen you breathe in", lambda: balanced(),
     f"C55H104O6 + {O2_IN} O2 -> {CO2_OUT} CO2 + {H2O_OUT} H2O (atoms balance: checked) [M]"),
    ("the pieces join up again as carbon dioxide ... and as water", lambda: balanced(), "[M]"),
    ("water leaves in your sweat, your tears, your pee and even your breath", lambda: True,
     "[M]: the water \"may be excreted in the urine, faeces, sweat, breath, tears or other bodily fluids\""),
    ("10 kg of fat: 8.4 kg leave through your lungs, 1.6 kg turn into water",
     lambda: abs(fat_split()[0] - EXHALED_KG / LOSS_KG) < 0.01 and abs(fat_split()[1] - WATER_KG / LOSS_KG) < 0.01,
     f"[M][N]; our atom count gives {fat_split()[0]:.1%} / {fat_split()[1]:.1%}"),
    ("breathing faster won't help ... panting on purpose just makes you dizzy", lambda: True,
     "[M]: \"breathing more than required ... hyperventilation ... dizziness, palpitations and loss of "
     "consciousness\"; [R]: hyperventilating leads to hypocapnia and does not burn more fat"),
    ("your body only burns more fat when it needs more energy, like when you move", lambda: True,
     "[M]: replacing one hour of rest with moderate exercise such as jogging raises the metabolic rate about "
     "sevenfold and removes about an extra 40 g of carbon"),
    ("a tiny bit of you is leaving every time you breathe out", lambda: CARBON_PER_BREATH_MG > 0,
     f"[M]: at rest about {BREATHS_PER_MIN} breaths a minute, each carrying 33 mg of CO2 ({CARBON_PER_BREATH_MG} mg of "
     "carbon); about 200 g of carbon a day, a third of it during sleep"),
    ("(shown) 29 kg of oxygen in, 28 kg of CO2 and 11 kg of water out for 10 kg of fat",
     lambda: abs((LOSS_KG + O2_KG) - (CO2_KG + H2O_KG)) < 0.5, "[M][N] (mass balances to 39 kg)"),
]


def report() -> tuple[str, bool]:
    rows, ok = [], True
    for claim, check, note in CLAIMS:
        good = bool(check())
        ok &= good
        rows.append(f"| {'PASS' if good else 'FAIL'} | {claim} | {note} |")
    text = "# facts.md: every claim in the \"where does the fat go\" Short\n\n| | Claim | Source / check |\n|---|---|---|\n"
    text += "\n".join(rows) + "\n\nSources: see the docstring of config/facts.py.\n"
    return text, ok


if __name__ == "__main__":
    t, ok = report()
    print(t)
    raise SystemExit(0 if ok else 1)
