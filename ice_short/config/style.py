"""
config/style.py -- the visual, voice and audio contract for the Ice King Short.

Look: a turquoise Caribbean sea at golden hour (Martinique, 1806), a merchant brig with its hold cut open on a cargo of
glowing pond ice in sawdust; a lantern-lit hold; a stone debtors' cell; a New England pond in winter; a Boston desk
with the Gazette and an antique globe; the deep-blue Atlantic (1833) and the hazy golden Hooghly at Calcutta. Ice is
blue-white with a cyan glow. Inter ExtraBold type, ONE cinnabar accent for losses and laughs, an ice cyan for ice facts,
a mint green for what works.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WIDTH, HEIGHT, FPS = 1080, 1920, 60
SCENE = "Ice"                    # one continuous 3D scene

PALETTE = {
    "bg":          "#06090C",
    "sea_top":     "#3C78B8",
    "sea_mid":     "#9CC4E2",
    "sea_low":     "#F3D6A6",
    "sun":         "#FFD9A8",
    "deep":        "#0E4A60",
    "shallow":     "#2FB7B0",
    "ice":         "#BFEFFF",
    "ink":         "#F7F3EC",    # primary text
    "ink_dim":     "#D9D2C4",    # labels
    "ink_faint":   "#8E8578",
    "accent":      "#E5482C",    # cinnabar: losses, laughter, prison
    "cool":        "#7FE0FF",    # ice cyan
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
SCENE_HEAD_S = 0.30              # picture before the first word (the ship is already sailing)
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
