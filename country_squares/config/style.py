"""
config/style.py -- the visual and timing contract for every scene, in every tool.

The browser scenes read the generated scenes/web/style.css and style.json (python build.py style), so a colour
changed here changes everywhere.

Colour rule: ONE concept = ONE colour, in every scene. The accent marks the square (or the number) the narration is
talking about, and nothing else. Colour is never the only cue: everything coloured is also labelled.
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
# Palette, PROPOSED at STOP 1: "Night atlas". Land in four quiet paper tones on deep ink blue (neighbours never share
# a tone), squares keep their country's tone until the queue forms, then show their flag. One accent (vermilion) for
# the square being talked about and its dimension line.
# --------------------------------------------------------------------------
PALETTE = {
    "bg":        "#0B1020",   # the night sea, every scene's background
    "bg_glow":   "#141B33",   # the soft light behind the map / the floor of the queue
    "grid":      "#1B2440",   # graticule and the queue's floor line
    "land0":     "#EDE4D3",   # the four land tones (config/geo: greedy colouring of neighbours)
    "land1":     "#D8C7A6",
    "land2":     "#B9C3A5",
    "land3":     "#A9B9C7",
    "ghost":     "#3A4360",   # land that is not one of the 195 (Greenland, Taiwan, Western Sahara, ...)
    "ink":       "#F3EFE7",   # primary text
    "ink_dim":   "#A3ABBF",   # labels, areas
    "ink_faint": "#5F6884",   # secondary labels
    "edge":      "#0B1020",   # borders between countries and around squares
    "accent":    "#FF5A36",   # vermilion: the square the narration is about, its dimension line
}

# --------------------------------------------------------------------------
# Typography: Inter ExtraBold for every number and label (the user's pick on the chess Short), centred, uppercase
# labels. Captions: Archivo Captions (static ExtraBold semi-condensed cut), current word in the accent.
# --------------------------------------------------------------------------
FONT_SANS = "Inter"
FONT_CAPTIONS = "Archivo Captions"
FONT_FILES = {
    FONT_SANS: ["Inter-VariableFont_opsz,wght.ttf"],
    FONT_CAPTIONS: ["Archivo-Captions800.ttf"],
}
TYPE_PX = {"title": 96, "h1": 72, "h2": 54, "label": 40, "small": 30, "caption": 84, "number": 150}

# --------------------------------------------------------------------------
# Layout. Shorts / Reels overlays cover the top ~220 px, the bottom ~440 px and a ~150 px column on the right from
# about y = 1000. Everything that matters stays inside the middle 3:4 (y 240-1680), Instagram's grid crop.
# --------------------------------------------------------------------------
SAFE_MARGIN_PX = 64
SAFE_34_Y = (240, 1680)
SAFE_TOP_PX = 220
SAFE_BOTTOM_PX = 440
SAFE_RIGHT_PX = 150
CAPTION_Y = (1290, 1470)

# --------------------------------------------------------------------------
# Timing and pacing
# --------------------------------------------------------------------------
VOICE = "af_heart"             # Kokoro voice (the user's earlier Shorts)
VOICE_LANG = "en-us"
VOICE_SPEED = 0.95
EST_WPM = 194
SENTENCE_GAP_S = 0.4
BEAT_GAP_S = 0.8
SCENE_HEAD_S = 0.3
SCENE_TAIL_S = 0.5
TRANSITION_S = 0.5

VISUAL_ONLY: dict[str, float] = {}
SCENE_ORDER = ["S00_Hook", "S01_Giants", "S02_Middle", "S03_Tiny", "S04_Loop"]

CAPTION = {
    "max_chars_per_line": 28,
    "max_lines": 2,
    "min_duration_s": 1.0,
    "max_duration_s": 6.0,
    "font": FONT_CAPTIONS,
    "font_px": TYPE_PX["caption"],
}

AUDIO = {
    "sample_rate": 48_000,
    "target_lufs": -14.0,
    "true_peak_db": -1.0,
    "music_under_voice_db": -22.0,
    "sfx_under_voice_db": -12.0,
}


def export_web(out_dir: Path = ROOT / "scenes" / "web") -> None:
    tokens = {
        "video": {"width": WIDTH, "height": HEIGHT, "fps": FPS},
        "palette": PALETTE,
        "type_px": TYPE_PX,
        "layout": {"safe_margin_px": SAFE_MARGIN_PX, "safe_34_y": SAFE_34_Y, "caption_y": CAPTION_Y},
    }
    (out_dir / "style.json").write_text(json.dumps(tokens, indent=2))
    css = []
    for fam, files in FONT_FILES.items():
        for f in files:
            weight = "100 900" if "wght" in f else "800"
            css.append(f"@font-face {{ font-family: '{fam}'; src: url('../../assets/fonts/{f}'); "
                       f"font-weight: {weight}; font-style: normal; }}")
    css += [":root {"]
    css += [f"  --{k.replace('_', '-')}: {v};" for k, v in PALETTE.items()]
    css += [f"  --type-{k}: {v}px;" for k, v in TYPE_PX.items()]
    css += [f"  --font-sans: '{FONT_SANS}', sans-serif;", "}"]
    css += ["html, body { margin: 0; padding: 0; background: var(--bg); overflow: hidden; }",
            "canvas { display: block; }"]
    (out_dir / "style.css").write_text("\n".join(css) + "\n")


if __name__ == "__main__":
    export_web()
    print("wrote scenes/web/style.css and style.json")
