"""
tools/sfx.py -- synthesized sound effects (numpy/scipy only, no samples) and the cue sheet that places them.

Everything is placed on the measured word times (renders/cache/scene.json "anchors"), on the cut list ("shots") and
on the hauling clock the scene's workers walk to ("haul_hz": a footstep every half stride). Beds (wind, the sled's
drag, the torch, the lab's hum) follow the shots.

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


SOUNDS = {
    "xstamp": xstamp, "rewind": rewind, "chime": chime, "chime_low": lambda s: chime(s, 784.0), "pop": pop,
    "whoosh": lambda s: whoosh(s, 1.2, 150, 2200), "whoosh_long": lambda s: whoosh(s, 2.2, 120, 1800),
    "whoosh_fast": lambda s: whoosh(s, 0.6, 300, 3200), "shimmer": shimmer, "bubbles": bubbles, "slosh": slosh,
    "sizzle": lambda s: sizzle(s, 1.4), "dim": dim,
    "wind": lambda s: wind(s, 4.0), "drag": lambda s: drag(s, 4.0), "drag_big": lambda s: drag(s, 4.0, 0.5),
    "step": footstep_sand, "pour": lambda s: pour(s, 3.0), "pour_lab": lambda s: pour(s, 1.6, 0.6),
    "pour_lab_big": lambda s: pour(s, 1.9, 1.6), "brush": brush, "crackle": lambda s: crackle(s, 4.0), "tick": tick,
    "clap": clap, "stone": stone, "boom": boom, "hum": lambda s: hum(s, 4.0), "motor": lambda s: motor(s, 3.0),
    "scrape_dry": lambda s: scrape(s, 3.0, 1.0, 0.0), "scrape_wet": lambda s: scrape(s, 3.0, 0.0, 1.0),
    "squelch": squelch, "click": click, "blipW": lambda s: blip(s, 880.0), "tone_low": lambda s: tone(s, 220.0),
}


def cue_sheet() -> list:
    d = json.loads(SCENE.read_text())
    A, D, HZ = d["anchors"], d["duration"], d["haul_hz"]
    cuts = d["shots"]["cuts"] + [["_end", D]]
    paint, wipe = d["shots"]["paint"], d["shots"]["wipe"]
    span = {}
    for (name, t0), (_, t1) in zip(cuts[:-1], cuts[1:]):
        span.setdefault(name, []).append((t0, t1))
    c = []
    add = lambda t, name, db, seed=1: c.append([t, name, db, seed])

    def bed(name, t0, t1, db, seed=1, piece=4.0):
        """lay a looping bed between t0 and t1 (pieces of `piece` s, crossfaded by their own fades)"""
        k, t = 0, t0
        while t < t1 - 0.05:
            add(t, name, db, seed + k)
            t += piece - 0.15
            k += 1
        return k

    desert = [s for n in ("hook", "colossus", "colossus2", "pyramid", "team", "crane") for s in span.get(n, [])]
    for t0, t1 in desert:
        bed("wind", t0, t1, -20, 11)
    # the hero team: the sled's drag and the footsteps (hook, team, crane: the loop hears the same bed)
    for name in ("hook", "team", "crane"):
        for t0, t1 in span.get(name, []):
            bed("drag", t0, t1, -21, 21)
            step = 1 / (2 * HZ)
            t = t0 - (t0 % step)
            k = 0
            while t < t1:
                if t >= t0:
                    add(t, "step", -24 + (3 if k % 2 == 0 else 0), 30 + k % 7)
                    add(t + 0.11, "step", -27, 40 + k % 5)                 # the next man along, a beat behind
                t += step
                k += 1
    for name in ("colossus", "colossus2"):
        for t0, t1 in span.get(name, []):
            bed("drag_big", t0, t1, -19, 31)
            step = 1 / (2 * HZ * 0.8)
            t = t0 - (t0 % step) + step
            k = 0
            while t < t1:
                add(t, "clap", -20, 50 + k % 4)                           # the clapper keeps time
                for j in range(3):
                    add(t + 0.05 * j, "step", -24, 60 + (k + j) % 7)        # a crowd of feet
                t += step
                k += 1
            bed("pour", t0, t1, -24, 71, 3.0)
    # ---- hook
    add(A["heavier"] - 0.05, "stone", -11, 1)
    add(A["car"] - 0.1, "pop", -15, 2)
    add(A["thousands"] - 0.3, "whoosh_long", -15, 3)
    add(A["how"] - 0.15, "boom", -11, 1)
    add(A["until"] - 0.2, "whoosh_fast", -15, 4)
    add(A["man0"] - 0.6, "pour", -18, 5)
    for k in range(7):
        add(paint[0] + 0.12 * k, "brush", -15, 10 + k)
    # ---- the wall
    for t0, t1 in span.get("wall", []):
        bed("crackle", t0, t1, -22, 81)
    add(A["p_that"] - 0.2, "whoosh", -18, 5)
    add(A["four"] - 0.1, "pop", -14, 6)
    t, last = A["men170"] - 0.05, -1
    t_end = A["pulling"] + 0.1
    while t < t_end:                                                   # the counter: ticks, at most ~18 a second
        add(t, "tick", -20, int(t * 100) % 9)
        t += 1 / 18
    add(t_end, "chime_low", -15, 2)
    add(A["statue"] - 0.1, "whoosh", -16, 6)
    for k in range(6):
        add(wipe[0] + 0.12 * k, "brush", -16, 20 + k)
    add(A["pours"] - 0.1, "pop", -18, 7)
    add(A["ritual"] - 0.05, "xstamp", -14, 1)
    # ---- the lab
    for name in ("lab1", "lab2"):
        for t0, t1 in span.get(name, []):
            bed("hum", t0, t1, -27, 91)
    add(A["y2014"] - 0.15, "pop", -13, 8)
    add(A["pulled"] - 0.2, "motor", -22, 1)
    t = A["pulled"]
    while t < A["but"] - 0.3:
        add(t, "scrape_dry", -16, 101 + int(t))
        t += 2.85
    add(A["dry"] - 0.15, "pop", -16, 9)
    add(A["piling"] - 0.1, "xstamp", -16, 2)
    add(A["but"] - 0.3, "rewind", -15, 3)
    add(A["right"] - 0.1, "pour_lab", -14, 1)
    add(A["pull"] - 0.2, "motor", -22, 2)
    add(A["pull"] - 0.2, "scrape_wet", -18, 3)
    add(A["half"] - 0.15, "chime", -13, 1)
    # ---- the grains
    add(A["tiny"] - 0.3, "whoosh_fast", -14, 5)
    add(A["tiny"], "click", -16, 1)
    add(A["stick"] - 0.1, "bubbles", -15, 2)
    add(A["together"] - 0.1, "bubbles", -17, 3)
    add(A["twice"] - 0.05, "stone", -15, 2)
    add(A["twice"] + 0.15, "chime", -14, 2)
    # ---- back on the tray: it glides, then too much water
    add(A["glides"] - 0.75, "scrape_wet", -18, 4)
    add(A["toomuch"] - 0.4, "pour_lab_big", -13, 2)
    add(A["toomuch"] - 0.1, "xstamp", -15, 3)
    add(A["mudw"] - 0.05, "squelch", -13, 1)
    add(A["sinks"] - 0.3, "squelch", -12, 2)
    add(A["sinks"] + 0.1, "tone_low", -18, 1)
    # ---- engineering, not a ritual
    add(A["so_man"] - 0.3, "whoosh", -16, 7)
    add(A["engineering"] - 0.1, "chime", -13, 3)
    add(A["not_ritual"] - 0.3, "whoosh_fast", -18, 8)
    # ---- the end
    add(A["end"] - 0.3, "whoosh_long", -15, 9)
    add(A["even"] + 0.1, "pop", -16, 10)
    add(A["seven"] - 0.2, "pop", -16, 11)
    add(A["half2"] - 0.2, "sizzle", -15, 1)
    add(A["half2"] + 0.1, "shimmer", -17, 2)
    add(A["million"] - 0.75, "boom", -12, 2)
    add(A["million"] - 1.0, "whoosh_long", -16, 12)
    add(D - 2.6, "whoosh_long", -17, 13)                                 # the crane coming down into the start
    return sorted(c)


def render_track(total_s: float) -> np.ndarray:
    """All cues; whatever rings past the end wraps round onto the start (the video loops)."""
    n = int(total_s * SR)
    out = np.zeros(n + 6 * SR, np.float32)
    cache: dict = {}
    for t0, name, gain_db, seed in cue_sheet():
        key = (name, seed)
        if key not in cache:
            cache[key] = SOUNDS[name](seed).astype(np.float32)
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
