"""
scenes/3d/export.py -- write renders/cache/scenes/<SceneId>.json for the three.js scenes (pistol-shrimp Short).

Every event time is a phrase anchor on the measured narration (config/events.py), and the sound cues are built from
the same anchors, so each sound lands on the thing it belongs to (tools/sfx.py reads the cue rows).

    python scenes/3d/export.py S01_Jet
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from config import events, facts, style  # noqa: E402

OUT = ROOT / "renders" / "cache" / "scenes"
TIMINGS = ROOT / "renders" / "cache" / "timings.json"

# {scene: {key: (beat, phrase or None, offset[, 'end'])}}
ANCHORS = {
    "S00_Hook": {
        "pistol": ("S00.01", "pistol shrimp", 0.0),
        "knocks": ("S00.01", "knocks out", 0.0),
        "claw": ("S00.01", "with a claw", 0.0),
        "never": ("S00.01", "never even", 0.0),
        "touches": ("S00.01", "touches them", 0.0),
        "vend": ("S00.01", None, 0.0, "end"),
    },
    "S01_Jet": {
        "snaps": ("S01.01", "snaps the claw", 0.0),
        "fast": ("S01.01", "so fast", 0.0),
        "jet": ("S01.01", "the jet of water", 0.0),
        "shoots": ("S01.01", "shoots out", 0.0),
        "tears": ("S01.01", "tears open", 0.0),
        "bubble": ("S01.01", "a bubble", 0.0),
        "vend": ("S01.01", None, 0.0, "end"),
    },
    "S02_Crack": {
        "bubble": ("S02.01", "the bubble", 0.0),
        "collapses": ("S02.01", "collapses", 0.0),
        "crack": ("S02.01", "a crack", 0.0),
        "stun": ("S02.01", "stun or", 0.0),
        "kill": ("S02.01", "even kill", 0.0),
        "fish": ("S02.01", "small fish", 0.0),
        "vend": ("S02.01", None, 0.0, "end"),
    },
    "S03_Flash": {
        "collapses": ("S03.01", "it collapses", 0.0),
        "flashes": ("S03.01", "flashes with light", 0.0),
        "means": ("S03.01", "which means", 0.0),
        "instant": ("S03.01", "for an instant", 0.0),
        "hot": ("S03.01", "nearly as hot", 0.0),
        "sun": ("S03.01", "the Sun", 0.0),
        "vend": ("S03.01", None, 0.0, "end"),
    },
    "S04_Sonar": {
        "thousands": ("S04.01", "thousands", 0.0),
        "snap": ("S04.01", "snap at once", 0.0),
        "crackle": ("S04.01", "their crackle", 0.0),
        "drown": ("S04.01", "drown out", 0.0),
        "sonar": ("S04.01", "navy sonar", 0.0),
        "really": ("S04.01", "which really", 0.0),
        "war": ("S04.01", "World War Two", 0.0),
        "vend": ("S04.01", None, 0.0, "end"),
    },
}


def _common(scene_id: str) -> dict:
    timings = json.loads(TIMINGS.read_text())
    tm = timings[scene_id]
    return {"scene": scene_id, "fps": style.FPS, "palette": style.PALETTE, "caption_y": style.CAPTION_Y,
            "safe34": style.SAFE_34_Y, "timing": tm, "facts": dict(facts.F), "a": events.resolve(tm, ANCHORS.get(scene_id, {}))}


def export(scene_id: str) -> Path:
    data = _common(scene_id)
    # Sound cues are produced by the scene's own timeline (scenes/3d/<id>.js: cues(a, dur)) -- see tools/cues.mjs.
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{scene_id}.json"
    out.write_text(json.dumps(data, indent=1), encoding="utf-8")
    return out


if __name__ == "__main__":
    for sid in sys.argv[1:] or style.SCENE_ORDER:
        print(" ", export(sid).relative_to(ROOT))
