"""
tools/sfx.py -- synthesized sound effects (numpy/scipy only, no samples) and the cue sheet that places them.

Everything is placed on the measured word times (renders/cache/scene.json "anchors"), the same clock the scene uses.
The desert wind under everything is built periodic over the video, so the loop is seamless.

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


def xstamp(seed=1):
    """'No': a punchy low thud and a short muted buzz."""
    r = np.random.default_rng(seed)
    n, t = _t(0.45)
    thud = np.sin(_glide(140, 52, t, 0.03)) * _env(t, 0.001, 0.12)
    buzz = (np.sign(np.sin(2 * np.pi * 196 * t)) + np.sign(np.sin(2 * np.pi * 207.7 * t))) * 0.5
    buzz = _lp(buzz, 1400) * _env(t, 0.003, 0.09) * 0.45
    hit = _bp(r.normal(0, 1, n), 800, 4000) * _env(t, 0.0005, 0.012) * 0.6
    return _fade(_norm(thud + buzz + hit, 0.55))


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


def thud(seed=1):
    """The 10 kg block landing: a heavy soft thump that jiggles."""
    r = np.random.default_rng(seed)
    n, t = _t(1.0)
    body = np.sin(_glide(110, 48, t, 0.05)) * _env(t, 0.002, 0.25)
    jig = np.sin(2 * np.pi * 120 * t + 3 * np.sin(2 * np.pi * 11 * t)) * _env(t, 0.02, 0.15) * 0.35
    slap = _bp(r.normal(0, 1, n), 200, 1500) * _env(t, 0.001, 0.03) * 0.8
    return _fade(_norm(body + jig + slap, 0.6))


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


# ---------------------------------------------------------------- Giza
def wind(total, seed=1):
    """Desert wind: filtered noise with slow gusts, built in the frequency domain so it loops exactly."""
    r = np.random.default_rng(seed)
    n = int(total * SR)
    spec = np.fft.rfft(r.normal(0, 1, n))
    f = np.fft.rfftfreq(n, 1 / SR)
    shape = (f / 120) ** 1 / (1 + (f / 120) ** 2) / (1 + (f / 1800) ** 2)
    x = np.fft.irfft(spec * shape, n)
    t = np.arange(n) / SR
    gust = 0.65 + 0.35 * np.sin(2 * np.pi * 3 * t / total) * np.sin(2 * np.pi * 5 * t / total + 1)
    return _norm(x * gust, 0.5)


def rustle(seed=1, dur=1.4):
    """Papyrus unrolling: dry crackles over a soft brushing hiss."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    hiss = _bp(r.normal(0, 1, n), 1500, 7000) * (0.3 + 0.7 * np.abs(np.sin(2 * np.pi * 3 * t))) * 0.35
    cr = np.zeros(n)
    for _ in range(int(60 * dur)):
        i = int(r.uniform(0, n - 400))
        m = int(r.uniform(80, 400))
        cr[i:i + m] += _bp(r.normal(0, 1, m), 2000, 9000) * np.exp(-np.arange(m) / (m / 4)) * r.uniform(0.3, 1)
    env = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.3)
    return _fade(_norm((hiss + cr) * env, 0.45))


def timelapse(seed=1, dur=2.0, ticks=18):
    """Days racing past: a rising-falling air sweep with clock-like ticks speeding up."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    sw = whoosh(seed, dur, 150, 2600)[:n]
    tk = np.zeros(n)
    m = int(0.02 * SR)
    tt = np.arange(m) / SR
    for k in range(ticks):
        u = k / ticks
        i = int(n * (u ** 0.8) * 0.95)
        tk[i:i + m] += np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt / 0.004) * 0.5
    return _fade(_norm(sw + tk, 0.5))


def scrape(seed=1, dur=3.0, rough=1.0):
    """A heavy sledge dragged on sand: grinding low noise, pulsing with the men's steps."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 90, 900 + 1400 * rough)
    grit = _bp(r.normal(0, 1, n), 2500, 6000) * rough * 0.35
    pulse = 0.55 + 0.45 * np.abs(np.sin(np.pi * 1.6 * t))
    env = np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.3)
    return _fade(_norm((x + grit) * pulse * env, 0.45))


