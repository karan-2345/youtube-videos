"""Synthesized music bed and sound effects, cued from config/timeline.json.

    python tools/audio.py      -> audio/music.wav, audio/sfx.wav (48 kHz stereo)

Everything is generated here (no samples), so there is nothing to license.
Cue times come from the same timeline as the picture (config/timeline.json events),
so every sound lands on its spoken word.
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
rng = np.random.default_rng(11)

# the picture's own cue times (see web/main.js): stones, row, stagger, iris cuts, hand-offs
PERIOD = 0.6
STEP_DT = 0.15
NEL = 24
STONE_T = (E["stones"], E["stones"] + PERIOD)
ROW_T = E["row"] + 0.55
ROW2_T0 = E["late"] + 0.25
IRIS1 = (E["pond"] + 0.1, E["pond"] + 0.9)
IRIS2 = (E["tilt"] + 1.45, E["tilt"] + 2.25)
H1, H2 = 69.45, 77.9
PASS_A, PASS_B = E["sat"] - 0.3, E["how"] - 0.15


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


def stereo(y, pan=0.5):
    return np.stack([y * np.cos(pan * np.pi / 2), y * np.sin(pan * np.pi / 2)], 1)


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
        v *= 1 + 0.12 * np.sin(2 * np.pi * (0.13 + 0.05 * rng.random()) * t + rng.uniform(0, 6))
        out[:, 0] += v * np.cos(pan * np.pi / 2)
        out[:, 1] += v * np.sin(pan * np.pi / 2)
    return out / 3


S = {s["name"]: s for s in TL["sections"]}
Am9 = [45, 52, 55, 59, 60]          # A2 E3 G3 B3 C4
Fmaj7 = [41, 48, 52, 55, 57]        # F2 C3 E3 G3 A3
Cmaj9 = [48, 55, 59, 62, 64]        # C3 G3 B3 D4 E4
Gadd9 = [43, 50, 55, 59, 62]        # G2 D3 G3 B3 D4
Dm9 = [50, 57, 60, 64, 65]          # D3 A3 C4 E4 F4
Fmaj9 = [41, 53, 57, 60, 64, 67]


def chord_plan():
    plan, t = [], 0.0
    seq = {"hook": ([Am9, Fmaj7], 7.8, 0.8), "steer": ([Dm9], 7.9, 0.9), "ripples": ([Cmaj9, Fmaj7, Gadd9, Am9], 4.3, 1.0),
           "delay": ([Am9, Fmaj7, Cmaj9, Gadd9], 4.3, 1.1), "follow": ([Dm9, Fmaj7, Cmaj9], 3.7, 1.15)}
    for name, (chords, length, br) in seq.items():
        a, b, i = S[name]["start"], S[name]["end"], 0
        if name == "hook":
            a = 0.0
        while a < b - 0.3:
            e = min(a + length, b)
            plan.append((a, e, chords[i % len(chords)], br)); a = e; i += 1
    p0 = S["payoff"]["start"]
    plan.append((p0, p0 + 3.4, Fmaj7, 1.0))
    plan.append((p0 + 3.4, DUR, Cmaj9, 1.0))
    return plan


def music():
    buf = np.zeros((N, 2))
    xf = 0.9
    plan = chord_plan()
    for (a, b, notes, br) in plan:
        a0, b0 = max(0, a - xf / 2), min(DUR, b + xf / 2)
        n = int((b0 - a0) * SR)
        seg = np.zeros((n, 2))
        for m in notes:
            seg += pad_note(midi(m), n, a0, br) * (0.8 if m < 48 else 1.0)
        seg *= env_adsr(n, xf, xf)[:, None]
        add(buf, seg * 0.18, a0)
    t = np.arange(N) / SR
    sub = 0.045 * np.sin(2 * np.pi * midi(33) * t) * (1 + 0.2 * np.sin(2 * np.pi * 0.07 * t))   # A1 drone
    buf += sub[:, None]
    # plucked arpeggio: starts when the explaining starts, fuller as the beam gets steered
    step = 60 / 92 / 2
    arp_from, arp_to = S["steer"]["start"] + 0.4, S["payoff"]["start"] + 8.0
    tt, k = arp_from, 0
    while tt < arp_to:
        notes = next((c for (a, b, c, _) in plan if a <= tt < b), Cmaj9)
        pool = sorted(set(n + 12 for n in notes if n >= 48))
        m = pool[[0, 2, 1, 3, 2, 4, 1, 3][k % 8] % len(pool)]
        n = int(0.9 * SR)
        tn = np.arange(n) / SR
        v = (np.sin(2 * np.pi * midi(m) * tn) + 0.3 * np.sin(4 * np.pi * midi(m) * tn)) * np.exp(-tn / 0.26)
        v *= np.minimum(1, tn / 0.004)
        gain = 0.04 * (0.6 if tt < S["ripples"]["start"] else 1.0) * (1.25 if S["delay"]["start"] <= tt < S["follow"]["start"] else 1.0)
        add(buf, stereo(v, 0.3 + 0.4 * ((k * 37) % 10) / 10) * gain, tt)
        tt += step; k += 1
    # high shimmer under the radio section
    g0, g1 = E["panel"], S["follow"]["start"]
    n = int((g1 - g0 + 1.5) * SR)
    ts_ = np.arange(n) / SR
    sh = np.zeros((n, 2))
    for m, pan in ((81, 0.25), (84, 0.75), (88, 0.5)):
        v = np.sin(2 * np.pi * midi(m) * ts_) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.21 * ts_ + m))
        sh += stereo(v, pan)
    sh *= env_adsr(n, 2.5, 1.5)[:, None] * 0.012
    add(buf, sh, g0)
    arc = np.interp(t, [0, 2, 6, S["ripples"]["start"], S["delay"]["start"], S["follow"]["start"], S["payoff"]["start"], DUR - 2.5, DUR],
                    [0.0, 0.7, 0.8, 0.85, 1.0, 1.05, 1.0, 0.9, 0.0])
    buf *= arc[:, None]
    wet = fftconvolve(buf, IR, axes=0)[:N] * 0.35
    return hp(buf * 0.8 + wet, 35)


# ------------------------------------------------------------------ sfx
def noise(n):
    return rng.standard_normal(n)


def whoosh(dur=1.0, lo=300, hi=3000, gain=1.0, rise=0.45):
    n = int(dur * SR)
    x = noise(n)
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
        out[i:i + len(seg)] += f * np.hanning(len(seg))
    e = np.interp(np.arange(n) / n, [0, rise, 1], [0, 1, 0]) ** 1.6
    y = out * e * gain
    return np.stack([y, y], 1)


def tick(freq=2600, dur=0.03, gain=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return stereo(np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006) * gain)


def pop(freq=900, gain=0.35):
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t / 0.02))
    return stereo(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) * gain)


def impact(gain=0.8):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 52 + 60 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    click = lp(noise(n), 1800) * np.exp(-t / 0.02) * 0.6
    return stereo((body + click) * gain)


def rise_tone(f0, f1, dur, gain=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    return stereo(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_adsr(n, 0.05, 0.25) * gain)


def chime(root=76, gain=0.22, dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, d in ((1, 1, 1.6), (2.76, 0.4, 0.9), (5.4, 0.2, 0.5), (8.93, 0.1, 0.3)):
        y += a * np.sin(2 * np.pi * midi(root) * ratio * t) * np.exp(-t / d)
    y *= np.minimum(1, t / 0.003) * gain
    return np.stack([y, y * 0.95], 1)


def plop(freq=700, gain=0.3, pan=0.5):
    """Water drop: a short falling sine with a soft noise burst."""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = freq * (0.55 + 0.9 * np.exp(-t / 0.045))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    y += bp(noise(n), 1500, 5000) * np.exp(-t / 0.012) * 0.25
    return stereo(y * np.minimum(1, t / 0.002) * gain, pan)


def pluck(m, gain=0.2, pan=0.5):
    """Marimba-like note for the stagger staircase."""
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    f = midi(m)
    y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 3.9 * f * t) * np.exp(-t / 0.05)) * np.exp(-t / 0.18)
    return stereo(y * np.minimum(1, t / 0.002) * gain, pan)


def motor(dur, gain=0.2):
    """Stepper-motor whine with a gritty 14 Hz chatter, for the dish that has to turn."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 150 + 18 * np.sin(2 * np.pi * 0.9 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * 2 * np.cumsum(f) / SR)
    gate = 0.65 + 0.35 * (np.sin(2 * np.pi * 14 * t) > 0)
    y = bp(y * gate + 0.4 * noise(n) * gate, 120, 2400) * env_adsr(n, 0.25, 0.3) * gain
    return stereo(y, 0.4)


