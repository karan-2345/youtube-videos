"""
tools/sfx.py -- synthesized sound effects (numpy only) and the cue sheet that places them (wrinkly-fingers Short).

Every effect is generated here, so there are no third-party audio licences. The cue rows come from the scenes
themselves: each scene's JS lists [t, sound, dB, (length)] for the moments it animates (needle punches, swallows,
bursts, laser pulses), and tools/capture.py saves them to renders/cache/scenes/<Scene>.cues.json.

    render_track(total_s, starts, timings) -> mono float32 at SR     (used by tools/assemble.py)
    music_env(total_s, starts, timings)    -> gain curve for the music bed
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48_000
ROOT = Path(__file__).resolve().parents[1]
SCENES = ROOT / "renders" / "cache" / "scenes"


def _rng(seed):
    return np.random.default_rng(seed)


def _t(dur):
    return np.arange(int(dur * SR)) / SR


def _env(n, a, r):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))


def _bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def _lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def _norm(x, peak=0.5):
    return x / (np.abs(x).max() + 1e-9) * peak


def _chirp(f0, f1, dur, curve=1.0):
    t = _t(dur)
    f = f0 + (f1 - f0) * (t / dur) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ---------------------------------------------------------------- the sounds
def swish(seed=1, dur=0.45):
    """A soft air movement (camera moves, the block lifting)."""
    n = int(dur * SR)
    x = _rng(seed).normal(0, 1, n)
    t = np.arange(n) / SR
    cut = 600 + 2600 * np.sin(np.pi * t / dur) ** 2
    y = np.zeros(n)
    for i in range(0, n, 480):                       # a moving band-pass, block by block
        j = min(n, i + 480)
        f = cut[i]
        y[i:j] = _bp(x[max(0, i - 2000):j], f * 0.6, min(f * 1.6, 20000))[-(j - i):]
    return _norm(y * np.sin(np.pi * t / dur) ** 1.5, 0.45)


def buzz(seed=2, dur=1.8):
    """The tattoo machine: a coil buzzing at ~110 Hz with a rattle, fading in and out."""
    t = _t(dur)
    base = np.sign(np.sin(2 * np.pi * 112 * t)) * 0.5 + np.sin(2 * np.pi * 224 * t) * 0.3
    rattle = _bp(_rng(seed).normal(0, 1, len(t)), 1800, 5200) * (0.5 + 0.5 * np.sin(2 * np.pi * 112 * t))
    x = _lp(base, 2400) + 0.25 * rattle
    edge = np.minimum(1, np.minimum(t / 0.08, (dur - t) / 0.12))
    return _norm(x * edge, 0.45)


def punch(seed=3):
    """The needle going in: a tiny wet tick."""
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    x = _bp(_rng(seed).normal(0, 1, n), 2500, 7000) * _env(n, 0.0005, 0.006) \
        + 0.6 * np.sin(2 * np.pi * 380 * t) * _env(n, 0.001, 0.012)
    return _norm(x, 0.4)


def gulp(seed=4):
    """A cell swallowing: a short, soft, downward bubble."""
    r = _rng(seed)
    f0 = 520 * r.uniform(0.85, 1.15)
    x = _chirp(f0, f0 * 0.38, 0.16, 0.6) * _env(int(0.16 * SR), 0.01, 0.06)
    x += 0.15 * _bp(r.normal(0, 1, len(x)), 300, 1500) * _env(len(x), 0.002, 0.03)
    return _norm(x, 0.5)


def fizz(seed=5, dur=0.8):
    """Trying to digest: a quiet acid fizz."""
    n = int(dur * SR)
    r = _rng(seed)
    x = _bp(r.normal(0, 1, n), 3000, 9000) * (r.random(n) > 0.985) * 3 + 0.2 * _bp(r.normal(0, 1, n), 2000, 6000)
    t = np.arange(n) / SR
    return _norm(x * np.sin(np.pi * t / dur), 0.35)


def squish(seed=6, dur=0.6):
    """Cells crawling in: soft, slow, wet movement."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = _lp(_rng(seed).normal(0, 1, n), 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    return _norm(x * np.sin(np.pi * t / dur), 0.4)


