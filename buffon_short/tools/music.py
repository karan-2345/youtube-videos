"""
tools/music.py -- a generated music bed (no samples, no licences): curious and a little suspicious, a puzzle being
worked out. Plucked minor chords (A minor add 9, F major 7, D minor 9, E 7 sus 4) at 88 bpm, a muted
sixteenth-note pluck pattern, a soft sine bass, a warm pad, and a small synthetic room. It thins out under the
freezes and swells a little for the rain.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000
BPM = 88.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
#        bass (Hz)   chord tones (Hz)
CHORDS = [(55.00, [220.00, 246.94, 261.63, 329.63, 392.00]),   # A m add9
          (43.65, [174.61, 220.00, 261.63, 329.63, 349.23]),   # F maj7
          (36.71, [146.83, 174.61, 220.00, 261.63, 329.63]),   # D m9
          (41.20, [164.81, 220.00, 246.94, 293.66, 329.63])]   # E7 sus4


def _pluck(f, dur, amp, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, (a, d) in enumerate(((1.0, 0.35), (0.45 * bright, 0.12), (0.2 * bright, 0.06), (0.08 * bright, 0.03)), 1):
        x += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / d)
    return x * np.minimum(1, t / 0.003) * amp


def bed(total_s: float, quiet: list[tuple[float, float]] = (), seed: int = 31) -> np.ndarray:
    """Stereo (n, 2) float32, peak 0.5. `quiet`: [(t0, t1)] spans where only the pad plays (the freezes)."""
    n = int(total_s * SR) + SR
    L, R = np.zeros(n), np.zeros(n)
    r = np.random.default_rng(seed)
    six = BEAT / 4
    pattern = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 2, 1, 4, 3, 2]
    k, t = 0, 0.0
    is_quiet = lambda x: any(a <= x < b for a, b in quiet)
    while t < total_s:
        bass, tones = CHORDS[int(t // BAR) % len(CHORDS)]
        i = int(t * SR)
        if k % 16 == 0:                                   # pad + bass, once a bar
            m = int(BAR * 1.15 * SR)
            tt = np.arange(m) / SR
            env = np.minimum(1, tt / 0.6) * np.exp(-np.maximum(0, tt - BAR) / 0.3)
            pad = sum(np.sin(2 * np.pi * f * tt + j) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.3 * tt + j)) for j, f in enumerate(tones[:4]))
            e = min(n, i + m)
            L[i:e] += (0.025 * pad * env)[: e - i]
            R[i:e] += (0.025 * pad * env)[: e - i] * 0.9
            b = 0.16 * np.sin(2 * np.pi * bass * 2 * tt) * np.minimum(1, tt / 0.03) * np.exp(-tt / 1.4)
            if not is_quiet(t):
                L[i:e] += b[: e - i]
                R[i:e] += b[: e - i]
        if not is_quiet(t) and r.random() > 0.18:          # the pluck pattern
            f = tones[pattern[k % 16]] * 2
            acc = 1.0 if k % 4 == 0 else 0.6
            note = _pluck(f, 0.6, 0.06 * acc, bright=0.8 + 0.4 * r.random())
            e = min(n, i + len(note))
            pan = 0.5 + 0.3 * np.sin(k * 0.7)
            L[i:e] += note[: e - i] * (1 - pan)
            R[i:e] += note[: e - i] * pan
        k += 1
        t += six
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 5200, btype="low", fs=SR, output="sos"), out, axis=0)
    ir_n = int(1.4 * SR)
    for ch in range(2):
        ir = r.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.35 * SR))
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.72 * out[:, ch] + 0.28 * oaconvolve(out[:, ch], ir)[:n]
    out = out[: int(total_s * SR)]
    tt = np.arange(len(out)) / SR
    out *= (np.minimum(1, tt / 1.0) * np.minimum(1, (total_s - tt) / 1.2))[:, None]
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
