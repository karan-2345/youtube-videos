"""
tools/upload.py -- titles, description, hashtags and the pinned comment for YouTube Shorts and Instagram Reels
-> renders/final/upload.md. The claims match research/notes.md (the Sun comparison is an estimate).
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
    d = _dur(fin / "shrimp_short.mp4")
    text = f"""# Upload: The pistol shrimp's snap

Video: `shrimp_short.mp4` ({d:.1f} s, 1080 x 1920, 60 fps, captions burned in). For a platform that adds its own
captions use `shrimp_short_clean.mp4` + `shrimp_short.srt`. Cover: `cover.png` (3:4-safe).

## Title (pick one; the first is recommended)

1. This Shrimp Knocks Out Fish Without Touching Them 😳
2. The Shrimp That Fights With A Bubble 🫧
3. Why The Pistol Shrimp Is So Loud 🤯

## YouTube Shorts description

The pistol shrimp snaps its claw so fast that the water jet it shoots out tears open a bubble. When the bubble
collapses, the crack can stun or even kill a small fish, and the collapse even gives off a flash of light: for an
instant the inside of the bubble is estimated to be nearly as hot as the surface of the Sun. A whole colony
crackles so loudly that it jammed navy sonar in World War Two.

Sources: Versluis et al. 2000 (Science, "How snapping shrimp snap: through cavitating bubbles"); Lohse, Schmitz &
Versluis 2001 (Nature, "Snapping shrimp make flashing bubbles"); WHOI Oceanus and Scientific American on WWII sonar.

#shorts #science #animals #ocean #marinebiology #didyouknow #facts

## Instagram Reels caption

This shrimp never touches its prey 😳 Its claw makes a bubble that collapses with a crack, a flash of light and a
shock wave 🫧

#science #animals #ocean #marinebiology #didyouknow #reels

## Pinned comment

The flash is far too faint to see with your eyes: scientists only found it with sensitive light detectors in 2001.
What other animal would you like to see explained? 🤔
"""
    out = fin / "upload.md"
    out.write_text(text, encoding="utf-8")
    return out


if __name__ == "__main__":
    print(write())
