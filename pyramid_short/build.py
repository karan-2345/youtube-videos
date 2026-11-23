"""
build.py -- one entry point for the pyramid Short ("water on the sand").

    python build.py facts        check every number (facts.md)
    python build.py tts          synthesize the narration (Kokoro af_heart) -> audio/voice.wav, renders/cache/timings.json
    python build.py export       phrase times, events, cue sheet -> renders/cache/scene.json
    python build.py stills t...  PNG stills -> renders/stills/
    python build.py render       every frame -> renders/scene.mp4 (headless Chromium + three.js; ~2 h on 4 CPU cores)
    python build.py final        mix, master, captions -> renders/final/ (+ cover.png)
    python build.py all          everything above, in order

Needs: Python 3 with numpy, scipy, soundfile, pillow, kokoro-onnx; Node with Playwright (NODE_PATH pointing at it);
ffmpeg with libass; the Kokoro model files (kokoro-v1.0.onnx, voices-v1.0.bin) in $KOKORO_MODELS
(default /home/user/models; download from github.com/thewh1teagle/kokoro-onnx/releases, model-files-v1.0);
`npm ci` in scenes/web for three.js.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def node(*args):
    return subprocess.call(["node", str(ROOT / "tools" / "capture.js"), *args], cwd=ROOT)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd in ("facts", "all"):
        from config import facts
        text, ok = facts.report()
        (ROOT / "facts.md").write_text(text, encoding="utf-8")
        print(f"facts.md: {'ALL PASS' if ok else 'FAIL'}")
        if not ok:
            return 1
    if cmd in ("tts", "all"):
        from tools import tts
        tts.build()
    if cmd in ("export", "all", "stills", "render"):
        from config import style
        from tools import export
        style.export_web()
        export.export()
    if cmd == "stills":
        return node("stills", *rest)
    if cmd in ("render", "all"):
        rc = node("render", "--workers", "2")
        if rc:
            return rc
    if cmd in ("final", "all"):
        from tools import assemble, cover
        assemble.assemble()
        print(" ", cover.build().relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
