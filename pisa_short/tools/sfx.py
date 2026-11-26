"""
tools/sfx.py -- synthesized sound effects (numpy/scipy only, no samples) and the cue sheet that places them.

Floor landings and lift-offs come from the scene's own event list (renders/cache/scene.json "cues"); the rest is
placed on the phrase anchors and on the same clocks the scene uses (the fall, the freeze, the rewind, the year
counter).

    render_track(total_s) -> mono float32 at SR
"""

from __future__ import annotations

import json
import math
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


def _norm(x, peak=0.5):
    return x / (np.abs(x).max() + 1e-9) * peak


def _t(dur):
    n = int(dur * SR)
    return n, np.arange(n) / SR


def _env(t, a, d):
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


# ---------------------------------------------------------------- stone
def stone(seed: int) -> np.ndarray:
    """A floor of marble set down: a deep thud, a short crunch and a little grit trickling after."""
    r = np.random.default_rng(seed)
    n, t = _t(1.6)
    f0 = r.uniform(46, 58)
    body = np.sin(2 * np.pi * f0 * t * (1 + 0.6 * np.exp(-t / 0.05))) * _env(t, 0.002, 0.28)
    body += 0.5 * np.sin(2 * np.pi * f0 * 2.03 * t) * _env(t, 0.002, 0.12)
    crunch = _bp(r.normal(0, 1, n), 300, 2500) * _env(t, 0.001, 0.05) * 1.4
    grit = _bp(r.normal(0, 1, n), 1500, 6000) * np.exp(-((t - 0.25) ** 2) / 0.04) * 0.25 * (r.random(n) > 0.97)
    return _norm(body + crunch + grit * 3, 0.55)


def creak(seed: int = 1, dur: float = 1.6) -> np.ndarray:
    """Stone under strain: a low grinding groan with cracking ticks, getting louder."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    groan = _bp(r.normal(0, 1, n), 60, 260) * (0.4 + 0.6 * np.sin(2 * np.pi * 3.1 * t) ** 2)
    ticks = np.zeros(n)
    for k in range(int(dur * 14)):
        i = int(r.uniform(0, n - 2000) * (0.3 + 0.7 * r.random()))
        m = int(0.012 * SR)
        ticks[i:i + m] += _bp(r.normal(0, 1, m), 1200, 7000) * np.exp(-np.arange(m) / (0.002 * SR)) * r.uniform(0.3, 1.0)
    env = np.minimum(1, t / dur) ** 1.5
    return _norm((groan + 0.5 * ticks) * env * np.minimum(1, (dur - t) / 0.05), 0.5)


def rumble(seed: int = 1, dur: float = 3.6) -> np.ndarray:
    """The fall: a growing low rumble with tearing cracks and pieces breaking off."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    base = _lp(r.normal(0, 1, n), 140, 4) * 6
    mid = _bp(r.normal(0, 1, n), 200, 900) * 0.6
    env = (t / dur) ** 1.4
    x = (base + mid * env) * (0.15 + env)
    for k in range(26):                            # cracks
        i = int(n * (0.25 + 0.75 * r.random() ** 0.7)) - 4000
        m = int(r.uniform(0.02, 0.08) * SR)
        if i + m < n:
            x[i:i + m] += _bp(r.normal(0, 1, m), 600, 5000) * np.exp(-np.arange(m) / (0.012 * SR)) * r.uniform(0.6, 1.6) * env[i]
    return _norm(x, 0.55)


