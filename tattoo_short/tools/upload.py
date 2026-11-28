"""
tools/upload.py -- titles, description, hashtags and the pinned comment for YouTube Shorts and Instagram Reels
-> renders/final/upload.md. The claims match research/notes.md; the mouse study is named as a mouse study.
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
    d = _dur(fin / "tattoo_short.mp4")
    text = f"""# Upload: Why tattoos don't wash off

Video: `tattoo_short.mp4` ({d:.1f} s, 1080 x 1920, 60 fps, captions burned in). For a platform that adds its own
captions use `tattoo_short_clean.mp4` + `captions/tattoo_short.srt`. Cover: `cover.png` (3:4-safe).

## Title (pick one; the first is recommended)

1. Why Tattoos Don't Wash Off 🤔
2. Your Tattoo Is Being Eaten 😳
3. Why Tattoos Are So Hard To Remove 🤯

## YouTube Shorts description

Your skin sheds its outer layer every few weeks, so why does a tattoo stay? The needle puts the ink deeper, where
immune cells called macrophages swallow it but can't break it down. In a 2018 study, scientists killed those cells
in tattooed mice, and the tattoos didn't fade: new cells swallowed the same ink in the same place. That's also why
laser removal takes so many sessions.

Source: Baranska et al., "Unveiling skin macrophage dynamics explains both tattoo persistence and strenuous
removal", Journal of Experimental Medicine (2018), doi:10.1084/jem.20171608. (The experiment was done in mice.)

#shorts #tattoo #science #immunesystem #biology #didyouknow #facts

## Instagram Reels caption

Why doesn't your tattoo flake off with your skin? 🤔 Your immune cells are holding the ink, and when they die,
new ones grab it again 😳 (2018 study in mice, Journal of Experimental Medicine)

#tattoo #tattoos #science #biology #immunesystem #didyouknow #facts #reels

## Pinned comment

The study used mice, so human details may differ (human immune cells may live longer). But it explains why lasers
need so many sessions: they shatter the ink into pieces small enough for these cells to carry away 🧪
"""
    out = fin / "upload.md"
    out.write_text(text, encoding="utf-8")
    return out


if __name__ == "__main__":
    print(write())
