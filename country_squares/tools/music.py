"""
tools/music.py -- a generated music bed for the country-squares Short (no samples, no licences): light and curious,
a trip along a queue. Soft mallet arpeggios over warm chords (C major 9, A minor 9, F major 7, G6/9) at 96 bpm, a
round sine bass on the roots, a quiet shaker on the off-beats, and a small synthetic room.

Notes are additive (a few harmonics, each decaying faster than the one below), so the whole bed is vectorised.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000
BPM = 96.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
#              bass root   chord tones (Hz)
CHORDS = [(65.41, [261.63, 329.63, 392.00, 493.88, 587.33]),     # C maj9
          (55.00, [220.00, 261.63, 329.63, 392.00, 493.88]),     # A m9
          (43.65, [174.61, 220.00, 261.63, 329.63, 440.00]),     # F maj7
          (49.00, [196.00, 246.94, 293.66, 329.63, 440.00])]     # G6/9


def _note(f, dur, amp, parts):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, (a, d) in enumerate(parts, 1):
        x += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / d)
    return x * np.minimum(1, t / 0.004) * amp


MALLET = ((1.0, 0.35), (0.0, 0.1), (0.28, 0.08), (0.0, 0.05), (0.06, 0.02))     # odd partials: wooden / marimba-ish
PAD = ((1.0, 2.2), (0.3, 1.0), (0.1, 0.5))


def pad(total_s: float, seed: int = 7) -> np.ndarray:
    """Stereo (n, 2) float32, peak 0.5."""
    n = int(total_s * SR) + SR
    L = np.zeros(n)
    R = np.zeros(n)
    r = np.random.default_rng(seed)

    def add(x, i, pan):
        e = min(n, i + len(x))
        if e > i:
            L[i:e] += x[: e - i] * (1 - pan)
            R[i:e] += x[: e - i] * pan

    sixteenth = BEAT / 4
    pattern = [0, 2, 4, 2, 1, 3, 4, 3]
    k, t = 0, 0.0
    while t < total_s:
        root, tones = CHORDS[int(t // BAR) % len(CHORDS)]
        i = int(t * SR)
        if k % 16 == 0:                                      # chord + bass once a bar
            for j, f in enumerate(tones[:4]):
                add(_note(f, BAR * 1.2, 0.05, PAD), i, 0.3 + 0.13 * j)
            m = int(BAR * SR)
            tt = np.arange(m) / SR
            b = 0.22 * np.sin(2 * np.pi * root * tt) * np.minimum(1, tt / 0.03) * np.exp(-tt / 1.2)
            add(b, i, 0.5)
            add(0.5 * b[: int(BEAT * SR)], i + int(2 * BEAT * SR), 0.5)      # and again on beat 3
        if k % 2 == 0 and r.random() > 0.15:                 # mallet eighths
            f = tones[pattern[(k // 2) % 8]] * (2 if (k // 8) % 2 else 1)
            add(_note(f, 0.7, 0.06 * (1.0 if k % 4 == 0 else 0.7), MALLET), i, 0.5 + 0.3 * np.sin(k * 0.7))
        if k % 4 == 2:                                       # shaker on the off-beats
            m = int(0.06 * SR)
            sh = r.normal(0, 1, m) * np.exp(-np.arange(m) / (0.012 * SR)) * 0.018
            add(sosfilt(butter(2, [5000, 12000], btype="band", fs=SR, output="sos"), sh), i, 0.65)
        k += 1
        t += sixteenth
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 7000, btype="low", fs=SR, output="sos"), out, axis=0)
    ir_n = int(1.4 * SR)
    for ch in range(2):
        ir = r.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.35 * SR))
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.78 * out[:, ch] + 0.22 * oaconvolve(out[:, ch], ir)[:n]
    out = out[: int(total_s * SR)]
    tt = np.arange(len(out)) / SR
    out *= np.minimum(1, (total_s - tt) / 1.5)[:, None]
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
