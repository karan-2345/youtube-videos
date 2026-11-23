"""
tools/tts.py -- synthesize the narration with Kokoro (af_heart) and measure the timeline the scene syncs to.

    python -m tools.tts            -> audio/voice.wav, renders/cache/timings.json
    python -m tools.tts --phonemes print what the voice will say (IPA), for checking names

Sentences are synthesized one at a time (natural prosody, exact boundaries) and cached by (voice, speed, text).
Pronunciation fixes change only what the voice hears, never the captions.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402
from config.narration import BEATS  # noqa: E402
from tools.align import word_times  # noqa: E402

OUT = ROOT / "audio"
CACHE = OUT / "cache"
TIMINGS = ROOT / "renders" / "cache" / "timings.json"
SR = 24_000
TRIM_DB = -45.0
KEEP_S = 0.03

# Names the phonemizer gets wrong: spoken from IPA (captions keep the spelling).
IPA_FIXES: dict[str, str] = {}
# Years are said the way people say years (captions keep the digits).
SAY: dict[str, str] = {"2014": "twenty fourteen", "170": "a hundred and seventy"}
_IPA_RE = re.compile(r"\b(" + "|".join(IPA_FIXES) + r")('s)?\b") if IPA_FIXES else None


def speech_text(text: str) -> str:
    for k, v in SAY.items():
        text = text.replace(k, v)
    return text


def split_sentences(text: str) -> list[str]:
    return [p for p in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])", text.strip()) if p]


def _trim(x: np.ndarray) -> np.ndarray:
    thr = 10 ** (TRIM_DB / 20) * max(np.abs(x).max(), 1e-9)
    idx = np.flatnonzero(np.abs(x) > thr)
    if idx.size == 0:
        return x
    k = int(KEEP_S * SR)
    return x[max(idx[0] - k, 0): min(idx[-1] + k, len(x))]


class Voice:
    def __init__(self):
        self._k = None

    @property
    def k(self):
        if self._k is None:
            from kokoro_onnx import Kokoro
            self._k = Kokoro(str(style.MODELS / "kokoro-v1.0.onnx"), str(style.MODELS / "voices-v1.0.bin"))
        return self._k

    def phonemes(self, text: str) -> str:
        out, pos = [], 0
        for m in (_IPA_RE.finditer(text) if _IPA_RE else ()):
            chunk = text[pos:m.start()].strip()
            if chunk:
                out.append(self.k.tokenizer.phonemize(chunk, style.VOICE_LANG))
            out.append(IPA_FIXES[m.group(1)] + ("z" if m.group(2) else ""))
            pos = m.end()
        tail = text[pos:].strip()
        if tail:
            out.append(self.k.tokenizer.phonemize(tail, style.VOICE_LANG))
        return " ".join(x.strip() for x in out if x.strip())

    def synth(self, text: str) -> np.ndarray:
        spoken = speech_text(text)
        key = hashlib.sha1(f"{style.VOICE}|{style.VOICE_SPEED}|{spoken}".encode()).hexdigest()[:16]
        path = CACHE / f"{key}.wav"
        if path.exists():
            return sf.read(path, dtype="float32")[0]
        audio, sr = self.k.create(self.phonemes(spoken), voice=style.VOICE, speed=style.VOICE_SPEED,
                                  lang=style.VOICE_LANG, is_phonemes=True)
        assert sr == SR
        audio = _trim(np.asarray(audio, dtype=np.float32))
        sf.write(path, audio, SR)
        return audio


def build() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    TIMINGS.parent.mkdir(parents=True, exist_ok=True)
    voice = Voice()
    chunks = [np.zeros(int(style.SCENE_HEAD_S * SR), np.float32)]
    t = style.SCENE_HEAD_S
    beats = {}
    for i, (bid, text) in enumerate(BEATS):
        b0, sents = t, []
        ss = split_sentences(text)
        for j, s in enumerate(ss):
            a = voice.synth(s)
            ws = word_times(s, a, lambda w: voice.phonemes(speech_text(w)))
            sents.append({"text": s, "start": round(t, 3), "end": round(t + len(a) / SR, 3),
                          "words": [[w, round(t + w0, 3), round(t + w1, 3)] for w, w0, w1 in ws]})
            chunks.append(a)
            t += len(a) / SR
            if j < len(ss) - 1:
                chunks.append(np.zeros(int(style.SENTENCE_GAP_S * SR), np.float32))
                t += style.SENTENCE_GAP_S
        beats[bid] = {"start": round(b0, 3), "end": round(t, 3), "sentences": sents}
        if i < len(BEATS) - 1:
            chunks.append(np.zeros(int(style.BEAT_GAP_S * SR), np.float32))
            t += style.BEAT_GAP_S
    chunks.append(np.zeros(int(style.SCENE_TAIL_S * SR), np.float32))
    audio = np.concatenate(chunks)
    # the video is a whole number of frames; pad the voice to match exactly
    n_frames = int(np.ceil(len(audio) / SR * style.FPS))
    audio = np.pad(audio, (0, int(round(n_frames / style.FPS * SR)) - len(audio)))
    sf.write(OUT / "voice.wav", audio, SR)
    timing = {"duration": round(len(audio) / SR, 4), "frames": n_frames, "beats": beats}
    TIMINGS.write_text(json.dumps(timing, indent=1))
    words = sum(len(x[1].split()) for x in BEATS)
    print(f"  voice: {timing['duration']:.2f} s, {n_frames} frames, {words} words")
    for bid, b in beats.items():
        print(f"    {bid:8s} {b['start']:6.2f} - {b['end']:6.2f}  ({b['end'] - b['start']:.2f} s)")
    return timing


if __name__ == "__main__":
    if "--phonemes" in sys.argv:
        v = Voice()
        for bid, text in BEATS:
            print(bid, "|", v.phonemes(speech_text(text)))
    else:
        build()
