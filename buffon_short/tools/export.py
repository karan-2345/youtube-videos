"""
tools/export.py -- everything the 3D scene shows, as data: phrase times measured on the voice, every needle drop
(position, angle, drop time, whether it crosses), and the sound cue sheet. Writes renders/cache/scene.json.

The rain of 3,000 needles is config/facts.rain(RAIN_SEED): the counter on screen is computed from exactly the
needles that have landed, so the 3.1283 it ends on is the 2N/C of the needles you see.
"""

from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import facts, style  # noqa: E402

TIMINGS = ROOT / "renders" / "cache" / "timings.json"
OUT = ROOT / "renders" / "cache" / "scene.json"
G = 9.8


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
    """Numbers as they are said ('3,408' -> 'three thousand four hundred eight'): phrase times go by spoken length."""
    import re
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
    A = {
        "pi": at(tm, "hook", "calculate pi"),
        "circle0": at(tm, "hook", "without a single circle"),
        "dropping": at(tm, "hook", "just by dropping"),
        "floor": at(tm, "hook", "wooden floor"),
        "mathematician": at(tm, "hook", "one mathematician"),
        "six": at(tm, "hook", "six decimal places"),
        "right": at(tm, "hook", "right,"),
        "numbers": at(tm, "hook", "the numbers he wrote"),
        "cheated": at(tm, "hook", "cheated"),
        "hook_end": at(tm, "hook", end=True),
        "bridge": at(tm, "bridge"),
        "falling": at(tm, "bridge", "a falling needle"),
        "a_circle": at(tm, "bridge", "about a circle"),
        "bridge_end": at(tm, "bridge", end=True),
        "rule": at(tm, "rule"),
        "wide": at(tm, "rule", "wide", end=True),
        "across": at(tm, "rule", "one lying across"),
        "hits": at(tm, "rule", "always hits a crack"),
        "along": at(tm, "rule", "while one lying along"),
        "never": at(tm, "rule", "almost never"),
        "rule_end": at(tm, "rule", end=True),
        "circ": at(tm, "circle"),
        "any_way": at(tm, "circle", "point any way"),
        "full_circle": at(tm, "circle", "full circle"),
        "chance": at(tm, "circle", "the chance of a crossing"),
        "two_over_pi": at(tm, "circle", "exactly two over pi"),
        "twice": at(tm, "circle", "so twice the drops"),
        "turns": at(tm, "circle", "slowly turns into pi"),
        "circle_end": at(tm, "circle", end=True),
        "slow": at(tm, "slow"),
        "three_k": at(tm, "slow", "after 3,000 drops"),
        "honest": at(tm, "slow", "an honest run"),
        "one_decimal": at(tm, "slow", "one decimal place"),
        "slow_end": at(tm, "slow", end=True),
        "catch": at(tm, "catch"),
        "away": at(tm, "catch", "Lazzarini away"),
        "answer": at(tm, "catch", "his answer"),
        "frac": at(tm, "catch", "355 over 113"),
        "frac_end": at(tm, "catch", "355 over 113", end=True),
        "old": at(tm, "catch", "a fraction for pi"),
        "thousand": at(tm, "catch", "over a thousand years"),
        "drops3408": at(tm, "catch", "and his 3,408"),
        "right_number": at(tm, "catch", "just the right number"),
        "land_on": at(tm, "catch", "land on it"),
        "catch_end": at(tm, "catch", end=True),
        "end": at(tm, "end"),
        "stopped": at(tm, "end", "stopped the moment"),
        "hit_it": at(tm, "end", "hit it"),
        "trick": at(tm, "end", "the trick is real"),
        "but_his": at(tm, "end", "but his six"),
        "werent": at(tm, "end", "weren't"),
        "end_end": at(tm, "end", end=True),
        "duration": tm["duration"],
    }
    return A


def fall_time(h: float) -> float:
    return math.sqrt(2 * h / G)


