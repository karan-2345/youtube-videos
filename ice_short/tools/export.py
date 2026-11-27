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
    ("y1806", "hook", "1806"), ("young", "hook", "young man"), ("boston", "hook", "Boston"), ("sell", "hook", "sell"),
    ("frozen", "hook", "frozen pond"), ("water1", "hook", "water on"), ("tropical", "hook", "tropical"), ("island", "hook", "island"),
    ("laughed", "hook", "everyone laughed"), ("but1", "hook", "but thirty"), ("later", "hook", "later"),
    ("shipping", "hook", "shipping"), ("halfway", "hook", "halfway"), ("india0", "hook", "India"),
    ("name", "flop", "His name"), ("tudor", "flop", "Tudor"), ("newspaper", "flop", "Boston newspaper"), ("joked", "flop", "joked"),
    ("slippery", "flop", "slippery"), ("plan", "flop", "plan"), ("because1", "flop", "because most"), ("melted", "flop", "melted"),
    ("way", "flop", "the way"), ("martinique", "flop", "Martinique"), ("nowhere", "flop", "nowhere"), ("cold", "flop", "cold"),
    ("lost", "debt", "lost"), ("thousands", "debt", "thousands"), ("worse", "debt", "worse"), ("debts", "debt", "his debts"),
    ("prison", "debt", "prison"), ("still", "debt", "still"), ("giveup", "debt", "give up"),
    ("worked", "secret", "worked out"), ("big", "secret", "big block"), ("melts", "secret", "melts"), ("slowly", "secret", "slowly"), ("small", "secret", "small pieces"),
    ("cut", "secret", "cut his"), ("square", "secret", "square"), ("packed", "secret", "packed"), ("tight", "secret", "tight"),
    ("buried", "secret", "buried"), ("sawdust", "secret", "sawdust"), ("sawmills", "secret", "sawmills"), ("away", "secret", "away"),
    ("y1833", "india", "1833"), ("loaded", "india", "loaded"), ("t180", "india", "180"), ("pondice", "india", "pond ice"),
    ("ship2", "india", "ship called"), ("tuscany", "india", "Tuscany"), ("four", "india", "four months"), ("atsea", "india", "at sea"),
    ("crossing", "india", "crossing"), ("equator", "india", "equator"), ("twice", "india", "twice"), ("t100", "india", "100"),
    ("stillf", "india", "still frozen"), ("calcutta", "india", "Calcutta"),
    ("people", "king", "people there"), ("amazed", "king", "amazed"), ("built", "king", "built"), ("house", "king", "house"),
    ("forice", "king", "his ice"), ("known", "king", "known"), ("iceking", "king", "Ice King"),
    ("every", "end", "every clink"), ("clink", "end", "clink"), ("glass", "end", "glass"), ("trip", "end", "trip"), ("wrong", "end", "wrong"),
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


def shots(A: dict, D: float) -> dict:
    """The cut list (the scene and the sound both use it): [name, start]."""
    cut = [["hook", 0.0], ["laugh", A["laughed"] - 0.3], ["globe1", A["but1"] - 0.1], ["tudor", A["name"] - 0.15],
           ["paper", A["newspaper"] - 0.4], ["holdMelt", A["because1"] - 0.1], ["dockMelt", A["martinique"] - 0.25],
           ["prison", A["worse"] - 0.35], ["race", A["secret"] - 0.1], ["pond", A["cut"] - 0.4], ["pack", A["packed"] - 0.25],
           ["tuscany", A["india"] - 0.1], ["voyage", A["four"] - 0.45], ["globe2", A["crossing"] - 0.25],
           ["arrive", A["t100"] - 0.5], ["calcutta", A["calcutta"] - 0.3], ["house", A["built"] - 0.2],
           ["crown", A["known"] - 0.6], ["glass", A["end"] - 0.1]]
    return {"cuts": [[n, round(t, 4)] for n, t in cut]}


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
