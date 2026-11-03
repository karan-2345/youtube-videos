"""
tools/sheet.py -- contact sheet of a rendered scene at chosen beats (look checks).

    python tools/sheet.py S02_LineOfSight "S02.01+2" "S02.04~-0.2" ... [--preview] --out sheet.png

Each spec is <beat>+<seconds after start> or <beat>~<seconds relative to end>, or a plain time.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def resolve(spec: str, beats: dict) -> float:
    if "~" in spec:
        b, off = spec.split("~")
        return beats[b]["end"] + float(off)
    if "+" in spec:
        b, off = spec.split("+")
        return beats[b]["start"] + float(off)
    return float(spec)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("specs", nargs="+")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--out", required=True)
    ap.add_argument("--cols", type=int, default=2)
    a = ap.parse_args()
    beats = json.loads((ROOT / "renders/cache/timings.json").read_text())[a.scene]["beats"]
    src = ROOT / "renders" / ("preview" if a.preview else "scenes") / f"{a.scene}.mp4"
    ims = []
    with tempfile.TemporaryDirectory() as td:
        for i, spec in enumerate(a.specs):
            f = Path(td) / f"{i}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{resolve(spec, beats):.3f}", "-i", str(src),
                            "-frames:v", "1", str(f)], check=True)
            im = Image.open(f).convert("RGB")
            if im.width > 960:
                im = im.resize((960, 540), Image.LANCZOS)
            ims.append(im)
    w, h = ims[0].size
    rows = (len(ims) + a.cols - 1) // a.cols
    sheet = Image.new("RGB", (a.cols * w, rows * h))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % a.cols) * w, (i // a.cols) * h))
    sheet.save(a.out)
    print(a.out)


if __name__ == "__main__":
    sys.exit(main())
