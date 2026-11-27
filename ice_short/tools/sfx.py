"""
tools/sfx.py -- synthesized sound effects (numpy/scipy only, no samples) and the cue sheet that places them.

Everything is placed on the measured word times (renders/cache/scene.json "anchors") and on the cut list ("shots").
Beds (the sea, the harbour crowd, the hold's creaks, the winter wind) follow the shots; events land on their words.

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


# ---------------------------------------------------------------- shared effects (from the earlier Shorts)
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



# ---------------------------------------------------------------- the desert, the tomb, the lab
def wind(seed=1, dur=4.0):
    """Desert wind: soft band noise that gusts."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 180, 1400) + 0.4 * _bp(r.normal(0, 1, n), 1500, 4000)
    g = 0.6 + 0.4 * np.sin(2 * np.pi * t / dur * 2 + 1) * np.sin(2 * np.pi * t / dur * 3)
    return _norm(x * g, 0.3)


def drag(seed=1, dur=4.0, grit=1.0):
    """A wooden sled dragged over sand: a low rough hiss with grainy crackle, pulsing with the pulls."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    hiss = _bp(r.normal(0, 1, n), 120, 900)
    crack = _bp((r.random(n) > 0.995) * r.normal(0, 1, n), 1200, 5000) * 3 * grit
    return _norm(hiss + crack, 0.35)


def footstep_sand(seed=1):
    """A bare foot on sand: a soft low thump and a short crunchy scuff."""
    r = np.random.default_rng(seed)
    n, t = _t(0.22)
    body = np.sin(_glide(95, 55, t, 0.02)) * _env(t, 0.002, 0.04)
    crunch = _bp(r.normal(0, 1, n), 1200, 5000) * _env(t, 0.004, 0.035) * (0.5 + 0.5 * (r.random(n) > 0.6))
    return _fade(_norm(body + 0.7 * crunch, 0.4))


def pour(seed=1, dur=3.0, big=1.0):
    """Water poured from a jar onto sand: a burbling trickle (many tiny bubbles) over a soft splash hiss."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = _bp(r.normal(0, 1, n), 600, 3500) * 0.25 * big
    m = int(0.05 * SR)
    tt = np.arange(m) / SR
    for _ in range(int(dur * 70 * big)):
        i = int(r.uniform(0, n - m))
        f0 = r.uniform(500, 1600) / (0.7 + 0.3 * big)
        out[i:i + m] += np.sin(_glide(f0, f0 * 1.8, tt, 0.012)) * np.exp(-tt / 0.012) * r.uniform(0.2, 0.8)
    env = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.3)
    return _fade(_norm(out * env, 0.4))


def brush(seed=1, dur=0.35):
    """A broad brush stroke on plaster: a dry bristly swish."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 1500, 7000) * (0.7 + 0.3 * (r.random(n) > 0.5))
    env = np.sin(np.pi * t / dur) ** 1.5
    return _fade(_norm(x * env, 0.35))


def crackle(seed=1, dur=4.0):
    """A torch: low roar and pops."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    roar = _lp(r.normal(0, 1, n), 400) * (0.7 + 0.3 * np.sin(2 * np.pi * 3.1 * t))
    pops = _bp((r.random(n) > 0.9993) * r.normal(0, 1, n), 1500, 7000) * 8
    return _norm(roar + pops, 0.3)


def tick(seed=1):
    r = np.random.default_rng(seed)
    n, t = _t(0.03)
    return _fade(_norm(_bp(r.normal(0, 1, n), 2500, 7000) * _env(t, 0.0005, 0.005), 0.3), 0.005)


def clap(seed=1):
    """One hand clap (the man on the statue's knee keeps the rhythm)."""
    r = np.random.default_rng(seed)
    n, t = _t(0.15)
    x = _bp(r.normal(0, 1, n), 900, 3500) * (_env(t, 0.0005, 0.012) + 0.6 * _env(np.maximum(t - 0.006, 0), 0.0005, 0.02))
    return _fade(_norm(x, 0.45))


