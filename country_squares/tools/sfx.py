"""
tools/sfx.py -- synthesized sound effects (numpy only) and the cue sheet that places them.

Every effect is generated here, so there are no third-party audio licences. The cues come from the same key schedule
the scene animates: scenes/export.py writes them into renders/cache/scenes/<Scene>.json as [t, sound, dB] rows (the
counter ticks are measured from the browser's own camera by tools/probe.py).

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


def _bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def _norm(x, peak=0.5):
    return x / (np.abs(x).max() + 1e-9) * peak


def pop(seed: int = 1) -> np.ndarray:
    """A square landing in its place: a short rounded pop (a pitched sine with a fast downward glide)."""
    r = _rng(seed)
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f0 = 520 * r.uniform(0.9, 1.15)
    ph = 2 * np.pi * np.cumsum(f0 * (1 + 1.2 * np.exp(-t / 0.012))) / SR
    x = np.sin(ph) * np.exp(-t / 0.03) * np.minimum(1, t / 0.001)
    return _norm(x, 0.5)


def tick(seed: int = 4) -> np.ndarray:
    """A small dry tick (the rank counter moving on)."""
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.0004) * np.exp(-t / 0.003)
    x = _bp(_rng(seed).normal(0, 1, n), 3000, 9000) * env + 0.4 * np.sin(2 * np.pi * 2600 * t) * env
    return _norm(x, 0.4)


def whoosh(seed: int = 3, dur: float = 1.2, up: bool = True) -> np.ndarray:
    """Air moving past: band-passed noise whose centre sweeps up (or down), swelling in the middle."""
    r = _rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = r.normal(0, 1, n)
    out = np.zeros(n)
    bands = np.geomspace(300, 4000, 9)
    u = t / dur
    centre = np.geomspace(400, 3200, n) if up else np.geomspace(3200, 400, n)
    for lo, hi in zip(bands[:-1], bands[1:]):
        mid = np.sqrt(lo * hi)
        w = np.exp(-0.5 * (np.log(centre / mid) / 0.35) ** 2)
        out += _bp(noise, lo, hi) * w
    out *= np.sin(np.pi * u) ** 1.5
    return _norm(out, 0.5)


def thump(seed: int = 5) -> np.ndarray:
    """A soft low hit under a big number arriving on screen."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(55 * (1 + 1.5 * np.exp(-t / 0.03))) / SR
    x = np.sin(ph) * np.exp(-t / 0.16) * np.minimum(1, t / 0.002)
    x += 0.15 * _bp(_rng(seed).normal(0, 1, n), 800, 3000) * np.exp(-t / 0.01)
    return _norm(x, 0.5)


def chime(seed: int = 6) -> np.ndarray:
    """A bright two-note bell for the end of a long trip (the last square found)."""
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f, d0 in ((1318.5, 0.0), (1975.5, 0.07)):
        tt = np.maximum(0, t - d0)
        for k, (a, d) in enumerate(((1.0, 0.5), (0.25, 0.18), (0.08, 0.07)), 1):
            x += a * np.sin(2 * np.pi * f * k * 1.0007 ** k * tt) * np.exp(-tt / d) * (t >= d0)
    return _norm(x * np.minimum(1, t / 0.002), 0.4)


def _whoosh_cue(dur):
    return lambda seed: whoosh(seed, dur)


SOUNDS = {"pop": pop, "tick": tick, "thump": thump, "chime": chime,
          "whoosh": _whoosh_cue(1.2), "whoosh_long": _whoosh_cue(2.6), "whoosh_short": _whoosh_cue(0.7)}


def _cues(scene: str) -> list:
    path = SCENES / f"{scene}.json"
    return json.loads(path.read_text(encoding="utf-8")).get("cues", []) if path.exists() else []


def music_env(total_s: float, starts: dict, timings: dict, floor: float = 0.0) -> np.ndarray:
    """The bed fades in over the first 0.8 s."""
    n = int(total_s * SR)
    t = np.arange(n) / SR
    return np.clip(t / 0.8, 0, 1).astype(np.float32)


def render_track(total_s: float, starts: dict, timings: dict) -> np.ndarray:
    """Place every cue on the global timeline; returns a mono float32 track at SR."""
    out = np.zeros(int((total_s + 8) * SR), np.float32)

    def put(t, snd):
        i = int(round(t * SR))
        j = min(len(out), i + len(snd))
        if j > i >= 0:
            out[i:j] += snd[: j - i].astype(np.float32)

    for scene, s0 in starts.items():
        for k, (t0, name, gain_db) in enumerate(_cues(scene)):
            put(s0 + t0, SOUNDS[name](k + 1) * 10 ** (gain_db / 20))
    return out[: int(total_s * SR)]
