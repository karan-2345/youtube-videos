"""
tools/capture.py -- render a web/three.js scene frame-exactly with headless Chromium.

    python tools/capture.py S03a_OrbitsToScale                 full render -> renders/scenes/<id>.mp4
    python tools/capture.py S03a_OrbitsToScale --stills 3 12   PNG stills at t = 3 s and 12 s
    python tools/capture.py S03a_OrbitsToScale --workers 3

Each frame: window.setTime(frame / fps) -> CDP screenshot (fast PNG) -> ffmpeg stdin.
Workers render contiguous frame ranges into segments that are joined losslessly.
All intermediates are x264 CRF 12, BT.709-tagged, the same as the Manim path.
"""

from __future__ import annotations

import argparse
import base64
import functools
import http.server
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402

SCENES_OUT = ROOT / "renders" / "scenes"
CHROME_ARGS = ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-gpu-vsync", "--no-sandbox"]
# This machine has no GPU (a cloud container): the 2-D canvas is rasterized on the CPU, which is what it is built for.
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")


def encoder_cmd(out: Path, fps: int, src=("-f", "image2pipe", "-i", "-")) -> list[str]:
    """Shared intermediate encode: lossless-looking x264, BT.709 matrix + tags."""
    return ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), *src,
            "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-preset", "medium", "-crf", "12",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-r", str(fps), str(out)]


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class _Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256      # bursts of module + flag requests at boot
    daemon_threads = True


def serve() -> tuple[http.server.ThreadingHTTPServer, int]:
    srv = _Server(("127.0.0.1", 0), functools.partial(_Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def _open(p, scene: str, port: int):
    browser = p.chromium.launch(executable_path=CHROME if Path(CHROME).exists() else None, headless=True,
                                args=CHROME_ARGS)
    page = browser.new_page(viewport={"width": style.WIDTH, "height": style.HEIGHT}, device_scale_factor=1)
    page.on("console", lambda m: print(f"    [page {m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: print(f"    [page exception] {e}"))
    page.goto(f"http://127.0.0.1:{port}/scenes/web/player.html?scene={scene}")
    page.wait_for_function("window.ready === true || window.bootError !== undefined", timeout=180_000)
    err = page.evaluate("window.bootError")
    if err:
        raise RuntimeError(f"scene failed to boot:\n{err}")
    return browser, page


def _shot(cdp) -> bytes:
    return base64.b64decode(cdp.send("Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True})["data"])


def render_range(scene: str, f0: int, f1: int, out: Path, fps: int):
    from playwright.sync_api import sync_playwright
    srv, port = serve()           # one server per worker process: no shared backlog
    with sync_playwright() as p:
        browser, page = _open(p, scene, port)
        cdp = page.context.new_cdp_session(page)
        ff = subprocess.Popen(encoder_cmd(out, fps), stdin=subprocess.PIPE)
        t0 = time.perf_counter()
        for f in range(f0, f1):
            lost = page.evaluate("window.ctxLost")
            page.evaluate(f"window.setTime({f / fps!r})")
            png = _shot(cdp)
            if page.evaluate("window.ctxLost") != lost:           # the GPU context dropped mid-frame: wait, redo the frame
                print(f"    worker {f0}-{f1}: GPU context lost at frame {f}; re-rendering it", flush=True)
                page.wait_for_function(f"window.ctxRestored >= window.ctxLost", timeout=120_000)
                page.evaluate(f"window.setTime({f / fps!r})")
                page.evaluate(f"window.setTime({f / fps!r})")
                png = _shot(cdp)
            ff.stdin.write(png)
            if (f - f0) % 100 == 99:
                rate = (f - f0 + 1) / (time.perf_counter() - t0)
                print(f"    worker {f0:>5}-{f1:<5}: {f - f0 + 1}/{f1 - f0} frames ({rate:.1f} fps)", flush=True)
        ff.stdin.close()
        ff.wait()
        browser.close()
    srv.shutdown()
    if ff.returncode:
        raise RuntimeError(f"ffmpeg failed for {out}")


def stills(scene: str, times: list[float], out_dir: Path) -> list[Path]:
    from playwright.sync_api import sync_playwright
    srv, port = serve()
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    with sync_playwright() as p:
        browser, page = _open(p, scene, port)
        print(f"  renderer: {page.evaluate('window.glInfo')}")
        test = page.evaluate("window.selfTest()")
        if test is not None:
            print(f"  selfTest: {test}")
        cdp = page.context.new_cdp_session(page)
        for t in times:
            page.evaluate(f"window.setTime({t!r})")
            path = out_dir / f"{scene}_t{t:06.2f}.png"
            path.write_bytes(_shot(cdp))
            paths.append(path)
        browser.close()
    srv.shutdown()
    return paths


def render(scene: str, workers: int = 3) -> Path:
    fps = style.FPS
    timings = json.loads((ROOT / "renders/cache/timings.json").read_text())
    if scene in timings:
        duration = timings[scene]["duration"]
    else:                                   # look tests and other scenes without narration carry their own length
        duration = json.loads((ROOT / "renders/cache/scenes" / f"{scene}.json").read_text())["timing"]["duration"]
    n = round(duration * fps)
    SCENES_OUT.mkdir(parents=True, exist_ok=True)
    seg_dir = ROOT / "renders" / "frames" / scene
    seg_dir.mkdir(parents=True, exist_ok=True)
    bounds = [round(i * n / workers) for i in range(workers + 1)]
    procs, segs = [], []
    t0 = time.perf_counter()
    print(f"  {scene}: {n} frames ({duration:.2f} s) on {workers} workers")
    for i in range(workers):
        seg = seg_dir / f"seg{i}.mp4"
        segs.append(seg)
        procs.append(subprocess.Popen([sys.executable, __file__, scene, "--worker", str(bounds[i]),
                                       str(bounds[i + 1]), str(seg)]))
    codes = [pr.wait() for pr in procs]
    if any(codes):
        raise RuntimeError(f"worker failed: {codes}")
    lst = seg_dir / "segments.txt"
    lst.write_text("".join(f"file '{s.as_posix()}'\n" for s in segs))
    out = SCENES_OUT / f"{scene}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c", "copy", str(out)], check=True)
    dt = time.perf_counter() - t0
    print(f"  -> {out.relative_to(ROOT)}  ({dt:.0f} s wall, {n / dt:.1f} frames/s)")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--stills", nargs="*", type=float)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--worker", nargs=3)
    a = ap.parse_args()
    if a.worker:
        f0, f1, out = a.worker
        render_range(a.scene, int(f0), int(f1), Path(out), style.FPS)
    elif a.stills is not None:
        for p in stills(a.scene, a.stills, ROOT / "renders" / "stills"):
            print(f"  {p.relative_to(ROOT)}")
    else:
        render(a.scene, a.workers)


if __name__ == "__main__":
    main()
