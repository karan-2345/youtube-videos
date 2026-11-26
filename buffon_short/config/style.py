"""
config/style.py -- the visual, voice and audio contract for the Buffon's needle Short.

Look: the chess Short's room (dark, one warm lamp, Inter ExtraBold numbers, ONE cinnabar accent), moved from the
board to a floor of oiled oak planks. Steel needles; a needle that crosses a crack turns cinnabar.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WIDTH, HEIGHT, FPS = 1080, 1920, 60
SCENE = "Buffon"                 # one continuous 3D scene

PALETTE = {
    "bg":          "#0B0907",
    "oak":         "#7A4C2B",    # plank base
    "oak_light":   "#A87346",
    "oak_dark":    "#3A2212",
    "crack":       "#120A05",
    "steel":       "#D9DEE3",
    "lamp":        "#FFD9B0",
    "ink":         "#EFE6D6",    # primary text
    "ink_dim":     "#A39885",    # labels
    "ink_faint":   "#6D6458",
    "accent":      "#E0502F",    # cinnabar: a crossing needle, the number that matters
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
SCENE_HEAD_S = 0.35              # picture before the first word (the needle is already falling)
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
