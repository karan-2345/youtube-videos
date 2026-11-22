"""
tools/sfx.py -- synthesized sound effects (numpy/scipy only, no samples) and the cue sheet that places them.

Everything is placed on the measured word times (renders/cache/scene.json "anchors") and on the same clocks the scene
uses: every breath the figure takes ("breath") and the jog's strides ("jog").

    render_track(total_s) -> mono float32 at SR
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48_000
ROOT = Path(__file__).resolve().parents[1]
SCENE = ROOT / "renders" / "cache" / "scene.json"


def _bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def _lp(x, hi, order=2):
    return sosfilt(butter(order, hi, btype="low", fs=SR, output="sos"), x)


def _hp(x, lo, order=2):
    return sosfilt(butter(order, lo, btype="high", fs=SR, output="sos"), x)


def _norm(x, peak=0.5):
    return x / (np.abs(x).max() + 1e-9) * peak


def _t(dur):
    n = int(dur * SR)
    return n, np.arange(n) / SR


def _env(t, a, d):
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def _fade(x, out=0.02):
    m = int(out * SR)
    x[-m:] *= np.linspace(1, 0, m)
    return x


def _glide(f0, f1, t, tau):
    """phase of a tone gliding from f0 to f1 with time constant tau"""
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    return 2 * np.pi * np.cumsum(f) / SR


# ---------------------------------------------------------------- the fat
def blorp(seed=1):
    """A wet jiggle: a low wobbling bubble with a squelch on top."""
    r = np.random.default_rng(seed)
    n, t = _t(0.6)
    f = 95 + 40 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / 0.2)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(t, 0.01, 0.16)
    sq = _bp(r.normal(0, 1, n), 300, 1400) * _env(t, 0.004, 0.05) * (0.5 + 0.5 * np.sin(2 * np.pi * 31 * t))
    bub = np.sin(_glide(220, 520, t, 0.05)) * _env(t, 0.03, 0.07) * 0.5
    return _fade(_norm(body + 0.35 * sq + bub, 0.5))


def melt(seed=1, dur=1.2):
    """Oozing: a slow, slumping wet sweep downwards."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    noise = r.normal(0, 1, n)
    out = np.zeros(n)
    for k, (lo, hi) in enumerate([(180, 700), (260, 1000), (120, 420)]):
        seg = _bp(noise, lo, hi) * (0.6 + 0.4 * np.sin(2 * np.pi * (5 + 2 * k) * t + k))
        out += seg
    tone = np.sin(_glide(260, 110, t, 0.5)) * 0.4
    env = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.4)
    return _fade(_norm((out + tone) * env, 0.45))


def drip(seed=1):
    """A drop: the classic plip, a short tone that bends up."""
    r = np.random.default_rng(seed)
    n, t = _t(0.25)
    f0 = r.uniform(500, 800)
    x = np.sin(_glide(f0, f0 * 2.3, t, 0.018)) * _env(t, 0.001, 0.045)
    return _fade(_norm(x, 0.45))


def stretch(seed=1, dur=0.75):
    """Rubbery stretching: a rising creaky tone with fibre crackle (fat turning into 'muscle')."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    f = 90 + 120 * (t / dur) ** 1.4
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    tone = _bp(saw, 150, 1600) * (0.7 + 0.3 * np.sin(2 * np.pi * 23 * t))
    crack = (r.random(n) > 0.9985) * r.normal(0, 1, n)
    crack = _bp(crack, 1500, 6000) * 6
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.12)
    return _fade(_norm((tone + 0.4 * crack) * env, 0.45))


def bead(seed=1):
    """A tiny high plip: a bead of sweat."""
    r = np.random.default_rng(seed)
    n, t = _t(0.12)
    f0 = r.uniform(1700, 2600)
    return _fade(_norm(np.sin(_glide(f0, f0 * 1.6, t, 0.01)) * _env(t, 0.0005, 0.02), 0.3))


def xstamp(seed=1):
    """'No': a punchy low thud and a short muted buzz."""
    r = np.random.default_rng(seed)
    n, t = _t(0.45)
    thud = np.sin(_glide(140, 52, t, 0.03)) * _env(t, 0.001, 0.12)
    buzz = (np.sign(np.sin(2 * np.pi * 196 * t)) + np.sign(np.sin(2 * np.pi * 207.7 * t))) * 0.5
    buzz = _lp(buzz, 1400) * _env(t, 0.003, 0.09) * 0.45
    hit = _bp(r.normal(0, 1, n), 800, 4000) * _env(t, 0.0005, 0.012) * 0.6
    return _fade(_norm(thud + buzz + hit, 0.55))


def rewind(seed=1, dur=0.32):
    """A quick reverse whoosh (back to the lump)."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 400, 3000)
    env = (t / dur) ** 2.5
    return _fade(_norm(x * env, 0.4), 0.01)


