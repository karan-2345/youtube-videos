"""
tools/sfx.py -- synthesized sound effects (numpy only) and the cue sheet that places them (chess Short).

Every effect is generated here, so there are no third-party audio licences. Every piece that lands on the board gets
its own knock at the moment it lands, read from the same move schedule the scene animates (scenes/3d/export.py
writes it into renders/cache/scenes/<Scene>.json as cue rows).

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


def _env(n, a, r):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))


def _bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def _norm(x, peak=0.5):
    return x / (np.abs(x).max() + 1e-9) * peak


# ---------------------------------------------------------------- the board
def _modes(modes, dur, r, click=0.0):
    """Damped sinusoids (frequency Hz, decay s, amplitude), each detuned a little, plus an optional noise click."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f, d, a in modes:
        f *= r.uniform(0.96, 1.04)
        x += a * np.sin(2 * np.pi * f * t + r.uniform(0, 6.3)) * np.exp(-t / d)
    if click:
        x += click * _bp(r.normal(0, 1, n), 1500, 6000) * np.exp(-t / 0.0015)
    return x * np.minimum(1, t / 0.0008)


def tok(seed: int = 1) -> np.ndarray:
    """A felted wooden piece set down on a wooden board: a dull knock, most of it from the board."""
    r = _rng(seed)
    x = _modes([(240, 0.030, 1.0), (610, 0.016, 0.55), (1180, 0.009, 0.35), (2650, 0.004, 0.15)], 0.12, r, click=0.12)
    return _norm(x, 0.5)


def thock(seed: int = 2) -> np.ndarray:
    """A piece put down firmly: deeper, with more of the table in it."""
    r = _rng(seed)
    x = _modes([(118, 0.07, 1.0), (300, 0.035, 0.6), (720, 0.016, 0.35), (1650, 0.007, 0.18)], 0.3, r, click=0.1)
    return _norm(x, 0.5)


def tick(seed: int = 4) -> np.ndarray:
    """A small dry tick (the count moving on), like a clock's escapement."""
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    x = _bp(_rng(seed).normal(0, 1, n), 3000, 9000) * _env(n, 0.0004, 0.003) \
        + 0.4 * np.sin(2 * np.pi * 2900 * t) * _env(n, 0.0005, 0.004)
    return _norm(x, 0.4)


SOUNDS = {"tok": tok, "thock": thock, "tick": tick}


def _cues(scene: str) -> list:
    """Cue rows exported with the scene data: [t, sound, dB]."""
    path = SCENES / f"{scene}.json"
    return json.loads(path.read_text(encoding="utf-8")).get("cues", []) if path.exists() else []


def music_env(total_s: float, starts: dict, timings: dict, floor: float = 0.0) -> np.ndarray:
    """The bed fades in over the first 1.5 s."""
    n = int(total_s * SR)
    t = np.arange(n) / SR
    return np.clip(t / 1.5, 0, 1).astype(np.float32)


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
