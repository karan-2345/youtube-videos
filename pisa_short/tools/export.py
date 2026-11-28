"""
tools/export.py -- everything the 3D scene shows, as data: phrase times measured on the voice, the year shown on
screen, when each floor of the tower lands or lifts off, and the sound cue sheet. Writes renders/cache/scene.json.

Floors: 0 = ground floor (blind arcade), 1-6 = the six open galleries, 7 = the bell chamber.
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
    """The text as it is said (years as years, other numbers in words): phrase times go by spoken length."""
    for k, v in SAY.items():
        text = text.replace(k, v)
    return re.sub(r"\d[\d,]*", lambda m: _words(int(m.group(0).replace(",", ""))), text)


def at(tm: dict, beat: str, phrase: str | None = None, end: bool = False, off: float = 0.0) -> float:
    """Time of a beat's start/end, or of `phrase` inside it (start, or end with end=True), by share of characters."""
    b = tm["beats"][beat]
    if phrase is None:
        return round((b["end"] if end else b["start"]) + off, 3)
    for s in b["sentences"]:
        i = s["text"].find(phrase)
        if i >= 0:
            j = i + (len(phrase) if end else 0)
            share = len(spoken(s["text"][:j])) / len(spoken(s["text"]))
            return round(s["start"] + (s["end"] - s["start"]) * share + off, 3)
    raise KeyError(f"{phrase!r} not in {beat}")


def anchors(tm: dict) -> dict:
    P = [
        ("tower", "hook", "Leaning Tower"), ("fallen", "hook", "should have fallen"), ("over", "hook", "over more"),
        ("y800", "hook", "800 years ago"), ("when", "hook", "when it was only"), ("three", "hook", "three floors"),
        ("tall", "hook", "tall,"), ("saved", "hook", "and what saved it"), ("genius", "hook", "some genius engineer"),
        ("but_war", "hook", "but a war"), ("war_word", "hook", "war."),
        ("save_tower", "bridge", "save a tower"), ("underground", "bridge", "look underground"),
        ("y1173", "ground", "In 1173"), ("began", "ground", "Pisa began building"), ("clay", "ground", "soft, wet clay"),
        ("foundation", "ground", "with a foundation"), ("deep", "ground", "three meters deep"),
        ("third", "ground", "by the third floor"), ("sinking", "ground", "one side was already sinking"),
        ("sinking_w", "ground", "sinking"),
        ("went_war", "war", "went to war"), ("stopped", "war", "the work stopped"), ("century", "war", "almost a century"),
        ("weight", "war", "while the tower's weight"), ("squeezed", "war", "squeezed water"),
        ("clay2", "war", "out of the clay"), ("firmer", "war", "made it firmer"),
        ("kept", "war", "because if they'd kept building"), ("collapsed", "war", "it would have collapsed"),
        ("came_back", "banana", "the builders came back"), ("new_floor", "banana", "each new floor"),
        ("taller", "banana", "a little taller"), ("one_side", "banana", "on one side"), ("hide", "banana", "to hide the lean"),
        ("straight", "banana", "isn't straight at all"), ("curved", "banana", "but curved"),
        ("like_banana", "banana", "like a banana"),
        ("y1990", "modern", "By 1990"), ("so_far", "modern", "leaning so far"), ("close", "modern", "had to close"),
        ("engineers", "modern", "until engineers"), ("pulled", "modern", "pulled soil"),
        ("high_side", "modern", "the high side"), ("straightened", "modern", "straightened it"),
        ("half_m", "modern", "almost half a meter"),
        ("same_clay", "end", "that same soft clay"), ("saved_from", "end", "has saved it"),
        ("quakes", "end", "four strong earthquakes"), ("swaying", "end", "by keeping it from swaying"),
        ("shaking", "end", "the shaking"), ("so_ground", "end", "so the ground"), ("made_lean", "end", "made it lean"),
        ("reason", "end", "is the reason"), ("standing", "end", "still standing"),
    ]
    A = {k: at(tm, b, p) for k, b, p in P}
    for b in tm["beats"]:
        A[b] = at(tm, b)
        A[b + "_end"] = at(tm, b, end=True)
    A["duration"] = tm["duration"]
    return A


