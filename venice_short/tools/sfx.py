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



# ---------------------------------------------------------------- Venice
def pile(seed=1, big=1.0):
    """A wooden post struck by a heavy rammer: a deep woody knock, the post ringing, a squelch of mud underneath."""
    r = np.random.default_rng(seed)
    n, t = _t(1.2)
    knock = np.sin(_glide(150 * big ** -0.3, 62, t, 0.03)) * _env(t, 0.0008, 0.16)
    wood = sum(np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * np.exp(-t / d) * g for f, d, g in [(410, 0.07, 0.6), (690, 0.05, 0.4), (1130, 0.03, 0.25)])
    crack = _bp(r.normal(0, 1, n), 900, 5000) * _env(t, 0.0003, 0.012) * 0.9
    i = int(0.02 * SR); m = n - i; tt = np.arange(m) / SR
    sq = np.zeros(n); sq[i:] = _bp(r.normal(0, 1, m), 120, 700) * _env(tt, 0.01, 0.12) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * tt)) * 0.45
    return _fade(_norm(knock * 1.1 + wood * 0.5 + crack + sq, 0.6))


def pile_rain(seed=1, dur=2.4, count=60, peak_at=0.5):
    """Many posts going in at once: knocks thick in the middle, thinning out."""
    r = np.random.default_rng(seed)
    n, t = _t(dur + 1.2)
    out = np.zeros(n)
    for k in range(count):
        u = np.clip(r.beta(2.2, 2.2 / peak_at - 2.2 + 0.01), 0, 1)
        i = int(u * dur * SR)
        s = pile(int(r.integers(1, 40)), big=r.uniform(0.6, 1.3)) * r.uniform(0.25, 0.8)
        out[i:i + len(s)] += s[: n - i]
    return _fade(_norm(out, 0.6))


def splash(seed=1, big=1.0):
    """Something long plunging into water: a hollow plop and a spray."""
    r = np.random.default_rng(seed)
    n, t = _t(1.0)
    plop = np.sin(_glide(380 * big ** -0.4, 140, t, 0.04)) * _env(t, 0.002, 0.07)
    spray = _bp(r.normal(0, 1, n), 1200, 7000) * _env(t, 0.005, 0.18 * big) * 0.6
    bub = bubbles(seed, dur=1.0, count=8)[:n] * 0.3
    return _fade(_norm(plop + spray + bub, 0.5))


def treefall(seed=1, dur=2.2):
    """A tree going over: the trunk creaking as it leans, a rush of branches, a heavy crash."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    c = creak(seed); out[: len(c)] += c[:n] * 0.8
    rush = _bp(r.normal(0, 1, n), 600, 5000) * np.clip((t - 0.35) / 0.8, 0, 1) ** 2 * np.exp(-np.maximum(t - 1.15, 0) / 0.25)
    out += rush * 0.5
    i = int(1.1 * SR); m = n - i; tt = np.arange(m) / SR
    out[i:] += (np.sin(_glide(90, 40, tt, 0.08)) * _env(tt, 0.002, 0.3) + _lp(r.normal(0, 1, m), 900) * _env(tt, 0.002, 0.2) * 0.8)
    return _fade(_norm(out, 0.6))


def chop(seed=1):
    """An axe or adze biting into wood."""
    r = np.random.default_rng(seed)
    n, t = _t(0.35)
    x = _bp(r.normal(0, 1, n), 700, 4000) * _env(t, 0.0005, 0.02) + np.sin(2 * np.pi * r.uniform(220, 300) * t) * _env(t, 0.001, 0.05) * 0.6
    return _fade(_norm(x, 0.5))


def crumble(seed=1, dur=1.6):
    """Rotten wood giving way: soft crackles and a crumbling hiss."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = crackle(seed, dur=dur)[:n] * 0.7 + _bp(r.normal(0, 1, n), 300, 2500) * 0.25 * np.sin(np.pi * t / dur)
    return _fade(_norm(x, 0.45))