def whoosh(seed=1, dur=1.0, lo=200, hi=2400):
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = r.normal(0, 1, n)
    out = np.zeros(n)
    k = 8
    for i in range(k):                          # a band that sweeps up and back down
        a, b = i * n // k, (i + 1) * n // k
        c = lo + (hi - lo) * np.sin(np.pi * (i + 0.5) / k)
        out[a:b] = _bp(x, c * 0.7, min(c * 1.4, SR / 2 - 100))[a:b]
    env = np.sin(np.pi * t / dur) ** 2
    return _fade(_norm(out * env, 0.45))


def whoomp(seed=1):
    """An impact into the gold: a low boom with a soft air burst."""
    r = np.random.default_rng(seed)
    n, t = _t(1.4)
    boom = np.sin(_glide(90, 42, t, 0.12)) * _env(t, 0.004, 0.45)
    air = _lp(r.normal(0, 1, n), 1800) * _env(t, 0.002, 0.18) * 0.5
    return _fade(_norm(boom + air, 0.6))


def shimmer(seed=1, dur=2.0, density=60, lo=2500, hi=7500):
    """Sparkles: many tiny bright pings over an airy hiss (the specks)."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = _hp(r.normal(0, 1, n), 5000) * 0.05 * np.sin(np.pi * t / dur)
    m = int(0.12 * SR)
    tt = np.arange(m) / SR
    for _ in range(int(density * dur)):
        i = int(r.uniform(0, n - m))
        f = r.uniform(lo, hi)
        out[i:i + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / r.uniform(0.015, 0.05)) * r.uniform(0.2, 1.0)
    env = np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.5)
    return _fade(_norm(out * env, 0.35))


def inhale(seed=1, dur=1.2, strength=1.0):
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 700, 4200) + 0.5 * _bp(r.normal(0, 1, n), 1800, 2600)
    env = np.sin(np.pi * np.minimum(1, t / dur) * 0.5) ** 2 * np.minimum(1, (dur - t) / 0.06)
    return _fade(_norm(x * env, 0.35 * strength))


def exhale(seed=1, dur=1.2, strength=1.0):
    """Breath out: 'hhhh' -- band noise with a soft vowel colour, quick to start, slow to die away."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 250, 2600) + 0.6 * _bp(r.normal(0, 1, n), 900, 1300)
    env = np.minimum(1, t / 0.06) * (1 - t / dur) ** 1.4
    return _fade(_norm(_lp(x, 3200) * env, 0.45 * strength))


def chime(seed=1, f0=1046.5):
    """The right answer: two bright bell notes a major third apart."""
    n, t = _t(1.6)
    out = np.zeros(n)
    for k, f in enumerate((f0, f0 * 1.26)):
        d = int(k * 0.09 * SR)
        tt = t[: n - d]
        tone = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt / 0.15)
                + 0.15 * np.sin(2 * np.pi * f * 3.01 * tt) * np.exp(-tt / 0.08))
        out[d:] += tone * _env(tt, 0.002, 0.5)
    return _fade(_norm(out, 0.4))


def pop(seed=1):
    """A soft UI pop for a label."""
    r = np.random.default_rng(seed)
    n, t = _t(0.12)
    f0 = r.uniform(700, 950)
    return _fade(_norm(np.sin(_glide(f0, f0 * 0.45, t, 0.02)) * _env(t, 0.001, 0.03), 0.35))