def stone(seed=1):
    """A heavy stone settling: a deep thud with a gritty crunch."""
    r = np.random.default_rng(seed)
    n, t = _t(1.2)
    boom = np.sin(_glide(70, 38, t, 0.1)) * _env(t, 0.003, 0.35)
    grit = _bp(r.normal(0, 1, n), 300, 2500) * _env(t, 0.002, 0.08) * 0.6
    return _fade(_norm(boom + grit, 0.6))


def boom(seed=1):
    """A big low hit with an airy tail (HOW?, 2,000,000+)."""
    r = np.random.default_rng(seed)
    n, t = _t(2.0)
    b = np.sin(_glide(80, 36, t, 0.15)) * _env(t, 0.004, 0.6)
    air = _lp(r.normal(0, 1, n), 1200) * _env(t, 0.01, 0.4) * 0.4
    return _fade(_norm(b + air, 0.6))


def hum(seed=1, dur=4.0):
    """A quiet lab: mains hum and a little air."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = 0.4 * np.sin(2 * np.pi * 100 * t) + 0.15 * np.sin(2 * np.pi * 200 * t) + _bp(r.normal(0, 1, n), 300, 2500) * 0.6
    return _norm(x, 0.25)


def motor(seed=1, dur=3.0, f=180.0):
    """The motor stage pulling: a whine with gear ripple."""
    n, t = _t(dur)
    x = np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 37 * t)) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    env = np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.2)
    return _fade(_norm(_bp(x, 100, 3000) * env, 0.3))


def scrape(seed=1, dur=3.0, jerky=1.0, smooth=0.0):
    """The model sled on sand: dry = gritty stick-slip scrapes; smooth = a soft even hiss."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    g = _bp(r.normal(0, 1, n), 1500, 7000)
    stick = 0.35 + 0.65 * (np.sin(2 * np.pi * 1.1 * t) > 0.2) * jerky + (1 - jerky) * 0.5
    grit = _bp((r.random(n) > 0.99) * r.normal(0, 1, n), 2500, 8000) * 3 * jerky
    soft = _bp(r.normal(0, 1, n), 400, 2500) * smooth
    env = np.minimum(1, t / 0.1) * np.minimum(1, (dur - t) / 0.2)
    return _fade(_norm((g * stick * (1 - smooth) + grit + soft) * env, 0.35))


def squelch(seed=1, dur=0.8):
    """Mud: a wet sucking squelch."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _lp(r.normal(0, 1, n), 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * (6 + 10 * t) * t))
    g = np.sin(_glide(140, 70, t, 0.2)) * 0.5
    return _fade(_norm((x + g) * _env(t, 0.02, 0.25), 0.45))


def click(seed=1, dur=1.2, count=40):
    """Dry grains knocking together: tiny glassy clicks."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    m = int(0.01 * SR)
    for _ in range(count):
        i = int(r.uniform(0, n - m))
        out[i:i + m] += _bp(r.normal(0, 1, m), 3000, 9000) * np.exp(-np.arange(m) / (0.001 * SR)) * r.uniform(0.2, 1)
    return _fade(_norm(out, 0.35))


def tone(seed=1, f=440.0, dur=0.6):
    n, t = _t(dur)
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * _env(t, 0.003, 0.2)
    return _fade(_norm(x, 0.35))




# ---------------------------------------------------------------- the Ice King's own effects
def waves(seed=1, dur=8.0, big=1.0):
    """The sea along a hull: a low wash breathing with the swell, and splashes on top."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _lp(r.normal(0, 1, n), 700) * (0.55 + 0.45 * np.sin(2 * np.pi * (0.13 + 0.03 * big) * t + seed) ** 2)
    hiss = _bp(r.normal(0, 1, n), 1500, 6000) * (0.2 + 0.8 * np.maximum(0, np.sin(2 * np.pi * 0.21 * t + seed * 2)) ** 3)
    low = _lp(r.normal(0, 1, n), 160) * 1.4 * big
    env = np.minimum(1, np.minimum(t, dur - t) / 0.6)
    return _norm((x + 0.35 * hiss + low) * env, 0.45)


def lap(seed=1, dur=6.0):
    """Harbour water lapping against posts: soft irregular slaps."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = _lp(r.normal(0, 1, n), 400) * 0.25
    for k in range(int(dur * 2.2)):
        i = int(r.uniform(0, dur - 0.3) * SR); m = int(0.25 * SR); tt = np.arange(m) / SR
        out[i:i + m] += _bp(r.normal(0, 1, m), 250, 1600) * _env(tt, 0.01, 0.06) * r.uniform(0.3, 1)
    env = np.minimum(1, np.minimum(t, dur - t) / 0.5)
    return _norm(out * env, 0.35)


