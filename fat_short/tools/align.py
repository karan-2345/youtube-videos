"""
tools/align.py -- word times inside one synthesized sentence, without a speech recogniser.

Kokoro gives no timestamps, so each word is placed by its share of the sentence's PHONEMES (a better proxy for
duration than letters), and every comma is pinned to a pause actually found in the audio. Between two pins the words
share the speech time by phoneme count. Good to about +-0.1 s, which is what the picture needs to hit a word.
"""

from __future__ import annotations

import re

import numpy as np

SR = 24_000
HOP = 0.01


def _pauses(a: np.ndarray, min_gap: float = 0.06) -> list[tuple[float, float]]:
    """Quiet stretches (start, end) in seconds, longest-first irrelevant: returned in time order."""
    win = int(0.025 * SR)
    hop = int(HOP * SR)
    n = max(1, (len(a) - win) // hop)
    rms = np.array([np.sqrt(np.mean(a[i * hop: i * hop + win] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms / (rms.max() + 1e-12))
    quiet = db < -34
    out, i = [], 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            t0, t1 = i * HOP + 0.0125, j * HOP + 0.0125
            if t1 - t0 >= min_gap and t0 > 0.05 and t1 < len(a) / SR - 0.05:
                out.append((t0, t1))
            i = j
        else:
            i += 1
    return out


def word_times(text: str, audio: np.ndarray, phon) -> list[tuple[str, float, float]]:
    """[(word, start, end)] relative to the start of `audio`. `phon(word) -> phoneme string`."""
    toks = text.split()
    wts = []
    for w in toks:
        core = re.sub(r"[^\w'.]", "", w).strip(".")
        p = re.sub(r"[ˈˌ\s]", "", phon(core)) if core else ""
        wts.append(max(len(p), 1) + 0.6)              # +0.6: every word has some onset/transition time
    dur = len(audio) / SR
    gaps = _pauses(audio)
    # expected time of each comma (end of the word carrying it) by phoneme share over the whole sentence
    cum = np.cumsum(wts) / sum(wts)
    pins = []                                          # (token index after which the pause falls, gap)
    used = -1
    for i, w in enumerate(toks[:-1]):
        if not w.endswith((",", ";", ":")):
            continue
        exp = cum[i] * dur
        best, bd = None, 0.7
        for gi, (g0, g1) in enumerate(gaps):
            if gi <= used:
                continue
            d = abs(0.5 * (g0 + g1) - exp)
            if d < bd:
                best, bd = gi, d
        if best is not None:
            pins.append((i, gaps[best]))
            used = best
    # segments between pins: (first token, last token, t0, t1)
    segs, i0, t0 = [], 0, 0.0
    for i, (g0, g1) in pins:
        segs.append((i0, i, t0, g0))
        i0, t0 = i + 1, g1
    segs.append((i0, len(toks) - 1, t0, dur))
    out = []
    for a, b, s0, s1 in segs:
        tot = sum(wts[a:b + 1])
        t = s0
        for k in range(a, b + 1):
            d = (s1 - s0) * wts[k] / tot
            out.append((toks[k], round(t, 3), round(t + d, 3)))
            t += d
    return out
