"""
tools/listen.py -- the whole narration as one file, cut exactly as the final will be (each scene overlapping the
next by the cross-fade, which only ever overlaps silence), for listening to the script at STOP 1.

    .venv\\Scripts\\python tools\\listen.py   ->  samples/narration_v2.wav
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402


def main(name: str = "narration_v2"):
    timings = json.loads((ROOT / "renders/cache/timings.json").read_text())
    parts, sr = [], None
    for sid in style.SCENE_ORDER:
        x, sr = sf.read(ROOT / "audio/tts" / f"{sid}.wav", dtype="float32")
        assert abs(len(x) / sr - timings[sid]["duration"]) < 0.01
        parts.append(x)
    xf = int(style.TRANSITION_S * sr)
    out = parts[0]
    for p in parts[1:]:
        out = np.concatenate([out[:-xf], out[-xf:] + p[:xf], p[xf:]])
    dst = ROOT / "samples" / f"{name}.wav"
    sf.write(dst, out, sr)
    print(f"  {dst.relative_to(ROOT)}  {len(out) / sr:.1f} s")


if __name__ == "__main__":
    main()
