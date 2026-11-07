"""
scenes/export.py -- the key schedule of every scene -> renders/cache/scenes/<Id>.json (read by scenes/web/lib/squares.js).

Every time is a phrase anchor on the measured narration (config/events.at), so editing the script and re-running
the TTS moves every key with it. Every number on screen comes from config/facts.py.

    python scenes/export.py [scene ...]
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import geo, style  # noqa: E402
from config.events import at  # noqa: E402
from config.facts import F  # noqa: E402

OUT = ROOT / "renders" / "cache" / "scenes"
TIMINGS = ROOT / "renders" / "cache" / "timings.json"

B = geo.map_bounds()
MAP_S = 0.0306                                       # px per km: the whole world, edge to edge
MAP_CAM = {"kind": "map", "x": 0.0, "y": round((B["y0"] + B["y1"]) / 2 - 20 / MAP_S, 1), "s": MAP_S}   # map centre at y 980
QUEUE = {"x0": B["x0"] + 700, "base": B["y1"] + 9000, "gap": 0.3}
BASE_PX = 1100                                       # the queue's baseline on screen (labels end above the captions)
SIX = (3.0, 0.317, 0.36)                             # q(r, z, ox) that frames the first six squares edge to edge


def q(t, r, z=1.0, ox=0.0, by=BASE_PX, pace=None, ease=None):
    k = {"t": round(t, 3), "kind": "q", "r": r, "z": z, "ox": ox, "by": by}
    if pace:
        k["pace"] = pace
    if ease:
        k["ease"] = ease
    return k


def m(t, cam=MAP_CAM, ease=None, **over):
    k = {**cam, "t": round(t, 3), **over}
    if ease:
        k["ease"] = ease
    return k


def km(v: float) -> str:
    """Side lengths as printed on screen: 4,135 km / 17.8 km / 4.6 km / 663 m."""
    if v < 1:
        return f"{v * 1000:,.0f} m"
    if v < 100:
        return f"{v:,.1f} km"
    return f"{v:,.0f} km"


def graticule():
    lines = []
    for lon in range(-180, 181, 30):
        lines.append([list(map(lambda v: round(v, 1), geo.project(lon, lat)))
                      for lat in range(int(geo.LAT_RANGE[0]), int(geo.LAT_RANGE[1]) + 1, 2)])
    for lat in range(-30, 90, 30):
        lines.append([list(map(lambda v: round(v, 1), geo.project(lon, lat))) for lon in range(-180, 181, 3)])
    return lines


def base(scene: str, timing: dict) -> dict:
    return {
        "id": scene, "timing": {"duration": timing["duration"]}, "fps": style.FPS,
        "palette": style.PALETTE, "queue": QUEUE, "stagger": 0.5, "flyStagger": 0.6,
        "morph": [[0, 1]], "fly": [[0, 1]], "flags": [[0, 1]], "labels": [[0, 1]], "ghosts": [[0, 0]],
        "grid": [[0, 0]], "floor": [[0, 1]], "edge": [[0, 1.2]], "blur": [[0, 1]], "fade": [[0, 0]],
        "accents": [], "dims": [], "callouts": [], "counters": [], "bars": [], "rulers": [], "nests": [],
    }


def land(t0, t1, rank, st=0.6, n=195):
    """When square `rank` finishes its flight (the fly track runs 0 -> 1 from t0 to t1; squares are staggered by rank,
    the same rule squares.js uses)."""
    o = (rank - 1) / (n - 1)
    return t0 + (t1 - t0) * (1 + st * o) / (1 + st)


def accent_pops(d, db=-8):
    return [[round(a["t0"] + 0.05, 3), "pop", db] for a in d["accents"]]


def blur_window(t0, t1, k=6):
    return [[0, 1], [t0, 1], [t0 + 0.15, k], [t1 - 0.15, k], [t1, 1]]


# ---------------------------------------------------------------------------------------------------- scenes
def s00(T):
    d = base("S00_Hook", T)
    b1, b2 = "S00.01", "S00.02"
    t_like = at(T, b1, "look like this")
    t_lined = at(T, b2)
    t_4100 = at(T, b2, "about 4,100")
    t_to = at(T, b2, "to one you could")
    t_walk = at(T, b2, "walk across")
    t_end = T["duration"]
    whip0, whip1 = t_to - 0.15, t_to + 2.6
    d.update({
        "graticule": graticule(),
        "morph": [[0, 0], [1.0, 0], [t_like - 1.0, 1]],
        "ghosts": [[0, 1], [1.0, 1], [t_like - 1.0, 0.3], [t_lined + 0.4, 0.3], [t_lined + 1.6, 0]],
        "grid": [[0, 0.55], [t_lined + 0.2, 0.55], [t_lined + 1.8, 0]],
        "fly": [[0, 0], [t_lined + 0.1, 0], [t_lined + 3.4, 1]],
        "flags": [[0, 0], [t_lined + 1.8, 0], [t_lined + 3.6, 1]],
        "floor": [[0, 0], [t_lined + 1.5, 0], [t_lined + 3.2, 1]],
        "camera": [m(0), m(t_lined - 0.3, s=MAP_S * 1.12, ease="inOut2"),
                   q(t_lined + 3.4, 1.55, 0.62, 0.3, ease="inOut"),
                   q(t_4100 - 0.1, 1.2, 0.8, 0.12, ease="inOut2"),
                   q(whip0, 1.0, 0.95, 0.0, ease="inOut2"),
                   q(whip1, 195, 1.0, 0.0, pace="log", ease="inOut"),
                   q(t_end, 195, 1.08, 0.0, ease="inOut2")],
        "blur": blur_window(whip0 + 0.2, whip1 - 0.3),
        "labels": [[0, 0], [t_lined + 2.8, 0], [t_lined + 3.6, 1], [whip0, 1], [whip0 + 0.3, 0], [whip1 - 0.3, 0], [whip1, 1]],
        "callouts": [
            {"t0": 0.5, "t1": t_lined + 0.6, "y": 420, "lines": [["EVERY COUNTRY", 96, "ink"], ["AS A SQUARE", 96, "accent"]]},
            {"t0": max(t_walk - 0.2, whip1 - 0.15), "t1": t_end + 1, "y": 300,
             "lines": [["ABOUT", 44, "ink_dim"], [f"{F['va.walk_min']:.0f} MINUTES", 110, "accent"], ["ON FOOT", 44, "ink_dim"]]},
        ],
        "accents": [{"t0": t_4100 - 0.2, "t1": whip0 + 0.3, "iso": "ru"},
                    {"t0": whip1 - 0.1, "t1": t_end + 1, "iso": "va"}],
        "dims": [{"t0": t_4100 - 0.2, "t1": whip0 + 0.3, "iso": "ru", "text": km(F["side.ru"])},
                 {"t0": whip1 - 0.1, "t1": t_end + 1, "iso": "va", "text": km(F["side.va"])}],
        "counters": [{"t0": whip0 + 0.2, "t1": whip1 - 0.25, "y": 260}],
    })
    f0, f1 = t_lined + 0.1, t_lined + 3.4
    d["cues"] = ([[0.45, "thump", -6], [1.0, "whoosh", -10], [f0, "whoosh", -6], [whip0, "whoosh_long", -4],
                  [whip1 - 0.05, "chime", -8]] +
                 [[round(land(f0, f1, k), 3), "pop", -12 - k] for k in range(1, 9)] + accent_pops(d))
    return d


def s01(T):
    d = base("S01_Giants", T)
    b1, b2, b3 = "S01.01", "S01.02", "S01.03"
    t_ru, t_pct, t_ca = at(T, b1, "Russia's"), at(T, b1, "71 percent"), at(T, b1, "Canada's")
    t_b2, t_trip, t_4 = at(T, b2), at(T, b2, "triplets"), at(T, b2, "about 4 percent")
    t_b3, t_br, t_47 = at(T, b3), at(T, b3, "Brazil"), at(T, b3, "47 percent")
    t_end = T["duration"]
    d.update({
        "camera": [q(0, 1.45, 0.72, 0.15, ease="inOut2"), q(t_b2 - 0.3, 1.5, 0.76, 0.15, ease="inOut2"),
                   q(t_b2 + 1.2, 3.0, 0.66, 0.0), q(t_b3 - 0.3, 3.0, 0.68, 0.0, ease="inOut2"),
                   q(t_b3 + 1.6, *SIX), q(t_end, SIX[0], SIX[1] * 0.97, SIX[2], ease="inOut2")],
        "accents": [{"t0": t_ru - 0.2, "t1": t_b2 + 0.2, "iso": "ru"},
                    {"t0": t_ca - 0.2, "t1": t_b2 + 0.2, "iso": "ca"}] +
                   [{"t0": t_b2 + 0.4 + 0.35 * i, "t1": t_b3 + 0.2, "iso": iso} for i, iso in enumerate(["ca", "us", "cn"])] +
                   [{"t0": t_br - 0.1 + 0.4 * i, "t1": t_end + 1, "iso": iso, "w": 5} for i, iso in enumerate(["br", "au"])],
        "dims": [{"t0": t_ru - 0.2, "t1": t_b2 + 0.2, "iso": "ru", "text": km(F["side.ru"])},
                 {"t0": t_ca - 0.2, "t1": t_b2 + 0.2, "iso": "ca", "text": km(F["side.ca"])}],
        "callouts": [
            {"t0": t_pct - 0.25, "t1": t_b2 + 0.1, "y": 270,
             "lines": [[f"+{F['x.ru_ca']:.0%}", 150, "accent"], ["MORE AREA THAN CANADA", 44, "ink_dim"]]},
            {"t0": t_trip - 0.25, "t1": t_b3 + 0.1, "y": 270,
             "lines": [["ALMOST TRIPLETS", 64, "ink"], [f"WITHIN {F['x.ca_cn']:.0%}", 120, "accent"]]},
        ],
        "bars": [{"t0": t_47 - 0.5, "t1": t_end + 1, "y": 420, "k": 6,
                  "left": f"FIRST 6: {F['x.top6']:.0%}", "right": f"OTHER {F['n.countries'] - 6:.0f}: {1 - F['x.top6']:.0%}"}],
    })
    d["cues"] = ([[c["t0"] + 0.05, "thump", -7] for c in d["callouts"]] + accent_pops(d) +
                 [[t_b2 - 0.2, "whoosh_short", -12], [t_b3 - 0.2, "whoosh", -12], [t_47 - 0.4, "thump", -7]] +
                 [[round(t_47 - 0.3 + 0.2 + 1.2 * (i + 1) / 6, 3), "tick", -10] for i in range(6)])
    return d


def s02(T):
    d = base("S02_Middle", T)
    b1, b2 = "S02.01", "S02.02"
    t_in, t_fits = at(T, b1, "India"), at(T, b1, "fits into")
    t_b2, t_98, t_mw, t_12 = at(T, b2), at(T, b2, "at number"), at(T, b2, "Malawi's"), at(T, b2, "a twelfth")
    t_end = T["duration"]
    d.update({
        "camera": [q(0, SIX[0], SIX[1] * 0.97, SIX[2]), q(t_in + 0.2, 7.0, 0.9, 0.0, pace="log"),
                   q(t_b2 - 0.2, 7.0, 0.92, 0.0, ease="inOut2"), q(t_mw, 98.0, 0.9, 0.0, pace="log"),
                   q(t_end, 98.0, 0.95, 0.0, ease="inOut2")],
        "blur": blur_window(t_b2, t_mw - 0.2, 4),
        "labels": [[0, 1], [t_b2, 1], [t_b2 + 0.3, 0], [t_mw - 0.4, 0], [t_mw, 1]],
        "accents": [{"t0": t_in - 0.2, "t1": t_b2 + 0.1, "iso": "in"}, {"t0": t_mw - 0.1, "t1": t_end + 1, "iso": "mw"}],
        "nests": [{"t0": t_fits - 0.3, "t1": t_b2 + 0.1, "y": 250, "S": 420, "a": "ru", "b": "in",
                   "labelA": "RUSSIA", "labelB": "INDIA", "big": f"{F['x.ru_in']:.1f}×", "small": "INDIA'S AREA"}],
        "counters": [{"t0": t_b2 + 0.1, "t1": t_12 - 0.5, "y": 250}],
        "rulers": [{"t0": t_12 - 0.4, "t1": t_end + 1, "y": 380, "a": "ru", "b": "mw",
                    "n": round(F["x.ru_mw_side"]), "stagger": 0.09,
                    "top": f"{round(F['x.ru_mw_side'])} MALAWIS", "bottom": f"= RUSSIA'S WIDTH, {km(F['side.ru'])}".upper()}],
    })
    r = d["rulers"][0]
    d["cues"] = (accent_pops(d) + [[0.2, "whoosh_short", -12], [t_fits - 0.25, "thump", -7], [t_b2, "whoosh_long", -6],
                                   [t_mw - 0.05, "chime", -12]] +
                 [[round(r["t0"] + 0.3 + i * r["stagger"] + 0.12, 3), "pop", -14] for i in range(r["n"])])
    return d


def s03(T):
    d = base("S03_Tiny", T)
    b1, b2, b3 = "S03.01", "S03.02", "S03.03"
    t_sm, t_tv, t_nr, t_lt8 = (at(T, b1, p) for p in ("San Marino", "Tuvalu", "Nauru", "less than"))
    t_b2, t_mc = at(T, b2), at(T, b2, "Monaco's")
    t_b3, t_va, t_663, t_hold = at(T, b3), at(T, b3, "Vatican City"), at(T, b3, "663"), at(T, b3, "so Russia")
    t_39 = at(T, b3, "about 39 million")
    t_end = T["duration"]
    d.update({
        "camera": [q(0, 98.0, 0.95, 0.0), q(t_sm - 0.1, 191.4, 0.62, 0.35, pace="log"),
                   q(t_b2 - 0.2, 192.0, 0.6, 0.45, ease="inOut2"), q(t_mc + 0.2, 194.0, 0.85, 0.0),
                   q(t_b3 - 0.1, 194.0, 0.88, 0.0, ease="inOut2"), q(t_va + 0.3, 195.0, 1.0, 0.0),
                   q(t_hold - 0.1, 195.0, 1.05, 0.0, ease="inOut2"),
                   q(t_end - 0.4, 1.45, 0.72, 0.15, pace="log", ease="inOut"), q(t_end, 1.45, 0.72, 0.15)],
        "blur": blur_window(t_hold + 0.3, t_end - 0.7, 6),
        "labels": [[0, 1], [0.3, 0], [t_sm - 0.5, 0], [t_sm - 0.1, 1], [t_hold + 0.3, 1], [t_hold + 0.6, 0],
                   [t_end - 0.6, 0], [t_end - 0.2, 1]],
        "accents": [{"t0": t - 0.15, "t1": t_b2 + 0.1, "iso": iso} for t, iso in ((t_sm, "sm"), (t_tv, "tv"), (t_nr, "nr"))] +
                   [{"t0": t_mc - 0.1, "t1": t_b3 + 0.1, "iso": "mc"}, {"t0": t_va - 0.1, "t1": t_hold + 0.6, "iso": "va"}],
        "dims": [{"t0": t - 0.15, "t1": t_b2 + 0.1, "iso": iso, "text": km(F[f"side.{iso}"]), "px": 36}
                 for t, iso in ((t_sm, "sm"), (t_tv, "tv"), (t_nr, "nr"))] +
                [{"t0": t_mc - 0.1, "t1": t_b3 + 0.1, "iso": "mc", "text": km(F["side.mc"])},
                 {"t0": t_va - 0.1, "t1": t_hold + 0.6, "iso": "va", "text": km(F["side.va"])}],
        "counters": [{"t0": 0.2, "t1": t_sm - 0.3, "y": 250}],
        "callouts": [
            {"t0": t_lt8 - 0.2, "t1": t_b2 + 0.1, "y": 270,
             "lines": [[f"UNDER {math.ceil(F['side.sm']):.0f} KM", 110, "accent"], ["WIDE", 44, "ink_dim"]]},
            {"t0": t_39 - 0.3, "t1": t_end + 1, "y": 270,
             "lines": [[f"{F['x.ru_va'] / 1e6:.0f} MILLION", 120, "accent"], ["VATICAN CITIES FIT IN RUSSIA", 44, "ink_dim"]]},
        ],
    })
    d["cues"] = (accent_pops(d) + [[0.15, "whoosh_long", -6], [t_lt8 - 0.15, "thump", -7], [t_b2 - 0.2, "whoosh_short", -12],
                                   [t_b3 - 0.1, "whoosh_short", -12], [t_va + 0.25, "chime", -8],
                                   [t_hold + 0.2, "whoosh_long", -4], [t_39 - 0.25, "thump", -5]])
    return d


def s04(T):
    d = base("S04_Loop", T)
    b1 = "S04.01"
    t_q = at(T, b1, "so where")
    t_end = T["duration"]
    back0, back1 = 0.5, t_end - 2.0
    d.update({
        "graticule": graticule(),
        "camera": [q(0, 1.45, 0.72, 0.15), q(back0 + 0.3, 1.45, 0.7, 0.15, ease="inOut2"), m(back1 + 0.3, ease="inOut")],
        "fly": [[0, 1], [back0, 1], [back1, 0]],
        "flags": [[0, 1], [back0 + 0.6, 1], [back1 - 0.4, 0]],
        "labels": [[0, 1], [back0, 1], [back0 + 0.5, 0]],
        "floor": [[0, 1], [back0 + 0.4, 1], [back0 + 1.2, 0]],
        "morph": [[0, 1], [back1 - 0.2, 1], [t_end - 0.05, 0]],
        "ghosts": [[0, 0], [back1 - 0.6, 0], [back1, 0.3], [t_end - 0.4, 1]],
        "grid": [[0, 0], [back1 - 0.6, 0], [t_end - 0.3, 0.55]],
        "callouts": [{"t0": t_q - 0.2, "t1": t_end - 0.1, "y": 420,
                      "lines": [["WHERE IS", 96, "ink"], ["YOURS?", 96, "accent"]]}],
    })
    d["cues"] = [[back0, "whoosh", -6], [back1 - 0.3, "whoosh", -12], [t_q - 0.15, "thump", -6]]
    return d


SCENES = {"S00_Hook": s00, "S01_Giants": s01, "S02_Middle": s02, "S03_Tiny": s03, "S04_Loop": s04}


def export(only=None):
    timings = json.loads(TIMINGS.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for sid, fn in SCENES.items():
        if only and sid not in only:
            continue
        d = fn(timings[sid])
        (OUT / f"{sid}.json").write_text(json.dumps(d, separators=(",", ":")), encoding="utf-8")
        print(f"  {sid}: {d['timing']['duration']:.2f} s, {len(d['camera'])} camera keys")


if __name__ == "__main__":
    export(set(sys.argv[1:]) or None)
