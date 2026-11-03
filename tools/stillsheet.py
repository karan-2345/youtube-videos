"""
tools/stillsheet.py -- tile the latest stills of a scene (renders/stills/<Scene>_t*.png) into one small sheet.

    python tools/stillsheet.py S00_Chirp [--cols 4] [--w 480]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--w", type=int, default=480)
    ap.add_argument("--times", nargs="*", type=float)
    a = ap.parse_args()
    files = sorted((ROOT / "renders" / "stills").glob(f"{a.scene}_t*.png"))
    if a.times:
        files = [f for f in files if float(f.stem.split("_t")[-1]) in a.times]
    h = a.w * 9 // 16
    rows = (len(files) + a.cols - 1) // a.cols
    sheet = Image.new("RGB", (a.cols * a.w, rows * h), "black")
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB").resize((a.w, h), Image.LANCZOS)
        x, y = (i % a.cols) * a.w, (i // a.cols) * h
        sheet.paste(im, (x, y))
        d.text((x + 6, y + 4), f.stem.split("_t")[-1], fill="yellow")
    out = ROOT / "renders" / "stills" / f"{a.scene}_sheet.png"
    sheet.save(out)
    print(out.relative_to(ROOT))


if __name__ == "__main__":
    sys.exit(main())
