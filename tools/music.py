"""
tools/music.py -- a generated music bed for the chess Short (no samples, no licences): warm and unhurried, a club
room late at night, under the knocks of the pieces. Soft piano chords (D minor 9, B-flat major 7, F major 7 over A,
C add 9) at 78 bpm, a muted eighth-note arpeggio, a sine bass on the roots, and a small synthetic room.

Notes are additive (a few harmonics, each decaying faster than the one below), so the whole bed is vectorised.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000
BPM = 78.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
#              bass root    chord tones (Hz)
CHORDS = [(36.71, [146.83, 174.61, 220.00, 261.63, 329.63]),     # D m9
          (29.14, [116.54, 146.83, 174.61, 220.00, 293.66]),     # B-flat maj7
          (27.50, [174.61, 220.00, 261.63, 329.63, 440.00]),     # F maj7 / A
          (32.70, [130.81, 196.00, 293.66, 329.63, 392.00])]     # C add9


def _note(f, dur, amp, parts=((1.0, 0.9), (0.35, 0.35), (0.12, 0.15), (0.05, 0.07))):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, (a, d) in enumerate(parts, 1):
        x += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / d)
    return x * np.minimum(1, t / 0.006) * amp


def pad(total_s: float, seed: int = 21) -> np.ndarray:
    """Stereo (n, 2) float32, peak 0.5."""
    n = int(total_s * SR) + SR
    L = np.zeros(n)
    R = np.zeros(n)
    r = np.random.default_rng(seed)
    eighth = BEAT / 2
    pattern = [0, 2, 1, 3, 2, 4, 3, 2]
    k, t = 0, 0.0
    while t < total_s:
        root, tones = CHORDS[int(t // BAR) % len(CHORDS)]
        i = int(t * SR)
        if k % 8 == 0:                                       # the chord, once a bar, soft and wide
            for j, f in enumerate(tones[:4]):
                note = _note(f, BAR * 1.1, 0.07, ((1.0, 1.6), (0.25, 0.6), (0.06, 0.25)))
                e = min(n, i + len(note))
                pan = 0.35 + 0.1 * j
                L[i:e] += note[: e - i] * (1 - pan)
                R[i:e] += note[: e - i] * pan
            m = int(BAR * SR)
            tt = np.arange(m) / SR
            b = 0.2 * np.sin(2 * np.pi * root * 2 * tt) * np.minimum(1, tt / 0.05) * np.exp(-tt / 1.6)
            e = min(n, i + m)
            L[i:e] += b[: e - i]
            R[i:e] += b[: e - i]
        if r.random() > 0.2:                                 # the muted arpeggio
            f = tones[pattern[k % 8]] * 2
            note = _note(f, 0.5, 0.05 * (1.0 if k % 2 == 0 else 0.65), ((1.0, 0.18), (0.3, 0.07), (0.1, 0.03)))
            e = min(n, i + len(note))
            pan = 0.5 + 0.25 * np.sin(k * 0.9)
            L[i:e] += note[: e - i] * (1 - pan)
            R[i:e] += note[: e - i] * pan
        k += 1
        t += eighth
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 4500, btype="low", fs=SR, output="sos"), out, axis=0)
    ir_n = int(1.2 * SR)
    for ch in range(2):
        ir = r.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.3 * SR))
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.75 * out[:, ch] + 0.25 * oaconvolve(out[:, ch], ir)[:n]
    out = out[: int(total_s * SR)]
    tt = np.arange(len(out)) / SR
    out *= np.minimum(1, (total_s - tt) / 2.0)[:, None]
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
