"""
tools/upload.py -- titles, description, hashtags and the pinned comment for YouTube Shorts and Instagram Reels
-> renders/final/upload.md. The claims match research/notes.md (the grip idea is presented as debated).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _dur(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True)
    return float(out.stdout.strip() or 0)


def write() -> Path:
    fin = ROOT / "renders" / "final"
    fin.mkdir(parents=True, exist_ok=True)
    d = _dur(fin / "wrinkle_short.mp4")
    text = f"""# Upload: Why fingers wrinkle in water

Video: `wrinkle_short.mp4` ({d:.1f} s, 1080 x 1920, 60 fps, captions burned in). For a platform that adds its own
captions use `wrinkle_short_clean.mp4` + `captions/wrinkle_short.srt`. Cover: `cover.png` (3:4-safe).

## Title (pick one; the first is recommended)

1. Why Fingers Wrinkle In Water 🤔
2. Pruney Fingers Aren't From The Water 😳
3. Your Nerves Wrinkle Your Fingers 🤯

## YouTube Shorts description

Pruney fingers aren't just your skin soaking up water. Your nerves tell the blood vessels under the skin to
tighten, the fingertip shrinks and the skin buckles into folds. That's why a finger with a damaged nerve doesn't
wrinkle (doctors have used it as a nerve test). The wrinkles might work like tire treads for wet grip, but studies
disagree. And they come back in the same pattern every time.

Sources: Wilder-Smith & Chow 2003 (Microvascular Research); Hsieh et al. 2006 (Clinical Autonomic Research);
Kareklas et al. 2013 (Biology Letters) vs Haseleu et al. 2014 (PLoS ONE); Laytin & German 2025 (J. Mech. Behav.
Biomed. Mater.).

#shorts #science #biology #humanbody #didyouknow #facts #nerves

## Instagram Reels caption

Your fingers don't wrinkle just because they soak up water 🤔 Your nerves do it on purpose, and the folds come back in
the same pattern every time 😳

#science #biology #humanbody #didyouknow #facts #reels

## Pinned comment

Do wrinkly fingers really grip wet things better? A 2013 study said yes (12% faster with wet marbles), a 2014 study
with 40 people found no difference. Which side are you on? 🤔
"""
    out = fin / "upload.md"
    out.write_text(text, encoding="utf-8")
    return out


if __name__ == "__main__":
    print(write())
