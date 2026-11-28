"""
tools/cover.py -- the Shorts / Reels cover: a frame of the rendered video with the title in Inter ExtraBold, every
word inside the middle 3:4 (Instagram's grid crop). Writes renders/final/cover.png and cover_34_check.png.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402

FRAME = ("S00_Hook", 5.8)                 # the block lifting out of the arm, star on top
LINES = ["WHY DON'T", "TATTOOS", "WASH OFF?"]
ACCENT_LINE = 2


def build() -> Path:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    out_dir = ROOT / "renders" / "final"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / "cover_raw.png"
    scene, t = FRAME
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i",
                    str(ROOT / "renders" / "scenes" / f"{scene}.mp4"), "-frames:v", "1", str(raw)], check=True)
    img = Image.open(raw).convert("RGB")
    font = ImageFont.truetype(str(ROOT / "assets" / "fonts" / "Inter-VariableFont_opsz,wght.ttf"), 116)
    try:
        font.set_variation_by_name("ExtraBold")
    except Exception:
        font.set_variation_by_axes([32, 800])
    y0 = style.SAFE_34_Y[0] + 14
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    text = Image.new("RGBA", img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(text)
    y = y0
    for i, line in enumerate(LINES):
        w = td.textlength(line, font=font)
        x = (style.WIDTH - w) / 2
        sd.text((x, y + 8), line, font=font, fill=(0, 0, 0, 200))
        col = style.PALETTE["accent"] if i == ACCENT_LINE else style.PALETTE["ink_text"]
        td.text((x, y), line, font=font, fill=col)
        y += 130
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    img = Image.alpha_composite(Image.alpha_composite(img.convert("RGBA"), shadow), text).convert("RGB")
    out = out_dir / "cover.png"
    img.save(out)
    y0c, y1c = style.SAFE_34_Y
    img.crop((0, y0c, style.WIDTH, y1c)).save(out_dir / "cover_34_check.png")
    raw.unlink(missing_ok=True)
    return out


if __name__ == "__main__":
    print(build())
