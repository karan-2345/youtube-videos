"""
tools/thumb_compose.py -- the two thumbnail framings for "How LIGO Heard Two Black Holes Collide", composed in PIL at 1920x1080
from the video's own frames, then handed to tools/thumbnail.py (scale to 1280x720, small-size sheet, pick).

  A  two black holes about to merge (S00) over the real chirp trace + "WE HEARD BLACK HOLES"
  B  the proton at the end of the zoom (S09) with the change beside it + "400x SMALLER THAN A PROTON"

Text stays above y = 800 (YouTube's duration badge covers the bottom-right corner at small sizes).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402
from tools import grade  # noqa: E402

STILLS = ROOT / "renders" / "stills"
FONTS = Path("C:/Windows/Fonts")
P = style.PALETTE


def _font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def _frame(scene: str, t: float) -> Image.Image:
    out = STILLS / f"_thumb_{scene}_{t:.2f}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(ROOT / "renders" / "scenes" / f"{scene}.mp4"),
                    "-frames:v", "1", str(out)], check=True)
    return Image.open(out).convert("RGB")


def _text(d, xy, s, font, fill, shadow=True):
    if shadow:
        d.text((xy[0] + 4, xy[1] + 5), s, font=font, fill=(0, 0, 0))
    d.text(xy, s, font=font, fill=fill)


def _cover(im, boxes, blur=40):
    mask = Image.new("L", im.size, 0)
    md = ImageDraw.Draw(mask)
    for bx in boxes:
        md.rectangle(bx, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    return Image.composite(Image.new("RGB", im.size, P["bg"]), im, mask)


def _place(frame, scale, x, y):
    """The frame scaled down (never up) and placed on a background canvas, so text and picture don't overlap."""
    im = Image.new("RGB", (1920, 1080), P["bg"])
    fr = frame.resize((int(1920 * scale), int(1080 * scale)), Image.LANCZOS)
    im.paste(fr, (x, y))
    return im


def variant_a() -> Image.Image:
    """Two black holes about to merge on the rippling sheet (S00), the real chirp trace beneath, "WE HEARD BLACK HOLES"."""
    import json
    from config import events
    tm = json.loads((ROOT / "renders" / "cache" / "timings.json").read_text())["S00_Chirp"]
    e = events.scene_events("S00_Chirp", tm)
    fr = _frame("S00_Chirp", e["smash"] + 0.55)
    fr = _cover(fr, [(0, 0, 1920, 260), (0, 820, 1920, 1080)])    # the shrunken trace on top, the chip below
    im = _place(fr, 0.86, 260, 200)
    d = ImageDraw.Draw(im)
    _text(d, (80, 50), "WE HEARD", _font("Inter_18pt-Black.ttf", 150), P["ink"])
    _text(d, (80, 205), "BLACK HOLES", _font("Inter_18pt-Black.ttf", 150), P["stretch"])
    tr = json.loads((ROOT / "renders" / "cache" / "scenes" / "S00_Chirp.json").read_text())["trace"]["y"]
    n = len(tr)
    pts = [(120 + 1680 * i / (n - 1), 840 - 95 * y) for i, y in enumerate(tr)]
    d.line(pts, fill=P["det_l"], width=7, joint="curve")
    _text(d, (124, 950), "real LIGO data", _font("Inter_18pt-Bold.ttf", 40), P["ink_dim"], shadow=False)
    return im


def variant_b() -> Image.Image:
    """The proton at the end of S09's zoom, with the change marked beside it: "400x SMALLER THAN A PROTON"."""
    import json
    from config import events
    tm = json.loads((ROOT / "renders" / "cache" / "timings.json").read_text())["S09_Signal"]
    e = events.s09_signal(tm)
    fr = _frame("S09_Signal", e["wider"] + 2.2)
    fr = _cover(fr, [(0, 0, 900, 260), (0, 800, 1920, 1080)])
    im = _place(fr, 0.9, 190, 160)
    d = ImageDraw.Draw(im)
    _text(d, (80, 50), "400× SMALLER", _font("Inter_18pt-Black.ttf", 140), P["ink"])
    _text(d, (80, 195), "THAN A PROTON", _font("Inter_18pt-Black.ttf", 140), P["stretch"])
    return im


def build() -> dict[str, Path]:
    STILLS.mkdir(parents=True, exist_ok=True)
    out = {}
    for v, fn in (("A", variant_a), ("B", variant_b)):
        p = STILLS / f"Thumbnail_{v}_t000.00.png"
        fn().save(p)
        out[v] = p
    return out
