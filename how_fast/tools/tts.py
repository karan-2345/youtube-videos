"""Kokoro af_heart TTS with word-level timings.

Voice settings are locked by the channel: Kokoro `af_heart`, en-us, speed 0.86,
sentence by sentence. G2P is misaki (the same front end the official Kokoro
pipeline uses for American voices); the ONNX model was patched to also output
its per-phoneme durations, which gives exact word start/end times.
"""
import json
import os

import numpy as np
import onnxruntime as ort
import soundfile as sf
from misaki import en, espeak
from phonemizer.backend.espeak.wrapper import EspeakWrapper

# The pip espeakng-loader build points at a missing data dir; use the system espeak-ng.
EspeakWrapper.set_library("/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1")
EspeakWrapper.set_data_path("/usr/lib/x86_64-linux-gnu/espeak-ng-data")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, "assets/models/kokoro-v1.0-dur.onnx")
VOICES = os.path.join(ROOT, "assets/models/voices-v1.0.bin")
VOCAB = json.load(open(os.path.join(ROOT, ".venv/lib/python3.11/site-packages/kokoro_onnx/config.json"), encoding="utf-8"))["vocab"]
SR = 24000
VOICE = "af_heart"
SPEED = 0.86

_sess = None
_g2p = None
_voice = None


def _init():
    global _sess, _g2p, _voice
    if _sess is None:
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 4
        _sess = ort.InferenceSession(MODEL, opts, providers=["CPUExecutionProvider"])
        _g2p = en.G2P(trf=False, british=False, fallback=espeak.EspeakFallback(british=False), unk="")
        _voice = np.load(VOICES)[VOICE]


def phonemize(text):
    """Return [(word_text, phonemes, whitespace_after)] from misaki."""
    _init()
    _, tokens = _g2p(text)
    out = []
    for t in tokens:
        out.append((t.text, t.phonemes or "", t.whitespace))
    return out


def synth(text, speed=SPEED):
    """Synthesize one sentence. Returns (audio float32 @24k, words).

    words: list of dicts {text, start, end} in seconds, punctuation tokens dropped.
    """
    _init()
    toks = phonemize(text)
    ids, owner = [], []  # owner[i] = index into toks (or -1 for whitespace)
    for ti, (_, ph, ws) in enumerate(toks):
        for ch in ph:
            if ch in VOCAB:
                ids.append(VOCAB[ch])
                owner.append(ti)
        if ws:
            ids.append(VOCAB[" "])
            owner.append(-1)
    while owner and owner[-1] == -1:  # no trailing space
        ids.pop(); owner.pop()
    style = _voice[min(len(ids), len(_voice)) - 1]
    audio, dur = _sess.run(None, {
        "tokens": np.array([[0, *ids, 0]], dtype=np.int64),
        "style": np.asarray(style, dtype=np.float32),
        "speed": np.array([speed], dtype=np.float32),
    })
    audio = np.asarray(audio).ravel().astype(np.float32)
    dur = np.asarray(dur).ravel()
    frames = np.concatenate([[0], np.cumsum(dur)])
    edges = frames * (len(audio) / frames[-1])  # sample offset of each token boundary
    # token k of `ids` spans edges[k+1]..edges[k+2] (edges[0..1] is the leading pad)
    spans = {}
    for k, ti in enumerate(owner):
        if ti < 0:
            continue
        s, e = edges[k + 1] / SR, edges[k + 2] / SR
        if ti in spans:
            spans[ti][1] = e
        else:
            spans[ti] = [s, e]
    words = []
    for ti, (txt, ph, _) in enumerate(toks):
        if ti in spans and any(c.isalnum() for c in txt):
            words.append({"text": txt, "start": round(spans[ti][0], 3), "end": round(spans[ti][1], 3)})
    return audio, words, {"frames_total": float(frames[-1]), "samples": len(audio), "samples_per_frame": len(audio) / float(frames[-1])}


def trim(audio, words, thresh_db=-45.0, pad=0.03):
    """Trim leading/trailing silence and shift word times to match."""
    a = np.abs(audio)
    win = int(0.01 * SR)
    env = np.sqrt(np.convolve(audio ** 2, np.ones(win) / win, mode="same"))
    thr = 10 ** (thresh_db / 20) * max(env.max(), 1e-9)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return audio, words
    s = max(0, idx[0] - int(pad * SR))
    e = min(len(audio), idx[-1] + int(pad * SR))
    shift = s / SR
    out = []
    for w in words:
        out.append({**w, "start": round(max(0.0, w["start"] - shift), 3), "end": round(min((e - s) / SR, w["end"] - shift), 3)})
    return audio[s:e], out


if __name__ == "__main__":
    import sys
    text = sys.argv[1] if len(sys.argv) > 1 else "Imagine sitting perfectly still, like this."
    audio, words, info = synth(text)
    print(info)
    audio, words = trim(audio, words)
    for w in words:
        print(f"{w['start']:6.3f} {w['end']:6.3f}  {w['text']}")
    sf.write(os.path.join(ROOT, "audio/_test.wav"), audio, SR)
    print("len", round(len(audio) / SR, 3), "s")
