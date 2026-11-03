"""
tools/doctor.py -- verify the toolchain this project depends on.

    python build.py doctor            versions, fonts, models, disk
    python build.py doctor --webgl    also benchmark headless WebGL capture (about 1 min)
"""

from __future__ import annotations

import functools
import http.server
import importlib.metadata as md
import shutil
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONT_DIRS = [Path(r"C:\Windows\Fonts"), Path.home() / "AppData/Local/Microsoft/Windows/Fonts"]


def _run(cmd):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return (out.stdout or out.stderr).strip().splitlines()[0]
    except Exception as e:  # noqa: BLE001 -- report, don't crash
        return f"MISSING ({e.__class__.__name__})"


def report():
    rows = []
    rows.append(("python", _run(["python", "--version"])))
    for pkg in ("manim", "numpy", "scipy", "matplotlib", "cartopy", "skyfield", "sgp4",
                "playwright", "kokoro-onnx", "soundfile"):
        try:
            rows.append((pkg, md.version(pkg)))
        except md.PackageNotFoundError:
            rows.append((pkg, "MISSING"))
    rows.append(("ffmpeg", _run(["ffmpeg", "-hide_banner", "-version"])))
    rows.append(("latex", _run(["latex", "--version"])))
    rows.append(("dvisvgm", _run(["dvisvgm", "--version"])))
    rows.append(("node", _run(["node", "--version"])))
    three = ROOT / "scenes/web/node_modules/three/package.json"
    rows.append(("three.js", "installed" if three.exists() else "MISSING (npm install in scenes/web)"))
    for f in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        p = ROOT / "assets/models" / f
        rows.append((f, f"{p.stat().st_size / 1e6:.0f} MB" if p.exists() else "MISSING"))
    for font in ("Inter", "JetBrainsMono"):
        found = any(any(d.glob(f"{font}*.ttf")) for d in FONT_DIRS if d.exists())
        rows.append((f"font {font}", "found" if found else "MISSING"))
    rows.append(("blender", shutil.which("blender") or "not installed (not needed: see ENVIRONMENT.md)"))
    free = shutil.disk_usage(ROOT).free / 1e9
    rows.append(("disk free", f"{free:.1f} GB"))
    w = max(len(k) for k, _ in rows)
    for k, v in rows:
        print(f"  {k:<{w}}  {v}")
    return all("MISSING" not in v for _, v in rows)


def webgl_benchmark(frames=90):
    from playwright.sync_api import sync_playwright

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    root = ROOT / "scenes" / "web"
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/_smoke/index.html"
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chromium", headless=True,
                              args=["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 1920, "height": 1080})
        pg.goto(url)
        pg.wait_for_function("window.ready === true")
        cdp = pg.context.new_cdp_session(pg)
        t0 = time.perf_counter()
        for i in range(frames):
            pg.evaluate(f"window.setTime({i / 60})")
            cdp.send("Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True})
        dt = (time.perf_counter() - t0) / frames
        print(f"  WebGL renderer   {pg.evaluate('window.glInfo')}")
        print(f"  capture speed    {dt * 1000:.0f} ms/frame at 1920x1080 (one worker)")
        b.close()
    srv.shutdown()
