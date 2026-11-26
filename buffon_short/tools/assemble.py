"""
tools/assemble.py -- the final Short: rendered picture + voice + SFX + music + captions, mastered.

Writes renders/final/
  buffon_short.mp4          captions burned in (word captions, the spoken word in cinnabar)
  buffon_short_clean.mp4    no captions
  buffon_short_silent.mp4   no audio
  captions/buffon_short.srt sentence cards for the upload
  stems/voice.wav, sfx.wav, music.wav, master.wav (48 kHz 24-bit, sample-aligned with the video)
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import textwrap
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402
from tools import music, sfx  # noqa: E402
from tools.export import spoken  # noqa: E402

FINAL = ROOT / "renders" / "final"
NAME = "buffon_short"
SR = style.AUDIO["sample_rate"]


# ---------------------------------------------------------------- captions
def _ts(t, sep=","):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def _ass_ts(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_color(hex_rgb, alpha=1.0):
    h = hex_rgb.lstrip("#")
    return f"&H{round((1 - alpha) * 255):02X}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def words(timing: dict) -> list[dict]:
    """Every spoken word, placed inside its measured sentence by its share of the SPOKEN text."""
    out = []
    for beat in timing["beats"].values():
        for sen in beat["sentences"]:
            toks = sen["text"].split()
            lens = [len(spoken(w)) + 1 for w in toks]
            t, span = sen["start"], sen["end"] - sen["start"]
            for w, n in zip(toks, lens):
                d = span * n / sum(lens)
                out.append({"w": w, "start": t, "end": t + d})
                t += d
    return out


def _groups(ws, max_words=3, max_chars=17):
    out, cur = [], []
    for w in ws:
        if cur and (len(cur) == max_words or sum(len(x["w"]) + 1 for x in cur) + len(w["w"]) > max_chars):
            out.append(cur)
            cur = []
        cur.append(w)
        if w["w"].endswith((".", ",", "?", ";", ":", "!")):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def write_captions(timing: dict) -> tuple[Path, Path]:
    caps = FINAL / "captions"
    caps.mkdir(parents=True, exist_ok=True)
    # SRT: sentence cards of up to 2 x 42 characters, timed by spoken share
    srt, i = [], 1
    for beat in timing["beats"].values():
        for sen in beat["sentences"]:
            chunks, cur = [], ""
            for clause in re.split(r"(?<=,)\s+", sen["text"]):
                trial = f"{cur} {clause}".strip()
                if len(textwrap.wrap(trial, 42)) <= 2:
                    cur = trial
                else:
                    if cur:
                        chunks.append(cur)
                    cur = clause
            chunks.append(cur)
            total = sum(len(spoken(c)) for c in chunks)
            t = sen["start"]
            for c in chunks:
                d = (sen["end"] - sen["start"]) * len(spoken(c)) / total
                srt.append(f"{i}\n{_ts(t)} --> {_ts(t + d)}\n" + "\n".join(textwrap.wrap(c, 42)) + "\n")
                i += 1
                t += d
    srt_path = caps / f"{NAME}.srt"
    srt_path.write_text("\n".join(srt), encoding="utf-8")

    hi, ink = _ass_color(style.PALETTE["accent"]), _ass_color(style.PALETTE["ink"])
    y = sum(style.CAPTION_Y) // 2
    ev = []
    gs = _groups(words(timing))
    for gi, g in enumerate(gs):
        g_end = g[-1]["end"] + 0.25
        if gi + 1 < len(gs) and gs[gi + 1][0]["start"] - g[-1]["end"] < 0.6:
            g_end = gs[gi + 1][0]["start"]
        for wi, w in enumerate(g):
            t1 = g[wi + 1]["start"] if wi + 1 < len(g) else g_end
            parts = [("{\\c" + hi + "&}" + x["w"] + "{\\c" + ink + "&}") if j == wi else x["w"] for j, x in enumerate(g)]
            pop = "{\\fscx86\\fscy86\\t(0,90,\\fscx100\\fscy100)}" if wi == 0 else ""
            ev.append(f"Dialogue: 0,{_ass_ts(w['start'])},{_ass_ts(t1)},Cap,,0,0,0,,{{\\pos(540,{y})}}{pop}" + " ".join(parts))
    ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {style.WIDTH}
PlayResY: {style.HEIGHT}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{style.FONT_CAPTIONS},{style.CAPTION['font_px']},{ink},&H00FFFFFF,{_ass_color(style.PALETTE['bg'])},&H80000000,0,0,0,0,100,100,0.5,0,1,6,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n"
    ass_path = FINAL / f"{NAME}.ass"
    ass_path.write_text(ass, encoding="utf-8")
    return srt_path, ass_path


# ---------------------------------------------------------------- audio
def lufs(x: np.ndarray, path: Path) -> float:
    sf.write(path, x, SR, subtype="FLOAT")
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True)
    path.unlink()
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out.stderr)[-1])


def duck(music_st: np.ndarray, voice: np.ndarray, depth_db=6.0, attack=0.04, release=0.7) -> np.ndarray:
    """Sidechain: the music dips by up to depth_db while the voice speaks (smoothed envelope)."""
    win = int(0.02 * SR)
    env = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode="same"))
    on = (env > 0.01).astype(np.float64)
    g = np.empty_like(on)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    s = 0.0
    for i, v in enumerate(on):                     # one-pole follower, faster up than down
        s = a * s + (1 - a) * v if v > s else r * s + (1 - r) * v
        g[i] = s
    gain = 10 ** (-depth_db * g / 20)
    return music_st * gain[:, None]


def mix(timing: dict) -> tuple[Path, dict]:
    stems = FINAL / "stems"
    stems.mkdir(parents=True, exist_ok=True)
    total = timing["frames"] / style.FPS
    n = int(round(total * SR))
    v24, sr0 = sf.read(ROOT / "audio" / "voice.wav", dtype="float32")
    from scipy.signal import resample_poly
    voice = resample_poly(v24, SR // 8000, sr0 // 8000).astype(np.float32)
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    A = json.loads((ROOT / "renders/cache/scene.json").read_text())["anchors"]
    fx = sfx.render_track(total)[:n]
    fx = np.pad(fx, (0, n - len(fx)))
    quiet = [(A["cheated"] - 0.3, A["bridge"] + 0.6), (A["hit_it"] - 0.2, A["werent"])]
    mus = music.bed(total, quiet=quiet)[:n]
    mus = np.pad(mus, ((0, n - len(mus)), (0, 0)))
    tmp = FINAL / "_lufs.wav"
    lv, ls, lm = lufs(voice, tmp), lufs(fx, tmp), lufs(mus, tmp)
    gs = 10 ** ((lv - 9.0 - ls) / 20)              # SFX 9 LU under the voice
    gm = 10 ** ((lv - 12.0 - lm) / 20)             # music 12 LU under the voice, then ducked
    fx *= gs
    mus = duck(mus * gm, voice)
    vst = np.stack([voice, voice], 1)
    fxst = np.stack([fx, fx], 1)
    for name, x in (("voice", vst), ("sfx", fxst), ("music", mus)):
        sf.write(stems / f"{name}.wav", x, SR, subtype="PCM_24")
    premix = vst + fxst + mus
    pre = FINAL / "_premix.wav"
    sf.write(pre, premix, SR, subtype="FLOAT")
    print(f"    stems: voice {lv:.1f} LUFS, sfx {ls:.1f} -> x{gs:.3f}, music {lm:.1f} -> x{gm:.3f}")
    return pre, {"voice": lv, "sfx": ls, "music": lm}


def _loudnorm(wav: Path) -> tuple[str, dict]:
    A = style.AUDIO
    target = f"I={A['target_lufs']}:TP={A['true_peak_db']}:LRA=11"
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", f"loudnorm={target}:print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True)
    m = json.loads(re.findall(r"{[^{}]*}", out.stderr)[-1])
    return (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
            f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"), m


def master(pre: Path, out: Path) -> dict:
    """Two-pass loudnorm in linear mode; if the gain would push peaks past the ceiling, a look-ahead limiter trims just
    those peaks first, so the normalisation stays one linear gain."""
    A = style.AUDIO
    _, m0 = _loudnorm(pre)
    gain = A["target_lufs"] - float(m0["input_i"])
    ceiling = A["true_peak_db"] - gain - 1.3
    src = pre
    if float(m0["input_tp"]) > ceiling:
        src = pre.with_name("_lim.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(pre), "-af",
                        f"alimiter=limit={10 ** (ceiling / 20):.5f}:attack=5:release=60:level=0", "-c:a", "pcm_f32le", str(src)],
                       check=True)
    norm, m = _loudnorm(src)
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-nostats", "-i", str(src), "-af", f"{norm}:print_format=json,aresample={SR}",
                        "-c:a", "pcm_s24le", str(out)], capture_output=True, text=True, check=True)
    m2 = json.loads(re.findall(r"{[^{}]*}", r.stderr)[-1])
    if src != pre:
        src.unlink()
    return {"input_i": float(m["input_i"]), "output_i": float(m2["output_i"]), "output_tp": float(m2["output_tp"]),
            "type": m2.get("normalization_type", "?")}


def assemble() -> dict:
    timing = json.loads((ROOT / "renders/cache/timings.json").read_text())
    video = ROOT / "renders" / "scene.mp4"
    FINAL.mkdir(parents=True, exist_ok=True)
    srt, ass = write_captions(timing)
    pre, levels = mix(timing)
    mst_path = FINAL / "stems" / "master.wav"
    mst = master(pre, mst_path)
    pre.unlink()
    print(f"    master: {mst['input_i']:.2f} -> {mst['output_i']:.2f} LUFS, TP {mst['output_tp']:.2f} dBTP ({mst['type']})")
    total = timing["frames"] / style.FPS
    enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-colorspace", "bt709",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "256k", "-ar", str(SR),
           "-movflags", "+faststart"]
    tag = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
    outs = {}
    for suffix, vf in (("", f"subtitles={ass.relative_to(ROOT).as_posix()}:fontsdir=assets/fonts,{tag}"), ("_clean", tag)):
        out = FINAL / f"{NAME}{suffix}.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(mst_path), "-vf", vf,
                        "-map", "0:v", "-map", "1:a", *enc, "-t", f"{total:.4f}", str(out)], check=True, cwd=ROOT)
        outs[suffix or "captioned"] = out
    silent = FINAL / f"{NAME}_silent.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(outs["_clean"]), "-map", "0:v", "-c", "copy", "-an",
                    "-movflags", "+faststart", str(silent)], check=True)
    outs["silent"] = silent
    for k, v in outs.items():
        print(f"    {k:10s} {v.relative_to(ROOT)}")
    print(f"    srt        {srt.relative_to(ROOT)}")
    return {"master": mst, "levels": levels, **outs}


if __name__ == "__main__":
    assemble()
