"""Hindi voiceover via edge-tts (hi-IN-MadhurNeural), one clip per line.

Writes audio/lineN.wav and audio/lines.json with each clip's duration.
"""
import asyncio
import json
import os
import subprocess
import wave

import certifi
import numpy as np

# The session proxy re-signs TLS; edge-tts pins certifi, so point it at the proxy bundle when present.
if os.path.exists("/root/.ccr/ca-bundle.crt"):
    certifi.where = lambda: "/root/.ccr/ca-bundle.crt"
import edge_tts  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "audio")
SR = 48000

# (key, voice, rate, pitch, text). "narr" = narrator, "bhad" = the bhadwa himself.
LINES = [
    ("intro", "narr", "+22%", "+0Hz",
     "क्या आपको पता है? हर कॉलेज में एक भड़वा ज़रूर होता है, जो बच्चों से पैसे उधार लेता है, अपनी मजबूरी के नाम पर।"),
    ("bhai", "narr", "+24%", "+0Hz",
     "ये मजबूर इंसान सबसे पैसे लेगा, तो भाई के नाम पर।"),
    ("baap", "narr", "+24%", "+0Hz",
     "पर जैसे ही देने की बात आती है, तब वो बाप बन जाता है!"),
    ("rant", "bhad", "+26%", "-6Hz",
     "कैसे पैसे? जब देखो पैसे पैसे! पढ़ाई पर ध्यान लगा! मेको अभी अपने झाट के बाल साफ़ करने हैं, तू मदद करेगा क्या?"),
]
VOICES = {"narr": "hi-IN-MadhurNeural", "bhad": "hi-IN-MadhurNeural"}


async def make(key, who, rate, pitch, text):
    mp3 = os.path.join(AUDIO, key + ".mp3")
    words = []
    comm = edge_tts.Communicate(text, VOICES[who], rate=rate, pitch=pitch, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"text": chunk["text"], "start": chunk["offset"] / 1e7,
                              "end": (chunk["offset"] + chunk["duration"]) / 1e7})
    pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", mp3, "-ar", str(SR), "-ac", "1",
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(pcm, dtype=np.int16)
    # Trim leading/trailing silence so scene timing follows the speech; shift word times to match.
    loud = np.nonzero(np.abs(a) > 300)[0]
    i0, i1 = max(0, loud[0] - int(0.02 * SR)), min(len(a), loud[-1] + int(0.08 * SR))
    a = a[i0:i1]
    with wave.open(os.path.join(AUDIO, key + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())
    lead = i0 / SR
    for wd in words:
        wd["start"] = round(max(0.0, wd["start"] - lead), 3)
        wd["end"] = round(max(0.0, wd["end"] - lead), 3)
    return {"key": key, "who": who, "dur": len(a) / SR, "words": words}


async def main():
    meta = [await make(*l) for l in LINES]
    json.dump(meta, open(os.path.join(AUDIO, "lines.json"), "w"), indent=1)
    for m in meta:
        print(f"{m['key']:6s} {m['dur']:.2f}s  " + " ".join(f"{w['text']}@{w['start']:.2f}" for w in m["words"]))
    print("total", round(sum(m["dur"] for m in meta), 2))


asyncio.run(main())
