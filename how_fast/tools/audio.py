"""Synthesized music bed and sound effects, cued from config/timeline.json.

    python tools/audio.py      -> audio/music.wav, audio/sfx.wav (48 kHz stereo)

Everything is generated here (no samples), so there is nothing to license.
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "config/timeline.json"), encoding="utf-8"))
E = TL["events"]
SR = 48000
DUR = TL["duration"] + 0.3
N = int(DUR * SR)
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def env_adsr(n, a, r, sr=SR):
    e = np.ones(n)
    na, nr = int(a * sr), int(r * sr)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def reverb_ir(seconds=2.8, predelay=0.02):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (seconds / 6.5))[:, None]
    ir = lp(ir, 6500)
    ir[: int(predelay * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum() / 2)


IR = reverb_ir()


def add(buf, sig, t0):
    i0 = int(round(t0 * SR))
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    i1 = min(len(buf), i0 + len(sig))
    if i1 > i0:
        buf[i0:i1] += sig[: i1 - i0]


# ------------------------------------------------------------------ music
def pad_note(f, n, t_off=0.0, bright=1.0):
    """Warm detuned additive pad voice, stereo."""
    t = np.arange(n) / SR + t_off
    out = np.zeros((n, 2))
    for det, pan in ((-6, 0.2), (0, 0.5), (6, 0.8)):
        fd = f * 2 ** (det / 1200)
        v = np.zeros(n)
        for h in range(1, 9):
            fh = fd * h
            if fh > 5000:
                break
            amp = (1.0 / h) * np.exp(-fh / (1400 * bright))
            v += amp * np.sin(2 * np.pi * fh * t + rng.uniform(0, 2 * np.pi))
        lfo = 1 + 0.12 * np.sin(2 * np.pi * (0.13 + 0.05 * rng.random()) * t + rng.uniform(0, 6))
        v *= lfo
        out[:, 0] += v * np.cos(pan * np.pi / 2)
        out[:, 1] += v * np.sin(pan * np.pi / 2)
    return out / 3


# chord plan: (start, end, midi notes, brightness)
S = {s["name"]: s for s in TL["sections"]}
Dm9 = [50, 57, 60, 64, 65]          # D3 A3 C4 E4 F4
Bbmaj7 = [46, 53, 57, 62, 65]       # Bb2 F3 A3 D4 F4
F_A = [45, 53, 57, 60, 64]          # A2 F3 A3 C4 E4
Gm9 = [43, 50, 57, 58, 62]          # G2 D3 A3 Bb3 D4
C6 = [48, 55, 57, 64, 67]           # C3 G3 A3 E4 G4
Fmaj9 = [41, 53, 57, 60, 64, 67]    # F2 F3 A3 C4 E4 G4
Bbmaj9 = [46, 53, 57, 60, 62, 65]
Cadd9 = [48, 55, 62, 64, 67]


def chord_plan():
    plan = [(0.0, S["spin"]["start"], Dm9, 0.8)]
    t, seq = S["spin"]["start"], [Bbmaj7, F_A, Gm9, Dm9]
    i = 0
    while t < S["orbit"]["start"] - 0.5:
        e = min(t + 6.9, S["orbit"]["start"])
        plan.append((t, e, seq[i % 4], 0.9)); t = e; i += 1
    t, seq, i = S["orbit"]["start"], [Bbmaj7, C6, Dm9, F_A], 0
    while t < S["galaxy"]["start"] - 0.5:
        e = min(t + 3.55, S["galaxy"]["start"])
        plan.append((t, e, seq[i % 4], 1.0)); t = e; i += 1
    t, seq, i = S["galaxy"]["start"], [Gm9, Bbmaj9, Fmaj9, Cadd9], 0
    while t < S["payoff"]["start"] - 0.5:
        e = min(t + 4.75, S["payoff"]["start"])
        plan.append((t, e, seq[i % 4], 1.25)); t = e; i += 1
    plan.append((S["payoff"]["start"], S["payoff"]["start"] + 3.6, Bbmaj9, 1.0))
    plan.append((S["payoff"]["start"] + 3.6, DUR, Fmaj9, 1.0))
    return plan


def music():
    buf = np.zeros((N, 2))
    xf = 0.9
    for (a, b, notes, br) in chord_plan():
        a0, b0 = max(0, a - xf / 2), min(DUR, b + xf / 2)
        n = int((b0 - a0) * SR)
        seg = np.zeros((n, 2))
        for k, m in enumerate(notes):
            seg += pad_note(midi(m), n, a0, br) * (0.8 if m < 48 else 1.0)
        seg *= env_adsr(n, xf, xf)[:, None]
        add(buf, seg * 0.18, a0)
    # sub drone on D
    t = np.arange(N) / SR
    sub = 0.05 * np.sin(2 * np.pi * midi(38) * t) * (1 + 0.2 * np.sin(2 * np.pi * 0.07 * t))
    buf += sub[:, None]
    # plucked arpeggio from the orbit section on (soft, 104 bpm eighths)
    step = 60 / 104 / 2
    arp_from, arp_to = S["orbit"]["start"] + 0.2, S["payoff"]["start"] + 7.5
    plan = chord_plan()
    tt, k = arp_from, 0
    while tt < arp_to:
        notes = next((c for (a, b, c, _) in plan if a <= tt < b), Fmaj9)
        pool = sorted(set(n + 12 for n in notes if n >= 50))
        m = pool[[0, 2, 1, 3, 2, 4, 1, 3][k % 8] % len(pool)]
        n = int(0.9 * SR)
        tn = np.arange(n) / SR
        v = (np.sin(2 * np.pi * midi(m) * tn) + 0.3 * np.sin(4 * np.pi * midi(m) * tn)) * np.exp(-tn / 0.28)
        v *= np.minimum(1, tn / 0.004)
        pan = 0.3 + 0.4 * ((k * 37) % 10) / 10
        gain = 0.045 * (1.25 if S["galaxy"]["start"] <= tt < S["payoff"]["start"] else 1.0)
        add(buf, np.stack([v * np.cos(pan * np.pi / 2), v * np.sin(pan * np.pi / 2)], 1) * gain, tt)
        tt += step; k += 1
    # shimmer over the galaxy
    g0, g1 = S["galaxy"]["start"], S["payoff"]["start"]
    n = int((g1 - g0 + 1.5) * SR)
    ts_ = np.arange(n) / SR
    sh = np.zeros((n, 2))
    for m, pan in ((81, 0.25), (84, 0.75), (88, 0.5)):
        v = np.sin(2 * np.pi * midi(m) * ts_) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.21 * ts_ + m))
        sh[:, 0] += v * np.cos(pan * np.pi / 2); sh[:, 1] += v * np.sin(pan * np.pi / 2)
    sh *= env_adsr(n, 3.0, 1.5)[:, None] * 0.012
    add(buf, sh, g0)
    # overall arc: quieter hook, lift through the galaxy, settle at the end
    arc = np.interp(t, [0, 2, S["spin"]["start"], S["galaxy"]["start"], S["galaxy"]["start"] + 4, S["payoff"]["start"], DUR - 2.5, DUR],
                    [0.0, 0.75, 0.85, 0.9, 1.1, 1.0, 0.9, 0.0])
    buf *= arc[:, None]
    wet = fftconvolve(buf, IR, axes=0)[:N] * 0.35
    out = hp(buf * 0.8 + wet, 35)
    return out


# ------------------------------------------------------------------ sfx
def noise(n):
    return rng.standard_normal(n)


def whoosh(dur=1.0, lo=300, hi=3000, gain=1.0, rise=0.45):
    n = int(dur * SR)
    x = noise(n)
    # moving band: filter in blocks and crossfade (cheap time-varying filter)
    blk = 1024
    out = np.zeros(n)
    for i in range(0, n, blk // 2):
        u = i / n
        c = lo * (hi / lo) ** (np.sin(np.pi * min(1, u / (rise * 2))) if u < rise else 1 - (u - rise) / (1 - rise) * 0.6)
        c = float(np.clip(c, 60, 16000))
        seg = x[i:i + blk]
        if len(seg) < 32:
            break
        f = bp(seg, c * 0.6, min(c * 1.6, 20000))
        w = np.hanning(len(seg))
        out[i:i + len(seg)] += f * w
    e = np.interp(np.arange(n) / n, [0, rise, 1], [0, 1, 0]) ** 1.6
    y = out * e * gain
    return np.stack([y, y], 1)


def tick(freq=2600, dur=0.03, gain=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006) * gain
    return np.stack([y, y], 1)


def pop(freq=900, gain=0.35):
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t / 0.02))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) * gain
    return np.stack([y, y], 1)


def impact(gain=0.8):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 52 + 60 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    click = lp(noise(n), 1800) * np.exp(-t / 0.02) * 0.6
    y = (body + click) * gain
    return np.stack([y, y], 1)


def rise_tone(f0, f1, dur, gain=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_adsr(n, 0.05, 0.25) * gain
    return np.stack([y, y], 1)


def chime(root=76, gain=0.22, dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, d in ((1, 1, 1.6), (2.76, 0.4, 0.9), (5.4, 0.2, 0.5), (8.93, 0.1, 0.3)):
        y += a * np.sin(2 * np.pi * midi(root) * ratio * t) * np.exp(-t / d)
    y *= np.minimum(1, t / 0.003) * gain
    return np.stack([y, y * 0.95], 1)


def counter_ticks(buf, t0, dur, n_ticks=16, gain=0.12):
    for i in range(n_ticks):
        u = (i / n_ticks) ** 0.6
        add(buf, tick(2200 + 900 * u, gain=gain * (0.6 + 0.4 * u)), t0 + u * dur)


def pour(dur):
    n = int(dur * SR)
    x = bp(noise(n), 500, 2600) * 0.08
    for _ in range(int(dur * 22)):
        i = rng.integers(0, max(1, n - 3000))
        f = rng.uniform(380, 1100)
        tt = np.arange(2400) / SR
        x[i:i + 2400] += np.sin(2 * np.pi * f * (1 + 2.5 * tt) * tt) * np.exp(-tt / 0.012) * 0.12
    x *= env_adsr(n, 0.2, 0.4)
    return np.stack([x, x], 1)


def rumble(dur, gain=0.05):
    n = int(dur * SR)
    x = lp(noise(n), 160) * gain * env_adsr(n, 0.6, 0.6)
    return np.stack([x, x], 1)


def zip_(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(noise(n), 900, 5000) * 0.25 * (t / dur) ** 0.7 * env_adsr(n, 0.02, 0.15)
    f = 300 * (6 ** (t / dur))
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.06 * env_adsr(n, 0.05, 0.2)
    return np.stack([x * 0.8, x], 1)


def swirl(dur, gain=0.5):
    y = whoosh(dur, 250, 2400, gain, rise=0.5)[:, 0]
    t = np.arange(len(y)) / len(y)
    pan = 0.5 + 0.45 * np.sin(2 * np.pi * t)
    return np.stack([y * np.cos(pan * np.pi / 2), y * np.sin(pan * np.pi / 2)], 1) * 1.3


def sfx():
    b = np.zeros((N, 2))
    n0 = int(2.0 * SR)
    air = lp(noise(n0), 900) * np.linspace(0, 1, n0) ** 2 * 0.05
    add(b, np.stack([air, air], 1), 0.0)
    for i in range(3):
        add(b, pop(700 + 180 * i, 0.3), E["three"] + 0.05 + i * 0.28)
    add(b, whoosh(1.1, 250, 2800, 0.55), E["spin"] - 0.55)
    add(b, whoosh(0.8, 400, 3000, 0.35), E["merry"] - 0.45)
    add(b, whoosh(0.8, 400, 3000, 0.35), E["equator"] - 0.4)
    counter_ticks(b, E["spin_num"] - 0.25, 0.9)
    add(b, impact(0.45), E["spin_num"] + 0.62)
    add(b, whoosh(0.8, 400, 3000, 0.35), E["jet"] - 0.45)
    add(b, rise_tone(330, 520, 0.9, 0.07), E["jet"] + 0.05)
    add(b, rise_tone(330, 820, 0.9, 0.08), E["jet"] + 0.55)
    add(b, pop(1100, 0.28), E["jet_word"] - 0.05)
    add(b, whoosh(0.9, 300, 2600, 0.4), E["feel"] - 0.5)
    add(b, rumble(E["orbit"] - E["feel"], 0.06), E["feel"] - 0.2)
    add(b, pour(E["pour"] + 0.7 - (E["flight"] + 0.2)), E["flight"] + 0.2)
    add(b, whoosh(3.0, 120, 2200, 0.75, rise=0.35), E["orbit"] - 0.3)
    add(b, whoosh(0.8, 400, 3000, 0.35), E["marathon"] - 0.45)
    t0 = E["marathon_earth"] + 0.25
    add(b, zip_(1.42), t0)
    for i in range(15):
        add(b, tick(3000, gain=0.07), t0 + i * 0.1)
    add(b, chime(84, 0.12, 1.2), t0 + 1.42)
    add(b, whoosh(0.8, 400, 3000, 0.3), E["orbit_num"] - 0.45)
    counter_ticks(b, E["orbit_num"] - 0.2, 1.0)
    add(b, impact(0.45), E["orbit_num"] + 0.78)
    add(b, whoosh(4.8, 90, 4200, 0.8, rise=0.7), E["galaxy"] - 0.3)
    counter_ticks(b, E["gal_num"] - 0.2, 1.0)
    add(b, impact(0.7), E["gal_num"] + 0.78)
    add(b, swirl(3.8, 0.45), E["lap"] + 0.15)
    counter_ticks(b, E["lap_num"] - 0.3, 1.2, 14)
    add(b, whoosh(0.7, 400, 2600, 0.3), E["dinos"] - 0.35)
    for i, dt in enumerate((0.0, 0.22, 0.44)):
        th = impact(0.18 + 0.08 * i)[: int(0.5 * SR)]
        add(b, th, E["dinos"] + 0.1 + dt)
    add(b, whoosh(1.0, 250, 2600, 0.45), E["payoff"] - 0.75)
    add(b, pop(820, 0.25), E["payoff"] + 0.1)
    add(b, chime(79, 0.18, 3.5), E["end"] + 0.2)
    wet = fftconvolve(b, IR[: int(1.2 * SR)], axes=0)[:N] * 0.18
    return hp(b + wet, 40)


def main():
    m = music()
    s = sfx()
    for name, x in (("music", m), ("sfx", s)):
        x = x / max(1e-9, np.abs(x).max()) * 0.8
        sf.write(os.path.join(ROOT, f"audio/{name}.wav"), x.astype(np.float32), SR, subtype="FLOAT")
        print(f"audio/{name}.wav  {len(x) / SR:.1f} s")


if __name__ == "__main__":
    main()
