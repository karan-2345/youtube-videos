"""
config/style.py -- the visual, voice and audio contract for the Leaning Tower of Pisa Short.

Look: a floating diorama -- a block of the Piazza dei Miracoli lawn with the tower on it, its sides cut to show the
ground underneath -- in Tuscan golden-hour light. White marble, green lawn, sand and blue-grey clay; Inter ExtraBold
numbers and ONE cinnabar accent (what went wrong, what matters).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WIDTH, HEIGHT, FPS = 1080, 1920, 60
SCENE = "Pisa"                   # one continuous 3D scene

PALETTE = {
    "bg":          "#1A1410",    # behind everything (the sky shader paints over it)
    "sky_top":     "#36639A",
    "sky_mid":     "#A9B4BE",
    "sky_low":     "#F2C38A",    # the haze at the horizon, golden hour
    "sun":         "#FFD7A1",
    "marble":      "#ECE5D7",
    "marble_shade":"#B9AE9C",
    "grass":       "#5F7A35",
    "grass_light": "#86A048",
    "sand":        "#98835F",    # horizon A: sandy silt
    "clay":        "#6E7C86",    # horizon B: the soft, wet "Pancone" clay
    "clay_firm":   "#48525A",
    "sand_deep":   "#7A6A50",    # horizon C: dense sand
    "water":       "#7EC8F2",
    "ink":         "#F7F1E6",    # primary text
    "ink_dim":     "#D9CDB8",    # labels
    "ink_faint":   "#9C917F",
    "accent":      "#E5482C",    # cinnabar
}

FONT_SANS = "Inter"
FONT_CAPTIONS = "Archivo Captions"
FONT_FILES = {FONT_SANS: ["Inter-VariableFont_opsz,wght.ttf"]}

SAFE_34_Y = (240, 1680)          # Instagram grid crop: every number and caption stays inside
CAPTION_Y = (1330, 1470)         # word captions band

# ---------------------------------------------------------------- voice (Kokoro, user's pick: af_heart)
VOICE = "af_heart"
VOICE_LANG = "en-us"
VOICE_SPEED = 0.95
MODELS = Path(os.environ.get("KOKORO_MODELS", "/home/user/models"))
SENTENCE_GAP_S = 0.35
BEAT_GAP_S = 0.45
SCENE_HEAD_S = 0.30              # picture before the first word (the tower is already starting to tip)
SCENE_TAIL_S = 1.0               # hold after the last word: the loop back to the first frame

CAPTION = {"max_chars_per_line": 42, "max_lines": 2, "font_px": 84}

AUDIO = {"sample_rate": 48_000, "target_lufs": -14.0, "true_peak_db": -1.0}


def export_web(out_dir: Path = ROOT / "scenes" / "web") -> None:
    css = [f"@font-face {{ font-family: 'Inter'; src: url('../../assets/fonts/{FONT_FILES[FONT_SANS][0]}'); "
           f"font-weight: 100 900; font-style: normal; }}", ":root {"]
    css += [f"  --{k.replace('_', '-')}: {v};" for k, v in PALETTE.items()]
    css += ["}"]
    (out_dir / "style.css").write_text("\n".join(css) + "\n")
    (out_dir / "style.json").write_text(json.dumps({"palette": PALETTE}, indent=1))
