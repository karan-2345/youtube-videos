"""Voice + synthesized plucky music + SFX, then mux with the rendered video.

    python tools/mix.py   -> audio/master.wav, final/college_bhadwa_demo.mp4
"""
import os
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R  # noqa: E402  (timeline lives in the renderer)

ROOT = R.ROOT
SR = 48000
N = int(R.END * SR)
rng = np.random.default_rng(7)


def load(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def put(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    buf[i:i + len(sig)] += sig * gain


def env(n, attack=0.005, decay=0.1):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def pluck(freq, dur=0.6, bright=0.5):
    """Karplus-Strong plucked string."""
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p).astype(np.float32)
    out = np.zeros(n, np.float32)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.993 + 0.006 * bright)
    return out


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- sfx
def pop(f0=900, f1=300, d=0.08):
    t = np.arange(int(d * SR)) / SR
    f = np.linspace(f0, f1, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, d / 3)


def whoosh(d=0.45):
    n = int(d * SR)
    x = rng.normal(0, 1, n)
    k = np.hanning(n)
    lp = np.convolve(x, np.ones(18) / 18, "same")
    return (lp * k * 1.6).astype(np.float32)


def boom():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 75 * np.exp(-t * 1.5) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    hit = np.convolve(rng.normal(0, 1, n), np.ones(30) / 30, "same") * np.exp(-t / 0.08)
    return (body * 1.0 + hit * 1.2).astype(np.float32)


def riser(d=0.35):
    t = np.arange(int(d * SR)) / SR
    f = np.linspace(200, 1400, len(t))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / d) ** 2 * 0.5).astype(np.float32)


def ting():
    t = np.arange(int(0.9 * SR)) / SR
    return ((np.sin(2 * np.pi * 2637 * t) + 0.6 * np.sin(2 * np.pi * 3951 * t)) * env(len(t), 0.002, 0.25)).astype(np.float32)


def zip_():
    t = np.arange(int(0.28 * SR)) / SR
    f = np.linspace(500, 2200, len(t))
    return (np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.35 * env(len(t), 0.01, 0.12)).astype(np.float32)


def scratch():
    t = np.arange(int(0.22 * SR)) / SR
    f = 900 - 3000 * t
    sq = np.sin(2 * np.pi * np.cumsum(np.maximum(f, 120)) / SR)
    return (sq * np.hanning(len(t)) * 0.8 + rng.normal(0, 0.15, len(t))).astype(np.float32)


def rain(d):
    n = int(d * SR)
    x = np.convolve(rng.normal(0, 1, n), np.ones(6) / 6, "same")
    k = np.minimum(1, np.minimum(np.arange(n), n - np.arange(n)) / (0.2 * SR))
    return (x * k * 0.25).astype(np.float32)


def music(t0, t1, gain):
    """Bouncy I-V-vi-IV pluck arpeggio, 112 bpm eighths."""
    out = np.zeros(N, np.float32)
    chords = [(48, 52, 55, 60), (43, 50, 55, 59), (45, 52, 57, 60), (41, 48, 53, 57)]
    step = 60 / 112 / 2
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    t, k = t0, 0
    cache = {}
    while t < t1:
        ch = chords[(k // 8) % 4]
        notes = [ch[pattern[k % 8]] + 12]
        if k % 8 == 0:
            notes.append(ch[0] - 12)
        for m in notes:
            if m not in cache:
                cache[m] = pluck(midi(m), 0.7, 0.6)
            put(out, cache[m], t, gain * (1.0 if m > 40 else 0.8))
        t += step
        k += 1
    # fade the tail so it ends cleanly at t1
    i1 = int(t1 * SR)
    fade = int(0.08 * SR)
    out[i1 - fade:i1] *= np.linspace(1, 0, fade)
    out[i1:] = 0
    return out


def main():
    voice = np.zeros(N, np.float32)
    for key, t in R.START.items():
        put(voice, load(os.path.join(ROOT, f"audio/{key}.wav")), t)
    voice /= np.max(np.abs(voice)) + 1e-9

    sfx = np.zeros(N, np.float32)
    put(sfx, whoosh(0.4), R.T_BHADWA - 0.6, 0.35)
    put(sfx, pop(1200, 500), R.T_BHADWA + 0.05, 0.5)
    put(sfx, whoosh(0.3), R.T_UDHAR + 0.15, 0.25)
    put(sfx, pop(700, 1400, 0.1), R.T_UDHAR + 0.55, 0.35)
    put(sfx, rain(R.START["bhai"] - R.T_APNI), R.T_APNI - 0.1, 0.25)
    for i in range(4):
        put(sfx, pop(800 + 150 * i, 400 + 150 * i), R.T_SABSE - 0.05 + i * 0.27 + 0.33, 0.45)
    put(sfx, pop(1400, 2000, 0.12), R.T_BHAI + 0.1, 0.35)
    put(sfx, scratch(), R.T_BAAT - 0.05, 0.4)
    put(sfx, riser(), R.T_BAAP - 0.47, 0.5)
    put(sfx, boom(), R.T_BAAP - 0.12, 0.9)
    put(sfx, pop(600, 1300, 0.12), R.T_PADHAI, 0.4)
    put(sfx, ting(), R.T_MEKO + 0.25, 0.35)
    put(sfx, pop(1500, 900, 0.1), R.END - 1.0, 0.4)
    put(sfx, zip_(), R.END - 0.62, 0.5)

    mus = music(0.0, R.T_BAAP - 0.15, 0.09) + music(R.T_MEKO - 0.1, R.END - 0.62, 0.07)

    mix = voice + sfx * 0.8 + mus
    mix /= np.max(np.abs(mix)) / 0.95
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    master = os.path.join(ROOT, "audio/master.wav")
    with wave.open(master, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

    # python tools/mix.py [renders/<video>.mp4 final/<out>.mp4]
    video = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 2 else "renders/video.mp4")
    out = os.path.join(ROOT, sys.argv[2] if len(sys.argv) > 2 else "final/college_bhadwa_demo.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", master,
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000", "-ac", "2",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out],
                   check=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
