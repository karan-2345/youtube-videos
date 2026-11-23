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
    ("egyptians", "hook", "Egyptians"), ("dragged", "hook", "dragged"), ("heavier", "hook", "heavier"),
    ("car", "hook", "car"), ("desert", "hook", "desert"), ("thousands", "hook", "thousands"),
    ("nobody", "hook", "nobody"), ("how", "hook", "how"), ("until", "hook", "until"),
    ("scientists", "hook", "scientists"), ("man0", "hook", "man in"), ("painting0", "hook", "ancient painting"),
    ("pouring", "hook", "pouring"), ("water0", "hook", "water on"), ("sand0", "hook", "the sand"),
    # painting
    ("p_that", "painting", "That painting"), ("four", "painting", "four thousand"), ("old", "painting", "old"),
    ("men170", "painting", "170"), ("pulling", "painting", "pulling"), ("statue", "painting", "giant statue"),
    ("sled1", "painting", "on a sled"), ("while", "painting", "while"), ("pours", "painting", "pours"),
    ("front1", "painting", "in front"), ("which", "painting", "which experts"), ("ritual", "painting", "only a ritual"),
    # lab
    ("y2014", "lab", "2014"), ("physicists", "lab", "physicists"), ("amsterdam", "lab", "Amsterdam"),
    ("pulled", "lab", "pulled"), ("small_sled", "lab", "small sled"), ("tray", "lab", "tray"),
    ("dry", "lab", "dry sand"), ("hard", "lab", "hard work"), ("because1", "lab", "because the sand"),
    ("piling", "lab", "piling"), ("wall", "lab", "a wall"),
    # secret
    ("but", "secret", "But with"), ("right", "secret", "right amount"), ("water2", "secret", "water"),
    ("pull", "secret", "the pull"), ("half", "secret", "about half"), ("tiny", "secret", "tiny drops"),
    ("stick", "secret", "stick"), ("together", "secret", "together"), ("so_sand", "secret", "so the sand"),
    ("twice", "secret", "twice"), ("stiff", "secret", "stiff"), ("glides", "secret", "glides"),
    # mud
    ("toomuch", "mud", "too much"), ("mudw", "mud", "mud"), ("sinks", "mud", "sinks"), ("so_man", "mud", "so the man"),
    ("thewater", "mud", "the water was"), ("engineering", "mud", "engineering"), ("not_ritual", "mud", "not a ritual"),
    # end
    ("even", "end", "even though"), ("seven", "end", "seven hundred"), ("younger", "end", "younger"),
    ("great", "end", "Great Pyramid"), ("same", "end", "same trick"), ("half2", "end", "half as many"),
    ("people", "end", "people"), ("pull2", "end", "pull each"), ("million", "end", "two million"),
    ("stones2", "end", "stones"), ("across2", "end", "across the desert"),
]

# The hauling clock shared by the scene (strides) and the sound (footsteps, the clapper): a whole number of stride
# cycles over the video, so the loop is seamless.
HAUL_HZ_TARGET = 0.5


def anchors(tm: dict) -> dict:
    A = {k: at(tm, b, p) for k, b, p in ANCHORS}
    for k, b, p in ANCHORS:
        A[k + "_e"] = at(tm, b, p, end=True)
    for b in tm["beats"]:
        A[b] = at(tm, b)
        A[b + "_end"] = at(tm, b, end=True)
    A["duration"] = tm["duration"]
    return A


def shots(A: dict, D: float) -> dict:
    """The cut list (the scene and the sound both use it): [name, start]; the brush transitions."""
    paint = [A["painting0"] - 0.3, A["painting0"] + 0.55]       # the desert painted over into the wall
    wipe = [A["statue"] + 0.45, A["statue"] + 1.25]             # the painting wiped away into 3D
    cut = [["hook", 0.0], ["wall", paint[1]], ["colossus", wipe[0]], ["lab1", A["lab"] - 0.02],
           ["macro", A["tiny"] - 0.12], ["lab2", A["glides"] - 0.75], ["colossus2", A["so_man"] - 0.12],
           ["pyramid", A["end"] - 0.05], ["team", A["same"] - 0.2], ["crane", A["million"] - 1.0]]
    return {"cuts": [[n, round(t, 4)] for n, t in cut], "paint": paint, "wipe": wipe}


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
        "facts": {"blocks": facts.BLOCKS, "block_t": facts.BLOCK_T, "workers": facts.WORKERS,
                  "painting_bc": facts.PAINTING_BC, "pyramid_bc": facts.GREAT_PYRAMID_BC},
        "haul_hz": round(HAUL_HZ_TARGET * tm["duration"] / 8) * 8 / tm["duration"],     # 8 strides = 4 bars of music
        "shots": shots(A, tm["duration"]),
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