def creak(seed=1):
    """Ship's timbers: a stick-slip pulse train sweeping through a wooden resonance."""
    r = np.random.default_rng(seed)
    n, t = _t(0.9)
    f = 28 + 30 * np.sin(np.pi * t / 0.9) + r.uniform(-4, 4)
    ph = np.cumsum(f) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    x = np.zeros(n)
    for lo, hi, g in [(300, 520, 1.0), (700, 1100, 0.5), (1600, 2400, 0.2)]:
        x += _bp(pulses * r.uniform(0.6, 1.0, n), lo, hi, 2) * g
    return _fade(_norm(x * np.sin(np.pi * t / 0.9), 0.4))


def gull(seed=1):
    """A gull: two or three falling calls with harmonics and a rasp."""
    r = np.random.default_rng(seed)
    n, t = _t(1.3)
    out = np.zeros(n)
    for k in range(2 + seed % 2):
        i = int((0.05 + k * 0.33) * SR); m = int(0.28 * SR); tt = np.arange(m) / SR
        f0 = r.uniform(1500, 1900)
        ph = _glide(f0, f0 * 0.62, tt, 0.12) + 0.3 * np.sin(2 * np.pi * 32 * tt)
        s = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)
        out[i:i + m] += s * _env(tt, 0.02, 0.1) * (1 - 0.3 * k)
    return _fade(_norm(_bp(out, 700, 6000), 0.3))


def flap(seed=1):
    """Canvas taking the wind: two soft thumps of air."""
    r = np.random.default_rng(seed)
    n, t = _t(0.7)
    x = np.zeros(n)
    for k, d in enumerate((0.0, 0.18)):
        i = int(d * SR); m = n - i; tt = np.arange(m) / SR
        x[i:] += _lp(r.normal(0, 1, m), 500) * _env(tt, 0.005, 0.05) * (1 - 0.4 * k)
    return _fade(_norm(x, 0.4))


def _formant_voice(r, n, f0, formants, rate, jitter=0.03):
    t = np.arange(n) / SR
    f = f0 * (1 + jitter * np.sin(2 * np.pi * r.uniform(3, 6) * t + r.uniform(0, 6)))
    ph = np.cumsum(f) / SR
    src = 2 * (ph % 1) - 1                                   # a sawtooth glottal source
    x = np.zeros(n)
    for fc, bw, g in formants:
        x += _bp(src, fc - bw / 2, fc + bw / 2) * g
    return x


def laughs(seed=1, dur=2.0, voices=7):
    """A crowd laughing: several voices of "ha-ha-ha" (vowel formants, bursts at 5-7 Hz)."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    for v in range(voices):
        f0 = r.uniform(110, 300)
        x = _formant_voice(r, n, f0, [(800, 300, 1.0), (1250, 300, 0.6), (2600, 500, 0.25)], 6)
        rate = r.uniform(4.5, 6.5); on = r.uniform(0.0, 0.25)
        burst = np.maximum(0, np.sin(2 * np.pi * rate * (t - on))) ** 2 * (t > on)
        breath = _bp(r.normal(0, 1, n), 1200, 5000) * 0.15
        shape = np.exp(-np.maximum(0, t - on) / r.uniform(0.9, 1.6)) * np.minimum(1, (t - on).clip(0) / 0.05)
        out += (x + breath) * burst * shape * r.uniform(0.5, 1.0)
    return _fade(_norm(out, 0.45), 0.2)


def murmur(seed=1, dur=6.0, vowel="a"):
    """A crowd talking: many voices, vowels drifting, no words."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    for v in range(10):
        f0 = r.uniform(100, 240)
        F1 = r.uniform(400, 800); F2 = r.uniform(1000, 1900)
        x = _formant_voice(r, n, f0, [(F1, 250, 1.0), (F2, 350, 0.5)], 4, 0.08)
        syl = 0.5 + 0.5 * np.sin(2 * np.pi * r.uniform(3, 5) * t + r.uniform(0, 6))
        out += x * syl * r.uniform(0.3, 1.0)
    env = np.minimum(1, np.minimum(t, dur - t) / 0.6)
    return _norm(_lp(out, 3000) * env, 0.3)


