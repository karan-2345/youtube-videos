"""
tools/export.py -- everything the 3D scene shows, as data: word and phrase times measured on the voice (see
tools/align.py), and the sound cue sheet. Writes renders/cache/scene.json.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import facts, style  # noqa: E402
from tools.tts import SAY  # noqa: E402

TIMINGS = ROOT / "renders" / "cache" / "timings.json"
OUT = ROOT / "renders" / "cache" / "scene.json"

_ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
         "seventeen eighteen nineteen").split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def _words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + ("" if n % 10 == 0 else "-" + _ONES[n % 10])
    if n < 1000:
        return _ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + _words(n % 100))
    return _words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + _words(n % 1000))


def spoken(text: str) -> str:
    """The text as it is said (SAY replacements, other numbers in words)."""
    for k, v in SAY.items():
        text = text.replace(k, v)
    return re.sub(r"\d[\d,]*", lambda m: _words(int(m.group(0).replace(",", ""))), text)


def _norm(w: str) -> str:
    return re.sub(r"[^\w.']", "", w.lower()).strip(".")


def at(tm: dict, beat: str, phrase: str | None = None, end: bool = False, off: float = 0.0) -> float:
    """Time of a beat's start/end, or of `phrase` inside it (its first word's start, or its last word's end)."""
    b = tm["beats"][beat]
    if phrase is None:
        return round((b["end"] if end else b["start"]) + off, 3)
    want = [_norm(w) for w in phrase.split()]
    for s in b["sentences"]:
        ws = s["words"]
        for i in range(len(ws) - len(want) + 1):
            if [_norm(w[0]) for w in ws[i:i + len(want)]] == want:
                return round((ws[i + len(want) - 1][2] if end else ws[i][1]) + off, 3)
    raise KeyError(f"{phrase!r} not in {beat}")


ANCHORS = [
    # hook
    ("lose", "hook", "lose weight"), ("fat0", "hook", "the fat doesn't"), ("melt", "hook", "melt away"),
    ("away", "hook", "away"), ("muscle_or", "hook", "or turn"), ("muscle", "hook", "muscle"),
    ("sweat_and", "hook", "and you don't"), ("sweat", "hook", "sweat it out"), ("either", "hook", "either"),
    ("because", "hook", "because most"), ("leaves", "hook", "leaves your body"), ("every", "hook", "every time"),
    ("breathe_out", "hook", "breathe out"),
    # survey
    ("scientists", "survey", "scientists"), ("asked", "survey", "asked"), ("n150", "survey", "150"),
    ("doctors", "survey", "doctors"), ("dietitians", "survey", "dietitians"), ("trainers", "survey", "personal trainers"),
    ("where", "survey", "where the fat goes"), ("only", "survey", "only three"), ("three", "survey", "three of them"),
    ("right", "survey", "got it right"),
    # atoms
    ("made_of", "atoms", "made of"), ("three_kinds", "atoms", "three kinds"), ("atoms_w", "atoms", "atoms"),
    ("carbon", "atoms", "carbon"), ("hydrogen", "atoms", "hydrogen"), ("oxygen", "atoms", "oxygen,"),
    ("energy", "atoms", "needs energy"), ("breaks", "atoms", "breaks the fat"), ("apart", "atoms", "apart"),
    ("with_oxygen", "atoms", "with the oxygen"), ("breathe_in", "atoms", "breathe in"),
    # split
    ("pieces", "split", "the pieces"), ("join", "split", "join up again"), ("co2", "split", "carbon dioxide"),
    ("gas", "split", "the gas"), ("breathe_out2", "split", "breathe out"), ("water", "split", "as water"),
    ("which", "split", "which leaves"), ("sweat2", "split", "your sweat"), ("tears", "split", "your tears"), ("pee", "split", "your pee"),
    ("breath", "split", "even your breath"),
    # numbers
    ("ten", "numbers", "10 kg"), ("of_fat", "numbers", "of fat"), ("eight", "numbers", "8.4 kg"),
    ("lungs", "numbers", "through your lungs"), ("only16", "numbers", "only"), ("one6", "numbers", "1.6 kg"),
    ("into_water", "numbers", "turn into water"),
    # twist
    ("faster", "twist", "breathing faster"), ("wont", "twist", "won't help"), ("because2", "twist", "because your"),
    ("burns", "twist", "burns more fat"), ("needs", "twist", "needs more energy"), ("move", "twist", "like when you move"),
    ("moveW", "twist", "move"), ("panting", "twist", "and panting"), ("purpose", "twist", "on purpose"),
    ("dizzy", "twist", "dizzy"),
    # end
    ("right_now", "end", "right now"), ("watch", "end", "as you watch this"), ("tiny", "end", "a tiny bit"),
    ("leaving", "end", "leaving"), ("every2", "end", "every time"), ("breathe_out3", "end", "breathe out"),
]


