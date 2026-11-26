"""
tools/music.py -- a generated music bed (no samples, no licences) with an Egyptian colour: the D Hijaz mode
(D Eb F# G A Bb C), a low drone on D and A, an oud-like plucked string (Karplus-Strong) playing a winding figure over
D - Eb - Cm - D, and a frame drum (doum and tek, the maqsum rhythm) with soft jingles in the middle of the Short.
The tempo fits exactly 25 bars into the video, so the end flows back into the start.

    bed(total_s, drums_on, hush) -> stereo (n, 2) float32
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000
D_LEN = 66.0
BARS = 25
BPM = 240.0 * BARS / D_LEN          # 90.9: a whole number of bars in the video
BEAT = 60.0 / BPM
BAR = 4 * BEAT

N = lambda m: 440.0 * 2 ** ((m - 69) / 12)          # MIDI -> Hz
# D Hijaz: D Eb F# G A Bb C
SCALE = [62, 63, 66, 67, 69, 70, 72, 74, 75, 78, 79, 81]
CHORDS = [(50, [62, 66, 69, 74, 78, 81]),            # D  (D F# A)
          (51, [63, 67, 70, 75, 79, 82]),            # Eb (Eb G Bb)
          (48, [60, 63, 67, 72, 75, 79]),            # Cm (C Eb G)
          (50, [62, 66, 69, 74, 78, 81])]            # D
FIGURE = [0, 2, 3, 2, 4, 3, 1, 2]                    # eighth-note figure over the chord tones
MAQSUM = [("D", 0), ("T", 1), ("T", 3), ("D", 4), ("T", 6)]      # in eighths: D T . T D . T .


def _lp(x, hi, order=2):
    return sosfilt(butter(order, hi, btype="low", fs=SR, output="sos"), x, axis=0)


def _hp(x, lo, order=2):
    return sosfilt(butter(order, lo, btype="high", fs=SR, output="sos"), x, axis=0)


def string(f, dur=1.4, rng=None, bright=0.6):
    """Karplus-Strong plucked string with a soft body resonance: oud-ish."""
    rng = rng or np.random.default_rng(1)
    n = int(dur * SR)
    p = max(2, int(round(SR / f)))
    buf = rng.uniform(-1, 1, p)
    buf = _lp(buf, 1500 + 3500 * bright, 1)
    out = np.zeros(n)
    damp = 0.996
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = damp * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    body = sosfilt(butter(2, [180, 900], btype="band", fs=SR, output="sos"), out)
    x = out + 0.6 * body
    t = np.arange(n) / SR
    return x * np.minimum(1, (dur - t) / 0.05) * np.minimum(1, t / 0.002)


def drone(freqs, dur, seed=3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, f in enumerate(freqs):
        for h, a in ((1, 1.0), (2, 0.5), (3, 0.3), (4, 0.18), (5, 0.1)):
            x += a * np.sin(2 * np.pi * f * h * t * (1 + 0.0006 * k) + 0.7 * k + h)
    # slow breathing swell, periodic over the video
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * t * 4 / D_LEN)
    return _lp(x, 1800)


def doum(dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 70 + 60 * np.exp(-t / 0.02)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)


def tek(rng, dur=0.15):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sosfilt(butter(2, [1800, 7000], btype="band", fs=SR, output="sos"), rng.normal(0, 1, n))
    ring = np.sin(2 * np.pi * 950 * t) * 0.3
    return (x + ring) * np.exp(-t / 0.03)


def jingle(rng, dur=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = _hp(rng.normal(0, 1, n), 5500)
    for f in (6100, 7400, 8800):
        x += 0.4 * np.sin(2 * np.pi * f * t + rng.uniform(0, 6))
    return x * np.minimum(1, t / 0.004) * np.exp(-t / 0.035)


def bed(total_s: float, drums_on: list[tuple[float, float]] = (), hush: list[tuple[float, float]] = (),
        seed: int = 7) -> np.ndarray:
    """drums_on: spans with the frame drum; hush: spans where only the drone plays. Stereo (n, 2), peak 0.5."""
    n = int(total_s * SR) + 2 * SR
    L, R = np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(seed)
    inside = lambda x, spans: any(a <= x < b for a, b in spans)

    def put(x, i, gl, gr):
        j = min(n, i + len(x))
        if j > i:
            L[i:j] += x[: j - i] * gl
            R[i:j] += x[: j - i] * gr

    # the drone: D and A, the whole way through (it loops)
    dr = drone([N(38), N(45), N(50)], total_s + 1)
    put(dr * 0.045, 0, 1.0, 0.92)
    cache: dict = {}
    k, t = 0, 0.0
    while t < total_s - 0.02:
        i = int(t * SR)
        bar = int(t // BAR) % len(CHORDS)
        root, tones = CHORDS[bar]
        if not inside(t, hush):
            note = tones[FIGURE[k % 8]] - 12
            if (k // 8) % 4 == 3 and k % 8 in (5, 6, 7):           # a little run down the mode at each fourth bar
                note = SCALE[(7 - (k % 8)) % len(SCALE)] - 12 + 12
            key = (note, k % 8 == 0)
            if key not in cache:
                cache[key] = string(N(note), 1.3, np.random.default_rng(note), bright=0.8 if k % 8 == 0 else 0.55)
            pan = 0.5 + 0.28 * np.sin(k * 0.61)
            put(cache[key] * (0.16 if k % 8 == 0 else 0.11), i, 1 - pan, pan)
            if k % 8 == 0:                                           # bass string on the bar
                kb = ("b", root)
                if kb not in cache:
                    cache[kb] = string(N(root), 1.8, np.random.default_rng(root), bright=0.3)
                put(cache[kb] * 0.18, i, 0.9, 0.9)
            if inside(t, drums_on):
                pos = k % 8
                for stroke, at in MAQSUM:
                    if at == pos:
                        put(doum() * 0.3 if stroke == "D" else tek(rng) * 0.09, i, 0.95, 1.0)
                put(jingle(rng) * (0.05 if k % 2 == 0 else 0.03), i + int(BEAT / 4 * SR), 0.8, 1.0)
        k += 1
        t = k * BEAT / 2
    out = np.stack([L, R], 1)
    out = _lp(out, 10000)
    ir_n = int(2.0 * SR)                                             # a stone hall
    for ch in range(2):
        ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.45 * SR))
        ir = sosfilt(butter(2, 4200, btype="low", fs=SR, output="sos"), ir)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.78 * out[:, ch] + 0.22 * oaconvolve(out[:, ch], ir)[:len(out)]
    # fold the tail that runs past the end back onto the start: the loop has the same room sound both ways
    m = int(total_s * SR)
    tail = out[m:m + int(1.5 * SR)].copy()
    out = out[:m]
    out[: len(tail)] += tail
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