def dim(seed=1, dur=0.9):
    """Lights going down: a falling, darkening whoosh."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = r.normal(0, 1, n)
    out = np.zeros(n)
    k = 8
    for i in range(k):
        a, b = i * n // k, (i + 1) * n // k
        c = 2400 * (1 - i / k) + 200
        out[a:b] = _bp(x, c * 0.6, c * 1.3)[a:b]
    tone = np.sin(_glide(520, 180, t, 0.3)) * 0.3
    return _fade(_norm((out + tone) * np.sin(np.pi * t / dur), 0.4))


def blip(seed=1, f=660.0):
    """A plucky FM blip (an atom lighting up)."""
    n, t = _t(0.5)
    mod = np.sin(2 * np.pi * f * 2 * t) * 2.5 * np.exp(-t / 0.05)
    x = np.sin(2 * np.pi * f * t + mod) * _env(t, 0.001, 0.14)
    return _fade(_norm(x, 0.4))


def glass(seed=1, f=523.25, dur=2.4):
    """A soft glassy tone (the molecule appears)."""
    n, t = _t(dur)
    x = sum(np.sin(2 * np.pi * f * m * t + m) * np.exp(-t / (0.9 / m)) / m for m in (1, 2.01, 3.03, 4.2))
    return _fade(_norm(x * np.minimum(1, t / 0.03), 0.35))


def swirl(seed=1, dur=2.4):
    """Air rushing in, swirling (the oxygen)."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = r.normal(0, 1, n)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 2.2 * t)
    out = _bp(x, 500, 1500) * lfo + _bp(x, 1500, 4000) * (1 - lfo)
    return _fade(_norm(out * np.sin(np.pi * t / dur) ** 1.5, 0.4))


def burst(seed=1):
    """The molecule breaking apart: a pop and a spray of tiny clicks."""
    r = np.random.default_rng(seed)
    n, t = _t(1.5)
    boom = np.sin(_glide(160, 60, t, 0.06)) * _env(t, 0.001, 0.2)
    clicks = np.zeros(n)
    m = int(0.01 * SR)
    for _ in range(140):
        i = int(abs(r.normal(0, 0.25)) * SR)
        if i + m < n:
            clicks[i:i + m] += _bp(r.normal(0, 1, m), 2000, 9000) * np.exp(-np.arange(m) / (0.0015 * SR)) * r.uniform(0.2, 1)
    return _fade(_norm(boom + 0.8 * clicks, 0.55))


def snaps(seed=1, dur=1.6, count=40):
    """Atoms clicking together into new molecules: small wooden snaps spread over a moment."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    m = int(0.04 * SR)
    tt = np.arange(m) / SR
    for _ in range(count):
        i = int(r.uniform(0, 0.8) ** 1.3 * (n - m))
        f = r.uniform(900, 2200)
        out[i:i + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.008) * r.uniform(0.3, 1)
    return _fade(_norm(out, 0.4))


def rise(seed=1, dur=1.8):
    """Gas floating up: an airy rising sweep."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = r.normal(0, 1, n)
    out = np.zeros(n)
    k = 10
    for i in range(k):
        a, b = i * n // k, (i + 1) * n // k
        c = 300 + 3000 * (i / k) ** 1.5
        out[a:b] = _bp(x, c * 0.7, c * 1.3)[a:b]
    return _fade(_norm(out * np.sin(np.pi * t / dur), 0.35))


def bubbles(seed=1, dur=1.2, count=14):
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    m = int(0.08 * SR)
    tt = np.arange(m) / SR
    for _ in range(count):
        i = int(r.uniform(0, n - m))
        f0 = r.uniform(400, 1100)
        out[i:i + m] += np.sin(_glide(f0, f0 * 2, tt, 0.015)) * np.exp(-tt / 0.02) * r.uniform(0.3, 1)
    return _fade(_norm(out, 0.4))


def thud(seed=1):
    """The 10 kg block landing: a heavy soft thump that jiggles."""
    r = np.random.default_rng(seed)
    n, t = _t(1.0)
    body = np.sin(_glide(110, 48, t, 0.05)) * _env(t, 0.002, 0.25)
    jig = np.sin(2 * np.pi * 120 * t + 3 * np.sin(2 * np.pi * 11 * t)) * _env(t, 0.02, 0.15) * 0.35
    slap = _bp(r.normal(0, 1, n), 200, 1500) * _env(t, 0.001, 0.03) * 0.8
    return _fade(_norm(body + jig + slap, 0.6))


def sizzle(seed=1, dur=2.4):
    """Dissolving into specks: a crackling, rising sparkle hiss."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    crack = (r.random(n) > 0.993) * r.normal(0, 1, n)
    crack = _bp(crack, 2500, 9000) * 4
    hiss = _bp(r.normal(0, 1, n), 3000, 9000) * 0.12
    env = np.minimum(1, t / 0.3) * np.minimum(1, (dur - t) / 0.4)
    return _fade(_norm((crack + hiss) * env, 0.4))


def slosh(seed=1, dur=1.4):
    """Turning to water: a soft slosh."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _lp(r.normal(0, 1, n), 900)
    wob = 0.5 + 0.5 * np.sin(2 * np.pi * (3 + 2 * t) * t)
    gl = np.sin(_glide(300, 700, t, 0.4)) * 0.2 * np.exp(-t / 0.5)
    env = np.minimum(1, t / 0.12) * np.exp(-t / 0.6)
    return _fade(_norm((x * wob + gl) * env, 0.45))


