"""
tools/sfx.py -- synthesized sound effects (numpy only, no third-party audio) and the cue sheet that places them.

Landing tinks come from the same needle schedule the scene animates (renders/cache/scene.json "cues"); the rest
(typing ticks, the bell when a traced circle closes, soft reveals) are placed on the phrase anchors.

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


def _norm(x, peak=0.5):
    return x / (np.abs(x).max() + 1e-9) * peak


def tink(seed: int) -> np.ndarray:
    """A steel needle landing on oiled oak: a tiny metallic ring over a soft wooden tap."""
    r = np.random.default_rng(seed)
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    base = r.uniform(0.85, 1.2)
    for f, d, a in ((3150, 0.045, 1.0), (5230, 0.03, 0.7), (7480, 0.02, 0.45), (9900, 0.012, 0.3)):
        x += a * np.sin(2 * np.pi * f * base * t + r.uniform(0, 6.3)) * np.exp(-t / d)
    wood = _bp(r.normal(0, 1, n), 500, 2200) * np.exp(-t / 0.006) * 2.2
    x = 0.55 * x + wood
    if r.random() < 0.6:                                  # a small second bounce
        k = int(r.uniform(0.025, 0.05) * SR)
        x[k:] += 0.35 * x[: n - k]
    return _norm(x * np.minimum(1, t / 0.0004), 0.5)


def tick(seed: int = 4) -> np.ndarray:
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    x = _bp(np.random.default_rng(seed).normal(0, 1, n), 2500, 8000) * np.exp(-t / 0.003) \
        + 0.4 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.004)
    return _norm(x, 0.4)


def bell(seed: int = 1, f0: float = 784.0) -> np.ndarray:
    """A soft struck bell (inharmonic partials), for a traced circle closing."""
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, (ratio, d, a) in enumerate(((1.0, 1.6, 1.0), (2.76, 0.7, 0.45), (5.4, 0.3, 0.25), (8.93, 0.15, 0.12))):
        x += a * np.sin(2 * np.pi * f0 * ratio * t + k) * np.exp(-t / d)
    return _norm(x * np.minimum(1, t / 0.003), 0.5)


def thock(seed: int = 2) -> np.ndarray:
    """A soft low reveal: felt mallet on a wooden box."""
    r = np.random.default_rng(seed)
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r.uniform(0.98, 1.02) * t) * np.exp(-t / d)
            for f, d, a in ((92, 0.16, 1.0), (185, 0.08, 0.5), (410, 0.03, 0.25)))
    x += 0.15 * _bp(r.normal(0, 1, n), 800, 3000) * np.exp(-t / 0.004)
    return _norm(x * np.minimum(1, t / 0.002), 0.5)


def whoosh_stop(seed: int = 1, dur: float = 0.55) -> np.ndarray:
    """Air rushing in, then time stops: a swelling filtered noise cut dead, and a low thump with a tail."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = r.normal(0, 1, n)
    swell = sum(_bp(noise, lo, lo * 2.2) * np.clip(t / dur - i * 0.12, 0, 1) ** 2 for i, lo in enumerate((300, 900, 2400)))
    swell *= np.minimum(1, (dur - t) / 0.004)
    m = int(1.6 * SR)
    tt = np.arange(m) / SR
    thump = np.sin(2 * np.pi * 58 * tt) * np.exp(-tt / 0.25) + 0.4 * np.sin(2 * np.pi * 116 * tt) * np.exp(-tt / 0.12)
    tail = _bp(r.normal(0, 1, m), 200, 1200) * np.exp(-tt / 0.5) * 0.12
    out = np.concatenate([_norm(swell, 0.35), _norm(thump + tail, 0.55)])
    return out


def rewind(seed: int = 1, dur: float = 1.25) -> np.ndarray:
    """Tape rewinding: a fluttering band of noise sweeping up, fading in fast and out slow."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    noise = r.normal(0, 1, n)
    for i, (lo, hi) in enumerate(((400, 900), (900, 2000), (2000, 4500), (4500, 9000))):
        band = _bp(noise, lo, hi)
        w = np.exp(-((t / dur - (0.15 + 0.22 * i)) ** 2) / 0.03)
        out += band * w
    flutter = 1 + 0.35 * np.sin(2 * np.pi * (14 + 30 * t / dur) * t)
    env = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.5)
    return _norm(out * flutter * env, 0.5)


SOUNDS = {"tink": tink, "freeze": whoosh_stop, "rewind": rewind, "tick": tick, "bell": bell, "thock": thock}


def extra_cues(A: dict) -> list:
    """Cues placed on phrase anchors (the scene uses the same anchors for what they belong to)."""
    out = []
    six, right = A["six"], A["right"]
    for k in range(6):                                    # the six decimals typing out
        out.append([six + (right - six + 0.2) * (k + 1) / 7, "tick", -10.0, k + 1])
    out.append([A["a_circle"] + 0.05, "bell", -14.0, 1])                    # ring 1 closes as the needle lands
    out.append([A["full_circle"] + 0.75, "bell", -13.0, 2])                  # ring 2 closes
    out.append([A["two_over_pi"] - 0.3, "thock", -8.0, 1])
    out.append([A["frac"] - 0.3, "thock", -8.0, 2])
    out.append([A["drops3408"], "thock", -10.0, 3])
    out.append([A["right_number"] + 0.3, "tick", -8.0, 9])
    out.append([A["one_decimal"] - 0.05, "thock", -9.0, 4])
    out.append([A["trick"] - 0.05, "thock", -9.0, 5])
    out.append([A["but_his"] + 0.35, "rewind", -20.0, 7])                    # (soft) the strike being drawn
    return out


def cue_sheet() -> list:
    d = json.loads(SCENE.read_text())
    return sorted(d["cues"] + extra_cues(d["anchors"]), key=lambda c: c[0])


def render_track(total_s: float) -> np.ndarray:
    out = np.zeros(int((total_s + 4) * SR), np.float32)
    cache: dict = {}
    for t0, name, gain_db, seed in cue_sheet():
        key = (name, seed if name != "tink" else seed % 64)
        if key not in cache:
            cache[key] = SOUNDS[name](key[1]).astype(np.float32)
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
    sf.write(ROOT / "audio" / "sfx_preview.wav", x, SR)
    print(f"  sfx: {len(cue_sheet())} cues, peak {np.abs(x).max():.2f}")
