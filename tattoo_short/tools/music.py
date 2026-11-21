"""
tools/music.py -- a generated music bed for the tattoo Short (no samples, no licences): light and curious, the
"huh, really?" feeling of a weird-facts Short. Marimba-like plucks on an eighth-note ostinato over C, A minor, F and
G at 100 bpm, a soft staccato bass on beats 1 and 3, a quiet off-beat shaker, and a small synthetic room.

Notes are additive (a few harmonics, each decaying faster than the one below), so the whole bed is vectorised.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000
BPM = 100.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
#           bass (Hz)  chord tones (Hz), low to high
CHORDS = [(65.41, [261.63, 329.63, 392.00, 523.25]),     # C
          (55.00, [220.00, 261.63, 329.63, 440.00]),     # A minor
          (43.65, [174.61, 220.00, 261.63, 349.23]),     # F
          (49.00, [196.00, 246.94, 293.66, 392.00])]     # G
PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]                       # which chord tone plays on each eighth


def _mallet(f, amp, dur=0.6):
    """A soft marimba-ish note: fundamental, a 4th partial (marimba bars ring at ~4x), a quick attack."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35) + 0.25 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.05) \
        + 0.08 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.012)
    return x * np.minimum(1, t / 0.003) * amp


def pad(total_s: float, seed: int = 31) -> np.ndarray:
    """Stereo (n, 2) float32, peak 0.5."""
    n = int(total_s * SR) + SR
    L = np.zeros(n)
    R = np.zeros(n)
    r = np.random.default_rng(seed)
    eighth = BEAT / 2
    k, t = 0, 0.0
    while t < total_s:
        bass, tones = CHORDS[int(t // BAR) % len(CHORDS)]
        i = int(t * SR)
        # the ostinato (an octave up on the last eighth of each bar)
        f = tones[PATTERN[k % 8]] * (2 if k % 8 == 7 else 1)
        if r.random() > 0.08:
            note = _mallet(f, 0.09 * (1.0 if k % 2 == 0 else 0.7))
            e = min(n, i + len(note))
            pan = 0.5 + 0.3 * np.sin(k * 1.3)
            L[i:e] += note[: e - i] * (1 - pan)
            R[i:e] += note[: e - i] * pan
        if k % 4 == 0:                                            # bass on beats 1 and 3, short
            m = int(0.35 * SR)
            tt = np.arange(m) / SR
            b = 0.22 * (np.sin(2 * np.pi * bass * tt) + 0.3 * np.sin(2 * np.pi * bass * 2 * tt)) \
                * np.minimum(1, tt / 0.01) * np.exp(-tt / 0.16)
            e = min(n, i + m)
            L[i:e] += b[: e - i]
            R[i:e] += b[: e - i]
        if k % 2 == 1:                                            # a quiet shaker on the off-beats
            m = int(0.05 * SR)
            sh = sosfilt(butter(2, [5000, 11000], btype="band", fs=SR, output="sos"), r.normal(0, 1, m))
            sh *= np.exp(-np.arange(m) / SR / 0.012) * 0.025
            e = min(n, i + m)
            L[i:e] += sh[: e - i] * 0.8
            R[i:e] += sh[: e - i]
        k += 1
        t += eighth
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 6000, btype="low", fs=SR, output="sos"), out, axis=0)
    ir_n = int(0.9 * SR)
    for ch in range(2):
        ir = r.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.18 * SR))
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.8 * out[:, ch] + 0.2 * oaconvolve(out[:, ch], ir)[:n]
    out = out[: int(total_s * SR)]
    tt = np.arange(len(out)) / SR
    out *= np.minimum(1, (total_s - tt) / 1.2)[:, None]
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
