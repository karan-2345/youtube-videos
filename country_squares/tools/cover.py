"""
tools/cover.py -- the Shorts / Reels cover: the hook frame where every country has just become a square, under the
title. Captured from the S00 scene itself (so it is exactly what the video shows), at the moment the morph completes.
Everything that matters sits inside the middle 3:4 (y 240-1680), Instagram's grid crop.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config.events import at  # noqa: E402
from tools.capture import stills  # noqa: E402

FINAL = ROOT / "renders" / "final"


def make() -> Path:
    timing = json.loads((ROOT / "renders/cache/timings.json").read_text())["S00_Hook"]
    t = round(at(timing, "S00.01", "look like this") + 0.4, 2)
    [png] = stills("S00_Hook", [t], ROOT / "renders" / "stills")
    FINAL.mkdir(parents=True, exist_ok=True)
    out = FINAL / "cover.png"
    shutil.copy(png, out)
    print(f"  cover: S00_Hook at {t} s -> {out.relative_to(ROOT)}")
    return out


if __name__ == "__main__":
    make()