def whoosh_stop(seed: int = 1, dur: float = 0.55) -> np.ndarray:
    """Air rushing in, then time stops: a swelling filtered noise cut dead, a low thump with a tail."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    noise = r.normal(0, 1, n)
    swell = sum(_bp(noise, lo, lo * 2.2) * np.clip(t / dur - i * 0.12, 0, 1) ** 2 for i, lo in enumerate((300, 900, 2400)))
    swell *= np.minimum(1, (dur - t) / 0.004)
    m, tt = _t(1.6)
    thump = np.sin(2 * np.pi * 52 * tt) * np.exp(-tt / 0.3) + 0.4 * np.sin(2 * np.pi * 104 * tt) * np.exp(-tt / 0.14)
    tail = _bp(r.normal(0, 1, m), 200, 1200) * np.exp(-tt / 0.6) * 0.12
    return np.concatenate([_norm(swell, 0.35), _norm(thump + tail, 0.55)])


def rewind(seed: int = 1, dur: float = 1.1) -> np.ndarray:
    """Tape rewinding: a fluttering band of noise sweeping up, in fast, out slow."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    out = np.zeros(n)
    noise = r.normal(0, 1, n)
    for i, (lo, hi) in enumerate(((400, 900), (900, 2000), (2000, 4500), (4500, 9000))):
        out += _bp(noise, lo, hi) * np.exp(-((t / dur - (0.15 + 0.22 * i)) ** 2) / 0.03)
    flutter = 1 + 0.35 * np.sin(2 * np.pi * (14 + 30 * t / dur) * t)
    env = np.minimum(1, t / 0.06) * np.minimum(1, (dur - t) / 0.45)
    return _norm(out * flutter * env, 0.5)


def lift(seed: int = 1, dur: float = 0.55) -> np.ndarray:
    """A floor pulled up into the past: a quick reversed whoosh."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    noise = r.normal(0, 1, n)
    f = 300 + 3000 * (t / dur) ** 2
    x = np.zeros(n)
    for lo in (0.6, 1.0, 1.7):
        x += _bp(noise, 250 * lo, 4000 * lo) * 0.3
    x *= (t / dur) ** 2.5 * np.minimum(1, (dur - t) / 0.02)
    x += 0.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 3
    return _norm(x, 0.45)


def whoosh(seed: int = 1, dur: float = 1.0, lo: float = 200, hi: float = 2400) -> np.ndarray:
    """A soft camera move."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    x = _bp(r.normal(0, 1, n), lo, hi) * np.sin(np.pi * t / dur) ** 2
    return _norm(x, 0.4)


def shing(seed: int = 1) -> np.ndarray:
    """Two swords drawn and crossed: a scrape up into a bright metallic ring."""
    r = np.random.default_rng(seed)
    n, t = _t(1.8)
    scrape = _bp(r.normal(0, 1, n), 2500, 9000) * np.minimum(1, t / 0.25) * np.exp(-np.maximum(0, t - 0.25) / 0.03)
    ring = np.zeros(n)
    tr = np.maximum(0, t - 0.27)
    for f, d, a in ((1830, 0.9, 1.0), (2970, 0.6, 0.7), (4410, 0.4, 0.5), (6120, 0.25, 0.35), (2350, 0.7, 0.4)):
        ring += a * np.sin(2 * np.pi * f * tr * (1 + 0.002 * np.sin(2 * np.pi * 6 * tr))) * np.exp(-tr / d) * (t > 0.27)
    return _norm(0.6 * scrape + ring * 0.5, 0.5)


def drum(seed: int = 1) -> np.ndarray:
    """A big war drum."""
    r = np.random.default_rng(seed)
    n, t = _t(1.4)
    f = 62 * (1 + 0.5 * np.exp(-t / 0.04))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(t, 0.002, 0.45)
    x += _bp(r.normal(0, 1, n), 120, 900) * _env(t, 0.001, 0.03) * 0.9
    return _norm(x, 0.55)


def tick(seed: int = 4) -> np.ndarray:
    n, t = _t(0.03)
    x = _bp(np.random.default_rng(seed).normal(0, 1, n), 2500, 8000) * np.exp(-t / 0.003) + 0.4 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.004)
    return _norm(x, 0.4)


def drip(seed: int = 1) -> np.ndarray:
    """A water droplet: a short rising 'plip'."""
    r = np.random.default_rng(seed)
    n, t = _t(0.12)
    f = r.uniform(900, 1700) * (1 + 1.4 * t / 0.12)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(t, 0.001, 0.025)
    return _norm(x, 0.4)