def creak(seed=1):
    """A rope under load: a short, rubbing creak."""
    r = np.random.default_rng(seed)
    n, t = _t(0.35)
    f = r.uniform(160, 260)
    x = np.sign(np.sin(2 * np.pi * f * t + 2 * np.sin(2 * np.pi * 7 * t))) * _env(t, 0.03, 0.12)
    return _fade(_norm(_bp(x, 300, 2500), 0.3))


def pour(seed=1, dur=2.2):
    """Water poured from a jar onto sand: a splashing gurgle."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 400, 4000) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t + 3 * np.sin(2 * np.pi * 2 * t)))
    gl = np.zeros(n)
    for _ in range(int(30 * dur)):
        i = int(r.uniform(0, n - 2000)); m = 1500; tt = np.arange(m) / SR
        f0 = r.uniform(500, 1200)
        gl[i:i + m] += np.sin(_glide(f0, f0 * 1.8, tt, 0.01)) * np.exp(-tt / 0.012) * r.uniform(0.2, 0.6)
    env = np.minimum(1, t / 0.1) * np.minimum(1, (dur - t) / 0.4)
    return _fade(_norm((x * 0.6 + gl) * env, 0.45))


def clunk(seed=1):
    """A two-tonne block settling into place: stone on stone, deep and short."""
    r = np.random.default_rng(seed)
    n, t = _t(0.9)
    body = np.sin(_glide(120, 55, t, 0.04)) * _env(t, 0.002, 0.18)
    knock = _bp(r.normal(0, 1, n), 300, 2500) * _env(t, 0.001, 0.04)
    grit = _bp(r.normal(0, 1, n), 2000, 6000) * _env(t, 0.005, 0.15) * 0.25
    return _fade(_norm(body + 0.8 * knock + grit, 0.6))


def tick(seed=1):
    n, t = _t(0.05)
    return _fade(_norm(np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.005) + 0.4 * np.sin(2 * np.pi * 1550 * t) * np.exp(-t / 0.01), 0.35))


def chisel(seed=1, dur=2.0, hits=7):
    """Copper chisels and stone mallets in the quarry: little metallic tinks."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    m = int(0.15 * SR); tt = np.arange(m) / SR
    for k in range(hits):
        i = max(0, int((k + r.uniform(-0.2, 0.2)) / hits * (n - m)))
        f = r.uniform(1800, 3200)
        out[i:i + m] += (np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.03) + _bp(r.normal(0, 1, m), 1000, 5000) * np.exp(-tt / 0.008)) * r.uniform(0.4, 1)
    return _fade(_norm(out, 0.4))


def lap(seed=1, dur=6.0):
    """Water lapping at a hull: soft, irregular low splashes."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), 150, 1400)
    mod = np.clip(np.sin(2 * np.pi * 0.7 * t + 2 * np.sin(2 * np.pi * 0.23 * t)), 0, 1) ** 2
    env = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.6)
    return _fade(_norm(x * (0.3 + mod) * env, 0.4))


def oar(seed=1):
    """An oar dipping and pulling through the water."""
    r = np.random.default_rng(seed)
    n, t = _t(0.7)
    sp = _bp(r.normal(0, 1, n), 500, 4000) * _env(t, 0.005, 0.06)
    pull = _bp(r.normal(0, 1, n), 150, 900) * np.sin(np.pi * np.clip(t / 0.6, 0, 1)) * 0.5
    return _fade(_norm(sp + pull, 0.4))


def flap(seed=1):
    """A sail filling with wind."""
    r = np.random.default_rng(seed)
    n, t = _t(0.6)
    x = _bp(r.normal(0, 1, n), 100, 1600) * _env(t, 0.01, 0.12)
    return _fade(_norm(x, 0.45))


def tap(seed=1):
    """The card's edge meeting polished stone: a tiny, hard plastic tick."""
    r = np.random.default_rng(seed)
    n, t = _t(0.12)
    x = _bp(r.normal(0, 1, n), 2500, 9000) * np.exp(-t / 0.004) + 0.5 * np.sin(2 * np.pi * 4200 * t) * np.exp(-t / 0.01)
    return _fade(_norm(x, 0.45))


