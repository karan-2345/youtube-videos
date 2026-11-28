"""tools/sheet.py -- contact sheet of stills: python tools/sheet.py out.png a.png b.png ... (scaled to 360 px wide)"""
import subprocess
import sys

out, ins = sys.argv[1], sys.argv[2:]
args = []
for p in ins:
    args += ["-i", p]
fc = "".join(f"[{i}:v]scale=360:-1[s{i}];" for i in range(len(ins)))
fc += "".join(f"[s{i}]" for i in range(len(ins))) + f"hstack=inputs={len(ins)}" if len(ins) > 1 else "[s0]null"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args, "-filter_complex", fc, out], check=True)