def hook_needles(A: dict) -> list[dict]:
    """The hook's needles: one hero (already falling at t = 0, slow motion), a shower on 'just by dropping
    needles onto a wooden floor', a trickle to 'cheated', and a last wave that is caught mid-air by the freeze."""
    r = random.Random(7)
    out = []
    # the hero: lands across the crack at x = 0 near the camera, slow motion (3x)
    hero = {"x": 0.14, "z": 0.25, "th": 0.38, "h": 3.2, "tf": 5.5, "td": -4.125, "spin": 2.6, "tilt": 0.9,
            "g": "hero"}
    out.append(hero)
    t0, t1 = A["dropping"] - 0.1, A["numbers"] - 0.2

    def add(td, region, g):
        x = r.uniform(*region[0])
        z = r.uniform(*region[1])
        th = r.uniform(0, math.pi)
        h = r.uniform(5.0, 6.0)
        out.append({"x": x, "z": z, "th": th, "h": h, "tf": fall_time(h) * 1.25, "td": td,
                    "spin": r.uniform(-2.5, 2.5), "tilt": r.uniform(0.4, 1.2), "g": g})

    # the shower: dense first, then a trickle
    n_shower = 34
    for k in range(n_shower):
        u = (k / (n_shower - 1)) ** 1.6
        add(t0 + u * (t1 - t0), ((-2.4, 2.6), (-2.4, 2.2)), "hook")
    # the freeze wave: dropped so that they hang at every height when time stops on 'cheated'
    tF = A["cheated"]
    for k in range(14):
        h = r.uniform(5.0, 6.0)
        tf = fall_time(h) * 1.25
        td = tF - tf * r.uniform(0.15, 0.9)
        x, z, th = r.uniform(-2.2, 2.4), r.uniform(-2.0, 2.0), r.uniform(0, math.pi)
        out.append({"x": x, "z": z, "th": th, "h": h, "tf": tf, "td": td, "spin": r.uniform(-2.5, 2.5),
                    "tilt": r.uniform(0.4, 1.2), "g": "freeze"})
    for n in out:
        n["c"] = facts.crosses(n["x"], n["th"])
    return out


def rain_schedule(A: dict) -> tuple[list[dict], float, float]:
    """facts.rain(RAIN_SEED) dropped in the drawn order, slow at first then accelerating, all 3,000 landed just after
    'after 3,000 drops' is said."""
    needles = facts.rain(facts.RAIN_SEED)
    N = len(needles)
    t_start = A["twice"] + 0.6
    t_end = A["three_k"] + 0.9
    T = t_end - t_start
    # n(s) = N (e^{ks} - 1) / (e^{kT} - 1), with the first 8 landings taking the first 1.6 s
    lo, hi = 0.05, 5.0
    for _ in range(80):
        k = (lo + hi) / 2
        n = N * (math.exp(k * 1.6) - 1) / (math.exp(k * T) - 1)
        lo, hi = (k, hi) if n > 8 else (lo, k)
    r = random.Random(11)
    out = []
    for i, nd in enumerate(needles):
        land = t_start + math.log(1 + (i + 0.5) / N * (math.exp(k * T) - 1)) / k
        h = 3.0
        tf = fall_time(h) * 1.1
        out.append({"x": nd["x"], "z": nd["z"], "th": nd["th"], "c": nd["c"], "h": h, "tf": tf,
                    "td": round(land - tf, 4), "spin": r.uniform(-3, 3), "tilt": r.uniform(0.3, 1.1), "g": "rain"})
    return out, t_start, t_end


