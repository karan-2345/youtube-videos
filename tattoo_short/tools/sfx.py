"""
tools/sfx.py -- synthesized sound effects (numpy only) and the cue sheet that places them (tattoo Short).

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


SOUNDS = {"rustle": rustle, "zip": zip_, "swish": swish, "buzz": buzz, "punch": punch, "gulp": gulp, "fizz": fizz, "squish": squish, "pop": pop,
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