def pop(seed=7):
    """A cell bursting: a bright pop with a wet tail."""
    r = _rng(seed)
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = 900 * r.uniform(0.85, 1.2)
    x = np.sin(2 * np.pi * f * t * (1 - 0.6 * t / 0.22)) * _env(n, 0.001, 0.025)
    x += 0.5 * _bp(r.normal(0, 1, n), 1200, 6000) * _env(n, 0.0008, 0.012)
    x += 0.25 * _lp(r.normal(0, 1, n), 900) * _env(n, 0.01, 0.07)
    return _norm(x, 0.5)


def ding(seed=8):
    """'Still there': a soft two-note glass chime."""
    t = _t(1.2)
    x = np.zeros_like(t)
    for f, d0, a in ((1318.5, 0.0, 1.0), (1975.5, 0.09, 0.7)):
        tt = np.maximum(0, t - d0)
        x += a * (np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / 0.1)) \
            * np.exp(-tt / 0.45) * (t >= d0)
    return _norm(x, 0.4)


def whir(seed=9, dur=0.7):
    """The laser hand-piece arriving: a rising electric hum."""
    t = _t(dur)
    x = _chirp(90, 180, dur) + 0.4 * _chirp(180, 360, dur) + 0.1 * _bp(_rng(seed).normal(0, 1, len(t)), 2000, 6000)
    return _norm(x * np.sin(np.pi * t / dur) ** 0.7, 0.35)


def zap(seed=10):
    """One laser pulse: a snap and a short bright tone."""
    r = _rng(seed)
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    x = _bp(r.normal(0, 1, n), 2000, 10000) * _env(n, 0.0003, 0.008)
    x += 0.5 * np.sin(2 * np.pi * 2600 * t) * _env(n, 0.001, 0.03)
    x += 0.5 * np.sin(2 * np.pi * 70 * t) * _env(n, 0.002, 0.04)
    return _norm(x, 0.5)


def zapbig(seed=11):
    """The close-up pulse: a bigger snap with a low thump and a shimmer tail."""
    r = _rng(seed)
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    x = _bp(r.normal(0, 1, n), 1500, 12000) * _env(n, 0.0003, 0.02)
    x += 0.7 * np.sin(2 * np.pi * 55 * t) * _env(n, 0.002, 0.12)
    x += 0.4 * _chirp(3200, 1400, 0.6) * _env(n, 0.002, 0.15)
    return _norm(x, 0.55)


def shimmer(seed=12, dur=0.9):
    """Ink shattering into dust: a scatter of tiny high ticks."""
    n = int(dur * SR)
    r = _rng(seed)
    x = np.zeros(n)
    for _ in range(70):
        i = int(r.uniform(0, 0.75) ** 1.6 * n)
        m = int(0.012 * SR)
        f = r.uniform(4000, 9000)
        tt = np.arange(m) / SR
        seg = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.003) * r.uniform(0.3, 1)
        x[i:i + m] += seg[: n - i]
    return _norm(x * np.exp(-np.arange(n) / SR / 0.45), 0.4)


