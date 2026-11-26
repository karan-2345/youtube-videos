"""
tools/music.py -- a generated music bed (no samples, no licences): light, curious and modern. A mallet-like FM pluck
plays A minor arpeggios (Am - F - C - G) over a warm pad and a round sub bass; a soft kick, snap and shaker come in
after the hook and leave for the ending, so the end flows back into the start. 100 bpm.

    bed(total_s, sections) -> stereo (n, 2) float32
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000
BPM = 100.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT

#          root   chord tones for the arpeggio (Hz)
CHORDS = [(110.00, [220.00, 261.63, 329.63, 440.00, 523.25, 659.25]),    # A minor
          (87.31, [174.61, 220.00, 261.63, 349.23, 440.00, 523.25]),     # F
          (130.81, [196.00, 261.63, 329.63, 392.00, 523.25, 659.25]),    # C
          (98.00, [196.00, 246.94, 293.66, 392.00, 493.88, 587.33])]     # G
PATTERN = [0, 2, 4, 3, 5, 3, 4, 2]                                         # eighth notes


def _lp(x, hi, order=2):
    return sosfilt(butter(order, hi, btype="low", fs=SR, output="sos"), x, axis=0)


def _hp(x, lo, order=2):
    return sosfilt(butter(order, lo, btype="high", fs=SR, output="sos"), x, axis=0)


def pluck(f, dur=0.9, bright=1.0):
    """FM mallet: a sine carrier with a fast-decaying modulator (marimba / kalimba-ish)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = 2.2 * bright * np.exp(-t / 0.04)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 4.0 * t))
    x += 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.12)
    env = np.minimum(1, t / 0.002) * np.exp(-t / 0.32)
    return x * env * np.minimum(1, (dur - t) / 0.03)


def pad_chord(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, f in enumerate(freqs):
        for det in (-0.12, 0.12):
            ph = 2 * np.pi * f * (1 + det / 100) * t + k
            x += (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.5        # saw, two detuned voices
    x = _lp(x, 1400, 2)
    env = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.6)
    return x * env


def kick(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)


def snap(rng, dur=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sosfilt(butter(2, [1200, 6000], btype="band", fs=SR, output="sos"), rng.normal(0, 1, n))
    return x * np.exp(-t / 0.035)


def shaker(rng, dur=0.08):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return _hp(rng.normal(0, 1, n), 6000) * np.minimum(1, t / 0.01) * np.exp(-t / 0.02)


def bed(total_s: float, drums_on: list[tuple[float, float]] = (), hush: list[tuple[float, float]] = (),
        seed: int = 7) -> np.ndarray:
    """drums_on: spans with the beat; hush: spans where only the pad plays. Stereo (n, 2) float32, peak 0.5."""
    n = int(total_s * SR) + 2 * SR
    L, R = np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(seed)
    inside = lambda x, spans: any(a <= x < b for a, b in spans)
    put = lambda x, i, gl, gr: (L.__setitem__(slice(i, min(n, i + len(x))), L[i:min(n, i + len(x))] + x[: max(0, min(n, i + len(x)) - i)] * gl),
                                R.__setitem__(slice(i, min(n, i + len(x))), R[i:min(n, i + len(x))] + x[: max(0, min(n, i + len(x)) - i)] * gr))
    cache: dict = {}
    # pad, one chord per bar
    bar = 0
    while bar * BAR < total_s + BAR:
        root, tones = CHORDS[bar % 4]
        p = pad_chord([tones[0], tones[1], tones[2]], BAR + 0.6) * 0.05
        i = int(bar * BAR * SR)
        put(p, i, 1.0, 0.9)
        # sub bass: root on beats 1 and 3 (and a pickup)
        for b in (0, 2):
            tb = bar * BAR + b * BEAT
            if tb < total_s and not inside(tb, hush):
                m = int(BEAT * 1.6 * SR)
                tt = np.arange(m) / SR
                sub = np.sin(2 * np.pi * root * tt) * np.minimum(1, tt / 0.01) * np.exp(-tt / 0.45) * 0.085
                put(sub, int(tb * SR), 1, 1)
        bar += 1
    # pluck arpeggio (eighths), drums (quarters / sixteenths)
    k, t = 0, 0.0
    while t < total_s:
        i = int(t * SR)
        _, tones = CHORDS[int(t // BAR) % 4]
        if not inside(t, hush):
            f = tones[PATTERN[k % 8]]
            key = (round(f, 2), k % 8 == 0)
            if key not in cache:
                cache[key] = pluck(f, bright=1.2 if k % 8 == 0 else 0.9)
            note = cache[key] * (0.1 if k % 8 == 0 else 0.072)
            pan = 0.5 + 0.3 * np.sin(k * 0.77)
            put(note, i, 1 - pan, pan)
            if inside(t, drums_on):
                beat = k // 2
                if k % 2 == 0 and beat % 2 == 0:
                    put(kick() * 0.24, i, 1, 1)
                if k % 2 == 0 and beat % 4 in (1, 3):
                    put(snap(rng) * 0.07, i, 0.9, 1)
                for s in range(2):                                   # shaker on sixteenths
                    put(shaker(rng) * (0.035 if s == 0 else 0.022), i + int(s * BEAT / 4 * SR), 0.8, 1)
        k += 1
        t += BEAT / 2
    out = np.stack([L, R], 1)
    out = _lp(out, 9000)
    # a small bright room
    ir_n = int(1.4 * SR)
    for ch in range(2):
        ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.3 * SR))
        ir = sosfilt(butter(2, 5000, btype="low", fs=SR, output="sos"), ir)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.82 * out[:, ch] + 0.18 * oaconvolve(out[:, ch], ir)[:len(out)]
    out = out[: int(total_s * SR)]
    tt = np.arange(len(out)) / SR
    out *= np.minimum(1, tt / 0.05)[:, None]
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
