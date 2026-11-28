"""
tools/music.py -- a generated music bed (no samples, no licences) with an ancient-Egyptian colour: an oud-like plucked
string (Karplus-Strong) playing arpeggios in D Hijaz (D Eb F# G A Bb C) -- D, Eb, C minor, D -- over a soft D-A
drone, and a darbuka (low "doum", bright "tek") in the middle of the film only, so the end flows back into the start.

The tempo is locked to the hauling clock (two beats per stride, scene.json "haul_hz"), which puts a whole number of
bars in the video: the bed loops seamlessly with the picture.

    bed(total_s, drums_on, hush, haul_hz) -> stereo (n, 2) float32, peak 0.5
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000

D2, A2 = 73.42, 110.0
CHORDS = [
    [146.83, 185.00, 220.00, 293.66, 369.99, 440.00],   # D (with F#: the Hijaz third)
    [155.56, 196.00, 233.08, 311.13, 392.00, 466.16],   # Eb
    [130.81, 155.56, 196.00, 261.63, 311.13, 392.00],   # C minor
    [146.83, 185.00, 220.00, 293.66, 369.99, 440.00],   # D
]
PATTERN = [0, 2, 1, 3, 4, 3, 5, 3]                    # eighth notes
# an ornament: on the last eighth of every other bar, a quick Eb-D turn high up (the Hijaz flavour)
TURN = [622.25, 587.33]


def _ks(f: float, dur: float, seed: int, bright: float = 0.6) -> np.ndarray:
    """Karplus-Strong plucked string with a short wooden body (oud-ish)."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    p = max(2, int(round(SR / f)))
    buf = r.uniform(-1, 1, p)
    for _ in range(3 - int(2 * bright)):
        buf = np.convolve(buf, np.ones(5) / 5, mode="same")
    buf -= buf.mean()
    out = np.empty(n)
    decay = 0.994
    for i in range(n):
        j = i % p
        out[i] = buf[j]
        buf[j] = decay * (0.25 * buf[j - 1] + 0.5 * buf[j] + 0.25 * buf[(j + 1) % p])
    t = np.arange(n) / SR
    body = sosfilt(butter(2, [220, 3200], btype="band", fs=SR, output="sos"), out)
    x = (0.6 * out + 0.6 * body) * np.minimum(1, (dur - t) / 0.05)
    return x / (np.abs(x).max() + 1e-9)


def _doum(rng):
    m = int(0.6 * SR); tt = np.arange(m) / SR
    f = 62 + 40 * np.exp(-tt / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.22) + rng.normal(0, 1, m) * np.exp(-tt / 0.006) * 0.15


def _tek(rng):
    m = int(0.25 * SR); tt = np.arange(m) / SR
    x = sosfilt(butter(2, [1800, 7000], btype="band", fs=SR, output="sos"), rng.normal(0, 1, m)) * np.exp(-tt / 0.03)
    return x + np.sin(2 * np.pi * 820 * tt) * np.exp(-tt / 0.02) * 0.4


def bed(total_s: float, drums_on: list[tuple[float, float]] = (), hush: list[tuple[float, float]] = (),
        haul_hz: float = 0.5, seed: int = 41) -> np.ndarray:
    beat = 1.0 / (2 * haul_hz)                    # two beats per stride (~121 bpm)
    bar = 4 * beat
    n = int(total_s * SR) + 2 * SR
    L, R = np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(seed)
    inside = lambda x, spans: any(a <= x < b for a, b in spans)
    cache: dict = {}
    t_all = np.arange(n) / SR
    # the drone: D2 + A2 (+ D3), breathing on a period that divides the video, so it loops too
    lfo = 2 * np.pi * t_all / (total_s / 7)
    drone = (np.sin(2 * np.pi * D2 * t_all) + 0.7 * np.sin(2 * np.pi * A2 * t_all + 1)
             + 0.3 * np.sin(2 * np.pi * 146.83 * t_all + 2)) * (0.75 + 0.25 * np.sin(lfo))
    drone = sosfilt(butter(2, 700, btype="low", fs=SR, output="sos"), drone) * 0.05
    L += drone; R += drone * 0.95

    def put(x, i, gl, gr):
        e = min(n, i + len(x))
        if e > i:
            L[i:e] += x[: e - i] * gl; R[i:e] += x[: e - i] * gr

    k, t = 0, 0.0
    eighth = beat / 2
    while t < total_s:
        i = int(t * SR)
        b = int(t // bar + 1e-6)
        tones = CHORDS[b % 4]
        quiet = inside(t, hush)
        if not quiet:
            if rng.random() > 0.06:
                if k % 16 == 15 and b % 2 == 1:
                    for j, f in enumerate(TURN):                 # the ornament
                        key = ("t", f)
                        if key not in cache:
                            cache[key] = _ks(f, 0.6, seed=3 + j, bright=0.8)
                        put(cache[key] * 0.05, i + int(j * eighth / 2 * SR), 0.35, 0.65)
                else:
                    f = tones[PATTERN[k % 8]]
                    key = (round(f, 2), k % 3)
                    if key not in cache:
                        cache[key] = _ks(f, 1.1, seed=k % 3 + int(f), bright=0.5 + 0.2 * (k % 3))
                    pan = 0.5 + 0.25 * np.sin(k * 0.9)
                    put(cache[key] * (0.1 if k % 8 == 0 else 0.068), i, 1 - pan, pan)
            if k % 8 == 0:                                       # the bass string on each bar
                fb = tones[0] / 2
                key = ("b", round(fb, 2))
                if key not in cache:
                    cache[key] = _ks(fb, 2.2, seed=7, bright=0.3)
                put(cache[key] * 0.12, i, 1, 1)
            if inside(t, drums_on):                              # darbuka: doum-tek-tek-doum-tek (maqsum-ish)
                pos = k % 8
                if pos in (0, 3):
                    put(_doum(rng) * 0.11, i, 1, 1)
                elif pos in (2, 6):
                    put(_tek(rng) * 0.05, i, 0.8, 1)
                elif pos in (5, 7):
                    put(_tek(rng) * 0.028, i, 1, 0.8)
        k += 1
        t += eighth
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 5000, btype="low", fs=SR, output="sos"), out, axis=0)
    ir_n = int(1.6 * SR)
    for ch in range(2):                                          # a stone hall
        ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.38 * SR))
        ir = sosfilt(butter(2, 3000, btype="low", fs=SR, output="sos"), ir)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = 0.8 * out[:, ch] + 0.2 * oaconvolve(out[:, ch], ir)[:n]
    # the tail of the last bars wraps round onto the start, so the loop point has no gap in the reverb
    m = int(total_s * SR)
    tail = out[m:m + SR].copy()
    out = out[:m]
    out[: len(tail)] += tail
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
