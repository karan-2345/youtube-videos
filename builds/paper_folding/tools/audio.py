"""tools/audio.py -- synthesized SFX + a generated music bed + the mix and master (numpy/scipy/ffmpeg only).

Every sound is generated here (no samples, no third-party audio). SFX are placed from cache/cues.json, which
tools/cues.js records from the same seekable timeline the picture is rendered from.

    python tools/audio.py      -> audio/sfx.wav, audio/music.wav, audio/master.wav (48 kHz, -14 LUFS, <= -1 dBTP)
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, oaconvolve

ROOT = Path(__file__).resolve().parents[1]
SR = 48_000
TARGET_LUFS, TP = -14.0, -1.0
A = ROOT / "audio"


def rng(s):
    return np.random.default_rng(s)


def bp(x, lo, hi, o=2):
    return sosfilt(butter(o, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, o=2):
    return sosfilt(butter(o, f, btype="low", fs=SR, output="sos"), x)


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4))


def norm(x, p):
    return x / (np.abs(x).max() + 1e-9) * p


# ---------------------------------------------------------------- the sounds
def crease(seed, weight=1.0):
    """A sheet folded and pressed flat: a rustle, then the crease pressed (a soft papery snap and a low thump)."""
    r = rng(seed)
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    rustle = bp(r.normal(0, 1, n), 700, 5200) * env(n, 0.05, 0.09) * (0.6 + 0.4 * np.sin(2 * np.pi * r.uniform(18, 30) * t))
    k = int(0.11 * SR)
    snap = np.zeros(n); snap[k:] = bp(r.normal(0, 1, n - k), 1800, 7500) * env(n - k, 0.002, 0.025)
    thump = np.zeros(n); thump[k:] = np.sin(2 * np.pi * (95 + 40 * weight) * t[: n - k]) * env(n - k, 0.003, 0.05) * 0.8 * weight
    return norm(0.55 * rustle + 0.6 * snap + thump, 0.5)


def tick(seed):
    r = rng(seed)
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    x = bp(r.normal(0, 1, n), 2500, 8000) * env(n, 0.0004, 0.004) + 0.5 * np.sin(2 * np.pi * 2300 * t) * env(n, 0.0005, 0.005)
    return norm(x, 0.35)


def gold(seed):
    """Gold leaf: a thinner, brighter crinkle with a faint metallic ring."""
    r = rng(seed)
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    crk = bp(r.normal(0, 1, n), 2500, 10000) * env(n, 0.01, 0.05)
    ring = sum(np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * np.exp(-t / d) for f, d in ((3170, 0.25), (4630, 0.18), (6020, 0.12)))
    return norm(crk + 0.05 * ring, 0.4)


def strain(seed):
    """The eighth fold refusing: a slow creak of compressed paper."""
    r = rng(seed)
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    am = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (14 + 6 * t) * t))
    x = bp(r.normal(0, 1, n), 300, 2400) * am * env(n, 0.25, 0.4)
    return norm(lp(x, 3000), 0.4)


def strike(seed):
    r = rng(seed)
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    x = bp(r.normal(0, 1, n), 1200, 4200) * np.minimum(1, t / 0.3) * np.exp(-np.maximum(0, t - 0.3) / 0.03)
    return norm(x, 0.35)


def thud(seed):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * 70 * t) * env(n, 0.004, 0.08) + 0.2 * bp(rng(seed).normal(0, 1, n), 200, 900) * env(n, 0.002, 0.03), 0.45)


def ping(seed, f=880):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (0.5 / m)) for m, a in ((1, 1), (2, 0.3), (3, 0.12)))
    return norm(x * np.minimum(1, t / 0.004), 0.3)


def whoosh(seed, dur=5.0, peak=0.6):
    """A long airy swell for the big camera flights (noise through a slowly opening filter)."""
    r = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = r.normal(0, 1, n)
    lo = lp(x, 500, 2); mid = bp(x, 400, 2500, 2)
    u = t / dur
    shape = np.sin(np.pi * np.clip(u / peak, 0, 1) / 2) ** 2 * np.clip((1 - u) / (1 - peak), 0, 1) ** 1.5
    return norm((lo + 0.6 * mid * u) * shape, 0.4)


def unroll(seed, dur=2.4):
    r = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(r.normal(0, 1, n), 500, 4000) * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 11 * t))) * env(n, 0.2, dur * 0.5)
    return norm(x, 0.3)


def sfx_track(total, cues):
    out = np.zeros(int((total + 6) * SR))

    def put(t, x, db=0.0):
        i = int(round(t * SR))
        j = min(len(out), i + len(x))
        if j > i >= 0:
            out[i:j] += x[: j - i] * 10 ** (db / 20)

    for k, (t, ch, v) in enumerate(cues):
        s = k + 1
        if ch == "s00fold":
            if v <= 7: put(t, crease(s, 0.6), -4)
            else: put(t, tick(s), -10 + 4 * (v == 42))
            if v == 42: put(t, thud(s), -3)
        elif ch == "s00strip": put(t - 0.2, whoosh(s, 5.8, 0.75), -2)
        elif ch == "s01fold": put(t, crease(s, 0.5 + v / 10), -2)
        elif ch == "s01strain" and v == 1: put(t, strain(s), -6)
        elif ch == "s02fold": put(t, gold(s), -6)
        elif ch == "s02strike" and v == 1: put(t, strike(s), -6)
        elif ch == "s02swap" and v == 1: put(t, thud(s), -8)
        elif ch == "s03step": put(t, ping(s, 440 * 2 ** (v / 4)), -10); put(t, tick(s), -8)
        elif ch == "s03glow" and v: put(t, ping(s, 660), -14)
        elif ch == "s04fold": put(t, crease(s, 0.3), -10)
        elif ch == "s04bar" and v == 1: put(t, whoosh(s, 3.0, 0.5), -6)
        elif ch == "s05fold":
            put(t, tick(s), -12 + 5 * (v in (22, 42)))
            if v == 42: put(t, thud(s), -6)
        elif ch == "s05end" and v == 1: put(t + 3.5, unroll(s), -8)
    return out[: int(total * SR)].astype(np.float32)


# ---------------------------------------------------------------- music: a quiet bed, A minor add9 / F maj7 / C add9 / G6, 72 bpm
CHORDS = [(55.0, [220.0, 261.63, 329.63, 493.88]), (43.65, [174.61, 220.0, 261.63, 329.63]),
          (65.41, [196.0, 261.63, 293.66, 329.63]), (49.0, [196.0, 246.94, 293.66, 329.63])]


def note(f, dur, amp, parts):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / d) for k, (a, d) in enumerate(parts, 1))
    return x * np.minimum(1, t / 0.008) * amp


def music(total, seed=7):
    bpm = 72.0; beat = 60 / bpm; bar = 4 * beat
    n = int(total * SR) + SR
    L = np.zeros(n); R = np.zeros(n)
    r = rng(seed)
    t, k = 0.0, 0
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    while t < total:
        root, tones = CHORDS[int(t // bar) % 4]
        i = int(t * SR)
        if k % 8 == 0:
            for j, f in enumerate(tones):
                x = note(f, bar * 1.15, 0.06, ((1.0, 2.0), (0.2, 0.8), (0.05, 0.3)))
                e = min(n, i + len(x)); p = 0.3 + 0.13 * j
                L[i:e] += x[: e - i] * (1 - p); R[i:e] += x[: e - i] * p
            x = note(root, bar, 0.2, ((1.0, 1.8), (0.3, 0.6)))
            e = min(n, i + len(x)); L[i:e] += x[: e - i]; R[i:e] += x[: e - i]
        if r.random() > 0.3:
            x = note(tones[pattern[k % 8]] * 2, 0.6, 0.035 * (1 if k % 2 == 0 else 0.6), ((1.0, 0.25), (0.25, 0.08)))
            e = min(n, i + len(x)); p = 0.5 + 0.25 * np.sin(k * 0.7)
            L[i:e] += x[: e - i] * (1 - p); R[i:e] += x[: e - i] * p
        k += 1; t += beat / 2
    out = np.stack([L, R], 1)
    out = sosfilt(butter(2, 3800, btype="low", fs=SR, output="sos"), out, axis=0)
    irn = int(1.4 * SR)
    for c in range(2):
        ir = r.normal(0, 1, irn) * np.exp(-np.arange(irn) / (0.35 * SR)); ir /= np.sqrt((ir ** 2).sum())
        out[:, c] = 0.7 * out[:, c] + 0.3 * oaconvolve(out[:, c], ir)[:n]
    out = out[: int(total * SR)]
    tt = np.arange(len(out)) / SR
    out *= (np.minimum(1, tt / 1.0) * np.minimum(1, (total - tt) / 1.2))[:, None]   # in and out, for the loop
    return (out / np.abs(out).max() * 0.5).astype(np.float32)


# ---------------------------------------------------------------- loudness and mastering
def measure(path, extra=""):
    o = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
                        f"{extra}loudnorm=I={TARGET_LUFS}:TP={TP}:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    return json.loads(re.findall(r"{[^{}]*}", o)[-1])


def lufs(path):
    o = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", o)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", o)[-1])


def main():
    tim = json.loads((ROOT / "cache/timings.json").read_text())
    total = tim["duration"]
    cues = json.loads((ROOT / "cache/cues.json").read_text())
    sf.write(A / "sfx.wav", sfx_track(total, cues), SR)
    sf.write(A / "music.wav", music(total), SR)
    lv, ls, lm = (lufs(A / f)[0] for f in ("voice.wav", "sfx.wav", "music.wav"))
    MUSIC_BELOW, SFX_BELOW = 17.0, 9.0
    gm, gs = 10 ** ((lv - MUSIC_BELOW - lm) / 20), 10 ** ((lv - SFX_BELOW - ls) / 20)
    n = int(round(total * SR))
    fc = (f"[0:a]aresample={SR},pan=stereo|c0=c0|c1=c0,asplit=2[v][vsc];"
          f"[2:a]volume={gm:.4f}[m];[m][vsc]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=700[md];"
          f"[1:a]volume={gs:.4f},pan=stereo|c0=c0|c1=c0[s];"
          f"[v][s][md]amix=inputs=3:normalize=0:dropout_transition=0,apad,atrim=end_sample={n}[out]")
    premix = A / "premix.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(A / "voice.wav"), "-i", str(A / "sfx.wav"), "-i", str(A / "music.wav"),
                    "-filter_complex", fc, "-map", "[out]", "-c:a", "pcm_f32le", str(premix)], check=True)
    # one linear gain to -14 LUFS; if that would push true peaks past -1 dBTP, a look-ahead limiter first trims those few peaks
    m0 = measure(premix)
    gain = TARGET_LUFS - float(m0["input_i"])
    ceiling = TP - gain - 1.3
    src = premix
    if float(m0["input_tp"]) > ceiling:
        src = A / "premix_lim.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(premix), "-af",
                        f"alimiter=limit={10 ** (ceiling / 20):.5f}:attack=5:release=60:level=0", "-c:a", "pcm_f32le", str(src)], check=True)
    m = measure(src)
    norm_f = (f"loudnorm=I={TARGET_LUFS}:TP={TP}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
              f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json")
    o = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-nostats", "-i", str(src), "-af", f"{norm_f},aresample={SR}",
                        "-c:a", "pcm_s24le", str(A / "master.wav")], capture_output=True, text=True, check=True).stderr
    m2 = json.loads(re.findall(r"{[^{}]*}", o)[-1])
    res = {"voice_lufs": lv, "sfx_lufs": ls, "music_lufs": lm, "music_gain_db": 20 * np.log10(gm), "sfx_gain_db": 20 * np.log10(gs),
           "premix_lufs": float(m0["input_i"]), "limited": src != premix, "master_lufs": float(m2["output_i"]),
           "master_tp": float(m2["output_tp"]), "type": m2["normalization_type"]}
    (ROOT / "cache/mix.json").write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