def anchors(tm: dict) -> dict:
    A = {k: at(tm, b, p) for k, b, p in ANCHORS}
    for k, b, p in ANCHORS:
        A[k + "_e"] = at(tm, b, p, end=True)
    for b in tm["beats"]:
        A[b] = at(tm, b)
        A[b + "_end"] = at(tm, b, end=True)
    A["duration"] = tm["duration"]
    return A


def regular(t0, t1, period, amp, in_share=0.42, **kw):
    out, s = [], t0
    while s + period <= t1 + 1e-6:
        out.append({"in0": round(s, 4), "ex0": round(s + period * in_share, 4), "ex1": round(s + period, 4), "amp": amp, **kw})
        s += period
    return out


def breath_cycles(A: dict, D: float) -> list[dict]:
    """Every breath the figure takes, timed to the words (the scene draws them, tools/sfx.py voices the loud ones).
    kind: calm | big | pant | jog"""
    c = []
    c += regular(-4, 6.6, 3.4, 0.35, kind="calm")
    c += [{"in0": A["leaves"] - 0.3, "ex0": A["breathe_out"] - 0.05, "ex1": A["breathe_out"] + 1.35, "amp": 1.0, "vapor": 1.2, "kind": "big"}]
    c += regular(A["breathe_out"] + 1.4, A["only"], 3.2, 0.4, kind="calm")
    c += regular(A["sweat2"] - 0.6, A["breath"] - 0.45, 2.6, 0.45, kind="calm")
    c += [{"in0": A["breath"] - 0.45, "ex0": A["breath"] + 0.1, "ex1": A["breath"] + 1.4, "amp": 0.8, "vapor": 1.6, "kind": "big"}]
    c += regular(A["breath"] + 1.4, A["faster"] - 0.1, 3.0, 0.45, kind="calm")
    c += regular(A["faster"] - 0.1, A["because2"] + 0.6, 0.46, 0.55, 0.45, vapor=1.4, kind="pant")
    c += regular(A["because2"] + 0.6, A["panting"] - 0.1, 0.92, 0.85, 0.45, vapor=1.1, kind="jog")
    c += regular(A["panting"] - 0.1, A["dizzy"] + 0.5, 0.42, 0.6, 0.45, vapor=1.4, kind="pant")
    c += regular(A["dizzy"] + 0.5, A["right_now"] + 0.4, 1.1, 0.6, kind="calm")
    c += regular(A["right_now"] + 0.4, A["breathe_out3"] - 0.9, 1.65, 0.5, kind="calm")
    c += [{"in0": A["breathe_out3"] - 0.9, "ex0": A["breathe_out3"] - 0.05, "ex1": A["breathe_out3"] + 1.3, "amp": 0.6, "kind": "end"}]
    c += regular(A["breathe_out3"] + 1.3, D + 8, 3.4, 0.35, kind="calm")
    return c


def jog(A: dict) -> dict:
    """The jog: weight ramps in after 'because your', out at 'panting'; cadence in strides per second."""
    return {"t0": A["because2"] + 0.55, "full": A["burns"] + 0.15, "out0": A["panting"] - 0.35, "t1": A["panting"] + 0.4, "hz": 1.45}


def cues(A: dict) -> list[list]:
    """[t, sound, dB, seed] for everything the scene does on its own clock (more in tools/sfx.py)."""
    return []


def export() -> dict:
    tm = json.loads(TIMINGS.read_text())
    A = anchors(tm)
    data = {
        "scene": style.SCENE, "fps": style.FPS, "frames": tm["frames"], "duration": tm["duration"],
        "palette": style.PALETTE, "anchors": A,
        "words": [w for b in tm["beats"].values() for s in b["sentences"] for w in s["words"]],
        "breath": breath_cycles(A, tm["duration"]), "jog": jog(A),
        "facts": {"fat": facts.FAT, "o2": facts.O2_IN, "co2": facts.CO2_OUT, "h2o": facts.H2O_OUT,
                  "surveyed": facts.SURVEYED, "correct": facts.CORRECT, "loss": facts.LOSS_KG,
                  "exhaled": facts.EXHALED_KG, "water": facts.WATER_KG},
    }
    data["cues"] = [[round(c[0], 4), c[1], round(c[2], 2), c[3]] for c in sorted(cues(A), key=lambda c: c[0])]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data))
    print(f"  scene.json: {len(A)} anchors, {len(data['cues'])} cues")
    return data


if __name__ == "__main__":
    d = export()
    for k, v in d["anchors"].items():
        if not k.endswith("_e"):
            print(f"    {k:14s} {v:7.2f}")
