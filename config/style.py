"""
config/style.py -- the visual and timing contract for every scene, in every tool.

Manim scenes import this directly. Web / three.js scenes read the generated
scenes/web/style.css and style.json (run `python build.py style`), so a colour
changed here changes everywhere.

Colour rule: ONE concept = ONE colour, in every scene. Never remap. Colour is
never the only cue: everything coloured is also labelled.
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
# Palette
# --------------------------------------------------------------------------
PALETTE = {
    # PROPOSED at STOP 1 (2026-11-01), look A "Club room": a walnut-and-maple tournament board on a dark table under
    # one warm lamp, boxwood and ebonised pieces, ivory type on near-black, ONE accent (cinnabar) for the number
    # that matters in each shot (85 billion, Qh4#, the extra forty zeros)
    "bg":            "#0B0907",  # the dark room, every scene's background
    "table":         "#1E150F",  # tabletop (lit only near the board)
    "table_grain":   "#0E0906",
    "maple":         "#D8B98C",  # light squares
    "maple_grain":   "#B08A5C",
    "walnut":        "#5B3B26",  # dark squares and the frame
    "walnut_grain":  "#2E1C11",
    "inlay":         "#D8C3A0",  # the a-h / 1-8 letters on the frame
    "boxwood":       "#E6CFA4",  # white pieces
    "ebony":         "#2A1F18",  # black pieces
    "lamp":          "#FFD9B0",  # the key light (about 3,200 K)
    "ink":           "#EFE6D6",  # primary text, the move threads
    "ink_dim":       "#A39885",  # labels
    "ink_faint":     "#6D6458",  # hairlines' text, secondary numbers
    "rule":          "#3A3128",  # hairlines
    "accent":        "#E0502F",  # cinnabar: the one number / square that matters
}
REUSE_COLORS: list[str] = []

# --------------------------------------------------------------------------
# Typography (user pick 2026-11-01): Inter ExtraBold for every number and label on screen, centred, uppercase
# labels, no hairlines, letterspacing or italic notes (the Source Serif 4 + letterspaced Archivo labels of the
# first look test "looked too infographic"). Inter 4.001 variable (opsz, wght; SIL OFL) is copied from this
# laptop's installed fonts into assets/fonts, no download. Captions stay Archivo ExtraBold semi-condensed
# (approved; static file still to download).
# --------------------------------------------------------------------------
FONT_SANS = "Inter"                      # numbers and labels (weight 800, tabular figures)
FONT_SERIF = "Inter"                     # (no serif in this look; the name is the slot)
FONT_MONO = "Inter"                      # counters use Inter's tabular figures
FONT_CAPTIONS = "Archivo Captions"      # static ExtraBold semi-condensed cut (tools/make_fonts.py); ASS Bold off
FONT_FILES = {
    FONT_SANS: ["Inter-VariableFont_opsz,wght.ttf"],
    "Archivo": ["Archivo[wdth,wght].ttf"],
}
MATH_PREAMBLE = r"\usepackage{sfmath}"

# Pixel sizes on the 1080 x 1920 frame
TYPE_PX = {"title": 120, "h1": 84, "h2": 56, "body": 44, "label": 38, "small": 30, "caption": 84,
           "credit": 36, "tag": 32, "number": 200}
MANIM_FS = {"title": 60, "h1": 48, "h2": 40, "body": 32, "label": 26, "small": 22, "equation": 44}

# --------------------------------------------------------------------------
# Layout: Shorts / Reels overlays cover the top ~220 px, the bottom ~440 px and a ~150 px column of buttons on
# the right from about y = 1000. Captions sit in their own band below the main picture.
# --------------------------------------------------------------------------
SAFE_MARGIN_PX = 64
SAFE_34_Y = (240, 1680)          # the middle 3:4 (1080 x 1440): Instagram's profile grid crops Reels to this, so every
                                 # number, label, board and caption stays inside it (user, 2026-11-01)
SAFE_TOP_PX = 220
SAFE_BOTTOM_PX = 440
SAFE_RIGHT_PX = 150
CAPTION_Y = (1290, 1470)         # caption band: below the picture, above the bottom overlay
CAPTION_BAND_PX = 0              # (16:9 legacy) no bottom band in the vertical layout
CAPTION_BOTTOM_PX = 0

# --------------------------------------------------------------------------
# Timing and pacing
# --------------------------------------------------------------------------
VOICE = "af_heart"             # Kokoro voice (see audio/voice_samples/)
VOICE_LANG = "en-us"
VOICE_SPEED = 0.95             # Kokoro rate for Shorts (user pick for the QR Short, 2026-10-18)
EST_WPM = 194                  # measured at 0.95 on the QR Short: 190-198 spoken wpm
SENTENCE_GAP_S = 0.4           # silence between sentences inside a beat
BEAT_GAP_S = 0.8               # silence between beats (paragraphs) inside a scene
SCENE_HEAD_S = 0.3             # visual lead-in before the first word of a scene
SCENE_TAIL_S = 0.5             # hold after the last word before the transition
                               # (tail + head - transition = 2.3 s of picture-only at every cut;
                               #  @lead / @pause in the script add more where a shot needs it)
TRANSITION_S = 0.5             # default cross-dissolve / match-cut length

# Scenes with no narration (fixed length, silent track) and the running order of the whole video
VISUAL_ONLY: dict[str, float] = {}
SCENE_ORDER = ["S00_Hook", "S01_First", "S02_Open", "S03_Runaway", "S04_Shannon", "S05_TryIt"]   # script v1 (user, 2026-11-01)

# Motion defaults (Manim run_time and web tween durations)
T_FAST, T_MED, T_SLOW = 0.5, 1.0, 2.0

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
    "box_color": "#0B110F",
    "box_alpha": 0.72,
}

# --------------------------------------------------------------------------
# Audio
# --------------------------------------------------------------------------
AUDIO = {
    "sample_rate": 48_000,
    "target_lufs": -14.0,      # YouTube reference loudness
    "true_peak_db": -1.0,
    "music_under_voice_db": -22.0,  # music bed relative to voice when ducked
    "sfx_under_voice_db": -12.0,
}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def hex_to_rgb01(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def manim_tex_template():
    """TexTemplate with sans-serif maths (sfmath)."""
    from manim import TexTemplate
    t = TexTemplate()
    t.add_to_preamble(MATH_PREAMBLE)
    return t


def px_to_manim(px: float) -> float:
    """Convert 1080p pixels to Manim units (frame height = 8 units)."""
    return px * 8.0 / HEIGHT


def export_web(out_dir: Path = ROOT / "scenes" / "web") -> None:
    """Write style.css (custom properties) and style.json for the web scenes."""
    tokens = {
        "video": {"width": WIDTH, "height": HEIGHT, "fps": FPS},
        "palette": PALETTE,
        "reuse_colors": REUSE_COLORS,
        "fonts": {"sans": FONT_SANS, "serif": FONT_SERIF, "mono": FONT_MONO},
        "type_px": TYPE_PX,
        "layout": {"safe_margin_px": SAFE_MARGIN_PX, "caption_band_px": CAPTION_BAND_PX},
        "timing": {"fast": T_FAST, "med": T_MED, "slow": T_SLOW, "transition": TRANSITION_S},
    }
    (out_dir / "style.json").write_text(json.dumps(tokens, indent=2))
    css = []
    for fam, files in FONT_FILES.items():           # local font files, so captures never depend on the network
        for f in files:
            weight = ("100 900" if "wght" in f else "600" if "SemiBold" in f else "700" if "Bold" in f
                      else "500" if "Medium" in f else "400")
            stretch = "font-stretch: 75% 125%; " if "wdth" in f else ""
            css.append(f"@font-face {{ font-family: '{fam}'; src: url('../../assets/fonts/{f}'); "
                       f"font-weight: {weight}; {stretch}font-style: {'italic' if 'Italic' in f else 'normal'}; }}")
    css += [":root {"]
    css += [f"  --{k.replace('_', '-')}: {v};" for k, v in PALETTE.items()]
    css += [f"  --type-{k}: {v}px;" for k, v in TYPE_PX.items()]
    css += [f"  --safe: {SAFE_MARGIN_PX}px;", f"  --caption-band: {CAPTION_BAND_PX}px;",
            f"  --font-sans: '{FONT_SANS}', sans-serif;", f"  --font-serif: '{FONT_SERIF}', serif;",
            f"  --font-mono: '{FONT_MONO}', monospace;", "}"]
    (out_dir / "style.css").write_text("\n".join(css) + "\n")


if __name__ == "__main__":
    export_web()
    print("wrote scenes/web/style.css and style.json")