def bell(seed: int = 1, f0: float = 196.0, dur: float = 5.0) -> np.ndarray:
    """A church bell: hum, prime, tierce, quint, nominal and the upper partials, long decay."""
    n, t = _t(dur)
    x = np.zeros(n)
    for k, (ratio, d, a) in enumerate(((0.5, 3.5, 0.6), (1.0, 2.6, 1.0), (1.19, 2.0, 0.55), (1.5, 1.6, 0.35),
                                       (2.0, 1.4, 0.7), (2.52, 0.9, 0.3), (3.0, 0.7, 0.25), (4.1, 0.4, 0.15))):
        x += a * np.sin(2 * np.pi * f0 * ratio * t + k) * np.exp(-t / d) * (1 + 0.03 * np.sin(2 * np.pi * 1.3 * t + k))
    strike = _bp(np.random.default_rng(seed).normal(0, 1, n), 800, 5000) * np.exp(-t / 0.01) * 0.6
    return _norm((x + strike) * np.minimum(1, t / 0.002), 0.5)


def stamp(seed: int = 1) -> np.ndarray:
    """A rubber stamp slammed down: CLOSED."""
    r = np.random.default_rng(seed)
    n, t = _t(0.5)
    x = np.sin(2 * np.pi * 90 * t) * _env(t, 0.001, 0.07) + _bp(r.normal(0, 1, n), 400, 3000) * _env(t, 0.0005, 0.02) * 1.2
    return _norm(x, 0.55)


def drill(seed: int = 1, dur: float = 3.6) -> np.ndarray:
    """An auger turning in the ground: a low motor hum with the grind of soil, pulsing as it turns."""
    r = np.random.default_rng(seed)
    n, t = _t(dur)
    f = 95 + 6 * np.sin(2 * np.pi * 0.7 * t)
    saw = 2 * ((np.cumsum(f) / SR) % 1.0) - 1
    motor = _lp(saw, 900) * 0.6
    grind = _bp(r.normal(0, 1, n), 300, 2400) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * t) ** 2) * 0.5
    env = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.5)
    return _norm((motor + grind) * env, 0.5)


def quake(seed: int = 1, dur: float = 0.8) -> np.ndarray:
    """One strong earthquake: a deep shudder with rattling."""
    r = np.random.default_rng(seed)
    n, t = _t(dur + 0.8)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    x = _lp(r.normal(0, 1, n), 90, 4) * 8 * env
    x += _bp(r.normal(0, 1, n), 300, 1600) * env * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 13 * t))) * 0.25
    return _norm(x, 0.55)


SOUNDS = {"stone": stone, "creak": creak, "rumble": rumble, "freeze": whoosh_stop, "rewind": rewind, "lift": lift,
          "shing": shing, "drum": drum, "tick": tick, "drip": drip, "stamp": stamp,
          "bell": lambda s: bell(s, f0=(196.0, 233.1, 261.6, 174.6)[s % 4]),
          "whoosh": lambda s: whoosh(s, 1.0 + 0.2 * (s % 3)),
          "whoosh_low": lambda s: whoosh(s, 1.2, 80, 700),
          "drill": lambda s: drill(s), "quake": lambda s: quake(s), "quake_long": lambda s: quake(s, 2.6),
          "ghost_fall": lambda s: rumble(s, 1.6)}


