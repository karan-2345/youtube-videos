"""tools/stitch.py PIECES.txt -- build renders/picture_final.mp4 from rendered pieces, each line "file offset f0 f1":
global frames [f0, f1) are the file's frames [offset, offset + f1 - f0). Pieces must tile 0..N exactly (checked).
Used when a segment was stopped part-way and its remainder re-rendered by other workers, or for small patches."""
import json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
N = round(json.loads((ROOT / "cache/data.json").read_text())["duration"] * 60)
rows = [l.split() for l in Path(sys.argv[1]).read_text().splitlines() if l.strip() and not l.startswith("#")]
pieces = [(ROOT / f, int(o), int(a), int(b)) for f, o, a, b in rows]
cur = 0
for f, o, a, b in pieces:
    assert a == cur and b > a, f"gap or overlap at {f} ({a}..{b}, expected start {cur})"
    have = int(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries",
                               "stream=nb_read_packets", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout)
    assert have >= o + b - a, f"{f} has {have} frames, needs {o + b - a}"
    cur = b
assert cur == N, f"pieces end at {cur}, timeline has {N} frames"
ins, parts = [], []
for k, (f, o, a, b) in enumerate(pieces):
    ins += ["-i", str(f)]
    parts.append(f"[{k}:v]trim=start_frame={o}:end_frame={o + b - a},setpts=PTS-STARTPTS[p{k}]")
fc = ";".join(parts) + ";" + "".join(f"[p{k}]" for k in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0[v]"
out = ROOT / "renders/picture_final.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-c:v", "libx264", "-preset", "fast",
                "-crf", "12", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-r", "60", str(out)], check=True)
m = int(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets",
                        "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout)
assert m == N, (m, N)
print(f"{len(pieces)} pieces -> {out.relative_to(ROOT)}, {m} frames")
