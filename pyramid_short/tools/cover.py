"""
tools/cover.py -- the Reels / Shorts cover: a frame of the rendered scene with a two-line title in Inter ExtraBold,
everything inside the middle 3:4 (Instagram's grid crop). -> renders/final/cover.png (+ cover_34_check.png)
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import style  # noqa: E402

T_FRAME = 0.6                        # the hook: the team hauling the block, the man pouring water (cover camera, no type)
LINES = [("WET", style.PALETTE["ink"]), ("SAND", style.PALETTE["water"])]


def build() -> Path:
    out = ROOT / "renders" / "final" / "cover.png"
    frame = ROOT / "renders" / "stills" / f"t{T_FRAME:06.2f}.png"
    frame.parent.mkdir(parents=True, exist_ok=True)
    import os
    subprocess.run(["node", str(ROOT / "tools" / "capture.js"), "stills", str(T_FRAME)], check=True, cwd=ROOT,
                   env={**os.environ, "Q": "cover=1&ss=2"}, stdout=subprocess.DEVNULL)
    im = Image.open(frame).convert("RGB")
    font_path = ROOT / "assets" / "fonts" / "Inter-VariableFont_opsz,wght.ttf"
    y = 290
    for text, color in LINES:
        size = 150
        while True:
            f = ImageFont.truetype(str(font_path), size)
            try:
                f.set_variation_by_axes([32, 800])        # opsz, wght: ExtraBold display cut
            except Exception:
                f.set_variation_by_name("ExtraBold")
            w = f.getbbox(text)[2]
            if w <= 940 or size < 60:
                break
            size -= 4
        shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).text((540, y), text, font=f, fill=(0, 0, 0, 230), anchor="mt")
        im.paste(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
        ImageDraw.Draw(im).text((540, y), text, font=f, fill=color, anchor="mt")
        y += int(size * 1.08)
    im.save(out)
    im.crop((0, style.SAFE_34_Y[0], 1080, style.SAFE_34_Y[1])).resize((540, 720)).save(out.with_name("cover_34_check.png"))
    return out


if __name__ == "__main__":
    print(" ", build().relative_to(ROOT))