def clatter(seed=1, dur=1.6, count=70, rev=False):
    """Hundreds of stones knocking loose and flying: a cascade of stony clacks over a rushing whoosh."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = whoosh(seed, dur, 120, 2000)[:n] * 0.6
    m = int(0.08 * SR); tt = np.arange(m) / SR
    for _ in range(count):
        i = int((r.uniform(0, 1) ** 0.7) * (n - m))
        f = r.uniform(500, 1600)
        out[i:i + m] += (np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.015) + _bp(r.normal(0, 1, m), 800, 5000) * np.exp(-tt / 0.006)) * r.uniform(0.15, 0.5)
    if rev:
        out = out[::-1].copy()
    return _fade(_norm(out, 0.5))


def murmur(seed=1, dur=6.0):
    """A busy town far off: a babble of formant-filtered noise."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    for k in range(6):
        f1 = r.uniform(400, 900)
        v = _bp(r.normal(0, 1, n), f1 * 0.8, f1 * 1.6) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * r.uniform(2, 5) * t + k)))
        out += v
    env = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.8)
    return _fade(_norm(out * env, 0.4))


def gong(seed=1):
    """A soft, low bronze swell: reverent."""
    n, t = _t(3.0)
    x = sum(a * np.sin(2 * np.pi * f * t + p) * np.exp(-t / d) for f, a, d, p in ((98, 1, 1.6, 0), (196.7, 0.5, 1.0, 1), (293, 0.3, 0.7, 2), (411, 0.2, 0.5, 3)))
    return _fade(_norm(x * np.minimum(1, t / 0.08), 0.45))


def ufo(seed=1, dur=1.5):
    """A cartoon saucer: a wobbling theremin tone with a shimmer."""
    n, t = _t(dur)
    f = 700 + 260 * np.sin(2 * np.pi * 6 * t) + 300 * t
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR)
    env = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.3)
    return _fade(_norm(x * env, 0.4))


def zip_(seed=1):
    n, t = _t(0.45)
    x = np.sin(_glide(400, 3200, t, 0.12)) * np.exp(-t / 0.18)
    return _fade(_norm(x, 0.4))


SOUNDS = {
    "xstamp": xstamp, "pop": pop, "chime": chime, "chime_low": lambda s: chime(s, 784.0), "whoomp": whoomp,
    "whoosh": lambda s: whoosh(s, 1.2, 150, 2200), "whoosh_long": lambda s: whoosh(s, 2.2, 120, 1800),
    "whoosh_fast": lambda s: whoosh(s, 0.6, 300, 3200), "shimmer": shimmer, "shimmer_long": lambda s: shimmer(s, 3.2, 70),
    "rise": rise, "thud": thud, "slosh": slosh, "step": step,
    "rustle": rustle, "timelapse": timelapse, "timelapse2": lambda s: timelapse(s, 2.2, 26),
    "scrape_dry": lambda s: scrape(s, 4.0, 1.0), "scrape_wet": lambda s: scrape(s, 4.6, 0.25), "scrape_a": lambda s: scrape(s, 3.4, 0.7),
    "creak": creak, "pour": pour, "clunk": clunk, "tick": tick, "chisel": chisel, "lap": lambda s: lap(s, 9.2),
    "oar": oar, "flap": flap, "tap": tap, "clatter": clatter, "clatter_rev": lambda s: clatter(s, 2.2, 90, True),
    "murmur": lambda s: murmur(s, 6.4), "murmur_big": lambda s: murmur(s, 2.6), "gong": gong, "ufo": ufo, "zip": zip_,
}


