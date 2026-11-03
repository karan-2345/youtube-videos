"""
tools/jumpcheck.py -- find single-frame jumps in a rendered video (a frame that differs from both neighbours far more
than the motion around it), e.g. a glitch frame from a lost GPU context, or a level that pops in.

    python tools/jumpcheck.py renders/scenes/S09_Signal.mp4 [--from 98 --to 140]

Frames are compared at 192x108 in grey. A frame is flagged when its change from the previous frame is more than
FACTOR x the median change over the surrounding second and above MIN_CHANGE (out of 255).
"""

from __future__ import annotations

import argparse
import subprocess

import numpy as np

FACTOR = 12.0
MIN_CHANGE = 12.0


def frame_changes(path: str, t0: float | None, t1: float | None, fps: int = 60):
    cmd = ["ffmpeg", "-v", "error"]
    if t0 is not None:
        cmd += ["-ss", str(t0)]
    cmd += ["-i", path]
    if t1 is not None:
        cmd += ["-t", str(t1 - (t0 or 0))]
    cmd += ["-vf", "scale=192:108,format=gray", "-f", "rawvideo", "-"]
    f = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.uint8).reshape(-1, 108, 192)
    d = np.abs(np.diff(f.astype(np.float32), axis=0)).mean(axis=(1, 2))
    t = (t0 or 0) + (np.arange(len(d)) + 1) / fps
    return t, d


def find_jumps(t, d, fps: int = 60):
    out = []
    w = fps // 2
    for i in range(len(d)):
        lo, hi = max(0, i - w), min(len(d), i + w + 1)
        local = np.median(np.r_[d[lo:i], d[i + 1:hi]]) if hi - lo > 1 else d[i]
        if d[i] > MIN_CHANGE and d[i] > FACTOR * max(local, 0.25):
            out.append((float(t[i]), float(d[i]), float(local)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--from", dest="t0", type=float)
    ap.add_argument("--to", dest="t1", type=float)
    a = ap.parse_args()
    t, d = frame_changes(a.video, a.t0, a.t1)
    jumps = find_jumps(t, d)
    print(f"{len(d) + 1} frames checked; median change {np.median(d):.2f}; {len(jumps)} jump(s)")
    for tt, dd, loc in jumps:
        print(f"  t = {tt:8.3f} s   change {dd:6.1f}   (around it: {loc:.2f})")
    return 1 if jumps else 0


if __name__ == "__main__":
    raise SystemExit(main())
