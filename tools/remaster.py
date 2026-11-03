"""
tools/remaster.py -- redo only the master of a finished final: sum the stems back into the premix (voice + sfx +
music = the premix, stems_README.md), run tools/assemble.master on it, and swap the new master onto the existing
videos without re-encoding the picture.

    .venv\\Scripts\\python tools\\remaster.py chess_short
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402
from tools import assemble  # noqa: E402


def main(name: str = "chess_short") -> None:
    fin = ROOT / "renders" / "final"
    st = fin / "stems"
    pre = fin / f"{name}_premix.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(st / "voice.wav"), "-i", str(st / "sfx.wav"),
                    "-i", str(st / "music.wav"), "-filter_complex",
                    "[0:a][1:a][2:a]amix=inputs=3:normalize=0:dropout_transition=0[out]", "-map", "[out]",
                    "-c:a", "pcm_f32le", str(pre)], check=True)
    mst = assemble.master(pre, st / "master.wav")
    print(f"    master: {mst['input_i']:.2f} -> {mst['output_i']:.2f} LUFS, TP {mst['output_tp']:.2f} dBTP, "
          f"{mst['type']} gain {mst['gain_db']:+.2f} dB")
    for suffix in ("", "_clean"):
        v = fin / f"{name}{suffix}.mp4"
        tmp = v.with_name(v.stem + "_tmp.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(v), "-i", str(st / "master.wav"),
                        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                        "-ar", str(style.AUDIO["sample_rate"]), "-movflags", "+faststart", "-shortest", str(tmp)],
                       check=True)
        tmp.replace(v)
    pre.unlink()


if __name__ == "__main__":
    main(*sys.argv[1:])
