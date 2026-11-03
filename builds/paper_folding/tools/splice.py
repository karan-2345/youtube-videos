"""tools/splice.py -- replace frame ranges of renders/picture.mp4 with re-rendered patches (frames/patches/p_<f0>_<f1>.mp4),
so a small fix found after the full render costs only those frames. Writes renders/picture_final.mp4."""
import re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
pic = ROOT / "renders/picture.mp4"
out = ROOT / "renders/picture_final.mp4"
patches = sorted((int(m[1]), int(m[2]), p) for p in (ROOT / "frames/patches").glob("p_*.mp4") if (m := re.match(r"p_(\d+)_(\d+)\.mp4", p.name)))
if not patches:
    subprocess.run(["cp", str(pic), str(out)], check=True); print("no patches"); sys.exit()
n = int(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets",
                        "-of", "csv=p=0", str(pic)], capture_output=True, text=True).stdout)
ins, parts, cur = ["-i", str(pic)], [], 0
for k, (a, b, p) in enumerate(patches, 1):
    ins += ["-i", str(p)]
    parts.append(f"[0:v]trim=start_frame={cur}:end_frame={a},setpts=PTS-STARTPTS[a{k}]")
    parts.append(f"[{k}:v]trim=start_frame=0:end_frame={b - a},setpts=PTS-STARTPTS[p{k}]")
    cur = b
parts.append(f"[0:v]trim=start_frame={cur}:end_frame={n},setpts=PTS-STARTPTS[z]")
labels = "".join(f"[a{k}][p{k}]" for k in range(1, len(patches) + 1)) + "[z]"
fc = ";".join(parts) + f";{labels}concat=n={2 * len(patches) + 1}:v=1:a=0[v]"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-c:v", "libx264", "-preset", "fast",
                "-crf", "12", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-r", "60", str(out)], check=True)
m = int(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets",
                        "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout)
assert m == n, (m, n)
print(f"{len(patches)} patch(es) spliced, {m} frames")