def underwater(seed=1, dur=4.0):
    """Being under the water: a muffled low rumble with slow swells and a few soft bubbles."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _lp(r.normal(0, 1, n), 220) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.31 * t + 1)) * 3
    x += bubbles(seed + 5, dur=dur, count=int(dur * 1.5))[:n] * 0.08
    env = np.minimum(1, np.minimum(t, dur - t) / 0.35)
    return _norm(x * env, 0.4)


def bird(seed=1):
    """A small garden bird: two or three quick chirps."""
    r = np.random.default_rng(seed)
    n, t = _t(0.7)
    out = np.zeros(n)
    for k in range(int(r.integers(2, 4))):
        i = int((0.02 + k * r.uniform(0.11, 0.16)) * SR); m = int(0.08 * SR); tt = np.arange(m) / SR
        f0 = r.uniform(3200, 4200)
        out[i:i + m] += np.sin(_glide(f0, f0 * r.uniform(1.15, 1.4), tt, 0.02)) * np.sin(np.pi * tt / 0.08) ** 2
    return _fade(_norm(out, 0.3))


def churchbell(seed=1, f0=233.0, strikes=2, gap=1.1):
    """A big church bell: a low hum note, a strike tone, minor-third partials, a long ring."""
    n, t = _t(5.5)
    x = np.zeros(n)
    for s in range(strikes):
        i = int(s * gap * SR); tt = t[: n - i]
        tone = sum(np.sin(2 * np.pi * f0 * k * tt + k) * np.exp(-tt / d) * g
                   for k, d, g in [(0.5, 4.0, 0.6), (1.0, 3.0, 1.0), (1.2, 2.2, 0.5), (1.5, 1.8, 0.35), (2.0, 1.5, 0.5), (2.6, 0.9, 0.25), (3.0, 0.7, 0.2)])
        x[i:] += tone * _env(tt, 0.001, 30)
    return _fade(_norm(x, 0.45), 0.4)


SOUNDS = {name: fn for name, fn in globals().items() if callable(fn) and not name.startswith("_") and name not in
          ("butter", "sosfilt", "render_track", "cue_sheet", "Path")}



def cue_sheet() -> list:
    """[t, sound, dB, seed, kwargs] for every effect."""
    d = json.loads(SCENE.read_text())
    A, D = d["anchors"], d["duration"]
    C = []
    add = lambda t, name, db=0.0, seed=1, **kw: C.append([t, name, db, seed, kw])
    cut = {"lagoon": A["because"] + 0.05, "forest": A["so1"] - 0.05, "rig": A["hammer2"] - 0.3, "top": A["between"] - 0.4,
           "build": A["then"] - 0.15, "salute": A["this_church"], "fence": A["wood_rots"] - 0.3, "secret": A["down"] - 0.25,
           "cells": A["bacteria"] - 0.35, "hold": A["keeps"] - 0.25, "finale": A["under"] - 0.2}
    # ---- beds: the canal lapping (it runs across the loop seam), under water, the garden, the microscope
    add(-0.5, "lap", -8, 1, dur=cut["lagoon"] + 1.0)
    add(cut["lagoon"], "lap", -10, 2, dur=A["no_rock"] - cut["lagoon"])
    add(A["no_rock"] - 0.3, "underwater", -6, 1, dur=cut["forest"] - A["no_rock"] + 0.5)
    add(cut["forest"], "wind", -14, 1, dur=cut["rig"] - cut["forest"])
    add(cut["rig"], "lap", -9, 3, dur=cut["salute"] - cut["rig"] + A["standing"] - A["this_church"])
    add(A["standing"] + 0.2, "underwater", -5, 2, dur=cut["fence"] - A["standing"])
    add(cut["fence"], "wind", -16, 2, dur=cut["secret"] - cut["fence"] + 0.2)
    for k, dt in enumerate((0.4, 1.9, 3.6, 5.2)):
        add(cut["fence"] + dt, "bird", -14, k + 1)
    add(cut["secret"], "lap", -10, 4, dur=1.6)
    add(cut["secret"] + 1.0, "underwater", -5, 3, dur=cut["cells"] - cut["secret"])
    add(cut["cells"], "hum", -14, 1, dur=cut["hold"] - cut["cells"] + 0.2)
    add(cut["hold"], "underwater", -6, 4, dur=cut["finale"] - cut["hold"] + 1.5)
    add(cut["finale"] + 1.0, "lap", -8, 5, dur=D - cut["finale"] - 0.5)
    add(1.2, "gull", -16, 1); add(D - 3.4, "gull", -17, 2)
    # ---- the hook
    add(A["millions"] - 0.1, "shimmer", -12, 1, dur=1.4)
    add(A["hammered"] + 0.05, "pile_rain", -2, 1, dur=0.6, count=16, peak_at=0.5)
    add(A["hammered"] + 0.03, "pile", -4, 2)
    add(A["thousand"], "whoomp", -10, 1)
    add(A["rotted"] - 0.25, "crumble", -4, 1, dur=1.4)
    add(A["rotted"] + 0.1, "creak", -6, 3); add(A["rotted"] + 0.5, "boom", -8, 1)
    add(A["rotted"] + 0.3, "drag", -12, 1, dur=1.2)
    add(A["but"] - 0.08, "rewind", -3, 1, dur=0.5)
    add(A["holding"] - 0.1, "rise", -10, 1, dur=1.0)
    add(A["holding"] + 0.2, "chime", -14, 1)
    # ---- the lagoon: time runs back, the city un-builds, the marsh, the huts, no rock, soft mud
    add(A["because"] - 0.1, "rewind", -4, 2, dur=0.9)
    add(A["because"] + 0.4, "whoosh", -8, 1, dur=1.2)
    add(A["islands"] - 0.4, "rustle", -12, 1)
    for k in range(6):
        add(A["built1"] + k * 0.13, "hammer", -14, k + 1, dur=0.5, count=4)
    add(A["no_rock"], "dim", -6, 1)
    add(A["no_rock"] + 0.1, "xstamp", -9, 1)
    add(A["soft"] + 0.4, "squelch", -3, 1); add(A["sticky"] + 0.15, "squelch", -4, 2)
    # ---- the forest felled, sharpened, flipped, hammered in
    add(A["cut"] - 0.05, "chop", -6, 1); add(A["cut"] + 0.18, "chop", -7, 2); add(A["cut"] + 0.4, "chop", -8, 3)
    for k in range(5):
        add(A["forests"] - 1.15 + k * 0.2, "treefall", -4 - k, k + 1)
    add(A["forests"] + 0.75, "boom", -8, 2)
    for k in range(8):
        add(A["sharpened"] - 0.05 + k * 0.13, "chop", -8 - (k % 3) * 2, k + 10)
    add(A["posts1"] - 0.2, "whoosh", -6, 2, dur=0.9)
    rig = [A["hammer2"] + 0.6 * k for k in range(4)]
    for k, b in enumerate(rig):
        add(b, "pile", 0, 30 + k, big=1.3)
        add(b + 0.005, "splash", -12, k + 1, big=0.6)
        add(b - 0.45, "creak", -16, 10 + k)
    add(A["hammer2"] - 0.15, "pile_rain", -5, 3, dur=2.3, count=70, peak_at=0.45)
    for k in range(6):
        add(A["hammer2"] - 0.2 + k * 0.33, "splash", -10 - k, 10 + k)
    add(A["packed"] - 0.05, "squelch", -4, 3); add(A["packed"] + 0.1, "thud", -6, 1)
    for k in range(7):
        add(A["then"] + 0.05 + k * 0.1, "clunk", -9 - (k % 2) * 3, k + 1)
    for k in range(6):
        add(A["stone"] - 0.35 + k * 0.14, "stone", -8 - k, k + 1)
    add(A["stone"] + 0.1, "rise", -8, 2, dur=1.5)
    add(A["this_church"] + 0.15, "chime", -10, 2)
    # ---- the Salute: its bell, the plunge, the counter
    add(A["salute_name"] - 0.1, "churchbell", -6, 1)
    add(A["standing"] + 0.1, "whoosh", -6, 3, dur=0.9)
    add(A["standing"] + 0.55, "splash", -8, 30, big=1.4)
    t, k = A["more_than"] - 0.1, 0
    while t < A["million"] + 0.5:
        add(t, "tick", -16, k + 1); t += 0.05 + 0.06 * (t - A["more_than"]) / 1.2; k += 1
    add(A["million"] + 0.55, "chime", -6, 3)
    # ---- the fence post rotting
    for k in range(7):
        add(A["eat"] - 0.25 + k * 0.17, "pop", -12 - (k % 3) * 2, k + 1)
    for k in range(4):
        add(A["fence"] - 0.2 + (A["few_years"] + 0.4 - A["fence"]) * (k + 1) / 4.0 - 0.05, "tick", -8, 40 + k)
    add(A["crumbles"] - 0.1, "crumble", -3, 2, dur=1.5)
    add(A["few_years"] - 0.35, "creak", -6, 7)
    add(A["few_years"] + 0.3, "thud", -4, 2)
    # ---- almost no oxygen, the fungi die
    add(A["down"] - 0.1, "bubbles", -8, 2, dur=1.2)
    add(A["almost"] - 0.05, "dim", -5, 2)
    add(A["fungi2"] - 0.2, "shimmer", -16, 2, dur=1.4)
    add(A["cant"] - 0.05, "xstamp", -6, 2)
    # ---- the microscope: in, the bacteria nibbling, centuries ticking, water filling, out
    add(cut["cells"] - 0.12, "whoomp", -6, 2); add(cut["cells"] - 0.05, "swirl", -12, 1, dur=1.4)
    add(A["nibble"] - 0.2, "click", -10, 1, dur=3.6, count=34)
    for k in range(9):
        add(A["slowly"] - 0.1 + (A["water_fills"] + 0.3 - A["slowly"]) * k / 9.0, "tick", -11, 60 + k)
    add(A["water_fills"] - 0.05, "pour", -9, 1, dur=1.6, big=0.6)
    add(A["water_fills"] + 0.2, "bubbles", -10, 3, dur=1.4)
    add(cut["hold"] - 0.12, "whoosh", -6, 4, dur=0.7)
    add(A["keeps"] + 0.1, "chime", -12, 4)
    add(A["carrying"], "boom", -9, 3)
    # ---- the finale
    add(A["palace"] + 0.05, "chime", -16, 5); add(A["church2"] + 0.1, "chime", -15, 6)
    add(A["whole_forest"] + 0.1, "shimmer", -12, 3, dur=1.6)
    add(A["upside"] - 0.1, "rise", -10, 3, dur=1.6)
    add(A["working"] + 0.3, "churchbell", -14, 2, strikes=1)
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
