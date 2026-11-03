"""Mix voice, music and SFX with the channel's rules, then loudness-normalise.

Music premixed 13 LU under (about 18 LU after ducking) the voice, SFX 13 LU under, music ducked under the
voice (sidechain envelope), then a look-ahead limiter and one linear gain to -14 LUFS / -1 dBTP.

    python tools/mix.py   -> audio/master.wav + audio/stems/{voice,music,sfx}.wav
"""
import json
import os
import subprocess

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
A = lambda p: os.path.join(ROOT, p)  # noqa: E731


def load():
    v, sr = sf.read(A("audio/narration.wav"), always_2d=False)
    v = resample_poly(v, SR, sr)
    m, _ = sf.read(A("audio/music.wav"))
    s, _ = sf.read(A("audio/sfx.wav"))
    n = max(len(v), len(m), len(s))
    pad = lambda x: np.pad(x, [(0, n - len(x))] + [(0, 0)] * (x.ndim - 1))  # noqa: E731
    v = np.stack([pad(v)] * 2, 1)
    return v, pad(m), pad(s)


def duck_env(v, depth_db=6.0):
    x = np.abs(v[:, 0])
    win = int(0.03 * SR)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same") + 1e-12)
    db = 20 * np.log10(rms)
    target = -depth_db * np.clip((db + 42) / 14, 0, 1)
    # attack 30 ms, release 450 ms (one-pole smoothing, block-wise for speed)
    out = np.empty_like(target)
    g = 0.0
    a_att, a_rel = np.exp(-1 / (0.03 * SR)), np.exp(-1 / (0.45 * SR))
    step = 48
    for i in range(0, len(target), step):
        tg = target[i:i + step].min()
        a = a_att ** step if tg < g else a_rel ** step
        g = a * g + (1 - a) * tg
        out[i:i + step] = g
    return 10 ** (out / 20)


def lufs(x, meter):
    return meter.integrated_loudness(x)


def main():
    v, m, s = load()
    meter = pyln.Meter(SR)
    lv, lm, ls = lufs(v, meter), lufs(m, meter), lufs(s, meter)
    gm = 10 ** (((lv - 13) - lm) / 20)
    gs = 10 ** (((lv - 13) - ls) / 20)
    duck = duck_env(v)
    music = m * gm * duck[:, None]
    sfx = s * gs
    mix = v + music + sfx
    os.makedirs(A("audio/stems"), exist_ok=True)
    for name, x in (("voice", v), ("music", music), ("sfx", sfx)):
        sf.write(A(f"audio/stems/{name}.wav"), x.astype(np.float32), SR, subtype="FLOAT")
    sf.write(A("audio/premix.wav"), mix.astype(np.float32), SR, subtype="FLOAT")
    print(f"voice {lv:.1f} LUFS | music {lm:.1f} -> {lufs(music, meter):.1f} (ducked) | sfx {ls:.1f} -> {lufs(sfx, meter):.1f}")

    # Linear master: a look-ahead peak limiter on the premix, then one gain to -14 LUFS with the true peak at or
    # below -1 dBTP (ffmpeg's loudnorm would fall back to dynamic mode on this voice's peaks).
    x = mix.copy()
    for _ in range(4):
        gain_db = -14.0 - meter.integrated_loudness(x)
        ceil = 10 ** ((-1.3 - gain_db) / 20)
        x = limit(mix, ceil)
    gain_db = -14.0 - meter.integrated_loudness(x)
    out = x * 10 ** (gain_db / 20)
    tp = true_peak_db(out)
    sf.write(A("audio/master.wav"), out.astype(np.float32), SR, subtype="PCM_24")
    reduced = 20 * np.log10(np.abs(mix).max() / max(1e-9, np.abs(x).max()))
    print(f"limiter: peaks trimmed by {reduced:.1f} dB | linear gain {gain_db:+.2f} dB")
    y, _ = sf.read(A("audio/master.wav"))
    print(f"master check: {meter.integrated_loudness(y):.2f} LUFS, true peak {tp:.2f} dBTP, {len(y) / SR:.2f} s")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", A("audio/master.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    summ = r.stderr[r.stderr.rindex("Summary:"):]
    print("ffmpeg ebur128:", " | ".join(l.strip() for l in summ.splitlines() if any(k in l for k in ("I:", "LRA:", "Peak:"))))


def limit(x, ceil, look=0.005, release=0.08):
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    a = np.abs(x).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(a, 1e-9))
    la = int(look * SR)
    g = minimum_filter1d(need, 2 * la + 1)
    # release: let the gain recover slowly (one-pole, block-wise), never faster than the min filter allows
    out = np.empty_like(g)
    cur, k = 1.0, np.exp(-64 / (release * SR))
    for i in range(0, len(g), 64):
        tg = g[i:i + 64].min()
        cur = tg if tg < cur else k * cur + (1 - k) * tg
        out[i:i + 64] = cur
    out = np.minimum(out, g)
    out = uniform_filter1d(out, la + 1)
    return x * out[:, None]


def true_peak_db(x):
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max())


if __name__ == "__main__":
    main()