def ooh(seed=1, dur=1.8):
    """A crowd's "ooh": a rounded vowel swelling and gliding up."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    for v in range(9):
        f0 = r.uniform(120, 280) * (1 + 0.12 * np.minimum(1, t / 0.6))
        ph = np.cumsum(f0 * (1 + 0.02 * np.sin(2 * np.pi * 5 * t + v))) / SR
        src = 2 * (ph % 1) - 1
        x = _bp(src, 250, 450) + 0.5 * _bp(src, 700, 1000)
        out += x * r.uniform(0.5, 1.0)
    env = np.sin(np.pi * np.minimum(1, t / dur)) ** 0.8
    return _fade(_norm(out * env, 0.4))


def scratch(seed=1, dur=2.0):
    """A pen nib on paper: grainy strokes."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 2500, 7000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 2.3 * t + seed))) * (r.random(n) < 0.6)
    env = np.minimum(1, np.minimum(t, dur - t) / 0.08)
    return _norm(x * env, 0.25)


def rustle(seed=1, dur=0.9):
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    crinkle = (r.random(n) < 0.02) * r.normal(0, 1, n)
    x = _bp(r.normal(0, 1, n), 1500, 8000) * 0.3 + _bp(crinkle, 2000, 9000) * 3
    return _fade(_norm(x * np.sin(np.pi * t / dur) ** 0.6, 0.35))


def clang(seed=1):
    """An iron door slamming: inharmonic partials, a long ring."""
    r = np.random.default_rng(seed)
    n, t = _t(2.4)
    x = np.zeros(n)
    for k, ratio in enumerate([1.0, 2.32, 3.17, 4.81, 6.3, 8.9]):
        x += np.sin(2 * np.pi * 180 * ratio * t + r.uniform(0, 6)) * np.exp(-t / (0.9 / (1 + k * 0.6))) / (1 + k * 0.4)
    hit = _lp(r.normal(0, 1, n), 2000) * _env(t, 0.001, 0.03) * 2
    thump = np.sin(2 * np.pi * 70 * t) * _env(t, 0.002, 0.12) * 1.5
    return _fade(_norm(x + hit + thump, 0.55))


def icecrack(seed=1):
    """Ice cracking: a sharp snap and the springy "pew" of a crack running."""
    r = np.random.default_rng(seed)
    n, t = _t(0.8)
    snap = _hp(r.normal(0, 1, n), 1500) * _env(t, 0.0005, 0.008) * 2
    pew = np.sin(_glide(3600, 600, t, 0.08)) * _env(t, 0.002, 0.18) * 0.6
    body = _bp(r.normal(0, 1, n), 200, 900) * _env(t, 0.002, 0.05)
    return _fade(_norm(snap + pew + body, 0.5))


def clunk(seed=1):
    """A block of ice set down on wood / on ice."""
    r = np.random.default_rng(seed)
    n, t = _t(0.5)
    knock = np.sin(2 * np.pi * r.uniform(110, 150) * t) * _env(t, 0.001, 0.07)
    crisp = _bp(r.normal(0, 1, n), 1500, 6000) * _env(t, 0.0005, 0.015) * 0.6
    ring = np.sin(2 * np.pi * r.uniform(1700, 2300) * t) * _env(t, 0.001, 0.05) * 0.15
    return _fade(_norm(knock + crisp + ring, 0.5))


