"""
tools/thumbnail.py -- the YouTube thumbnail: three.js stills (scenes/3d/Thumbnail.js) scaled to 1280x720.

    python build.py thumbnail            render framings A and B -> renders/stills/thumbnail_{A,B}.png
                                         + renders/stills/thumbnail_sheet.png (both at YouTube's small sizes)
    python build.py thumbnail --pick A   copy the chosen framing to renders/final/thumbnail.png

The stills come through the normal capture harness at 1920x1080 and are scaled down with Lanczos
(1.5x supersampling). The sheet shows each framing where YouTube shows it small, on the dark and the light
UI, with rounded corners and the duration badge in its corner, so readability can be judged at size.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
STILLS = ROOT / "renders" / "stills"
FINAL = ROOT / "renders" / "final" / "thumbnail.png"
VIDEO = ROOT / "renders" / "final" / "flip_in_space.mp4"
VARIANTS = ("A", "B")
SIZE = (1280, 720)
MAX_BYTES = 2 * 1024 * 1024                        # YouTube's thumbnail upload limit
# Where YouTube shows a thumbnail small (CSS px): home/search grid, mobile "up next" list, desktop sidebar
SMALL = [(360, 202, 12), (246, 138, 8), (168, 94, 8)]      # width, height, corner radius
UI = {"dark": ("#0F0F0F", "#F1F1F1"), "light": ("#FFFFFF", "#0F0F0F")}   # background, text
FONT = Path("C:/Windows/Fonts/Inter_18pt-SemiBold.ttf")


def scale(src: Path, dst: Path) -> Path:
    im = Image.open(src).convert("RGB").resize(SIZE, Image.LANCZOS)
    im.save(dst, optimize=True)
    return dst


def _duration() -> str:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(VIDEO)],
                             capture_output=True, text=True, check=True).stdout
        s = round(float(json.loads(out)["format"]["duration"]))
        return f"{s // 60}:{s % 60:02d}"
    except (OSError, subprocess.CalledProcessError, KeyError, ValueError):
        return "0:00"


def _card(im: Image.Image, w: int, h: int, radius: int, badge: str) -> Image.Image:
    """The thumbnail as YouTube draws it at w x h: rounded corners and the duration badge."""
    card = im.resize((w, h), Image.LANCZOS).convert("RGBA")
    d = ImageDraw.Draw(card, "RGBA")
    f = ImageFont.truetype(str(FONT), 12)
    tw = d.textlength(badge, font=f)
    x1, y1 = w - 4, h - 4
    d.rounded_rectangle([x1 - tw - 8, y1 - 18, x1, y1], 4, fill=(0, 0, 0, 204))
    d.text((x1 - tw - 4, y1 - 16), badge, font=f, fill=(255, 255, 255, 255))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius, fill=255)
    card.putalpha(mask)
    return card


def sheet(thumbs: dict[str, Path], out: Path) -> Path:
    badge = _duration()
    pad, gap, label_h = 28, 22, 26
    row_w = sum(w for w, _, _ in SMALL) + gap * (len(SMALL) - 1)
    row_h = max(h for _, h, _ in SMALL)
    panel_h = pad + len(thumbs) * (label_h + row_h) + (len(thumbs) - 1) * gap + pad
    W = pad * 2 + row_w
    img = Image.new("RGB", (W, panel_h * len(UI)), "#000000")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(str(FONT), 15)
    src = {v: Image.open(p).convert("RGB") for v, p in thumbs.items()}
    for i, (ui, (bg, ink)) in enumerate(UI.items()):
        y0 = i * panel_h
        d.rectangle([0, y0, W, y0 + panel_h], fill=bg)
        y = y0 + pad
        for v in thumbs:
            d.text((pad, y + 3), f"{v}  ·  {ui} UI  ·  " + "  /  ".join(f"{w}×{h}" for w, h, _ in SMALL), font=f, fill=ink)
            x, y = pad, y + label_h
            for w, h, r in SMALL:
                card = _card(src[v], w, h, r, badge)
                img.paste(card, (x, y + row_h - h), card)
                x += w + gap
            y += row_h + gap
    img.save(out, optimize=True)
    return out


def pick(variant: str) -> Path:
    src = STILLS / f"thumbnail_{variant}.png"
    if not src.exists():
        raise SystemExit(f"{src.relative_to(ROOT)} not found: run `build.py thumbnail` first")
    FINAL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, FINAL)
    check(FINAL)
    return FINAL


def check(path: Path) -> str:
    im = Image.open(path)
    n = path.stat().st_size
    assert im.format == "PNG" and im.size == SIZE, f"{path.name}: {im.format} {im.size}"
    assert n < MAX_BYTES, f"{path.name}: {n / 1e6:.2f} MB is over YouTube's 2 MB limit"
    return f"{im.size[0]}x{im.size[1]} PNG, {n / 1024 / 1024:.2f} MB"
