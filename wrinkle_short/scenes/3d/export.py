"""
scenes/3d/export.py -- write renders/cache/scenes/<SceneId>.json for the three.js scenes (wrinkly-fingers Short).

Every event time is a phrase anchor on the measured narration (config/events.py), and the sound cues are built from
the same anchors, so each sound lands on the thing it belongs to (tools/sfx.py reads the cue rows).

    python scenes/3d/export.py S01_Nerves
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from config import events, style  # noqa: E402

OUT = ROOT / "renders" / "cache" / "scenes"
TIMINGS = ROOT / "renders" / "cache" / "timings.json"

# {scene: {key: (beat, phrase or None, offset[, 'end'])}}
ANCHORS = {
    "S00_Hook": {
        "fingers": ("S00.01", "your fingers wrinkle", 0.0),
        "bath": ("S00.01", "in the bath", 0.0),
        "isnt": ("S00.01", "it isn't just", 0.0),
        "soaking": ("S00.01", "soaking up water", 0.0),
        "vend": ("S00.01", None, 0.0, "end"),
    },
    "S01_Nerves": {
        "nerves": ("S01.01", "your nerves", 0.0),
        "vessels": ("S01.01", "blood vessels", 0.0),
        "tighten": ("S01.01", "to tighten", 0.0),
        "shrinks": ("S01.01", "fingertip shrinks", 0.0),
        "buckles": ("S01.01", "buckles into folds", 0.0),
        "vend": ("S01.01", None, 0.0, "end"),
    },
    "S02_Test": {
        "finger": ("S02.01", "a finger with", 0.0),
        "damaged": ("S02.01", "damaged nerve", 0.0),
        "doesnt": ("S02.01", "doesn't wrinkle", 0.0),
        "doctors": ("S02.01", "which doctors", 0.0),
        "test": ("S02.01", "nerve test", 0.0),
        "vend": ("S02.01", None, 0.0, "end"),
    },
    "S03_Treads": {
        "purpose": ("S03.01", "on purpose", 0.0),
        "treads": ("S03.01", "tire treads", 0.0),
        "grip": ("S03.01", "grip wet things", 0.0),
        "although": ("S03.01", "although", 0.0),
        "argue": ("S03.01", "still argue", 0.0),
        "vend": ("S03.01", None, 0.0, "end"),
    },
    "S04_Same": {
        "folds": ("S04.01", "the folds", 0.0),
        "comeback": ("S04.01", "come back", 0.0),
        "same": ("S04.01", "same pattern", 0.0),
        "because": ("S04.01", "because", 0.0),
        "vessels": ("S04.01", "blood vessels", 0.0),
        "place": ("S04.01", "same place", 0.0),
        "vend": ("S04.01", None, 0.0, "end"),
    },
}


def _common(scene_id: str) -> dict:
    timings = json.loads(TIMINGS.read_text())
    tm = timings[scene_id]
    return {"scene": scene_id, "fps": style.FPS, "palette": style.PALETTE, "caption_y": style.CAPTION_Y,
            "safe34": style.SAFE_34_Y, "timing": tm, "a": events.resolve(tm, ANCHORS.get(scene_id, {}))}


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
