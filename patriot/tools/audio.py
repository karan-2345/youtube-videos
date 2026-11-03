"""Synthesized music bed and sound cues for the Patriot Short, cued from config/timeline.json.

    python tools/audio.py      -> audio/music.wav, audio/sfx.wav (48 kHz stereo)

Serious subject: a slow, dark drone bed and restrained, functional sounds (key clicks, radar blips,
a blade, low hits). No playful effects. The music drops out on the barracks line and returns for the
ending. Everything is generated here, so there is nothing to license.
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "config/timeline.json"), encoding="utf-8"))
E = TL["events"]
S = {s["name"]: s for s in TL["sections"]}
SR = 48000
DUR = TL["duration"] + 0.3
N = int(DUR * SR)
rng = np.random.default_rng(11)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def reverb_ir(seconds=3.2, predelay=0.03):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (seconds / 6.5))[:, None]
    ir = lp(ir, 5000)
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


def st(y, pan=0.5):
    return np.stack([y * np.cos(pan * np.pi / 2), y * np.sin(pan * np.pi / 2)], 1) * 1.414


# ------------------------------------------------------------------ music
def pad_note(f, n, t_off=0.0, bright=1.0):
    t = np.arange(n) / SR + t_off
    out = np.zeros((n, 2))
    for det, pan in ((-5, 0.25), (0, 0.5), (5, 0.75)):
        fd = f * 2 ** (det / 1200)
        v = np.zeros(n)
        for h in range(1, 7):
            fh = fd * h
            if fh > 3000:
                break
            v += (1.0 / h ** 1.3) * np.exp(-fh / (900 * bright)) * np.sin(2 * np.pi * fh * t + rng.uniform(0, 6.28))
        v *= 1 + 0.15 * np.sin(2 * np.pi * (0.07 + 0.04 * rng.random()) * t + rng.uniform(0, 6))
        out += st(v, pan) / 1.414
    return out / 3


# slow D minor colours; each chord lasts a long time
Dm = [38, 50, 57, 62, 65]          # D2 D3 A3 D4 F4
Bb = [34, 50, 53, 58, 62]          # Bb1 D3 F3 Bb3 D4
Gm = [43, 50, 55, 58, 62]          # G2 D3 G3 Bb3 D4
A_sus = [45, 52, 57, 62, 64]       # A2 E3 A3 D4 E4
Dm_add9 = [38, 50, 57, 64, 65]


def chord_plan():
    seq = [Dm, Bb, Gm, A_sus]
    plan, t, i = [], 0.0, 0
    stop = E["struck"] + 0.4
    while t < stop:
        e = min(t + 8.0, stop)
        plan.append((t, e, seq[i % 4], 0.8 + 0.1 * (i % 2)))
        t, i = e, i + 1
    # after the black: return quietly for the ending
    t = S["S05"]["start"]
    seq = [Bb, Gm, A_sus, Dm_add9]
    i = 0
    while t < DUR:
        e = min(t + 8.0, DUR)
        plan.append((t, e, seq[i % 4], 0.75))
        t, i = e, i + 1
    return plan


def music():
    buf = np.zeros((N, 2))
    xf = 1.6
    for (a, b, notes, br) in chord_plan():
        a0, b0 = max(0, a - xf / 2), min(DUR, b + xf / 2)
        n = int((b0 - a0) * SR)
        seg = np.zeros((n, 2))
        for m in notes:
            seg += pad_note(midi(m), n, a0, br) * (0.9 if m < 45 else 1.0)
        seg *= env(n, xf, xf)[:, None]
        add(buf, seg * 0.16, a0)
    t = np.arange(N) / SR
    # a slow pulse in the low register from the clock scene on: the clock ticking away, felt not heard
    pulse = np.zeros(N)
    p0, p1 = S["S02"]["start"], E["struck"] + 0.3
    bpm_step = 60 / 66
    k = p0
    while k < p1:
        i0 = int(k * SR)
        n = int(0.6 * SR)
        tn = np.arange(n) / SR
        y = np.sin(2 * np.pi * midi(38) * tn) * np.exp(-tn / 0.18) * np.minimum(1, tn / 0.01)
        pulse[i0:i0 + n][: max(0, min(n, N - i0))] += y[: max(0, min(n, N - i0))]
        k += bpm_step
    pulse *= np.interp(t, [p0, p0 + 3, S["S04"]["start"], E["mach"], p1 - 0.3, p1], [0, 0.05, 0.06, 0.08, 0.08, 0])
    buf += st(pulse)
    # high thin tone that rises in S04 (tension), cut with the black
    n0, n1 = E["mach"] - 2, E["struck"] + 0.35
    tone = 0.010 * np.sin(2 * np.pi * midi(81) * t) * np.interp(t, [n0, n1 - 0.2, n1], [0, 1, 0])
    buf += st(tone, 0.6)
    # overall arc: quiet hook, steady, drop to nothing on the barracks line, quiet return, fade at the end
    arc = np.interp(t, [0, 3, E["y1991"], E["y1991"] + 1, E["struck"] + 0.25, E["struck"] + 0.5,
                        S["S05"]["start"] + 0.2, S["S05"]["start"] + 3, DUR - 1.5, DUR],
                    [0.55, 0.7, 0.75, 0.95, 1.0, 0.0, 0.0, 0.75, 0.6, 0.35])
    buf *= arc[:, None]
    wet = fftconvolve(buf, IR, axes=0)[:N] * 0.4
    return hp(buf * 0.75 + wet, 30)


# ------------------------------------------------------------------ sfx
def key_click(gain=0.18):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    y = hp(rng.standard_normal(n), 1800) * np.exp(-t / 0.004) * gain
    y += np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.01) * gain * 0.6
    return st(y, 0.5 + rng.uniform(-0.08, 0.08))


def blip(freq=1320, dur=0.18, gain=0.12, pan=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / (dur / 4)) * np.minimum(1, t / 0.003) * gain
    return st(y, pan)


def low_hit(gain=0.5, f0=48, dur=2.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 + 40 * np.exp(-t / 0.06)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.6)
    y += lp(rng.standard_normal(n), 900) * np.exp(-t / 0.03) * 0.3
    return st(y * gain)


def blade(gain=0.25):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 3000, 9000) * np.exp(-t / 0.05) * 0.6
    for r, a in ((1, 1), (2.41, 0.5), (3.9, 0.3)):
        y += a * np.sin(2 * np.pi * 1900 * r * t) * np.exp(-t / 0.09) * 0.35
    return st(y * gain * np.minimum(1, t / 0.002))


def soft_tick(gain=0.05):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return st(np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.005) * gain)


def air(dur, gain=0.03, fc=700):
    n = int(dur * SR)
    y = lp(rng.standard_normal(n), fc) * env(n, 0.6, 0.6) * gain
    return st(y)


def sfx():
    b = np.zeros((N, 2))
    # S00: typing "0.1 + 0.2" (one click per character as the renderer types it), the answer, the four
    typeA, typeB = 0.35, E["into"] - 0.1
    for k in range(9):
        add(b, key_click(0.16 if k != 3 and k != 5 else 0.08), typeA + (k + 1) / 9 * (typeB - typeA) + 0.01)
    add(b, key_click(0.22), E["answer"] - 0.25)  # return key
    add(b, blip(1760, 0.25, 0.08), E["four"])
    add(b, low_hit(0.55), E["y1991"] - 0.15)
    add(b, air(E["strange"] - E["y1991"], 0.02, 500), E["y1991"])
    # radar sweep blips in the hook scope (one per sweep revolution of 2*pi/1.15 s)
    rev = 2 * np.pi / 1.15
    k = E["y1991"] + 0.4
    while k < S["S00"]["end"] - 0.5:
        add(b, blip(990, 0.3, 0.035, 0.45), k)
        k += rev
    add(b, blip(660, 0.5, 0.06), E["dead"])
    # S01: soft ticks as the digits unroll, the blade at bit 23
    for i in range(14):
        add(b, soft_tick(0.025), E["third_num"] - 0.35 + i / 16 * 1.0)
    for i in range(20):
        add(b, soft_tick(0.02), E["tenth"] + 0.25 + i / 20 * 1.0)
    add(b, blade(0.3), E["chop"] - 0.1)
    add(b, blip(520, 0.6, 0.05), E["slight"] + 0.8)
    # S02: the clock (tenth-second ticks while the count runs), the hours run, the 0.34 landing
    k = E["clock"] - 0.1
    while k < E["behind"] - 0.4:
        add(b, soft_tick(0.018), k)
        k += 0.1
    add(b, air(E["third_sec"] - E["behind"], 0.025, 1200), E["behind"] - 0.2)
    add(b, low_hit(0.35, 55, 1.6), E["third_sec"] - 0.12)
    # S03: two radar pulses, then the same two stamped late
    add(b, blip(1320, 0.22, 0.1, 0.35), E["pulses"] - 0.2)
    add(b, blip(1320, 0.22, 0.1, 0.65), E["pulses"] + 0.1)
    add(b, blip(990, 0.22, 0.07, 0.35), E["both"])
    add(b, blip(990, 0.22, 0.07, 0.65), E["both"] + 0.05)
    # S04: patched blocks light one by one, the missed one, the pop, the radar, the cut to black
    for k2 in range(3):
        add(b, soft_tick(0.05), E["accurate"] + 0.25 + k2 * 0.35)
    add(b, blip(440, 0.5, 0.06), E["missed"] + 0.1)
    add(b, blip(1320, 0.22, 0.08, 0.35), E["subtract"] + 0.2)
    add(b, low_hit(0.4, 52, 1.6), E["pop"] - 0.1)
    k = E["mach"] - 0.3
    while k < E["struck"]:
        add(b, blip(1180, 0.25, 0.03, 0.5), k)
        k += 1.6
    add(b, low_hit(0.6, 40, 3.0), E["struck"] + 0.35)
    # S05: soft marks on the calendar, the reboot, the console's return and the four
    for t0 in (E["israel"], E["israel"] + 1.6, E["israel"] + 2.6):
        add(b, soft_tick(0.04), t0)
    add(b, blip(880, 0.5, 0.05), E["d26"])
    add(b, air(2.0, 0.02, 900), E["reboot"] + 0.2)
    add(b, blip(1760, 0.25, 0.06), E["four2"])
    wet = fftconvolve(b, IR[: int(1.5 * SR)], axes=0)[:N] * 0.2
    return hp(b + wet, 35)


def main():
    os.makedirs(os.path.join(ROOT, "audio"), exist_ok=True)
    m = music()
    s = sfx()
    for name, x in (("music", m), ("sfx", s)):
        x = x / max(1e-9, np.abs(x).max()) * 0.8
        sf.write(os.path.join(ROOT, f"audio/{name}.wav"), x.astype(np.float32), SR, subtype="FLOAT")
        print(f"audio/{name}.wav  {len(x) / SR:.1f} s")


if __name__ == "__main__":
    main()
