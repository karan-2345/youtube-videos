"""Mix voice, music and SFX with the channel's rules, then loudness-normalise.

Music premixed 16 LU under the voice, SFX 10 LU under, music and SFX ducked under the
voice (sidechain envelope), then ffmpeg two-pass loudnorm to -14 LUFS / -1 dBTP.

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
    gm = 10 ** (((lv - 16) - lm) / 20)
    gs = 10 ** (((lv - 10) - ls) / 20)
    duck = duck_env(v)
    music = m * gm * duck[:, None]
    sfx = s * gs * duck_env(v, depth_db=5.0)[:, None]      # effects step back 5 dB while the voice is talking
    mix = v + music + sfx
    os.makedirs(A("audio/stems"), exist_ok=True)
    for name, x in (("voice", v), ("music", music), ("sfx", sfx)):
        sf.write(A(f"audio/stems/{name}.wav"), x.astype(np.float32), SR, subtype="FLOAT")
    sf.write(A("audio/premix.wav"), mix.astype(np.float32), SR, subtype="FLOAT")
    print(f"voice {lv:.1f} LUFS | music {lm:.1f} -> {lufs(music, meter):.1f} (ducked) | sfx {ls:.1f} -> {lufs(sfx, meter):.1f}")

    # ffmpeg two-pass loudnorm
    p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", A("audio/premix.wav"), "-af",
                         "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                        capture_output=True, text=True)
    js = p1.stderr[p1.stderr.rindex("{"): p1.stderr.rindex("}") + 1]
    st = json.loads(js)
    af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
          f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:offset={st['target_offset']}:"
          f"linear=true:print_format=json")
    p2 = subprocess.run(["ffmpeg", "-hide_banner", "-y", "-i", A("audio/premix.wav"), "-af", af, "-ar", str(SR),
                         "-c:a", "pcm_s24le", A("audio/master.wav")], capture_output=True, text=True)
    js2 = json.loads(p2.stderr[p2.stderr.rindex("{"): p2.stderr.rindex("}") + 1])
    print(f"loudnorm pass 1: I={st['input_i']} TP={st['input_tp']} | pass 2 mode: {js2.get('normalization_type')}, "
          f"out I={js2['output_i']} TP={js2['output_tp']}")
    x, _ = sf.read(A("audio/master.wav"))
    print(f"master check: {meter.integrated_loudness(x):.2f} LUFS, sample peak {20 * np.log10(np.abs(x).max()):.2f} dBFS, {len(x) / SR:.2f} s")


if __name__ == "__main__":
    main()
