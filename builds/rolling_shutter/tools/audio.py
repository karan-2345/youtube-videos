"""tools/audio.py (rolling shutter) -- synthesized SFX + a generated music bed + the mix and master (numpy/scipy/ffmpeg only).

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


# ---------------------------------------------------------------- the sounds (all synthesised here)
def tick(seed, f=2300):
    r = rng(seed)
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    x = bp(r.normal(0, 1, n), 2500, 8000) * env(n, 0.0004, 0.004) + 0.5 * np.sin(2 * np.pi * f * t) * env(n, 0.0005, 0.005)
    return norm(x, 0.35)


def readout(seed, dur=2.0):
    """A scan pass: a faint, fine-grained electronic shimmer (rows being read), rising and settling."""
    r = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    grain = (np.sin(2 * np.pi * 180 * t) > 0.6).astype(float) * 0.5 + 0.5
    x = bp(r.normal(0, 1, n), 3000, 9000) * grain
    tone = 0.25 * np.sin(2 * np.pi * (1320 + 120 * t / dur) * t)
    shape = np.minimum(1, t / 0.25) * np.clip((dur - t) / 0.6, 0, 1)
    return norm((x * 0.6 + tone) * shape, 0.25)


def shutter(seed):
    r = rng(seed)
    n = int(0.12 * SR)
    x = np.zeros(n)
    for k, d in ((0, 0.004), (int(0.055 * SR), 0.006)):
        m = n - k
        x[k:] += bp(r.normal(0, 1, m), 1500, 7000) * env(m, 0.0005, d)
    return norm(x, 0.5)


def thud(seed):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * 70 * t) * env(n, 0.004, 0.08) + 0.2 * bp(rng(seed).normal(0, 1, n), 200, 900) * env(n, 0.002, 0.03), 0.45)


def whoosh(seed, dur=1.6, peak=0.5):
    r = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = r.normal(0, 1, n)
    u = t / dur
    shape = np.sin(np.pi * np.clip(u / peak, 0, 1) / 2) ** 2 * np.clip((1 - u) / (1 - peak), 0, 1) ** 1.5
    return norm((lp(x, 500, 2) + 0.6 * bp(x, 400, 2500, 2) * u) * shape, 0.4)


def pluck(seed, f=82.41, dur=4.0):
    """Karplus-Strong: a plucked low E string at 82.41 Hz."""
    r = rng(seed)
    n = int(dur * SR)
    p = int(round(SR / f))
    buf = r.uniform(-1, 1, p)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    out = lp(out, 3000) * np.minimum(1, np.arange(n) / (0.002 * SR))
    return norm(out, 0.5)


def sfx_track(total, cues):
    out = np.zeros(int((total + 6) * SR))

    def put(t, x, db=0.0):
        i = int(round(t * SR))
        j = min(len(out), i + len(x))
        if j > i >= 0:
            out[i:j] += x[: j - i] * 10 ** (db / 20)

    for k, (t, ch, v) in enumerate(cues):
        s = k + 1
        if ch == "sweep_on": put(t, readout(s, 2.6), -10)
        elif ch == "sweep_start": put(t, readout(s, 2.2), -12); put(t, tick(s, 1800), -14)
        elif ch == "sweep_end": put(t, tick(s, 1400), -16)
        elif ch == "reveal": put(t, whoosh(s, 1.6), -10)
        elif ch == "freeze": put(t, thud(s), -12)
        elif ch == "shutter": put(t, shutter(s), -6)
        elif ch == "text": put(t, tick(s), -14)
        elif ch == "turn": put(t, whoosh(s, 1.2), -10)
        elif ch == "pluck": put(t, pluck(s), -6)
        elif ch == "tick": put(t, tick(s, 2600), -20)
    return out[: int(total * SR)].astype(np.float32)


# ---------------------------------------------------------------- music: a quiet bed, D minor / B-flat maj7 / F add9 / C6, 66 bpm
CHORDS = [(73.42, [220.0, 261.63, 293.66, 329.63]), (58.27, [174.61, 220.0, 293.66, 349.23]),
          (43.65, [174.61, 220.0, 261.63, 392.0]), (65.41, [196.0, 261.63, 329.63, 440.0])]


def note(f, dur, amp, parts):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / d) for k, (a, d) in enumerate(parts, 1))
    return x * np.minimum(1, t / 0.008) * amp


def music(total, seed=7):
    bpm = 66.0; beat = 60 / bpm; bar = 4 * beat
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
