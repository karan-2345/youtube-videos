"""
tools/music.py -- a generated music bed (no samples, no licences) with the feel of a sea shanty: 6/8 in D minor,
Dm - Bb - F - C, a plucked guitar arpeggio (Karplus-Strong), a plucked bass on the dotted beats, a soft concertina
pad (reeds: square-ish tones with a bellows tremolo), a fiddle tune, and a bodhran in the middle of the film only, so
the end flows back into the start.

The tempo is set so a whole number of 4-bar phrases fills the video: the bed loops seamlessly with the picture.

    bed(total_s, drums_on, hush) -> stereo (n, 2) float32, peak 0.5
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, oaconvolve, sosfilt

SR = 48_000

NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate("C C# D D# E F F# G G# A A# B".split())}


def hz(name: str) -> float:
    n, o = name[:-1], int(name[-1])
    return NOTE[n] * 2 ** (o - 4)


CHORDS = [["D3", "A3", "D4", "F4", "A4"], ["A#2", "F3", "A#3", "D4", "F4"], ["F2", "C3", "F3", "A3", "C4"], ["C3", "G3", "C4", "E4", "G4"]]
ARP = [0, 2, 3, 4, 3, 2]                      # eighths: root-ish up and down
# the fiddle tune: two 4-bar phrases (note, eighths); bar = 6 eighths
TUNE = [
    [("A4", 3), ("D5", 2), ("E5", 1)], [("F5", 3), ("D5", 3)], [("C5", 2), ("A4", 1), ("F4", 2), ("A4", 1)], [("G4", 3), ("E4", 3)],
    [("A4", 2), ("D5", 1), ("F5", 2), ("A5", 1)], [("G5", 2), ("F5", 1), ("D5", 3)], [("C5", 2), ("F5", 1), ("E5", 2), ("C5", 1)], [("D5", 6)],
]


def _ks(f: float, dur: float, seed: int, bright: float = 0.6, decay: float = 0.995) -> np.ndarray:
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    p = max(2, int(round(SR / f)))
    buf = r.uniform(-1, 1, p)
    for _ in range(3 - int(2 * bright)):
        buf = np.convolve(buf, np.ones(5) / 5, mode="same")
    buf -= buf.mean()
    out = np.empty(n)
    for i in range(n):
        j = i % p
        out[i] = buf[j]
        buf[j] = decay * (0.5 * buf[j] + 0.5 * buf[(j + 1) % p])
    t = np.arange(n) / SR
    body = sosfilt(butter(2, [120, 2600], btype="band", fs=SR, output="sos"), out)
    x = (0.5 * out + 0.7 * body) * np.minimum(1, (dur - t) / 0.05)
    return x / (np.abs(x).max() + 1e-9)


def _fiddle(f: float, dur: float, seed: int) -> np.ndarray:
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.6 * t) * np.minimum(1, t / 0.25)
    ph = np.cumsum(f * vib) / SR
    saw = 2 * (ph % 1) - 1
    bow = sosfilt(butter(2, [1500, 6000], btype="band", fs=SR, output="sos"), r.normal(0, 1, n)) * 0.04
    x = sosfilt(butter(2, [250, 3200], btype="band", fs=SR, output="sos"), saw + bow)
    env = np.minimum(1, t / 0.06) * np.minimum(1, (dur - t) / 0.08) * (0.85 + 0.15 * np.minimum(1, t / 0.4))
    return x * env / (np.abs(x).max() + 1e-9)


def _reed(freqs, dur: float) -> np.ndarray:
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for k, g in ((1, 1.0), (3, 0.3), (5, 0.12)):
            x += np.sin(2 * np.pi * f * k * t) * g * (1 + 0.002 * k)
    x *= 0.85 + 0.15 * np.sin(2 * np.pi * 4.2 * t)           # bellows tremolo
    x = sosfilt(butter(2, 1800, btype="low", fs=SR, output="sos"), x)
    env = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.3)
    return x * env / (np.abs(x).max() + 1e-9)


def _bodhran(rng, low=True):
    m = int(0.5 * SR); tt = np.arange(m) / SR
    if low:
        f = 70 + 50 * np.exp(-tt / 0.02)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.16) + rng.normal(0, 1, m) * np.exp(-tt / 0.005) * 0.2
    x = sosfilt(butter(2, [400, 2500], btype="band", fs=SR, output="sos"), rng.normal(0, 1, m)) * np.exp(-tt / 0.03)
    return x + np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / 0.04) * 0.5


def bed(total_s: float, drums_on: list = (), hush: list = (), seed: int = 41, **_) -> np.ndarray:
    bars = max(4, int(round(total_s / 1.95 / 4)) * 4)        # whole 4-bar phrases (~92 dotted-quarter bpm)
    bar = total_s / bars
    e = bar / 6
    n = int(total_s * SR) + 3 * SR
    L, R = np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(seed)
    inside = lambda x, spans: any(a <= x < b for a, b in spans)

    def put(x, i, gl, gr):
        i = max(0, i); end = min(n, i + len(x))
        if end > i:
            L[i:end] += x[: end - i] * gl; R[i:end] += x[: end - i] * gr

    cache: dict = {}
    for b in range(bars):
        t0 = b * bar
        ch = CHORDS[b % 4]
        quiet = inside(t0 + bar / 2, hush)
        # pad (always; quieter in a hush)
        key = ("pad", b % 4)
        if key not in cache:
            cache[key] = _reed([hz(x) for x in ch[1:4]], bar + 0.35)
        put(cache[key] * (0.05 if quiet else 0.08), int(t0 * SR), 0.9, 1.0)
        # bass on the two dotted beats
        for k, nm in ((0, ch[0]), (3, ch[1] if b % 2 else ch[0])):
            key = ("bass", nm)
            if key not in cache:
                cache[key] = _ks(hz(nm) / 2, 1.4, 7, bright=0.3, decay=0.997)
            put(cache[key] * (0.06 if quiet else 0.13), int((t0 + k * e) * SR), 1, 1)
        if not quiet:
            # guitar arpeggio
            for k in range(6):
                if rng.random() < 0.05:
                    continue
                nm = ch[ARP[k]]
                f = hz(nm) * 2
                key = ("g", nm)
                if key not in cache:
                    cache[key] = _ks(f, 0.9, int(f), bright=0.6)
                pan = 0.5 + 0.2 * np.sin(k * 1.1 + b)
                put(cache[key] * (0.085 if k in (0, 3) else 0.06), int((t0 + k * e) * SR), 1 - pan, pan)
            # the fiddle tune, from the second phrase until the last one (so the loop seam is just guitar and pad)
            if 4 <= b < bars - 4:
                pos = 0
                for nm, d in TUNE[b % 8]:
                    key = ("f", nm, d)
                    if key not in cache:
                        cache[key] = _fiddle(hz(nm), d * e + 0.05, d)
                    put(cache[key] * 0.07, int((t0 + pos * e) * SR), 0.7, 0.45)
                    pos += d
        # bodhran: the middle of the film only
        if inside(t0 + bar / 2, drums_on) and not quiet:
            for k in range(6):
                lo = k in (0, 3)
                g = 0.12 if lo else (0.035 if k in (2, 5) else 0.02)
                put(_bodhran(rng, lo) * g, int((t0 + k * e + (0.012 if k % 3 == 2 else 0)) * SR), 1, 0.9)
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 6000, btype="low", fs=SR, output="sos"), out, axis=0)
    ir_n = int(1.4 * SR)
    for c in range(2):                                         # a wooden room
        ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.3 * SR))
        ir = sosfilt(butter(2, 3500, btype="low", fs=SR, output="sos"), ir)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, c] = 0.82 * out[:, c] + 0.18 * oaconvolve(out[:, c], ir)[:n]
    m = int(total_s * SR)
    tail = out[m:m + 2 * SR].copy()
    out = out[:m]
    out[: len(tail)] += tail
    return (out / (np.abs(out).max() + 1e-9) * 0.5).astype(np.float32)
