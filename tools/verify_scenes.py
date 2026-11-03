"""
tools/verify_scenes.py -- every rendered scene in style.SCENE_ORDER has the right length (frame count from its timing)
and decodes cleanly. Prints one line per scene; exit code 1 if any is missing, short or broken.

    python tools/verify_scenes.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402


def main() -> int:
    tm = json.loads((ROOT / "renders" / "cache" / "timings.json").read_text())
    bad = 0
    for sc in style.SCENE_ORDER:
        p = ROOT / "renders" / "scenes" / f"{sc}.mp4"
        want = tm[sc]["duration"]
        if not p.exists():
            print(f"  MISSING {sc}"); bad += 1; continue
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                           capture_output=True, text=True)
        got = float(r.stdout.strip() or 0)
        err = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "null", "-"], capture_output=True, text=True).stderr
        ok = abs(got - want) < 0.1 and not err.strip()
        bad += not ok
        print(f"  {'ok ' if ok else 'BAD'} {sc:18s} {got:7.2f} s (want {want:.2f})" + ("  decode errors" if err.strip() else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
