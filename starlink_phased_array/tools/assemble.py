"""Join the rendered segments, burn captions, mux the master audio.

    python tools/assemble.py
      -> final/starlink_flat_antenna.mp4        (captions burned in)
      -> final/starlink_flat_antenna_clean.mp4  (no captions)
"""
import json
import math
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda p: os.path.join(ROOT, p)  # noqa: E731
TL = json.load(open(A("config/timeline.json"), encoding="utf-8"))
FRAMES = math.ceil(TL["duration"] * 60)
DUR = FRAMES / 60


def run(args):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr)


def main():
    os.makedirs(A("final"), exist_ok=True)
    segs = [A(f"renders/seg/seg{i}.mp4") for i in (1, 2, 3, 4)]
    with open(A("renders/seg/list.txt"), "w") as f:
        f.writelines(f"file '{s}'\n" for s in segs)
    run(["-f", "concat", "-safe", "0", "-i", A("renders/seg/list.txt"), "-c", "copy", A("renders/video_nocap.mp4")])
    venc = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-r", "60"]
    aenc = ["-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart"]
    afil = f"[1:a]atrim=0:{DUR:.4f},afade=t=out:st={DUR - 0.35:.4f}:d=0.35[a]"
    sub = f"subtitles={A('captions/captions.ass')}:fontsdir={A('assets/fonts')}"
    run(["-i", A("renders/video_nocap.mp4"), "-i", A("audio/master.wav"),
         "-filter_complex", f"[0:v]{sub}[v];{afil}", "-map", "[v]", "-map", "[a]", *venc, *aenc,
         A("final/starlink_flat_antenna.mp4")])
    run(["-i", A("renders/video_nocap.mp4"), "-i", A("audio/master.wav"),
         "-filter_complex", afil, "-map", "0:v", "-map", "[a]", *venc, *aenc,
         A("final/starlink_flat_antenna_clean.mp4")])
    for f in ("starlink_flat_antenna.mp4", "starlink_flat_antenna_clean.mp4"):
        p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                            "stream=codec_name,width,height,r_frame_rate,pix_fmt,color_space,color_primaries,color_transfer,sample_rate,channels:format=duration,size",
                            "-of", "json", A(f"final/{f}")], capture_output=True, text=True)
        info = json.loads(p.stdout)
        v = next(s for s in info["streams"] if s["codec_name"] == "h264")
        a = next(s for s in info["streams"] if s["codec_name"] == "aac")
        print(f"{f}: {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} {v.get('color_space')}/{v.get('color_primaries')}/{v.get('color_transfer')}"
              f" | aac {a['sample_rate']} Hz {a['channels']}ch | {float(info['format']['duration']):.2f} s | {int(info['format']['size']) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
