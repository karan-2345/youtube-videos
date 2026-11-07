"""
tools/probe.py -- add the rank counter's ticks to each scene's cue sheet, measured from the browser's own camera.

While a "#n OF 195" counter is on screen, one tick plays each time the number shown changes (window.probe(t) is the
camera squares.js draws with, so the ticks cannot drift from the picture). Ticks closer than MIN_GAP_S are merged:
on the fastest trips the counter moves faster than a tick can be heard.

    python tools/probe.py [scene ...]        (after scenes/export.py, which rewrites the cue sheets)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.capture import _open, serve  # noqa: E402

SCENES = ROOT / "renders" / "cache" / "scenes"
STEP_S = 1 / 240
MIN_GAP_S = 0.045


def ticks(scene: str) -> int:
    path = SCENES / f"{scene}.json"
    d = json.loads(path.read_text(encoding="utf-8"))
    if not d.get("counters"):
        return 0
    from playwright.sync_api import sync_playwright
    srv, port = serve()
    rows = []
    with sync_playwright() as p:
        browser, page = _open(p, scene, port)
        for c in d["counters"]:
            n = int((c["t1"] - c["t0"]) / STEP_S)
            rs = page.evaluate(f"[...Array({n}).keys()].map(i => window.probe({c['t0']} + i * {STEP_S}).r)")
            last_shown, last_t = None, -1.0
            for i, r in enumerate(rs):
                if r is None:
                    continue
                shown = max(1, min(195, round(r)))
                t = c["t0"] + i * STEP_S
                if last_shown is not None and shown != last_shown and t - last_t >= MIN_GAP_S:
                    rows.append([round(t, 4), "tick", -16])
                    last_t = t
                last_shown = shown
        browser.close()
    srv.shutdown()
    d["cues"] = [x for x in d.get("cues", []) if x[1] != "tick" or x[2] != -16] + rows
    path.write_text(json.dumps(d, separators=(",", ":")), encoding="utf-8")
    return len(rows)


if __name__ == "__main__":
    names = sys.argv[1:] or [p.stem for p in sorted(SCENES.glob("S*.json"))]
    for s in names:
        print(f"  {s}: {ticks(s)} counter ticks")
