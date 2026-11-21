"""
tools/assemble.py -- cut rendered scenes together with their voice, captions and loudness.

    python tools/assemble.py --name voyager --full S00_ColdOpen S01_Title ...

Writes (into renders/final/, or renders/sample/ for the checkpoint sample)
  <name>.mp4 / <name>_clean.mp4 / <name>_silent.mp4   captions burned in / none / no audio
  captions/<name>.srt
  with --full: stems/voice.wav, sfx.wav, music.wav  (48 kHz 24-bit, exactly as mixed: premix levels and
  ducking applied, full length, sample-aligned with the silent video), stems/master.wav (mixed and
  mastered), stems/per_scene/<Sxx>_<stem>.wav, stems/stems_README.md

Timeline: scene i starts at s_i = s_{i-1} + D_{i-1} - XFADE. Scene audio (voice) is placed at
the same offsets; every scene's voice track starts with SCENE_HEAD_S of silence, so the
cross-dissolve only ever overlaps silence.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402

TIMINGS = ROOT / "renders" / "cache" / "timings.json"
FINAL = ROOT / "renders" / "final"
CAPS = ROOT / "captions"
XFADE = style.TRANSITION_S


def probe_duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                          str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def balance(text: str, width: int) -> list[str]:
    """Two-line captions split near the middle (at a space), never longer than `width` per line."""
    if len(text) <= width:
        return [text]
    best = None
    for m in re.finditer(" ", text):
        a, b = text[:m.start()], text[m.end():]
        if len(a) <= width and len(b) <= width:
            score = max(len(a), len(b)) - (3 if a.endswith((",", ":", ";")) else 0)
            if best is None or score < best[0]:
                best = (score, [a, b])
    return best[1] if best else [text]


def _ts(t: float, sep=",") -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def _ass_ts(t: float) -> str:
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_color(hex_rgb: str, alpha: float) -> str:
    r, g, b = hex_rgb.lstrip("#")[0:2], hex_rgb.lstrip("#")[2:4], hex_rgb.lstrip("#")[4:6]
    a = round((1 - alpha) * 255)
    return f"&H{a:02X}{b}{g}{r}".upper()


def word_times(timings: dict, scenes: list[str], starts: list[float]) -> list[dict]:
    """Every spoken word on the global timeline. Sentences are measured; words inside a sentence are placed by their
    share of the SPOKEN text (tools/tts.speech_text: '6220' is 'sixty-two twenty'), the rule the phrase anchors in
    config/events.py use too."""
    from tools.tts import speech_text
    out = []
    for sc, s0 in zip(scenes, starts):
        for beat in timings[sc]["beats"].values():
            for sen in beat["sentences"]:
                toks = sen["text"].split()
                lens = [len(speech_text(" " + w).strip()) + 1 for w in toks]
                total = sum(lens)
                t, span = sen["start"] + s0, sen["end"] - sen["start"]
                for w, n in zip(toks, lens):
                    d = span * n / total
                    out.append({"w": w, "start": round(t, 3), "end": round(t + d, 3)})
                    t += d
    return out


def _chunks(words: list[dict], max_words=3, max_chars=17) -> list[list[dict]]:
    out, cur = [], []
    for w in words:
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


def write_captions(cues: list[dict], name: str, out_dir: Path = FINAL, caps_dir: Path = CAPS,
                   words: list[dict] | None = None) -> tuple[Path, Path]:
    """SRT: sentence cards (for the upload). Burned-in ASS: Shorts-style word captions, up to three words at a time
    in the caption band, the word being spoken in gold, each group popping in."""
    caps_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    width = style.CAPTION["max_chars_per_line"]
    srt = []
    for i, c in enumerate(cues, 1):
        lines = balance(c["text"], width)
        srt.append(f"{i}\n{_ts(c['start'])} --> {_ts(c['end'])}\n" + "\n".join(lines) + "\n")
    srt_path = caps_dir / f"{name}.srt"
    srt_path.write_text("\n".join(srt), encoding="utf-8")

    hi = _ass_color(style.PALETTE["accent"], 1.0)
    ink = _ass_color(style.PALETTE["ink"], 1.0)
    y = sum(style.CAPTION_Y) // 2
    ev = []
    groups = _chunks(words or [])
    for gi, g in enumerate(groups):
        g_end = g[-1]["end"] + 0.25
        if gi + 1 < len(groups) and groups[gi + 1][0]["start"] - g[-1]["end"] < 0.6:
            g_end = groups[gi + 1][0]["start"]                 # back to back: no flicker between groups
        for wi, w in enumerate(g):
            t0 = w["start"]
            t1 = g[wi + 1]["start"] if wi + 1 < len(g) else g_end
            parts = [("{\\c" + hi + "&}" + x["w"] + "{\\c" + ink + "&}") if j == wi else x["w"]
                     for j, x in enumerate(g)]
            pop = "{\\fscx86\\fscy86\\t(0,90,\\fscx100\\fscy100)}" if wi == 0 else ""
            ev.append(f"Dialogue: 0,{_ass_ts(t0)},{_ass_ts(t1)},Cap,,0,0,0,," + "{\\pos(540," + f"{y})}}" + pop
                      + " ".join(parts))
    C = style.CAPTION
    ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {style.WIDTH}
PlayResY: {style.HEIGHT}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{style.FONT_CAPTIONS},{C['font_px']},{ink},&H00FFFFFF,{_ass_color(style.PALETTE['bg'], 1.0)},&H80000000,0,0,0,0,100,100,0.5,0,1,6,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n"
    ass_path = out_dir / f"{name}.ass"
    ass_path.write_text(ass, encoding="utf-8")
    return srt_path, ass_path


def loudnorm_filter(wav: Path) -> tuple[str, dict]:
    """Two-pass EBU R128 loudness normalisation to the YouTube reference (pass 1: measure)."""
    A = style.AUDIO
    target = f"I={A['target_lufs']}:TP={A['true_peak_db']}:LRA=11"
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
                          f"loudnorm={target}:print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True)
    m = json.loads(re.findall(r"{[^{}]*}", out.stderr)[-1])
    return (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
            f"offset={m['target_offset']}:linear=true"), m


def master(premix_wav: Path, out: Path) -> dict:
    """Pass 2: apply the measured loudnorm; 48 kHz 24-bit. Returns what was measured and applied.
    If the gain needed to reach the target would push true peaks past the ceiling (loudnorm would then fall back
    to dynamic mode and ride the gain), a look-ahead limiter first trims just those few peaks, so the
    normalisation itself stays a single linear gain."""
    A = style.AUDIO
    _, m0 = loudnorm_filter(premix_wav)
    gain = A["target_lufs"] - float(m0["input_i"])
    ceiling_db = A["true_peak_db"] - gain - 1.3                 # 1.3 dB margin for inter-sample peaks
    limited = None
    if float(m0["input_tp"]) > ceiling_db:
        limited = premix_wav.with_name(premix_wav.stem + "_lim.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(premix_wav), "-af",
                        f"alimiter=limit={10 ** (ceiling_db / 20):.5f}:attack=5:release=60:level=0",
                        "-c:a", "pcm_f32le", str(limited)], check=True)
        print(f"    limiter: peaks above {ceiling_db:.1f} dBFS trimmed (input TP {float(m0['input_tp']):.1f} dBTP)")
        premix_wav = limited
    norm, m = loudnorm_filter(premix_wav)
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-nostats", "-i", str(premix_wav), "-af",
                        f"{norm}:print_format=json,aresample={style.AUDIO['sample_rate']}",
                        "-c:a", "pcm_s24le", str(out)], capture_output=True, text=True, check=True)
    m2 = json.loads(re.findall(r"{[^{}]*}", r.stderr)[-1])
    if limited:
        limited.unlink(missing_ok=True)
    return {"input_i": float(m["input_i"]), "input_tp": float(m["input_tp"]),
            "output_i": float(m2["output_i"]), "output_tp": float(m2["output_tp"]),
            "type": m2.get("normalization_type", "?"),
            "gain_db": float(m2["output_i"]) - float(m["input_i"])}


def lufs(path: Path) -> float:
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True)
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out.stderr)[-1])


def premix(voice: Path, total: float, starts: dict, timings: dict, name: str, out_dir: Path = FINAL,
           stems_dir: Path | None = None) -> tuple[Path, dict]:
    """Voice + synthesized SFX + generated music, the music ducked under the voice (sidechain).
    Stem levels are set from measured loudness, not guessed: music sits MUSIC_BELOW LU under the
    voice before ducking, SFX SFX_BELOW LU under it."""
    import soundfile as sf
    from tools import music, sfx
    sr = style.AUDIO["sample_rate"]
    n_out = int(round(total * sr))            # every stem and the premix end on exactly this sample
    sfx_path, mus_path = out_dir / f"{name}_sfx_raw.wav", out_dir / f"{name}_music_raw.wav"
    sf.write(sfx_path, sfx.render_track(total, starts, timings), sr)
    sf.write(mus_path, music.pad(total) * sfx.music_env(total, starts, timings)[:, None], sr)
    lv, ls, lm = lufs(voice), lufs(sfx_path), lufs(mus_path)
    MUSIC_BELOW, SFX_BELOW = 16.0, 10.0
    gm = 10 ** ((lv - MUSIC_BELOW - lm) / 20)
    gs = 10 ** ((lv - SFX_BELOW - ls) / 20)
    out = out_dir / f"{name}_premix.wav"
    fc = (f"[0:a]aresample={sr},asplit=2[v][vsc];"
          f"[2:a]volume={gm:.4f}[m];[m][vsc]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=700[md];"
          f"[1:a]volume={gs:.4f},pan=stereo|c0=c0|c1=c0[s];[v]pan=stereo|c0=c0|c1=c0[vs];"
          f"[vs][s][md]amix=inputs=3:normalize=0:dropout_transition=0,apad,atrim=end_sample={n_out}[out]")
    maps = ["-map", "[out]", "-c:a", "pcm_f32le", str(out)]
    if stems_dir:
        # the same three signals the amix sums, written out before summing (so voice + sfx + music = premix)
        stems_dir.mkdir(parents=True, exist_ok=True)
        fc = fc.replace("[vs][s][md]amix", "[vs]asplit=2[vs1][vs2];[s]asplit=2[s1][s2];[md]asplit=2[md1][md2];"
                                           "[vs1][s1][md1]amix")
        fc += (f";[vs2]apad,atrim=end_sample={n_out}[ov];[s2]apad,atrim=end_sample={n_out}[os];"
               f"[md2]apad,atrim=end_sample={n_out}[om]")
        for lab, fn in (("ov", "voice"), ("os", "sfx"), ("om", "music")):
            maps += ["-map", f"[{lab}]", "-c:a", "pcm_s24le", "-ar", str(sr), str(stems_dir / f"{fn}.wav")]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(voice), "-i", str(sfx_path), "-i", str(mus_path),
                    "-filter_complex", fc, *maps], check=True)
    sfx_path.unlink(missing_ok=True)
    mus_path.unlink(missing_ok=True)
    print(f"    stems: voice {lv:.1f} LUFS, sfx {ls:.1f} -> x{gs:.3f}, music {lm:.1f} -> x{gm:.3f}")
    return out, {"voice_lufs": lv, "sfx_lufs": ls, "music_lufs": lm, "sfx_gain": gs, "music_gain": gm,
                 "music_below": MUSIC_BELOW, "sfx_below": SFX_BELOW}


def cut_per_scene(stems_dir: Path, scenes: list[str], starts: list[float], durs: list[float]):
    """Per-scene stems: each scene's exact start and full length (overlaps included), block-wise reads."""
    import soundfile as sf
    per = stems_dir / "per_scene"
    per.mkdir(parents=True, exist_ok=True)
    for stem in ("voice", "sfx", "music"):
        src = stems_dir / f"{stem}.wav"
        info = sf.info(src)
        for sc, s0, d in zip(scenes, starts, durs):
            a = int(round(s0 * info.samplerate))
            x, _ = sf.read(src, start=a, stop=min(info.frames, a + int(round(d * info.samplerate))), dtype="float32")
            sf.write(per / f"{sc.split('_')[0]}_{stem}.wav", x, info.samplerate, subtype="PCM_24")


