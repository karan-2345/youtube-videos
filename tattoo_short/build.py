"""
build.py -- one entry point for the tattoo Short ("Why tattoos don't wash off", 1080 x 1920, 60 fps).

    python build.py style              export palette/fonts to scenes/web/style.{css,json}
    python build.py narration          render narration.md from config/narration.src.md (+ lint)
    python build.py tts [scenes...]    synthesize the narration (Kokoro), write timings + captions
    python build.py export [scenes...] write the scene data (phrase anchors) for the three.js scenes
    python build.py stills <id> t1 t2  PNG stills of a scene -> renders/stills/
    python build.py scene <id>         render one scene -> renders/scenes/<id>.mp4
    python build.py scenes             render every scene that is out of date
    python build.py final              voice + SFX + music + captions -> renders/final/tattoo_short.mp4
                                       (+ _clean, _silent, captions/.srt, stems/)
    python build.py cover              the cover still -> renders/final/cover.png
    python build.py upload             titles, description, hashtags -> renders/final/upload.md

On the laptop: .venv\\Scripts\\python build.py <command> (three.js must be installed in scenes/web: npm install).
The voice model goes in assets/models (kokoro-v1.0.onnx, voices-v1.0.bin), the same files as the chess Short.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def _export(ids):
    import importlib.util
    spec = importlib.util.spec_from_file_location("export3d", ROOT / "scenes" / "3d" / "export.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for i in ids:
        mod.export(i)


def _fresh(scene_id: str) -> bool:
    out = ROOT / "renders" / "scenes" / f"{scene_id}.mp4"
    if not out.exists():
        return False
    deps = [ROOT / "scenes" / "3d" / f"{scene_id}.js", *(ROOT / "scenes" / "3d" / "lib").glob("*.js"),
            ROOT / "scenes" / "3d" / "export.py", ROOT / "scenes" / "web" / "runtime.js",
            ROOT / "renders" / "cache" / "timings.json"]
    return out.stat().st_mtime > max(p.stat().st_mtime for p in deps if p.exists())


def cmd_style(_a):
    from config import style
    style.export_web()
    print("  scenes/web/style.css, style.json")


def cmd_narration(_a):
    from tools import narration
    return narration.main()


def cmd_tts(a):
    from tools import narration, tts
    if narration.main():
        return 1
    tts.build(set(a.scenes) or None)


def cmd_export(a):
    from config import style
    _export(a.scenes or style.SCENE_ORDER)


def cmd_stills(a):
    from tools import capture
    cmd_style(a)
    _export([a.id])
    for p in capture.stills(a.id, a.times, ROOT / "renders" / "stills"):
        print(f"  {p.relative_to(ROOT)}")


def cmd_scene(a):
    from tools import capture
    cmd_style(a)
    _export([a.id])
    capture.render(a.id, a.workers)


def cmd_scenes(a):
    from config import style
    for sid in style.SCENE_ORDER:
        if a.force or not _fresh(sid):
            a.id = sid
            cmd_scene(a)
        else:
            print(f"  {sid}: up to date")


def cmd_final(_a):
    from config import style
    from tools import assemble
    fin = ROOT / "renders" / "final"
    assemble.assemble(style.SCENE_ORDER, "tattoo_short", full=True, out_dir=fin, caps_dir=fin / "captions",
                      stems_dir=fin / "stems")


def cmd_cover(_a):
    from tools import cover
    print(" ", cover.build().relative_to(ROOT))


def cmd_upload(_a):
    from tools import upload
    print(" ", upload.write().relative_to(ROOT))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("style").set_defaults(fn=cmd_style)
    sub.add_parser("narration").set_defaults(fn=cmd_narration)
    p = sub.add_parser("tts")
    p.add_argument("scenes", nargs="*")
    p.set_defaults(fn=cmd_tts)
    p = sub.add_parser("export")
    p.add_argument("scenes", nargs="*")
    p.set_defaults(fn=cmd_export)
    p = sub.add_parser("stills")
    p.add_argument("id")
    p.add_argument("times", nargs="+", type=float)
    p.set_defaults(fn=cmd_stills)
    p = sub.add_parser("scene")
    p.add_argument("id")
    p.add_argument("--workers", type=int, default=3)
    p.set_defaults(fn=cmd_scene)
    p = sub.add_parser("scenes")
    p.add_argument("--workers", type=int, default=3)
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_scenes)
    sub.add_parser("final").set_defaults(fn=cmd_final)
    sub.add_parser("cover").set_defaults(fn=cmd_cover)
    sub.add_parser("upload").set_defaults(fn=cmd_upload)
    a = ap.parse_args()
    return a.fn(a) or 0


if __name__ == "__main__":
    raise SystemExit(main())
