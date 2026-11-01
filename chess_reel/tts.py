"""Kokoro af_heart voiceover, speed 0.9, one line per scene, placed at scene start."""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

SPEED = 0.9
VOICE = "af_heart"
FPS = 30
LINES = [  # (scene start frame, scene end frame, text)
    (8, 120, "You think chess is easy?"),
    (124, 330, "It starts with just twenty possible moves. Sixteen pawn moves, four knight moves."),
    (334, 690, "One move each, four hundred positions. Two, almost two hundred thousand. Three, a hundred and nineteen million. Four moves each, and there are already almost eighty-five billion ways the game could go."),
    (694, 930, "Most positions offer around thirty choices. Over a full game, Claude Shannon estimated ten to the power of one hundred twenty possible games."),
    (934, 1230, "The observable universe has about ten to the eighty atoms. Chess has a number of games with forty more zeros."),
    (1270, 1500, "And it all starts with just twenty moves."),
]
k = Kokoro("models/kokoro-v1.0.onnx", "models/voices-v1.0.bin")
SR = 24000
total = np.zeros(int(50 * SR), dtype=np.float32)
report = []
cursor = 0
for start, end, text in LINES:
    a, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    assert sr == SR
    # trim silence
    idx = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, idx[0] - 600): idx[-1] + 2400]
    s = max(int(start / FPS * SR), cursor + int(0.2 * SR))  # never overlap the previous line
    cursor = s + len(a)
    e = min(len(total), s + len(a))
    total[s:e] += a[: e - s]
    report.append({"start": start, "placed_s": round(s / SR, 2), "ends_s": round((s + len(a)) / SR, 2), "end": end, "dur_s": round(len(a) / SR, 2), "slot_s": round((end - start) / FPS, 2), "text": text})
peak = np.abs(total).max()
total = total / peak * 0.89
sf.write("public/audio/voiceover.wav", total, SR)
print(json.dumps(report, indent=1))