def step(seed=1):
    """A soft footstep."""
    r = np.random.default_rng(seed)
    n, t = _t(0.25)
    body = np.sin(_glide(120, 60, t, 0.02)) * _env(t, 0.001, 0.05)
    scuff = _bp(r.normal(0, 1, n), 600, 3500) * _env(t, 0.001, 0.02) * 0.6
    return _fade(_norm(body + scuff, 0.4))


def dizzy(seed=1, dur=1.5):
    """Cartoon dizziness: a wobbling slide down with twinkles."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    f = 900 * np.exp(-t / 1.2) + 380 + 70 * np.sin(2 * np.pi * 11 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 5 * t))
    tw = shimmer(seed, dur, density=10, lo=3000, hi=6000)[:n]
    env = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.4)
    return _fade(_norm(x * env * 0.6 + tw, 0.45))


SOUNDS = {
    "blorp": blorp, "melt": melt, "drip": drip, "stretch": stretch, "bead": bead, "xstamp": xstamp, "rewind": rewind,
    "whoosh": lambda s: whoosh(s, 1.2, 150, 2200), "whoosh_long": lambda s: whoosh(s, 2.2, 120, 1800),
    "whoosh_fast": lambda s: whoosh(s, 0.6, 300, 3200),
    "whoomp": whoomp, "shimmer": shimmer, "shimmer_long": lambda s: shimmer(s, 3.2, 70),
    "inhale": lambda s: inhale(s, 1.2), "inhale_short": lambda s: inhale(s, 0.3, 0.8),
    "exhale_big": lambda s: exhale(s, 1.6, 1.0), "exhale": lambda s: exhale(s, 0.9, 0.8), "exhale_short": lambda s: exhale(s, 0.32, 0.8),
    "chime": chime, "chime_low": lambda s: chime(s, 784.0), "pop": pop, "dim": dim,
    "blipC": lambda s: blip(s, 523.25), "blipH": lambda s: blip(s, 659.25), "blipO": lambda s: blip(s, 783.99),
    "glass": glass, "swirl": swirl, "burst": burst, "snaps": snaps, "snaps_w": lambda s: snaps(s, 1.0, 26), "rise": rise,
    "bubbles": bubbles, "thud": thud, "sizzle": sizzle, "slosh": slosh, "step": step, "dizzy": dizzy,
}


def cue_sheet() -> list:
    d = json.loads(SCENE.read_text())
    A, D, BR, J = d["anchors"], d["duration"], d["breath"], d["jog"]
    c = []
    add = lambda t, name, db, seed=1: c.append([t, name, db, seed])
    # ---- hook
    add(0.0, "blorp", -10, 1)
    add(A["melt"] - 0.12, "melt", -12, 2)
    for k, dt in enumerate((0.35, 0.55, 0.7, 0.85)):
        add(A["melt"] + dt, "drip", -16, 10 + k)
    add(A["away"] + 0.12, "xstamp", -11, 1)
    add(A["muscle_or"] - 0.15, "rewind", -16, 2)
    add(A["muscle_or"] + 0.12, "stretch", -12, 3)
    add(A["muscle"] + 0.15, "xstamp", -11, 2)
    add(A["sweat_and"] - 0.2, "rewind", -16, 3)
    for k in range(9):
        add(A["sweat"] - 0.1 + 0.07 * k, "bead", -18, 20 + k)
    add(A["either"] + 0.05, "xstamp", -11, 3)
    add(A["because"] - 0.15, "whoosh_long", -12, 4)
    add(A["because"] + 0.2, "shimmer_long", -15, 5)
    # ---- breaths (the big ones, the panting, the jog, and the quiet ones at the end)
    for k, b in enumerate(BR):
        kind = b.get("kind")
        if kind == "big":
            add(b["in0"], "inhale", -15, 40 + k); add(b["ex0"], "exhale_big", -13, 40 + k)
        elif kind == "pant":
            add(b["ex0"], "exhale_short", -17, 40 + k); add(b["in0"], "inhale_short", -23, 40 + k)
        elif kind == "jog":
            add(b["ex0"], "exhale", -17, 40 + k)
        elif kind == "end" or (kind == "calm" and A["right_now"] - 0.5 < b["ex0"] < D - 1.5):
            add(b["ex0"], "exhale", -20 if kind == "calm" else -15, 40 + k)
    add(A["breathe_out"] + 0.05, "shimmer", -15, 6)
    add(A["breathe_out_e"] + 0.05, "chime", -13, 1)
    # ---- survey
    add(A["survey"] - 0.25, "whoosh_long", -16, 7)
    for k, key in enumerate(("doctors", "dietitians", "trainers")):
        add(A[key] - 0.05, "pop", -14, 30 + k)
    add(A["where"] - 0.05, "pop", -15, 34)
    add(A["only"] + 0.2, "dim", -13, 8)
    for k in range(3):
        add(A["three"] - 0.12 + 0.11 * k, "chime", -19 - k, 2 + k)
    # ---- into the fat: the molecule
    add(A["right_e"] + 0.15, "whoosh", -11, 9)
    add(A["atoms"] + 0.28, "whoomp", -13, 1)
    add(A["atoms"] + 0.5, "glass", -15, 1)
    add(A["carbon"] - 0.05, "blipC", -19, 1)
    add(A["hydrogen"] - 0.05, "blipH", -19, 2)
    add(A["oxygen"] - 0.05, "blipO", -19, 3)
    add(A["energy"] - 0.6, "swirl", -15, 4)
    add(A["breaks"], "burst", -9, 1)
    add(A["with_oxygen"] - 0.2, "swirl", -16, 5)
    add(A["pieces"] + 0.05, "snaps", -12, 2)
    add(A["gas"] - 0.2, "rise", -14, 3)
    add(A["water"] - 0.2, "snaps_w", -14, 4)
    add(A["water"] + 0.4, "bubbles", -16, 5)
    add(A["which"] + 0.2, "whoosh_fast", -14, 10)
    add(A["numbers"] - 0.6, "whoosh_fast", -17, 13)
    # ---- water on the body
    for k, key in enumerate(("sweat2", "tears", "pee")):
        add(A[key] + 0.1, "drip", -14, 50 + k)
        add(A[key] + 0.25, "drip", -19, 60 + k)
    # ---- 10 kg
    add(A["numbers"] + 0.2, "whoosh_fast", -16, 12)
    add(A["ten"] - 0.05, "thud", -15, 1)
    add(A["ten"] + 0.05, "blorp", -15, 2)
    add(A["eight"] - 0.05, "sizzle", -13, 1)
    add(A["eight"] + 0.2, "shimmer_long", -14, 7)
    add(A["one6"] + 0.1, "slosh", -12, 1)
    # ---- the twist
    add(A["wont"] + 0.1, "xstamp", -11, 4)
    add(A["burns"] - 0.1, "shimmer", -16, 8)
    # strides: one foot down every half stride while jogging
    t = J["t0"] + 0.25
    k = 0
    while t < J["t1"] - 0.1:
        w = min(1.0, (t - J["t0"]) / max(J["full"] - J["t0"], 1e-3)) * (1 if t < J["out0"] else max(0, 1 - (t - J["out0"]) / (J["t1"] - J["out0"])))
        if w > 0.2:
            add(t, "step", -20 + 6 * w, 70 + k % 6)
        t += 1 / (2 * J["hz"])
        k += 1
    add(A["moveW_e"] + 0.02, "chime", -15, 6)
    add(A["dizzy"] + 0.15, "dizzy", -18, 1)
    # ---- the end: back into the lump, and round again
    add(A["breathe_out3"] + 0.4, "whoosh_long", -16, 11)
    add(D - 0.15, "blorp", -14, 1)            # the same jiggle the video starts with (heard across the loop)
    return sorted(c)


def render_track(total_s: float) -> np.ndarray:
    out = np.zeros(int((total_s + 6) * SR), np.float32)
    cache: dict = {}
    for t0, name, gain_db, seed in cue_sheet():
        key = (name, seed)
        if key not in cache:
            cache[key] = SOUNDS[name](seed).astype(np.float32)
        snd = cache[key] * 10 ** (gain_db / 20)
        i = int(round(t0 * SR))
        j = min(len(out), i + len(snd))
        if i < 0:
            snd, i = snd[-i:], 0
        if j > i:
            out[i:j] += snd[: j - i]
    return out[: int(total_s * SR)]


if __name__ == "__main__":
    import soundfile as sf
    d = json.loads(SCENE.read_text())
    x = render_track(d["duration"])
    (ROOT / "audio").mkdir(exist_ok=True)
    sf.write(ROOT / "audio" / "sfx_preview.wav", x, SR)
    print(f"  sfx: {len(cue_sheet())} cues, peak {np.abs(x).max():.2f}")