def zip_(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(noise(n), 900, 5000) * 0.25 * (t / dur) ** 0.7 * env_adsr(n, 0.02, 0.15)
    f = 300 * (6 ** (t / dur))
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.06 * env_adsr(n, 0.05, 0.2)
    return np.stack([x * 0.8, x], 1)


def counter_ticks(buf, t0, dur, n_ticks=16, gain=0.12):
    for i in range(n_ticks):
        u = (i / n_ticks) ** 0.6
        add(buf, tick(2200 + 900 * u, gain=gain * (0.6 + 0.4 * u)), t0 + u * dur)


def sfx():
    b = np.zeros((N, 2))
    n0 = int(2.2 * SR)
    add(b, stereo(lp(noise(n0), 800) * np.linspace(0, 1, n0) ** 2 * 0.045), 0.0)           # night air
    pent = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]                                  # A minor pentatonic, A3 up

    # hook: satellite appears, beam locks, speed counter, satellite leaves
    add(b, rise_tone(330, 760, 0.8, 0.07), E["sat"] - 0.5)
    add(b, pop(980, 0.3), E["sat"] + 0.05)
    add(b, whoosh(2.6, 150, 1800, 0.35, rise=0.5), E["sat"] + 0.3)
    counter_ticks(b, E["sat_num"] - 0.05, 1.1)
    add(b, impact(0.4), E["sat_num"] + 1.15)
    add(b, whoosh(1.0, 400, 2600, 0.35, rise=0.3), E["gone"] - 0.2)
    add(b, rise_tone(300, 480, 0.9, 0.06), E["how"])
    add(b, pop(740, 0.22), E["how"] + 0.1)
    add(b, whoosh(1.5, 200, 2200, 0.3, rise=0.4), PASS_B + 0.2)

    # a dish on a motor: whine and chatter, always behind; then the panel snaps onto the satellite
    add(b, pop(520, 0.25), E["motor"])
    add(b, motor(E["steer"] - E["motor"] + 0.2, 0.2), E["motor"] + 0.05)
    add(b, whoosh(0.5, 400, 3000, 0.4, rise=0.4), E["steer"] - 0.1)
    add(b, pop(1100, 0.35), E["steer"] + 0.25)
    add(b, chime(84, 0.14, 1.6), E["steer"] + 0.3)
    add(b, whoosh(1.0, 120, 2400, 0.5, rise=0.55), IRIS1[0])             # iris closes on the panel
    add(b, whoosh(1.1, 200, 2800, 0.45, rise=0.4), IRIS1[1])             # ... and opens on the pond

    # two stones, then crest + crest / crest + trough
    for T, pan, f in ((STONE_T[0], 0.3, 640), (STONE_T[1], 0.7, 560)):
        add(b, plop(f, 0.42, pan), T + 0.02)
    add(b, rise_tone(500, 1000, 1.0, 0.05), E["cross"] - 0.4)
    add(b, chime(88, 0.2, 2.2), E["up"] + 0.05)
    add(b, rise_tone(900, 260, 0.9, 0.07), E["down"] - 0.05)                # falling away: cancels
    add(b, impact(0.25), E["down"] + 0.55)

    # row of stones: the camera rises, all the stones land together
    add(b, whoosh(3.0, 120, 2400, 0.55, rise=0.6), E["row"] - 0.7)
    for i in range(NEL):
        add(b, plop(500 + 12 * i, 0.07, 0.15 + 0.7 * i / (NEL - 1)), ROW_T + 0.004 * i)
    add(b, impact(0.5), ROW_T + 0.04)
    add(b, pop(900, 0.25), E["ahead"] + 0.02)
    add(b, rise_tone(400, 900, 0.9, 0.05), E["ahead"])

    # each stone after its neighbour: the staircase you can hear
    add(b, whoosh(0.7, 300, 2200, 0.3, rise=0.3), E["late"] - 0.1)
    for i in range(NEL):
        add(b, pluck(pent[i // 2] + (0 if i % 2 == 0 else 0), 0.17, 0.12 + 0.76 * i / (NEL - 1)), ROW2_T0 + STEP_DT * i)
    add(b, whoosh(1.1, 250, 2600, 0.35, rise=0.45), E["slant"] - 0.3)
    add(b, chime(83, 0.16, 2.4), E["slant"] + 0.3)

    # pond becomes radio waves
    add(b, whoosh(2.6, 200, 5200, 0.6, rise=0.7), E["panel"] - 0.15)
    add(b, rise_tone(220, 1760, 2.2, 0.05), E["panel"])
    add(b, chime(91, 0.12, 2.8), E["panel"] + 1.9)
    # trillionths of a second: a fast patter of ticks
    for i in range(18):
        add(b, tick(3200 + 60 * i, gain=0.08), E["ps"] - 0.05 + i * 0.03)
    add(b, pop(1200, 0.22), E["ps"] + 0.62)
    add(b, rise_tone(500, 1100, 0.9, 0.06), E["tilt"] - 0.05)
    add(b, chime(88, 0.15, 1.8), E["tilt"] + 0.8)
    add(b, whoosh(1.0, 120, 2200, 0.5, rise=0.55), IRIS2[0])
    add(b, whoosh(1.1, 200, 2800, 0.45, rise=0.4), IRIS2[1])

    # follow: the beam glides, then jumps to the next satellite
    add(b, whoosh(3.0, 160, 1600, 0.25, rise=0.5), E["follow"] + 0.4)
    add(b, whoosh(0.7, 500, 3500, 0.4, rise=0.3), E["next"] + 0.6)
    for T in (H1, H2):
        add(b, zip_(0.5), T - 0.05)
        add(b, pop(1100, 0.3), T + 0.48)
        add(b, chime(84, 0.1, 1.2), T + 0.5)

    # payoff
    add(b, impact(0.5), E["payoff"] - 0.02)
    add(b, rise_tone(330, 660, 1.4, 0.05), E["payoff"] + 0.3)
    add(b, chime(79, 0.2, 4.0), E["end"] + 0.1)
    wet = fftconvolve(b, IR[: int(1.2 * SR)], axes=0)[:N] * 0.18
    return hp(b + wet, 40)


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
