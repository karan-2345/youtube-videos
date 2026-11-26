"""
tools/music.py -- a generated music bed (no samples, no licences) with a Tuscan, medieval feel: a plucked lute
(Karplus-Strong strings) playing D Dorian arpeggios -- D minor, C, G, D minor -- over a soft D-A drone, a frame drum
on the beats and a small synthetic stone room. 96 bpm. It drops to the drone alone under the freeze.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000
BPM = 96.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT

# chord tones (Hz) for the arpeggio, low to high
CHORDS = [
    [146.83, 174.61, 220.00, 293.66, 349.23, 440.00],   # D minor
    [130.81, 164.81, 196.00, 261.63, 329.63, 392.00],   # C
    [123.47, 146.83, 196.00, 246.94, 293.66, 392.00],   # G (with B natural: the Dorian colour)
    [146.83, 174.61, 220.00, 293.66, 349.23, 440.00],   # D minor
]
PATTERN = [0, 2, 3, 4, 5, 4, 3, 2]                      # eighth notes, rising and falling


def _ks(f: float, dur: float, seed: int, bright: float = 0.6) -> np.ndarray:
    """Karplus-Strong plucked string."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    p = max(2, int(round(SR / f)))
    buf = r.uniform(-1, 1, p)
    for _ in range(3 - int(2 * bright)):                       # a softer pluck: low-passed excitation
        buf = np.convolve(buf, np.ones(5) / 5, mode="same")
    buf -= buf.mean()
    out = np.empty(n)
    decay = 0.995
    for i in range(n):
        j = i % p
        out[i] = buf[j]
        buf[j] = decay * (0.25 * buf[j - 1] + 0.5 * buf[j] + 0.25 * buf[(j + 1) % p])
    t = np.arange(n) / SR
    body = sosfilt(butter(2, [180, 3800], btype="band", fs=SR, output="sos"), out)   # the lute's wooden body
    x = (0.7 * out + 0.5 * body) * np.minimum(1, (dur - t) / 0.05)
    return x / (np.abs(x).max() + 1e-9)


def bed(total_s: float, quiet: list[tuple[float, float]] = (), seed: int = 41) -> np.ndarray:
    """Stereo (n, 2) float32, peak 0.5. `quiet`: [(t0, t1)] spans where only the drone plays."""
    n = int(total_s * SR) + SR
    L, R = np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(seed)
    is_quiet = lambda x: any(a <= x < b for a, b in quiet)
    cache: dict = {}
    t_all = np.arange(n) / SR
    # the drone: D2 + A2 with a slow swell, like a hurdy-gurdy far away
    drone = (np.sin(2 * np.pi * 73.42 * t_all) + 0.7 * np.sin(2 * np.pi * 110.0 * t_all + 1)
             + 0.25 * np.sin(2 * np.pi * 146.83 * t_all + 2)) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t_all))
    drone = sosfilt(butter(2, 600, btype="low", fs=SR, output="sos"), drone) * 0.05
    L += drone; R += drone * 0.95
    eighth = BEAT / 2
    k, t = 0, 0.0
    while t < total_s:
        i = int(t * SR)
        tones = CHORDS[int(t // BAR) % len(CHORDS)]
        if not is_quiet(t):
            if rng.random() > 0.08:                              # the lute
                f = tones[PATTERN[k % 8]]
                key = (round(f, 2), k % 3)
                if key not in cache:
                    cache[key] = _ks(f, 1.2, seed=k % 3 + int(f), bright=0.5 + 0.2 * (k % 3))
                note = cache[key] * (0.11 if k % 8 == 0 else 0.075)
                e = min(n, i + len(note))
                pan = 0.5 + 0.25 * np.sin(k * 0.9)
                L[i:e] += note[: e - i] * (1 - pan)
                R[i:e] += note[: e - i] * pan
            if k % 8 == 0:                                       # the bass string on each bar
                fb = tones[0] / 2
                key = ("b", round(fb, 2))
                if key not in cache:
                    cache[key] = _ks(fb, 2.4, seed=7, bright=0.3)
                note = cache[key] * 0.13
                e = min(n, i + len(note))
                L[i:e] += note[: e - i]; R[i:e] += note[: e - i]
            if k % 4 == 0 or (k % 8 == 7):                       # frame drum: low on 1 and 3, a light tap before the bar
                m = int(0.5 * SR)
                tt = np.arange(m) / SR
                low = k % 4 == 0
                hit = (np.sin(2 * np.pi * (70 if low else 180) * tt) * np.exp(-tt / (0.18 if low else 0.05))
                       + rng.normal(0, 1, m) * np.exp(-tt / 0.008) * 0.3) * (0.07 if low else 0.035)
                e = min(n, i + m)
                L[i:e] += hit[: e - i]; R[i:e] += hit[: e - i]
        k += 1
        t += eighth
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 4500, btype="low", fs=SR, output="sos"), out, axis=0)
    ir_n = int(1.8 * SR)
    for ch in range(2):                                          # a stone room
        ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.4 * SR))
        ir = sosfilt(butter(2, 2500, btype="low", fs=SR, output="sos"), ir)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.8 * out[:, ch] + 0.2 * oaconvolve(out[:, ch], ir)[:n]
    out = out[: int(total_s * SR)]
    tt = np.arange(len(out)) / SR
    out *= (np.minimum(1, tt / 0.6) * np.minimum(1, (total_s - tt) / 1.0))[:, None]
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