def schedule(A: dict) -> dict:
    """Floor events [t, floor, kind]: 'land' (dropped into place), 'lift' (lifted off, time running backwards),
    'ghost' (the floors that were never built: they stack up and fail)."""
    ev = []
    # hook: after the rewind, time keeps running backwards -- floors 7 .. 3 lift off, 2026 -> 1178
    t0, t1 = A["when"] + 0.55, A["tall"] - 0.05
    for k, f in enumerate(range(7, 2, -1)):
        ev.append([t0 + (t1 - t0) * k / 4, f, "lift"])
    # ground: back to 1173 (the three floors lift off), then built up again: 1173 -> 1178
    for k, f in enumerate((2, 1, 0)):
        ev.append([A["y1173"] - 0.05 + 0.12 * k, f, "lift"])
    ev.append([A["began"] + 0.55, 0, "land"])
    ev.append([A["deep"] + 0.35, 1, "land"])
    ev.append([A["third"] + 0.3, 2, "land"])
    # war: the floors that would have been built
    g0, g1 = A["kept"] + 0.1, A["collapsed"] - 0.05
    for k, f in enumerate(range(3, 8)):
        ev.append([g0 + (g1 - g0) * k / 4, f, "ghost"])
    # banana: 1272-1319 the four galleries, each a wedge; 1372 the bell chamber
    b0, b1 = A["new_floor"] - 0.1, A["hide"] + 0.2
    for k, f in enumerate(range(3, 7)):
        ev.append([b0 + (b1 - b0) * k / 3, f, "land"])
    ev.append([A["banana_end"] + 0.05, 7, "land"])
    return {"floors": sorted(ev, key=lambda e: e[0])}


def years(A: dict) -> list[list]:
    """[t, year] keys for the counter (linear between keys, held outside)."""
    return [
        [A["y800"] - 0.3, facts.NOW], [A["when"] + 0.5, facts.NOW],          # the rewind starts in the present
        [A["tall"], facts.FIRST_STOP], [A["y1173"] - 0.1, facts.FIRST_STOP],  # ... and runs back to 1178
        [A["y1173"] + 0.3, facts.START], [A["began"] + 0.4, facts.START],    # back to 1173
        [A["third"] + 0.4, facts.FIRST_STOP], [A["stopped"] - 0.1, facts.FIRST_STOP],
        [A["firmer"] + 0.6, facts.RESUME], [A["came_back"], facts.RESUME],   # the pause: 1178 -> 1272
        [A["hide"] + 0.4, facts.SEVENTH], [A["banana_end"] - 0.1, facts.SEVENTH],
        [A["banana_end"] + 0.15, facts.BELLS], [A["y1990"] - 0.15, facts.BELLS],
        [A["so_far"], facts.CLOSED], [A["engineers"], facts.CLOSED],
        [A["half_m"] + 0.6, facts.REOPENED], [A["same_clay"] - 0.3, facts.REOPENED],
        [A["standing"], facts.NOW],
    ]


def cues(A: dict, sch: dict) -> list[list]:
    """[t, sound, dB, seed] for everything the scene does on its own clock."""
    out = []
    for t, f, kind in sch["floors"]:
        if kind == "land":
            out.append([t, "stone", -8.0 if f != 7 else -6.0, 10 + f])
        elif kind == "lift":
            out.append([t - 0.12, "lift", -16.0, 20 + f])
        elif kind == "ghost":
            out.append([t, "stone", -16.0, 30 + f])
    return out


def export() -> dict:
    tm = json.loads(TIMINGS.read_text())
    A = anchors(tm)
    sch = schedule(A)
    data = {
        "fps": style.FPS, "frames": tm["frames"], "duration": tm["duration"], "palette": style.PALETTE,
        "anchors": A, "floors": sch["floors"], "years": years(A),
        "facts": {"start": facts.START, "stop": facts.FIRST_STOP, "resume": facts.RESUME, "bells": facts.BELLS,
                  "closed": facts.CLOSED, "quakes": facts.QUAKES, "straightened_m": facts.STRAIGHTENED_M},
    }
    data["cues"] = [[round(c[0], 4), c[1], round(c[2], 2), c[3]] for c in sorted(cues(A, sch), key=lambda c: c[0])]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data))
    print(f"  scene.json: {len(sch['floors'])} floor events, {len(data['cues'])} cues")
    return data


if __name__ == "__main__":
    d = export()
    for k, v in d["anchors"].items():
        print(f"    {k:14s} {v:7.2f}")
