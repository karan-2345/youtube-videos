"""
tools/samples.py -- pace samples for checkpoint 1: the opening section (S00) at several Kokoro speeds,
with the planned sentence / paragraph / reveal pauses, through the same Voice class the build uses.

    python build.py samples 0.92 0.86 0.80   ->  samples/pace_092.wav ...
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402
from tools import narration, tts  # noqa: E402

GROUPS = {"opening": ("S00", "S01"), "every": ("S02",)}     # hook + the worked steps; the name Kaprekar
HEAD_S = 0.5          # short lead-in instead of the scene's 3 s picture-only opening


def build(speeds: list[float]) -> list[dict]:
    if narration.main():
        raise SystemExit("narration lint failed")
    sections = json.loads(tts.NARRATION.read_text(encoding="utf-8"))
    out_dir = ROOT / "samples"
    out_dir.mkdir(exist_ok=True)
    tts.CACHE.mkdir(parents=True, exist_ok=True)
    rows = []
    for (name, ids), speed in ((g, s) for g in GROUPS.items() for s in speeds):
        beats = [b for s in sections if s["id"] in ids for b in s["beats"]]
        style.VOICE_SPEED = speed                     # Voice keys its cache on (voice, speed, text)
        voice = tts.Voice()
        sr = tts.SR
        chunks = [np.zeros(int(HEAD_S * sr), np.float32)]
        words = speech = 0.0
        for i, b in enumerate(beats):
            if b.get("lead"):
                chunks.append(np.zeros(int(b["lead"] * sr), np.float32))   # picture-only moment
            sents = tts.split_sentences(b["text"])
            for j, s in enumerate(sents):
                a = voice.synth(s)
                chunks.append(a)
                speech += len(a) / sr
                words += len(s.split())
                if j < len(sents) - 1:
                    chunks.append(np.zeros(int(style.SENTENCE_GAP_S * sr), np.float32))
            gap = b["pause_after"] + (style.BEAT_GAP_S if i < len(beats) - 1 else 0.0)
            chunks.append(np.zeros(int(gap * sr), np.float32))
        chunks.append(np.zeros(int(style.SCENE_TAIL_S * sr), np.float32))
        audio = np.concatenate(chunks)
        path = out_dir / f"pace_{round(speed * 100):03d}_{name}.wav"
        sf.write(path, audio, sr)
        dur = len(audio) / sr
        rows.append({"group": name, "speed": speed, "file": path.name, "words": int(words), "duration_s": round(dur, 1),
                     "spoken_wpm": round(words / speech * 60, 1), "wpm_incl_pauses": round(words / dur * 60, 1)})
        print(f"  {path.relative_to(ROOT)}  {dur:5.1f} s  spoken {words / speech * 60:5.1f} wpm, "
              f"with pauses {words / dur * 60:5.1f} wpm")
    (out_dir / "pace_samples.json").write_text(json.dumps(rows, indent=1))
    return rows


if __name__ == "__main__":
    build([float(x) for x in sys.argv[1:]] or [style.VOICE_SPEED])