def sawstroke(seed=1, dur=1.6):
    """An ice saw: rough strokes back and forth."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    stroke = np.abs(np.sin(2 * np.pi * 1.6 * t)) ** 0.7
    x = _bp(r.normal(0, 1, n), 1800, 5500) * stroke * (0.6 + 0.4 * np.sin(2 * np.pi * 90 * t) ** 2)
    return _fade(_norm(x * np.minimum(1, t / 0.05), 0.35))


def bell(seed=1):
    """The ship's bell: two strikes."""
    n, t = _t(3.0)
    x = np.zeros(n)
    for d in (0.0, 0.42):
        i = int(d * SR); tt = t[: n - i]
        s = sum(np.sin(2 * np.pi * 620 * r * tt) * np.exp(-tt / (2.2 / (1 + k))) / (1 + k) for k, r in enumerate([1.0, 2.4, 2.98, 4.2, 5.4]))
        x[i:] += s * _env(tt, 0.001, 9)
    return _fade(_norm(x, 0.4))


def hammer(seed=1, dur=1.8, count=16):
    """Builders at work, sped up: hammer taps and knocks."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    for k in range(count):
        i = int(r.uniform(0, dur - 0.15) * SR); m = int(0.12 * SR); tt = np.arange(m) / SR
        f = r.uniform(600, 1400)
        out[i:i + m] += (np.sin(2 * np.pi * f * tt) * 0.5 + _bp(r.normal(0, 1, m), 1000, 5000)) * _env(tt, 0.0005, 0.02) * r.uniform(0.4, 1)
    return _fade(_norm(out, 0.4))


def clink(seed=1):
    """An ice cube dropping into a glass: the clink, a ring, a little splash."""
    r = np.random.default_rng(seed)
    n, t = _t(1.6)
    x = np.zeros(n)
    for f, g, d in [(2640, 1.0, 0.5), (4170, 0.6, 0.35), (5920, 0.35, 0.25), (7350, 0.2, 0.18)]:
        x += np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * np.exp(-t / d) * g
    tick = _hp(r.normal(0, 1, n), 3000) * _env(t, 0.0003, 0.004)
    i = int(0.03 * SR); m = n - i; tt = np.arange(m) / SR
    splash = np.zeros(n); splash[i:] = _bp(r.normal(0, 1, m), 900, 5000) * _env(tt, 0.003, 0.08) * 0.5
    return _fade(_norm(x * _env(t, 0.0005, 3) + tick + splash, 0.5))


def fizz(seed=1, dur=2.0):
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    pops = (r.random(n) < 0.004) * r.normal(0, 1, n)
    x = _hp(pops, 3000) + _bp(r.normal(0, 1, n), 4000, 9000) * 0.05
    return _norm(x * np.exp(-t / (dur * 0.6)) * np.minimum(1, t / 0.05), 0.2)


def hiss(seed=1, dur=3.0):
    """Sawdust pouring: a soft dry rush."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 400, 3000) * (0.8 + 0.2 * np.sin(2 * np.pi * 3 * t)) + _hp((r.random(n) < 0.01) * r.normal(0, 1, n), 2500) * 0.4
    env = np.minimum(1, np.minimum(t, dur - t) / 0.2)
    return _norm(x * env, 0.3)