def flow(seed=13, dur=1.0):
    """Dust carried away down the vessel: a gentle liquid whoosh."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = _bp(_rng(seed).normal(0, 1, n), 250, 1800) * (0.7 + 0.3 * np.sin(2 * np.pi * 9 * t))
    return _norm(x * np.sin(np.pi * t / dur) ** 1.2, 0.4)


def rustle(seed=14, dur=2.4):
    """Dead skin flaking off (time-lapse): a soft, dry papery flutter that swells and fades."""
    n = int(dur * SR)
    r = _rng(seed)
    t = np.arange(n) / SR
    x = _bp(r.normal(0, 1, n), 2500, 9000) * (r.random(n) > 0.6) + 0.3 * _bp(r.normal(0, 1, n), 800, 3000)
    flutter = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 11 * t + 3 * np.sin(2 * np.pi * 1.3 * t)))
    return _norm(x * flutter * np.sin(np.pi * t / dur) ** 1.5, 0.35)


def zip_(seed=15, dur=0.9):
    """The cut line running round the star: a quick rising train of fine ticks."""
    n = int(dur * SR)
    out = np.zeros(n)
    r = _rng(seed)
    t, k = 0.0, 0
    while t < dur - 0.02:
        i = int(t * SR)
        m = int(0.008 * SR)
        tt = np.arange(m) / SR
        f = 2500 + 3500 * t / dur
        out[i:i + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.0025) * r.uniform(0.6, 1)
        t += 0.028 - 0.016 * t / dur
        k += 1
    return _norm(out, 0.35)


def plop(seed=20):
    """A fingertip going into the bath: a deep water plop (a falling resonant bubble) and a little splash."""
    r = _rng(seed)
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 420 * r.uniform(0.9, 1.1) * np.exp(-t / 0.05) + 140
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.002, 0.07)
    x += 0.35 * _bp(r.normal(0, 1, n), 1500, 7000) * _env(n, 0.003, 0.05)
    return _norm(x, 0.5)


def bubbles(seed=21, dur=0.9):
    """Small bubbles rising: a scatter of quick rising blips."""
    r = _rng(seed)
    n = int(dur * SR)
    x = np.zeros(n)
    for _ in range(14):
        i = int(r.uniform(0, 0.8) * n)
        m = int(0.05 * SR)
        tt = np.arange(m) / SR
        f0 = r.uniform(600, 1400)
        seg = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 6 * tt)) / SR) * np.exp(-tt / 0.012) * r.uniform(0.3, 1)
        x[i:i + m] += seg[: n - i]
    return _norm(x, 0.4)


def creak(seed=22, dur=1.2):
    """Skin buckling into folds (time-lapse): a soft, slow, rubbery creak."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = _rng(seed)
    grains = (r.random(n) > 0.995).astype(float)
    tone = np.sin(2 * np.pi * (180 + 60 * t / dur) * t) * 0.3
    x = _bp(grains + 0.02 * r.normal(0, 1, n), 300, 2200) * 4 + tone * _lp(r.normal(0, 1, n), 30) * 8
    return _norm(x * np.sin(np.pi * t / dur) ** 1.2, 0.35)


def drip(seed=23, dur=0.8):
    """Water running off the finger: a few drips."""
    r = _rng(seed)
    n = int(dur * SR)
    x = np.zeros(n)
    for k in range(4):
        i = int((0.05 + k * 0.18 + r.uniform(0, 0.05)) * SR)
        m = int(0.08 * SR)
        tt = np.arange(m) / SR
        f = r.uniform(900, 1500) * (1 + 2.5 * tt / 0.08)
        x[i:i + m] += (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.02))[: n - i] * r.uniform(0.5, 1)
    return _norm(x, 0.4)


def rewind(seed=24, dur=0.6):
    """A quick tape rewind (the folds smoothing back out)."""
    t = _t(dur)
    x = np.sin(2 * np.pi * np.cumsum(900 + 1800 * (t / dur) ** 2) / SR) * 0.4 + 0.3 * _bp(_rng(seed).normal(0, 1, len(t)), 2000, 8000)
    return _norm(x * np.sin(np.pi * t / dur), 0.35)


def ticks(seed=25, dur=2.0):
    """Nerve signals: soft electric ticks, a few a second."""
    r = _rng(seed)
    n = int(dur * SR)
    x = np.zeros(n)
    t = 0.05
    while t < dur - 0.05:
        i = int(t * SR)
        m = int(0.02 * SR)
        tt = np.arange(m) / SR
        x[i:i + m] += np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt / 0.004) * r.uniform(0.5, 1)
        t += r.uniform(0.11, 0.2)
    return _norm(x, 0.35)


