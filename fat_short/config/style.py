"""
config/style.py -- the visual, voice and audio contract for the "where does the fat go" Short.

Look: a dark studio with one glowing thing in it -- a glossy, golden lump of fat, then a glass human figure with the
fat and the lungs glowing inside it; fat atoms as glossy ball-and-stick models. Gold = fat (and every speck of it
that leaves), cool white-blue = breath, blue = water. Inter ExtraBold numbers and ONE cinnabar accent for what is
wrong (the myths); a mint green for the right answer.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WIDTH, HEIGHT, FPS = 1080, 1920, 60
SCENE = "Fat"                    # one continuous 3D scene

PALETTE = {
    "bg":          "#06090F",    # the studio
    "bg_top":      "#0F1B2B",
    "bg_low":      "#030508",
    "fat":         "#FFB43A",    # amber-gold fat
    "fat_deep":    "#D9690F",
    "fat_glow":    "#FFD772",
    "muscle":      "#C23A40",
    "glass":       "#CFE4FF",    # the glass figure
    "lung":        "#FF7B6E",
    "carbon":      "#3B4049",
    "hydrogen":    "#F1F3F6",
    "oxygen":      "#E5483B",
    "breath":      "#C4E6FF",
    "water":       "#4DB2FF",
    "ink":         "#F4F7FA",    # primary text
    "ink_dim":     "#B8C5D3",    # labels
    "ink_faint":   "#6E7D8E",
    "accent":      "#E5482C",    # cinnabar: the myths, what is wrong
    "good":        "#52E39A",    # mint: the right answer
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
SCENE_HEAD_S = 0.30              # picture before the first word (the fat is already wobbling)
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