def _year_ticks(years: list, t_end: float) -> list:
    """A tick each time the year counter turns over (at most 22 a second, like a fast mechanical counter)."""
    def ease(u):
        return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2

    def y_at(t):
        if t <= years[0][0]:
            return years[0][1]
        for (t0, y0), (t1, y1) in zip(years, years[1:]):
            if t <= t1:
                return y0 + (y1 - y0) * ease(min(1, max(0, (t - t0) / max(t1 - t0, 1e-6))))
        return years[-1][1]
    out, phase, dt = [], 0.0, 1 / 480
    prev = y_at(0)
    k = 0
    t = 0.0
    while t < t_end:
        y = y_at(t)
        rate = min(abs(y - prev) / dt, 22.0)
        phase += rate * dt
        if phase >= 1:
            phase -= 1
            out.append([t, "tick", -15.0, 4 + k % 5])
            k += 1
        prev = y
        t += dt
    return out


def extra_cues(A: dict, years: list, D: float) -> list:
    tF0, tFz = 0.22, A["y800"] + 0.12
    tRw0 = A["when"] - 0.08
    out = [
        [0.0, "creak", -8.0, 1],
        [0.18, "stone", -8.0, 61],                                  # the ground gives way
        [tF0 + 0.1, "rumble", -8.0, 1],
        [tFz - 0.55, "freeze", -7.0, 1],
        [tRw0, "rewind", -6.0, 1],
        [A["genius"] + 0.65, "whoosh", -20.0, 2],
        [A["but_war"] - 0.45, "shing", -13.0, 1],
        [A["hook_end"] + 0.02, "drum", -6.0, 1],
        [A["save_tower"] - 0.4, "whoosh", -16.0, 3],
        [A["underground"] - 0.15, "whoosh_low", -6.0, 1],
        [A["underground"] + 0.25, "stone", -9.0, 77],              # the front half of the ground dropping away
        [A["stopped"] - 0.15, "drum", -11.0, 2],
        [A["stopped"] + 0.3, "drum", -15.0, 3],
        [A["war"] - 0.35, "shing", -14.0, 2],
        [A["kept"] - 0.4, "whoosh", -15.0, 4],
        [A["collapsed"] + 0.1, "ghost_fall", -9.0, 5],
        [A["came_back"] - 0.6, "whoosh", -17.0, 5],
        [A["banana_end"] + 0.12, "bell", -8.0, 0],                 # the bell chamber: the bells ring
        [A["banana_end"] + 1.25, "bell", -11.0, 1],
        [A["close"] - 0.02, "stamp", -10.0, 1],
        [A["pulled"] - 0.2, "drill", -12.0, 1],
        [A["straightened"] + 0.1, "whoosh", -15.0, 6],
        [A["same_clay"] - 0.4, "whoosh", -16.0, 7],
        [A["swaying"] - 0.1, "quake_long", -12.0, 9],
        [A["so_ground"] - 0.1, "whoosh_low", -10.0, 2],
        [A["reason"] + 0.3, "bell", -13.0, 2],                     # a last, far bell as we come home
    ]
    for i, q in enumerate([A["quakes"] - 0.25, A["quakes"] + 0.35, A["quakes"] + 0.95, A["quakes"] + 1.55]):
        out.append([q, "quake", -10.0 - i * 0.5, 10 + i])
    rng = np.random.default_rng(3)
    for k in range(18):                                            # droplets squeezed out of the clay
        out.append([A["weight"] + k * (A["kept"] - A["weight"] - 0.4) / 18 + rng.uniform(-0.1, 0.1), "drip", -19.0 + rng.uniform(-3, 2), k])
    out += _year_ticks(years, D)
    return out


def cue_sheet() -> list:
    d = json.loads(SCENE.read_text())
    return sorted(d["cues"] + extra_cues(d["anchors"], d["years"], d["duration"]), key=lambda c: c[0])


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
        if j > i >= 0:
            out[i:j] += snd[: j - i]
    return out[: int(total_s * SR)]


if __name__ == "__main__":
    import soundfile as sf
    d = json.loads(SCENE.read_text())
    x = render_track(d["duration"])
    (ROOT / "audio").mkdir(exist_ok=True)
    sf.write(ROOT / "audio" / "sfx_preview.wav", x, SR)
    print(f"  sfx: {len(cue_sheet())} cues, peak {np.abs(x).max():.2f}")
