"""Original festive background track (synthesized, royalty-free): tanpura drone,
plucked-string melody in a major-pentatonic (Bhoopali-like) scale, tabla-style
percussion, bells on scene cuts and firework pops. Writes out/music.wav."""
import os
import numpy as np
import wave

SR = 44100
DUR = 22.0
BPM = 108
BEAT = 60 / BPM
HERE = os.path.dirname(os.path.abspath(__file__))
N = int(SR * DUR)
mix = np.zeros((N, 2), np.float32)
rng = np.random.default_rng(3)

SA = 220.0 * 2 ** (2 / 12)  # Sa = B3-ish (246.9 Hz)
SCALE = [0, 2, 4, 7, 9]  # Sa Re Ga Pa Dha


def hz(deg, octv=0):
    o, i = divmod(deg, 5)
    return SA * 2 ** ((SCALE[i] + 12 * (o + octv)) / 12)


def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0]
    l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    mix[i0:i0 + len(sig), 0] += sig * gain * l
    mix[i0:i0 + len(sig), 1] += sig * gain * r


def pluck(f, dur=1.2):
    """Karplus-Strong, vectorized per period."""
    p = int(SR / f)
    n = int(SR * dur)
    buf = rng.uniform(-1, 1, p).astype(np.float32)
    out = np.zeros(n, np.float32)
    for s in range(0, n, p):
        e = min(p, n - s)
        out[s:s + e] = buf[:e]
        buf = 0.996 * 0.5 * (buf + np.roll(buf, -1))
    # sitar-ish buzz: soft saturation + slight bright layer
    out = np.tanh(out * 1.8) * 0.6
    return out


def tone(f, dur, decay, harm=(1,), amp=(1,)):
    t = np.arange(int(SR * dur)) / SR
    s = sum(a * np.sin(2 * np.pi * f * h * t) for h, a in zip(harm, amp))
    return (s * np.exp(-t / decay)).astype(np.float32)


def tabla(kind):
    t = np.arange(int(SR * 0.5)) / SR
    if kind == "dha":  # bass + ring
        f = 90 * (1 + 0.6 * np.exp(-t * 30))
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
        s += 0.5 * np.sin(2 * np.pi * 480 * t) * np.exp(-t * 14)
    elif kind == "na":
        s = 0.7 * np.sin(2 * np.pi * 520 * t) * np.exp(-t * 18) + 0.3 * np.sin(2 * np.pi * 1040 * t) * np.exp(-t * 25)
    else:  # "ti" click
        s = rng.normal(0, 1, len(t)) * np.exp(-t * 80) * 0.6
    s[:30] *= np.linspace(0, 1, 30)
    return s.astype(np.float32)


def bell(f):
    return tone(f, 2.5, 0.7, (1, 2.76, 5.4, 8.9), (1, 0.5, 0.25, 0.1))


def pop():
    t = np.arange(int(SR * 0.6)) / SR
    s = rng.normal(0, 1, len(t)) * np.exp(-t * 12)
    s = np.convolve(s, np.ones(6) / 6, "same")
    return s.astype(np.float32)


# --- tanpura drone (Pa Sa Sa Sa), whole track
t = np.arange(N) / SR
drone = np.zeros(N, np.float32)
for f, a in ((SA / 2 * 1.5, 0.5), (SA, 0.6), (SA, 0.6), (SA / 2, 0.8)):
    for h in range(1, 7):
        drone += (a / h) * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6)) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.3 * h * t))
drone *= 0.04
fade = np.minimum(1, t / 0.8) * np.minimum(1, (DUR - t) / 1.5)
mix[:, 0] += drone * fade
mix[:, 1] += drone * fade

# --- tabla: Keherwa-ish 8-beat theka in eighths, starting at 0.4 s
theka = ["dha", "ti", "na", "ti", "na", "ti", "dha", "ti", "dha", "ti", "na", "ti", "na", "na", "dha", "na"]
t0 = 0.4
i = 0
while t0 + i * BEAT / 2 < DUR - 1.2:
    k = theka[i % 16]
    add(tabla(k), t0 + i * BEAT / 2, 0.55 if k == "dha" else 0.35, pan=-0.15)
    i += 1

# --- melody (scale degrees; None = rest), eighth notes
phrase_a = [7, None, 9, 7, 6, 5, None, 6, 7, 9, 10, 9, 7, None, 6, 5]
phrase_b = [5, 6, 7, None, 9, 7, 6, 7, 5, None, 3, 4, 5, None, None, None]
phrase_c = [10, 9, 10, 12, 10, 9, 7, 9, 10, None, 9, 7, 6, 7, 5, None]
melody = phrase_a + phrase_b + phrase_a + phrase_c + phrase_a + phrase_b
for j, deg in enumerate(melody):
    tt = 0.4 + j * BEAT / 2
    if deg is None or tt > DUR - 1.0:
        continue
    add(pluck(hz(deg, -1)), tt, 0.45, pan=0.25)

# --- bells on cuts, pops with fireworks
for c in [0.0, 2.6] + [4.6 + i * 2.6 for i in range(5)] + [17.6]:
    add(bell(hz(10, -1) * 2), c, 0.18, pan=0.3)
    add(bell(hz(7, -1) * 2), c + 0.02, 0.12, pan=-0.3)
for ft in (0.15, 0.55, 1.2, 17.7, 18.1, 18.6, 19.6, 20.3, 21.0):
    add(pop(), ft, 0.35, pan=rng.uniform(-0.6, 0.6))

# final chord
for d in (0, 2, 4, 5):
    add(pluck(hz(d, -1), 2.5), 20.6, 0.35)

# master: soft limiter + normalize
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
end = np.minimum(1, (DUR - t) / 0.6)[:, None]
mix *= end
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
with wave.open(os.path.join(HERE, "out", "music.wav"), "wb") as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote out/music.wav")
