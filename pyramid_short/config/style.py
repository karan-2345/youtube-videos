"""
config/style.py -- the visual, voice and audio contract for the pyramid Short ("water on the sand").

Look: golden-hour desert in warm ochre light (the hauling team, the Great Pyramid under construction); a tomb wall
painted in the Egyptian style (lit by a torch); a dark lab studio with a tray of pale desert sand; a macro world of
sand grains. Water is a clear cool blue; wet sand is a deep umber. Inter ExtraBold type, ONE cinnabar accent for what
is wrong or hard (ritual?, dry, too much water) and a mint green for what works.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WIDTH, HEIGHT, FPS = 1080, 1920, 60
SCENE = "Pyramid"                    # one continuous 3D scene

PALETTE = {
    "bg":          "#0B0A0C",
    "sky_top":     "#3F6FA8",
    "sky_mid":     "#9DB7CF",
    "sky_low":     "#F1C892",
    "sun":         "#FFD7A0",
    "sand":        "#E2BC86",    # desert sand, lit
    "sand_dark":   "#B88A55",
    "sand_wet":    "#7A5332",    # wet sand
    "mud":         "#4A3220",
    "limestone":   "#D9CBB0",
    "casing":      "#EEE6D6",
    "alabaster":   "#EADFC8",
    "wood":        "#8A5A32",
    "rope":        "#B89A62",
    "skin":        "#9A5E3A",
    "linen":       "#F1EADB",
    "plaster":     "#D8BE8E",    # the tomb wall
    "ochre_red":   "#A8432A",
    "egypt_blue":  "#2F6FA0",
    "water":       "#5FB8F0",
    "lab_bg":      "#0C1520",
    "steel":       "#B9C2CC",
    "ink":         "#F7F3EC",    # primary text
    "ink_dim":     "#D9CDBB",    # labels
    "ink_faint":   "#8E8578",
    "accent":      "#E5482C",    # cinnabar: wrong / hard
    "good":        "#52E39A",    # mint: what works
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
SCENE_HEAD_S = 0.30              # picture before the first word (the team is already hauling)
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
