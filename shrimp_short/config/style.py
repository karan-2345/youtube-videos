"""
config/style.py -- the visual and timing contract for every scene, in every tool (pistol-shrimp Short).

Web / three.js scenes read the generated scenes/web/style.css and style.json (run `python build.py style`), so a
colour changed here changes everywhere.

Colour rule: ONE concept = ONE colour, in every scene. Never remap. Colour is never the only cue: everything
coloured is also labelled.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# --------------------------------------------------------------------------
# Video: vertical Short (YouTube Shorts + Instagram Reels)
# --------------------------------------------------------------------------
WIDTH, HEIGHT, FPS = 1080, 1920, 60

# --------------------------------------------------------------------------
# Palette: look "Cut-away" (2026-11-21). One object, one slice, one idea: the real thing first, then a clean block
# cut out of it, lit like a specimen on a dark warm backdrop. Cinnabar stays the one accent (captions' spoken word,
# the label that matters), as in the chess Short.
# --------------------------------------------------------------------------
PALETTE = {
    "bg":            "#0F0C0B",  # the dark backdrop (series constant; caption box, fades)
    "bg_glow":       "#2A1D18",  # the soft warm pool of light behind a specimen (the cut-open claw)
    "sea_deep":      "#04161C",  # the water far away (fog, the backdrop of every underwater shot)
    "sea":           "#0B3A46",  # the water near the subject (glow behind the shrimp)
    "caustic":       "#9FE3E8",  # light rippling on the sand
    "sand":          "#C7B08A",  # the seabed
    "sand_dark":     "#7E6A4C",  # the burrow, shadows in the sand
    "rock":          "#5E5249",  # stones round the burrow
    "weed":          "#3E7A5A",  # a few strands of sea grass
    "shrimp":        "#E06A43",  # the pistol shrimp's shell (one colour for the animal in every shot)
    "shrimp_band":   "#F6D9BE",  # the pale bands on its shell
    "claw_flesh":    "#F0A69C",  # the muscle inside the cut-open claw
    "plunger":       "#F2C14E",  # the plunger (peg) on the moving finger: the part that matters in S01
    "fish":          "#D9C9A0",  # the small fish (a goby)
    "fish_spot":     "#4E9CC6",  # its spots
    "jet":           "#BDF1FF",  # the water jet
    "bubble":        "#E4FAFF",  # the cavitation bubble
    "shock":         "#F2EBDD",  # the shock wave ring
    "flash":         "#FFF4D6",  # the flash of light
    "sun":           "#FFB24A",  # the Sun's surface
    "steel":         "#56626C",  # the submarine
    "sonar":         "#62F2A0",  # the sonar screen
    "ink_text":      "#F2EBDD",  # primary text (ivory)
    "ink_dim":       "#A99E8E",  # secondary text
    "accent":        "#E0502F",  # cinnabar: the one word / label that matters
}
REUSE_COLORS: list[str] = []

# --------------------------------------------------------------------------
# Typography: Inter ExtraBold for every label on screen, centred, short uppercase (user pick 2026-11-01, chess
# Short). Captions: Archivo Captions (static ExtraBold semi-condensed cut), the word being spoken in cinnabar.
# --------------------------------------------------------------------------
FONT_SANS = "Inter"
FONT_SERIF = "Inter"
FONT_MONO = "Inter"
FONT_CAPTIONS = "Archivo Captions"
FONT_FILES = {FONT_SANS: ["Inter-VariableFont_opsz,wght.ttf"]}

TYPE_PX = {"title": 120, "h1": 84, "h2": 56, "body": 44, "label": 46, "small": 30, "caption": 84,
           "credit": 36, "tag": 32, "number": 200}

# --------------------------------------------------------------------------
# Layout: Shorts / Reels overlays cover the top ~220 px, the bottom ~440 px and a ~150 px column of buttons on
# the right from about y = 1000. Everything that matters stays inside the middle 3:4 (y 240-1680), Instagram's
# grid crop (user, 2026-11-01).
# --------------------------------------------------------------------------
SAFE_MARGIN_PX = 64
SAFE_34_Y = (240, 1680)
SAFE_TOP_PX = 220
SAFE_BOTTOM_PX = 440
SAFE_RIGHT_PX = 150
CAPTION_Y = (1330, 1490)         # caption band: below the picture, above the bottom overlay
CAPTION_BAND_PX = 0
CAPTION_BOTTOM_PX = 0

# --------------------------------------------------------------------------
# Timing and pacing
# --------------------------------------------------------------------------
VOICE = "af_heart"
VOICE_LANG = "en-us"
VOICE_SPEED = 0.95
EST_WPM = 194
SENTENCE_GAP_S = 0.4
BEAT_GAP_S = 0.8
SCENE_HEAD_S = 0.3
SCENE_TAIL_S = 0.5
TRANSITION_S = 0.5

VISUAL_ONLY: dict[str, float] = {}
SCENE_ORDER = ["S00_Hook", "S01_Jet", "S02_Crack", "S03_Flash", "S04_Sonar"]

# --------------------------------------------------------------------------
# Captions
# --------------------------------------------------------------------------
CAPTION = {
    "max_chars_per_line": 42,
    "max_lines": 2,
    "min_duration_s": 1.0,
    "max_duration_s": 6.0,
    "font": FONT_SANS,
    "font_px": TYPE_PX["caption"],
    "box_color": "#0F0C0B",
    "box_alpha": 0.72,
}

# --------------------------------------------------------------------------
# Audio
# --------------------------------------------------------------------------
AUDIO = {
    "sample_rate": 48_000,
    "target_lufs": -14.0,
    "true_peak_db": -1.0,
}


def hex_to_rgb01(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def export_web(out_dir: Path = ROOT / "scenes" / "web") -> None:
    """Write style.css (custom properties) and style.json for the web scenes."""
    tokens = {
        "video": {"width": WIDTH, "height": HEIGHT, "fps": FPS},
        "palette": PALETTE,
        "fonts": {"sans": FONT_SANS},
        "type_px": TYPE_PX,
        "layout": {"safe_margin_px": SAFE_MARGIN_PX, "safe_34_y": SAFE_34_Y, "caption_y": CAPTION_Y},
    }
    (out_dir / "style.json").write_text(json.dumps(tokens, indent=2))
    css = []
    for fam, files in FONT_FILES.items():           # local font files, so captures never depend on the network
        for f in files:
            weight = "100 900" if "wght" in f else "400"
            css.append(f"@font-face {{ font-family: '{fam}'; src: url('../../assets/fonts/{f}'); "
                       f"font-weight: {weight}; font-style: normal; }}")
    css += [":root {"]
    css += [f"  --{k.replace('_', '-')}: {v};" for k, v in PALETTE.items()]
    css += [f"  --type-{k}: {v}px;" for k, v in TYPE_PX.items()]
    css += [f"  --safe: {SAFE_MARGIN_PX}px;", f"  --font-sans: '{FONT_SANS}', sans-serif;", "}"]
    (out_dir / "style.css").write_text("\n".join(css) + "\n")


if __name__ == "__main__":
    export_web()
    print("wrote scenes/web/style.css and style.json")