def cue_sheet() -> list:
    d = json.loads(SCENE.read_text())
    A, D = d["anchors"], d["duration"]
    T_CUT = 12.02
    c = []
    add = lambda t, name, db, seed=1: c.append([t, name, db, seed])
    # ---- hook
    add(A["tallest"] - 0.05, "pop", -16, 1)
    add(A["y3800"] - 0.15, "timelapse", -13, 1)
    add(A["thought"] - 0.05, "pop", -18, 2)
    add(A["how"] - 0.6, "whoosh_fast", -18, 1)
    add(A["until"] - 0.05, "rustle", -12, 1)
    add(A["diary"] - 0.1, "shimmer", -17, 1)
    add(A["stones"] - 0.3, "whoosh", -14, 2)
    add(T_CUT - 0.05, "whoomp", -18, 1)
    # ---- Merer's crew on the ramp
    add(T_CUT + 0.1, "scrape_a", -20, 1)
    for k in range(4):
        add(T_CUT + 0.4 + 0.85 * k, "creak", -24, 10 + k)
    add(A["merer_w"] - 0.05, "chime_low", -19, 1)
    add(15.3, "whoosh_long", -16, 3)
    add(A["n23"] - 0.05, "pop", -16, 3)
    add(18.35, "whoosh", -17, 4)
    for k in range(4):
        add(A["every"] + 0.18 * k, "tick", -21, 20 + k)
    add(A["one"] + 0.25, "scrape_a", -21, 2)
    add(A["every"] + 0.5, "clunk", -11, 1)
    add(A["every_day"] - 0.1, "timelapse2", -13, 2)
    # ---- the quarry and the sledge crew
    add(23.9, "whoosh", -17, 5)
    add(24.4, "chisel", -21, 1)
    add(26.0, "scrape_dry", -16, 3)
    for k in range(5):
        add(26.3 + 0.9 * k, "creak", -22, 20 + k)
    for k in range(9):
        add(26.1 + 0.62 * k, "step", -24, 30 + k)
    add(A["poured"] - 0.1, "pour", -13, 1)
    add(A["damp"] - 0.1, "scrape_wet", -19, 4)
    add(A["drops"] - 0.05, "rise", -19, 1)
    # ---- Tura, the boats, the canal
    add(34.4, "whoosh_long", -15, 6)
    add(34.6, "lap", -18, 1)
    add(34.9, "chisel", -22, 2)
    add(37.7, "flap", -17, 1)
    for k in range(4):
        add(37.9 + 1.5 * k, "oar", -18, 40 + k)
    add(A["forty"] - 0.05, "pop", -17, 4)
    add(A["canals"] - 0.05, "pop", -19, 5)
    # ---- the casing: the dive, the card, the shine, the stripping
    add(43.6, "whoosh_long", -12, 7)
    add(A["joints"] - 0.6, "whoosh_fast", -22, 8)
    add(A["thinner"] + 0.15, "tap", -12, 1)
    add(A["thinner"] + 0.32, "tap", -20, 2)
    add(A["so3"] - 0.05, "whoosh", -14, 9)
    add(A["shone"] - 0.1, "shimmer_long", -14, 2)
    add(A["shone"] + 0.05, "chime", -18, 3)
    add(A["took"] - 0.2, "clatter", -12, 1)
    # ---- the workers
    add(A["workers"] - 0.3, "murmur", -21, 1)
    add(A["slaves"] + 0.25, "xstamp", -11, 1)
    add(A["slaves_e"] + 0.12, "chime", -16, 4)
    add(A["bread"] - 0.05, "pop", -19, 6)
    add(A["beer"] - 0.05, "pop", -19, 7)
    add(A["king"] - 0.2, "gong", -16, 1)
    # ---- the end
    add(A["aliens"] - 0.55, "ufo", -15, 1)
    add(A["built3"] - 0.05, "xstamp", -10, 2)
    add(A["built3"] + 0.25, "zip", -16, 1)
    add(A["thousands"] - 0.2, "murmur_big", -16, 2)
    add(A["ropes"] - 0.25, "clatter_rev", -13, 3)
    add(D - 0.55, "shimmer", -20, 9)
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
    out = out[: int(total_s * SR)]
    out += wind(total_s).astype(np.float32) * 10 ** (-27 / 20)        # the desert, all the way round
    return out


if __name__ == "__main__":
    import soundfile as sf
    d = json.loads(SCENE.read_text())
    x = render_track(d["duration"])
    (ROOT / "audio").mkdir(exist_ok=True)
    sf.write(ROOT / "audio" / "sfx_preview.wav", x, SR)
    print(f"  sfx: {len(cue_sheet())} cues, peak {np.abs(x).max():.2f}")
