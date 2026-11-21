"""
scenes/3d/export.py -- write renders/cache/scenes/<SceneId>.json for the three.js scenes (tattoo Short).

Every event time is a phrase anchor on the measured narration (config/events.py), and the sound cues are built from
the same anchors, so each sound lands on the thing it belongs to (tools/sfx.py reads the cue rows).

    python scenes/3d/export.py S01_Held
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
        "voice": ("S00.01", None, 0.0),
        "sheds": ("S00.01", "sheds", 0.0),
        "weeks": ("S00.01", "every few weeks", 0.0),
        "why": ("S00.01", "so why", 0.0),
        "tattoo": ("S00.01", "your tattoo", 0.0),
        "withit": ("S00.01", "with it", 0.0),
        "vend": ("S00.01", None, 0.0, "end"),
    },
    "S01_Held": {
        "needle": ("S01.01", "the needle", 0.0),
        "deeper": ("S01.01", "deeper", 0.0),
        "immune": ("S01.01", "immune cells", 0.0),
        "macro": ("S01.01", "macrophages", 0.0),
        "swallow": ("S01.01", "swallow it", 0.0),
        "digest": ("S01.01", "can't digest", 0.0),
        "hold": ("S01.01", "hold on", 0.0),
        "vend": ("S01.01", None, 0.0, "end"),
    },
    "S02_Relay": {
        "sci": ("S02.01", "scientists", 0.0),
        "killed": ("S02.01", "killed", 0.0),
        "mice": ("S02.01", "tattooed mice", 0.0),
        "fade": ("S02.01", "didn't fade", 0.0),
        "newc": ("S02.01", "new cells", 0.0),
        "swallowed": ("S02.01", "swallowed", 0.0),
        "same": ("S02.01", "same spot", 0.0),
        "vend": ("S02.01", None, 0.0, "end"),
    },
    "S03_Laser": {
        "lasers": ("S03.01", "lasers", 0.0),
        "sessions": ("S03.01", "so many sessions", 0.0),
        "remove": ("S03.01", "remove a tattoo", 0.0),
        "shatter": ("S03.01", "shatter", 0.0),
        "small": ("S03.01", "small enough", 0.0),
        "carry": ("S03.01", "carry it away", 0.0),
        "vend": ("S03.01", None, 0.0, "end"),
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
