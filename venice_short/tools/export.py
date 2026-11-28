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
    ("venice", "hook", "Venice is"), ("millions", "hook", "millions"), ("trunks", "hook", "tree trunks"),
    ("hammered", "hook", "hammered"), ("into_mud", "hook", "mud"), ("thousand", "hook", "more than a thousand"),
    ("years_ago", "hook", "years ago"), ("should", "hook", "should have"), ("rotted", "hook", "rotted"),
    ("long_ago", "hook", "long ago"), ("but", "hook", "but they're"), ("still", "hook", "still holding"),
    ("holding", "hook", "holding"), ("city_up", "hook", "city up"),
    ("because", "lagoon", "Because"), ("first", "lagoon", "first Venetians"), ("built1", "lagoon", "built on"),
    ("islands", "lagoon", "islands"), ("shallow", "lagoon", "shallow"), ("where", "lagoon", "where there"),
    ("no_rock", "lagoon", "no rock"), ("only_water", "lagoon", "only water"), ("soft", "lagoon", "soft"),
    ("sticky", "lagoon", "sticky mud"),
    ("so1", "piles", "So they"), ("cut", "piles", "cut down"), ("forests", "piles", "whole forests"),
    ("sharpened", "piles", "sharpened"), ("posts1", "piles", "into posts"), ("hammer2", "piles", "hammered them"),
    ("close", "piles", "so close"), ("together", "piles", "together"), ("between", "piles", "between them"),
    ("packed", "piles", "packed firm"), ("then", "piles", "and then"), ("built2", "piles", "built in"),
    ("stone", "piles", "stone on top"),
    ("this_church", "salute", "This one church"), ("salute_name", "salute", "the Salute"),
    ("standing", "salute", "is standing"), ("more_than", "salute", "more than"), ("million", "salute", "million posts"),
    ("wood_rots", "rot", "wood rots"), ("fungi1", "rot", "tiny fungi"), ("eat", "rot", "eat it"),
    ("thats_why", "rot", "that's why"), ("fence", "rot", "fence post"), ("crumbles", "rot", "crumbles"),
    ("few_years", "rot", "few years"),
    ("down", "secret", "Down in"), ("though", "secret", "though"), ("almost", "secret", "almost no"),
    ("oxygen", "secret", "oxygen"), ("fungi2", "secret", "the fungi"), ("rot_wood", "secret", "rot wood"),
    ("cant", "secret", "can't live"), ("without", "secret", "without it"),
    ("bacteria", "slow", "bacteria"), ("nibble", "slow", "nibble"), ("slowly", "slow", "so slowly"),
    ("centuries", "slow", "centuries"), ("water_fills", "slow", "water fills"), ("keeps", "slow", "keeps its shape"),
    ("shape", "slow", "shape"), ("carrying", "slow", "carrying"), ("weight", "slow", "weight"),
    ("under", "finale", "under every"), ("palace", "finale", "palace"), ("church2", "finale", "every church"),
    ("whole_forest", "finale", "whole forest"), ("upside", "finale", "upside down"), ("in_mud", "finale", "in the mud"),
    ("working", "finale", "still working"),
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
