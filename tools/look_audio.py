"""
tools/look_audio.py -- the sound for the LookA test clip: the hook's real narration (audio/tts/S00_Hook.wav, the
first sentence) and the scene's own cue rows (a knock per piece landing, a tick per count, a firmer knock on 85
billion), mixed and muxed onto renders/scenes/LookA.mp4 -> samples/look/A_clubroom.mp4.
No music bed here; that is part of the STOP 2 mix.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools import sfx  # noqa: E402


def main():
    data = json.loads((ROOT / "renders/cache/scenes/LookA.json").read_text(encoding="utf-8"))
    dur = data["timing"]["duration"]
    n = int(dur * sfx.SR)
    voice, sr = sf.read(ROOT / "audio/tts/S00_Hook.wav", dtype="float32")
    voice = resample_poly(voice, sfx.SR, sr)[:n]
    voice = np.pad(voice, (0, n - len(voice)))
    fx = np.zeros(n + sfx.SR)
    for k, (t, name, db) in enumerate(data["cues"]):
        s = sfx.SOUNDS[name](k + 1) * 10 ** (db / 20)
        i = int(t * sfx.SR)
        fx[i:i + len(s)] += s[: max(0, len(fx) - i)]
    fade = np.minimum(1, (dur - np.arange(n) / sfx.SR) / 0.3)          # the clip ends mid-scene: a short fade
    mix = (0.9 * voice + 0.55 * fx[:n]) * fade
    wav = ROOT / "samples/look/_mix.wav"
    sf.write(wav, np.stack([mix, mix], 1), sfx.SR, subtype="PCM_24")
    dst = ROOT / "samples/look/A_clubroom.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(ROOT / "renders/scenes/LookA.mp4"), "-i", str(wav),
                    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt",
                    "yuv420p", "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-ar", "48000",
                    "-shortest", "-movflags", "+faststart", str(dst)], check=True)
    wav.unlink()
    print(f"  {dst.relative_to(ROOT)}  ({len(data['cues'])} cues, {dur:.1f} s)")


if __name__ == "__main__":
    sys.exit(main())
