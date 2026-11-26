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
    ("great", "hook", "Great"), ("pyramid", "hook", "Pyramid"), ("tallest", "hook", "tallest"),
    ("built", "hook", "built"), ("y3800", "hook", "3,800"), ("years", "hook", "years"), ("thought", "hook", "thought"),
    ("nobody", "hook", "nobody"), ("written", "hook", "written down"), ("how", "hook", "how"),
    ("did_it", "hook", "did it"), ("until", "hook", "until"), ("archaeologists", "hook", "archaeologists"),
    ("found", "hook", "found"), ("diary", "hook", "diary"), ("man", "hook", "a man"), ("hauled", "hook", "hauled"),
    ("stones", "hook", "its stones"),
    # merer
    ("name", "merer", "His name"), ("merer_w", "merer", "Merer"), ("crew", "merer", "his crew"),
    ("moved", "merer", "moved"), ("few", "merer", "just a few"), ("n23", "merer", "2.3"),
    ("million", "merer", "million"), ("blocks", "merer", "blocks"), ("which", "merer", "which"),
    ("ramps", "merer", "its ramps"), ("one", "merer", "about one"), ("every", "merer", "every few minutes"),
    ("every_day", "merer", "every day"), ("twenty", "merer", "twenty years"),
    # sledge
    ("most", "sledge", "Most"), ("cut", "sledge", "cut right"), ("beside", "sledge", "beside"),
    ("dragged", "sledge", "dragged"), ("sledges", "sledge", "wooden sledges"), ("while", "sledge", "while"),
    ("poured", "sledge", "poured"), ("water", "sledge", "water on"), ("sand", "sledge", "the sand in"),
    ("front", "sledge", "in front"), ("because", "sledge", "because"), ("damp", "sledge", "damp"),
    ("firm", "sledge", "firm"), ("pull", "sledge", "the pull"), ("drops", "sledge", "drops"),
    ("half", "sledge", "half"),
    # boats
    ("white", "boats", "white outer"), ("stones2", "boats", "outer stones"), ("across", "boats", "across"),
    ("nile", "boats", "the Nile"), ("so2", "boats", "so Merer's"), ("forty", "boats", "forty men"),
    ("sailed", "boats", "sailed"), ("boats_w", "boats", "in boats"), ("along", "boats", "along"),
    ("canals", "boats", "canals"), ("dug", "boats", "dug"), ("almost", "boats", "almost"),
    ("pyramid2", "boats", "the pyramid"),
    # casing
    ("cut2", "casing", "were cut so"), ("precisely", "casing", "precisely"), ("joints", "casing", "joints"),
    ("thinner", "casing", "thinner"), ("card", "casing", "credit card"), ("so3", "casing", "so the pyramid"),
    ("shone", "casing", "shone"), ("white2", "casing", "shone white"), ("until2", "casing", "until people"),
    ("took", "casing", "took"), ("away", "casing", "away"), ("cairo", "casing", "Cairo"),
    # workers
    ("builders", "workers", "builders"), ("slaves", "workers", "weren't slaves"), ("because3", "workers", "because"),
    ("paid", "workers", "paid"), ("bread", "workers", "bread"), ("beer", "workers", "beer"),
    ("buried", "workers", "buried"), ("next", "workers", "next to"), ("king", "workers", "king"),
    # end
    ("wasnt", "end", "it wasn't"), ("aliens", "end", "aliens"), ("built3", "end", "that built it"),
    ("thousands", "end", "thousands"), ("like", "end", "like Merer"), ("ropes", "end", "ropes"),
    ("boats3", "end", "boats and"), ("wet", "end", "wet sand"),
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
        "facts": {},
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