def stems_readme(stems_dir: Path, scenes, starts, durs, levels: dict, mst: dict, total: float):
    rows = "\n".join(f"| {sc} | {s0:9.3f} | {d:8.3f} | {int(round(s0 * 48000)):>10,} |" for sc, s0, d in zip(scenes, starts, durs))
    db = lambda g: 20 * __import__("math").log10(g)
    (stems_dir / "stems_README.md").write_text(f"""# Stems

All files: 48 kHz, 24-bit PCM WAV, stereo, {total:.3f} s, starting at 0:00 and sample-aligned with the
silent video. `voice.wav`, `sfx.wav` and `music.wav` are exactly what the mixer sums: premix levels and
the sidechain ducking are already applied. voice + sfx + music = the premix; the premix with the
mastering gain below = `master.wav` (the audio in the final MP4s).

## Levels (set from measured loudness)

| Stem | Measured | Gain applied in premix |
|---|---:|---:|
| voice | {levels['voice_lufs']:.1f} LUFS | 0.0 dB (reference) |
| sfx | {levels['sfx_lufs']:.1f} LUFS | {db(levels['sfx_gain']):+.2f} dB (target {levels['sfx_below']:.0f} LU under the voice) |
| music | {levels['music_lufs']:.1f} LUFS | {db(levels['music_gain']):+.2f} dB (target {levels['music_below']:.0f} LU under the voice), then ducked |

Music ducking: `sidechaincompress=threshold=0.02:ratio=5:attack=40:release=700`, keyed by the voice.

## Mastering

Two-pass `loudnorm` (I = {style.AUDIO['target_lufs']} LUFS, TP = {style.AUDIO['true_peak_db']} dBTP, LRA = 11, linear=true).
Premix measured {mst['input_i']:.2f} LUFS / {mst['input_tp']:.2f} dBTP; master {mst['output_i']:.2f} LUFS /
{mst['output_tp']:.2f} dBTP; normalisation type **{mst['type']}**. Overall gain **{mst['gain_db']:+.2f} dB**; in dynamic mode loudnorm also rides
the gain slightly and limits true peaks, so the master is not a pure copy of the stem sum (in linear mode it is).
To rebuild by hand: put the three stems at 0:00, sum at unity, apply {mst['gain_db']:+.2f} dB,
then a true-peak limiter at {style.AUDIO['true_peak_db']} dBTP.

## Scene starts

| Scene | Start (s) | Length (s) | Start (sample @ 48 kHz) |
|---|---:|---:|---:|
{rows}

Scenes overlap by {XFADE} s (cross-dissolves), so per-scene stems overlap by the same amount.
""", encoding="utf-8")