def laz_needles(A: dict) -> list[dict]:
    """'So he most likely stopped the moment he hit it': a last few drops, the counter steps 1,806 -> 1,808, and the
    next needles freeze mid-air on 'hit it'."""
    r = random.Random(23)
    out = []
    t_hit = A["hit_it"]
    lands = [A["stopped"] - 0.55, t_hit - 0.75, t_hit - 0.05]
    for i, land in enumerate(lands):
        h = 2.5
        tf = fall_time(h) * 1.2
        x, z = r.uniform(-1.6, 1.6), r.uniform(-1.4, 1.6)
        th = r.uniform(0.0, 0.5)              # across the boards, and placed to cross: these are counted crossings
        x = math.floor(x) + r.uniform(0.0, 0.25)
        out.append({"x": x, "z": z, "th": th, "h": h, "tf": tf, "td": land - tf, "spin": r.uniform(-2, 2),
                    "tilt": r.uniform(0.4, 1.0), "g": "laz", "c": True})
    for k in range(9):                        # caught in the air when he stops
        h = 2.5
        tf = fall_time(h) * 1.2
        td = t_hit - tf * r.uniform(0.1, 0.85)
        out.append({"x": r.uniform(-2.0, 2.0), "z": r.uniform(-1.8, 1.8), "th": r.uniform(0, math.pi), "h": h,
                    "tf": tf, "td": td, "spin": r.uniform(-2, 2), "tilt": r.uniform(0.4, 1.0), "g": "lazfreeze"})
    for n in out[3:]:
        n["c"] = facts.crosses(n["x"], n["th"])
    for n in out[:3]:
        assert facts.crosses(n["x"], n["th"]), n
    return out


def cues(A: dict, needles: list[dict], rain_t: tuple[float, float]) -> list[list]:
    """[t, sound, dB, seed]. Every landing gets a tink (quieter in the rain, where they add up to a patter)."""
    out = []
    r = random.Random(5)
    for i, n in enumerate(needles):
        land = n["td"] + n["tf"]
        g = n["g"]
        if g in ("freeze", "lazfreeze") and land > (A["cheated"] if g == "freeze" else A["hit_it"]):
            continue                                   # frozen in the air: never lands
        if g == "hero":
            out.append([land, "tink", -2.0, 1])
            land2 = land + A["duration"]               # (the loop's re-drop lands after the end: no sound)
        elif g == "hook":
            out.append([land, "tink", r.uniform(-11, -6), i])
        elif g == "rain":
            out.append([land, "tink", r.uniform(-30, -19), i])
        elif g == "laz":
            out.append([land, "tink", -6.0, i])
    out.append([A["cheated"] - 0.55, "freeze", -4.0, 1])
    out.append([A["hit_it"] - 0.55, "freeze", -5.0, 2])
    out.append([A["bridge"] + 0.05, "rewind", -6.0, 1])
    out.append([A["werent"] + 0.1, "rewind", -6.0, 2])
    return sorted(out, key=lambda c: c[0])


def export() -> dict:
    tm = json.loads(TIMINGS.read_text())
    A = anchors(tm)
    hook = hook_needles(A)
    rain, rs, re_ = rain_schedule(A)
    laz = laz_needles(A)
    needles = hook + rain + laz
    data = {
        "fps": style.FPS, "frames": tm["frames"], "duration": tm["duration"], "palette": style.PALETTE,
        "anchors": A, "rain": {"start": rs, "end": re_, "n": len(rain), "first": len(hook)},
        "needles": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in n.items()} for n in needles],
        "lazzarini": {"drops": facts.LAZ_DROPS, "crossings": facts.LAZ_CROSS},
    }
    data["cues"] = [[round(c[0], 4), c[1], round(c[2], 2), c[3]] for c in cues(A, needles, (rs, re_))]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data))
    est = facts.running_estimate(facts.rain(facts.RAIN_SEED))[-1]
    print(f"  scene.json: {len(needles)} needles ({len(rain)} rain, 2N/C = {est:.4f}), {len(data['cues'])} cues")
    return data


if __name__ == "__main__":
    d = export()
    for k, v in d["anchors"].items():
        print(f"    {k:14s} {v:7.2f}")
