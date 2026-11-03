"""
tools/cover.py -- renders/final/cover.png, the Reels / Shorts cover: a real frame of the climax (the game tree with
69,352,859,712,417 in the accent) with a question set in the video's own type (Inter ExtraBold). Everything that
matters sits inside the middle 1080 x 1440, so Instagram's 3:4 grid crop keeps it.

    python build.py cover
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402

FONTS = ROOT / "assets" / "fonts"
COVER_SCENE, COVER_T = "S03_Runaway", 23.9      # 69 trillion has landed over the tree and fog


def _hex(h: str, a: int = 255):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (a,)


def _inter(px: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTS / "Inter-VariableFont_opsz,wght.ttf"), px)
    f.set_variation_by_axes([32, 800])                 # opsz 32 (display), wght 800 (ExtraBold)
    return f


def build() -> Path:
    from tools import capture
    still = capture.stills(COVER_SCENE, [COVER_T], ROOT / "renders" / "stills")[0]
    img = Image.open(still).convert("RGBA")
    pal = style.PALETTE
    d = ImageDraw.Draw(img)
    big = _inter(86)
    y = 1468                                          # on the dark table, inside the 3:4 crop (y < 1680)
    for i, line in enumerate(["HOW MANY GAMES", "OF CHESS ARE THERE?"]):
        w = d.textlength(line, font=big)
        d.text(((1080 - w) / 2, y + i * 98), line, font=big, fill=_hex(pal["ink"]), stroke_width=6,
               stroke_fill=(0, 0, 0, 230))
    out = ROOT / "renders" / "final" / "cover.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out)
    return out


if __name__ == "__main__":
    print(build())