def assemble(scenes: list[str], name: str, full: bool = False, out_dir: Path = FINAL, caps_dir: Path = CAPS,
             stems_dir: Path | None = None) -> dict:
    timings = json.loads(TIMINGS.read_text())
    vids = [ROOT / "renders" / "scenes" / f"{s}.mp4" for s in scenes]
    durs = [probe_duration(v) for v in vids]
    for s, d in zip(scenes, durs):
        want = timings[s]["duration"]
        assert abs(d - want) < 2 / style.FPS, f"{s}: video {d:.3f} s vs audio {want:.3f} s"
    starts = [0.0]
    for d in durs[:-1]:
        starts.append(starts[-1] + d - XFADE)
    total = starts[-1] + durs[-1]
    out_dir.mkdir(parents=True, exist_ok=True)

    # captions on the global timeline
    cues = [{**c, "start": c["start"] + s0, "end": c["end"] + s0}
            for sc, s0 in zip(scenes, starts) for c in timings[sc]["captions"]]
    srt_path, ass_path = write_captions(cues, name, out_dir, caps_dir, word_times(timings, scenes, starts))

    # voice: each scene's track delayed to its start, mixed, resampled to 48 kHz
    voice = out_dir / f"{name}_voice_raw.wav"
    ins, parts = [], []
    for i, (sc, s0) in enumerate(zip(scenes, starts)):
        ins += ["-i", str(ROOT / "audio" / "tts" / f"{sc}.wav")]
        ms = int(round(s0 * 1000))
        parts.append(f"[{i}:a]aresample={style.AUDIO['sample_rate']},adelay={ms}|{ms}[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(scenes)))
    fc = ";".join(parts) + f";{mix}amix=inputs={len(scenes)}:normalize=0:dropout_transition=0,apad,atrim=0:{total:.3f}[out]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[out]",
                    "-ac", "1", "-c:a", "pcm_f32le", str(voice)], check=True)
    levels = None
    audio = voice
    if full:
        audio, levels = premix(voice, total, dict(zip(scenes, starts)), timings, name, out_dir, stems_dir)
    master_wav = (stems_dir or out_dir) / ("master.wav" if stems_dir else f"{name}_master.wav")
    mst = master(audio, master_wav)
    print(f"    master: {mst['input_i']:.2f} -> {mst['output_i']:.2f} LUFS, TP {mst['output_tp']:.2f} dBTP, "
          f"{mst['type']} gain {mst['gain_db']:+.2f} dB")

    # video: xfade chain
    vin, chain, last = [], [], "[0:v]"
    for v in vids:
        vin += ["-i", str(v)]
    for i in range(1, len(vids)):
        out = f"[x{i}]"
        chain.append(f"{last}[{i}:v]xfade=transition=fade:duration={XFADE}:offset={starts[i]:.4f}{out}")
        last = out
    if not chain:
        chain.append("[0:v]null[x0]")
        last = "[x0]"
    vchain = ";".join(chain)
    ass_rel = ass_path.relative_to(ROOT).as_posix()
    enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-c:a", "aac", "-b:a", "256k", "-ar", str(style.AUDIO["sample_rate"]), "-movflags", "+faststart"]
    a_idx = len(vids)
    outputs = {}
    for suffix, vf in (("", f"{last}subtitles={ass_rel}:fontsdir=assets/fonts,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]"),
                       ("_clean", f"{last}setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]")):
        out = out_dir / f"{name}{suffix}.mp4"
        fc = f"{vchain};{vf}"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *vin, "-i", str(master_wav), "-filter_complex", fc,
                        "-map", "[v]", "-map", f"{a_idx}:a", *enc, "-t", f"{total:.3f}", str(out)], check=True, cwd=ROOT)
        outputs[suffix or "captioned"] = out
    silent = out_dir / f"{name}_silent.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(outputs["_clean"]), "-map", "0:v", "-c", "copy",
                    "-an", "-movflags", "+faststart", str(silent)], check=True)
    outputs["silent"] = silent
    voice.unlink(missing_ok=True)
    if full:
        (out_dir / f"{name}_premix.wav").unlink(missing_ok=True)
    if stems_dir and full and len(scenes) > 1:
        cut_per_scene(stems_dir, scenes, starts, durs)
    if stems_dir and full:
        stems_readme(stems_dir, scenes, starts, durs, levels, mst, total)
    print(f"  {name}: {total:.2f} s, {len(cues)} captions")
    for k, v in outputs.items():
        print(f"    {k:10s} {v.relative_to(ROOT)}")
    print(f"    srt        {srt_path.relative_to(ROOT)}")
    return {"total": total, "starts": dict(zip(scenes, starts)), "durs": dict(zip(scenes, durs)),
            "master": mst, "levels": levels, **outputs}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("scenes", nargs="+")
    ap.add_argument("--name", required=True)
    ap.add_argument("--full", action="store_true", help="add SFX and music (the final mix)")
    a = ap.parse_args()
    assemble(a.scenes, a.name, a.full)