def squeeze(seed=26, dur=0.7):
    """Vessels tightening: a low, soft squeeze that bends down in pitch."""
    t = _t(dur)
    x = _chirp(160, 95, dur) * 0.7 + 0.2 * _lp(_rng(seed).normal(0, 1, len(t)), 500)
    return _norm(x * np.sin(np.pi * t / dur) ** 0.8, 0.4)


def snap(seed=27):
    """The damaged nerve: a dry snap."""
    r = _rng(seed)
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    x = _bp(r.normal(0, 1, n), 1200, 6000) * _env(n, 0.0004, 0.01) + 0.4 * np.sin(2 * np.pi * 220 * t) * _env(n, 0.001, 0.03)
    return _norm(x, 0.5)


def squelch(seed=28):
    """The wet fingertip meeting the marble: a short squelch."""
    r = _rng(seed)
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    x = _lp(r.normal(0, 1, n), 1200) * (0.6 + 0.4 * np.sin(2 * np.pi * 40 * t)) * _env(n, 0.005, 0.08)
    x += 0.3 * np.sin(2 * np.pi * (500 - 900 * t) * t) * _env(n, 0.002, 0.05)
    return _norm(x, 0.45)


def road(seed=29, dur=8.0):
    """A tyre on a wet road: a steady hiss with a slow swell."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = _bp(_rng(seed).normal(0, 1, n), 1500, 7000) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t))
    edge = np.minimum(1, np.minimum(t / 0.6, (dur - t) / 0.6))
    return _norm(x * edge, 0.3)


def thud(seed=30):
    """'Still debated': a soft low stamp."""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * (90 - 30 * t) * t) * _env(n, 0.002, 0.09) + 0.2 * _bp(_rng(seed).normal(0, 1, n), 800, 3000) * _env(n, 0.001, 0.01)
    return _norm(x, 0.5)


SOUNDS = {"plop": plop, "bubbles": bubbles, "creak": creak, "drip": drip, "rewind": rewind, "ticks": ticks,
          "squeeze": squeeze, "snap": snap, "squelch": squelch, "road": road, "thud": thud, "rustle": rustle, "zip": zip_, "swish": swish, "buzz": buzz, "punch": punch, "gulp": gulp, "fizz": fizz, "squish": squish, "pop": pop,
          "ding": ding, "whir": whir, "zap": zap, "zapbig": zapbig, "shimmer": shimmer, "flow": flow}


def _cues(scene: str) -> list:
    """Cue rows saved by the capture harness: [t, sound, dB, (length)]."""
    path = SCENES / f"{scene}.cues.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def music_env(total_s: float, starts: dict, timings: dict, floor: float = 0.0) -> np.ndarray:
    """The bed fades in over the first second."""
    n = int(total_s * SR)
    t = np.arange(n) / SR
    return np.clip(t / 1.0, 0, 1).astype(np.float32)


def render_track(total_s: float, starts: dict, timings: dict) -> np.ndarray:
    """Place every cue on the global timeline; returns a mono float32 track at SR."""
    out = np.zeros(int((total_s + 8) * SR), np.float32)

    def put(t, snd):
        i = int(round(t * SR))
        j = min(len(out), i + len(snd))
        if j > i >= 0:
            out[i:j] += snd[: j - i].astype(np.float32)

    for scene, s0 in starts.items():
        for k, row in enumerate(_cues(scene)):
            t0, name, gain_db = row[0], row[1], row[2]
            fn = SOUNDS[name]
            snd = fn(k + 1, row[3]) if len(row) > 3 else fn(k + 1)
            put(s0 + t0, snd * 10 ** (gain_db / 20))
    return out[: int(total_s * SR)]
