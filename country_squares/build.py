"""
build.py -- one entry point for the whole Short ("Every country as a square", vertical, 1080 x 1920 @ 60).

    python build.py data [--factbook PATH]   country table + map shapes -> data/countries.json
                                             (--factbook: re-extract the areas from a clone of factbook.json first)
    python build.py facts                    every number, its source and the checks -> facts.md
    python build.py narration                config/narration.src.md -> narration.md (+ lint)
    python build.py tts [scenes...]          synthesize the voice, measure every beat -> renders/cache/timings.json
    python build.py style                    palette + fonts -> scenes/web/style.css / style.json
    python build.py export [scenes...]       key schedules + sound cues -> renders/cache/scenes/<Id>.json
    python build.py stills <id> t1 t2 ...    PNG stills -> renders/stills/
    python build.py scene <id> [--workers N] render one scene -> renders/scenes/<id>.mp4
    python build.py final [--render]         assemble (voice, captions, SFX, music, master) -> renders/final/
                                             (--render: render every scene first)
    python build.py cover                    the Reels / Shorts cover -> renders/final/cover.png
    python build.py upload                   titles, description, sources -> renders/final/upload.md
    python build.py test                     pytest
    python build.py plan                     data + facts + narration + test

Run with the project venv: .venv/bin/python build.py <command>
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
NAME = "country_squares"


def run(*args):
    return subprocess.call([sys.executable, *map(str, args)], cwd=ROOT)


def cmd_data(a):
    if a.factbook:
        if run(ROOT / "tools/build_data.py", "extract", "--factbook", a.factbook):
            return 1
    return run(ROOT / "tools/build_data.py", "build")


def cmd_facts(_a):
    return run("-m", "config.facts")


def cmd_narration(_a):
    return run(ROOT / "tools/narration.py")


def cmd_tts(a):
    return run(ROOT / "tools/tts.py", *a.scenes)


def cmd_style(_a):
    return run(ROOT / "config/style.py")


def cmd_export(a):
    return run(ROOT / "scenes/export.py", *a.scenes) or run(ROOT / "tools/probe.py", *a.scenes)


def cmd_stills(a):
    return run(ROOT / "tools/capture.py", a.scene, "--stills", *a.times)


def cmd_scene(a):
    return run(ROOT / "tools/capture.py", a.scene, "--workers", a.workers)


def cmd_final(a):
    from config import style
    if a.render:
        for s in style.SCENE_ORDER:
            if run(ROOT / "tools/capture.py", s, "--workers", a.workers):
                return 1
    from tools.assemble import assemble
    final = ROOT / "renders" / "final"
    assemble(style.SCENE_ORDER, NAME, full=True, out_dir=final, caps_dir=final / "captions",
             stems_dir=final / "stems")
    return 0


def cmd_cover(_a):
    from tools import cover
    cover.make()
    return 0


def cmd_upload(_a):
    from tools import upload
    upload.write()
    return 0


def cmd_test(_a):
    return run("-m", "pytest", "-q", ROOT / "tests")


def cmd_plan(a):
    a.factbook = None
    for step in (cmd_data, cmd_facts, cmd_narration, cmd_test):
        if step(a):
            return 1
    return 0


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("data"); p.add_argument("--factbook", type=Path); p.set_defaults(fn=cmd_data)
    sub.add_parser("facts").set_defaults(fn=cmd_facts)
    sub.add_parser("narration").set_defaults(fn=cmd_narration)
    p = sub.add_parser("tts"); p.add_argument("scenes", nargs="*"); p.set_defaults(fn=cmd_tts)
    sub.add_parser("style").set_defaults(fn=cmd_style)
    p = sub.add_parser("export"); p.add_argument("scenes", nargs="*"); p.set_defaults(fn=cmd_export)
    p = sub.add_parser("stills"); p.add_argument("scene"); p.add_argument("times", nargs="+"); p.set_defaults(fn=cmd_stills)
    p = sub.add_parser("scene"); p.add_argument("scene"); p.add_argument("--workers", default="4"); p.set_defaults(fn=cmd_scene)
    p = sub.add_parser("final"); p.add_argument("--render", action="store_true"); p.add_argument("--workers", default="4")
    p.set_defaults(fn=cmd_final)
    sub.add_parser("cover").set_defaults(fn=cmd_cover)
    sub.add_parser("upload").set_defaults(fn=cmd_upload)
    sub.add_parser("test").set_defaults(fn=cmd_test)
    sub.add_parser("plan").set_defaults(fn=cmd_plan)
    a = ap.parse_args()
    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found on PATH")
        return 1
    return a.fn(a)


if __name__ == "__main__":
    raise SystemExit(main())