def slide(seed=1, dur=0.8):
    """Hatch boards sliding open."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 300, 1800) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t)) * np.sin(np.pi * t / dur)
    return _fade(_norm(x, 0.35))


SOUNDS = {name: fn for name, fn in globals().items() if callable(fn) and not name.startswith("_") and name not in
          ("butter", "sosfilt", "render_track", "cue_sheet", "Path")}


def cue_sheet() -> list:
    """[t, sound, dB, seed, kwargs] for every effect."""
    d = json.loads(SCENE.read_text())
    A, D = d["anchors"], d["duration"]
    cuts = {n: t for n, t in d["shots"]["cuts"]}
    names = [n for n, _ in d["shots"]["cuts"]]
    end_of = {n: (d["shots"]["cuts"][i + 1][1] if i + 1 < len(names) else D) for i, n in enumerate(names)}
    C = []
    add = lambda t, name, db=0.0, seed=1, **kw: C.append([t, name, db, seed, kw])
    # ---- beds: the sea (the hook and the glass run straight into each other across the loop)
    add(0.0, "waves", -3, 1, dur=cuts["laugh"] + 0.4)
    add(cuts["glass"] + 1.2, "waves", -4, 2, dur=D - cuts["glass"] - 1.2 + 0.6)
    for k, s in enumerate(("laugh", "tudor", "dockMelt", "race")):
        add(cuts[s], "lap", -9, 3 + k, dur=end_of[s] - cuts[s] + 0.3)
    add(cuts["tuscany"], "waves", 0, 7, dur=end_of["tuscany"] - cuts["tuscany"] + 0.3, big=1.6)
    add(cuts["calcutta"], "lap", -10, 9, dur=end_of["crown"] - cuts["calcutta"] + 0.3)
    add(cuts["laugh"], "murmur", -12, 1, dur=end_of["laugh"] - cuts["laugh"] + 0.2)
    add(cuts["tudor"], "murmur", -16, 2, dur=end_of["tudor"] - cuts["tudor"] + 0.2)
    add(cuts["dockMelt"], "murmur", -18, 3, dur=2.4)
    add(cuts["calcutta"], "murmur", -13, 4, dur=end_of["house"] - cuts["calcutta"] + 0.3)
    # the ship: creaks, gulls, sails
    for t0, s in [(1.0, 1), (3.9, 2), (cuts["holdMelt"] + 0.3, 3), (cuts["holdMelt"] + 1.6, 4), (cuts["pack"] + 0.2, 5),
                  (cuts["tuscany"] + 1.5, 6), (cuts["tuscany"] + 4.8, 7), (cuts["voyage"] + 0.2, 8), (cuts["arrive"] + 0.4, 9), (D - 2.2, 10)]:
        add(t0, "creak", -8, s)
    for t0, s in [(0.9, 1), (5.2, 2), (cuts["laugh"] + 1.0, 3), (cuts["dockMelt"] + 2.5, 4), (cuts["arrive"] + 1.4, 5), (cuts["calcutta"] + 0.6, 6), (D - 1.4, 7)]:
        add(t0, "gull", -10, s)
    add(2.2, "flap", -9, 1); add(cuts["tuscany"] + 0.8, "flap", -6, 2); add(cuts["tuscany"] + 3.4, "flap", -7, 3)
    # ---- the hook
    add(A["frozen"], "icecrack", -6, 1)
    add(A["tropical"] - 0.6, "whoosh", -6, 1)
    add(A["laughed"] - 0.05, "laughs", 0, 1, dur=1.9)
    add(A["laughed"] + 0.25, "laughs", -6, 2, dur=1.4, voices=5)
    # ---- the globe: a whoosh in, the pen drawing the route, a pin
    add(cuts["globe1"] - 0.25, "whoosh", -4, 2)
    add(A["later"], "scratch", -6, 1, dur=A["india0"] - A["later"] + 0.2)
    add(A["india0"], "pop", -4, 1)
    # ---- Tudor, the Gazette
    add(A["name"] + 0.1, "chime", -14, 1)
    add(cuts["paper"] - 0.1, "rustle", -2, 1)
    add(A["slippery"] - 0.05, "scratch", -4, 2, dur=A["plan_e"] - A["slippery"] + 0.3)
    # ---- melting on the way, nowhere to store it, the loss
    for k in range(9):
        add(cuts["holdMelt"] + 0.15 + k * 0.29, "drip", -8 - (k % 3) * 2, k + 1)
    add(cuts["holdMelt"] + 0.4, "slosh", -8, 1)
    add(A["martinique"], "sizzle", -14, 1)
    add(A["nowhere"] - 0.1, "dim", -6, 1)
    for k in range(6):
        add(A["martinique"] + 0.6 + k * 0.5, "drip", -12, k + 20)
    add(A["thousands"] - 0.15, "xstamp", -2, 1)
    # ---- prison
    add(cuts["prison"] + 0.05, "clang", -2, 1)
    add(A["prison"] - 0.05, "boom", -8, 1)
    add(cuts["prison"] + 1.6, "drip", -12, 31); add(cuts["prison"] + 3.1, "drip", -13, 32)
    add(A["still"] - 0.3, "rise", -8, 1)
    # ---- the race: time-lapse ticks, drips, the small pieces gone
    for k in range(int((A["small_e"] + 0.4 - A["melts"]) / 0.18)):
        add(A["melts"] - 0.2 + k * 0.18, "tick", -14, k + 1)
    for k in range(5):
        add(A["melts"] + k * 0.42, "drip", -12, k + 40)
    add(A["small_e"] + 0.15, "chime", -6, 2)
    # ---- the pond, the packing
    add(cuts["pond"], "wind", -8, 1, dur=end_of["pond"] - cuts["pond"] + 0.4)
    add(cuts["pond"] + 0.05, "sawstroke", -6, 1, dur=1.5)
    add(A["square"] - 0.05, "icecrack", -3, 2)
    for k in range(10):
        add(A["packed"] - 0.2 + k * 0.11 + 0.03 * (k % 2), "clunk", -6 - (k % 3) * 2, k + 1)
    add(A["buried"] - 0.2, "hiss", -6, 1, dur=A["away"] - A["buried"] + 0.8)
    # ---- 1833: the bell, the voyage, the equator, the arrival
    add(A["y1833"] - 0.05, "bell", -4, 1)
    add(cuts["voyage"], "whoosh", -8, 3)
    for k in range(10):
        add(A["four"] - 0.1 + k * 0.13, "tick", -12, k + 50)
    add(cuts["globe2"] - 0.2, "whoosh", -6, 4)
    add(A["crossing"], "scratch", -8, 3, dur=end_of["globe2"] - A["crossing"])
    add(A["equator"] + 0.02, "chime", -4, 3)
    add(A["twice"] + 0.02, "chime", -3, 4, f0=1318.5)
    add(A["t100"] - 0.1, "chime", -6, 5, f0=880.0)
    add(A["stillf"] - 0.4, "slide", -6, 1)
    # ---- Calcutta: the crowd, the ice house, the crown
    add(A["amazed"] - 0.25, "ooh", -2, 1)
    add(A["built"], "hammer", -8, 1, dur=A["forice_e"] - A["built"] + 0.2)
    add(A["forice_e"] + 0.1, "whoomp", -8, 1)
    add(A["known"] - 0.3, "shimmer", -6, 1, dur=2.0)
    add(A["iceking"] - 0.05, "chime", -3, 6)
    # ---- the glass
    add(A["clink"] - 0.05, "clink", 0, 1)
    add(A["clink"] + 0.1, "fizz", -10, 1, dur=2.4)
    add(A["trip"] - 0.5, "whoosh", -10, 5)
    return C


def render_track(total_s: float) -> np.ndarray:
    """All cues; whatever rings past the end wraps round onto the start (the video loops)."""
    n = int(total_s * SR)
    out = np.zeros(n + 8 * SR, np.float32)
    cache: dict = {}
    for t0, name, gain_db, seed, kw in cue_sheet():
        key = (name, seed, tuple(sorted(kw.items())))
        if key not in cache:
            cache[key] = np.asarray(SOUNDS[name](seed, **kw), np.float32)
        snd = cache[key] * 10 ** (gain_db / 20)
        i = int(round(t0 * SR))
        if i < 0:
            snd, i = snd[-i:], 0
        out[i:i + len(snd)] += snd
    tail = out[n:].copy()
    out = out[:n]
    out[: min(n, len(tail))] += tail[:n]
    return out


if __name__ == "__main__":
    import soundfile as sf
    d = json.loads(SCENE.read_text())
    x = render_track(d["duration"])
    (ROOT / "audio").mkdir(exist_ok=True)
    sf.write(ROOT / "audio" / "sfx_preview.wav", x, SR)
    print(f"  sfx: {len(cue_sheet())} cues, peak {np.abs(x).max():.2f}")
