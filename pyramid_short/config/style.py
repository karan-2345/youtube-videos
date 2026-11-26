"""
config/style.py -- the visual, voice and audio contract for the Great Pyramid Short.

Look: Giza as a floating diorama at golden hour -- the plateau of sand and limestone with the pyramid, its quarry and
ramp, the escarpment down to the Nile valley, the river and its canal, Tura's white cliffs beyond. Warm sand and gold
light, the white Tura casing, the deep green-blue Nile. Inter ExtraBold labels; gold for Merer and his diary, ONE
cinnabar accent for what is wrong (the myths), mint for the right answer.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WIDTH, HEIGHT, FPS = 1080, 1920, 60
SCENE = "Pyramid"                    # one continuous 3D scene

PALETTE = {
    "bg":          "#0B0E14",
    "sky_top":     "#3F72AE",    # golden-hour sky
    "sky_mid":     "#A9C0D2",
    "sky_low":     "#F1CF9E",
    "sun":         "#FFC98C",
    "sand":        "#D8B07A",    # the desert
    "sand_dark":   "#B48552",
    "rock":        "#CDB58E",    # Giza limestone (core blocks)
    "rock_dark":   "#8E7552",
    "casing":      "#ECE3D1",    # white Tura limestone
    "mud":         "#7E6145",    # mudbrick, ramps
    "nile":        "#2F6F7E",
    "nile_deep":   "#143847",
    "field":       "#6D8C3A",
    "palm":        "#3E5A28",
    "wood":        "#7A5233",
    "linen":       "#EFE6D0",
    "skin":        "#8A5A3A",
    "papyrus":     "#E6CF9C",
    "gold":        "#FFC24A",    # Merer, his diary
    "ink":         "#F7F4EE",    # primary text
    "ink_dim":     "#D9D1C3",    # labels
    "ink_faint":   "#9A9184",
    "accent":      "#E5482C",    # cinnabar: myths, what is wrong
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
SCENE_HEAD_S = 0.30              # picture before the first word (the camera is already gliding)
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
