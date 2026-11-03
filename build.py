"""
build.py -- one entry point for the whole project.

Planning stage (available now):
    python build.py doctor [--webgl]   check the toolchain
    python build.py style              export palette/fonts to scenes/web/style.{css,json}
    python build.py facts [--force]    recompute facts, regenerate facts.md, run checks
    python build.py narration          render narration.md from config/narration.src.md (+ lint)
    python build.py test               pytest
    python build.py plan               style + facts + narration + test
    python build.py voices [names...]  synthesize the voice-comparison samples
    python build.py samples [speeds...]  pace samples of the opening (samples/pace_092.wav ...)

Production:
    python build.py textures           build stylised Earth textures (Natural Earth + NASA Black Marble)
    python build.py tts [scenes...]    synthesize narration, write timings + captions
    python build.py scene <id> [--preview]   render one scene (Manim or three.js, picked automatically)
    python build.py stills <id> t1 t2  quick PNG stills of a three.js scene
    python build.py assemble --name N <ids...>   cut scenes + voice + captions -> renders/final/N.mp4
    python build.py sample             the checkpoint-2 sample scene, fully mixed -> renders/sample/
    python build.py final              the whole Short: every scene, voice, SFX, music, captions
                                       -> renders/final/chess_short.mp4 (+ _clean, _silent, captions, stems)
    python build.py cover              the Reels cover -> renders/final/cover.png
    python build.py upload             titles, description, caption -> renders/final/upload.md

Run everything with the project venv:  .venv\\Scripts\\python build.py <command>
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

VOICE_SAMPLE_TEXT = (
    "White has exactly twenty possible first moves, and Black has twenty replies."
)
DEFAULT_SAMPLE_VOICES = ["af_heart", "af_bella", "am_michael", "am_fenrir", "bm_george", "bf_emma"]


def cmd_doctor(args):
    from tools import doctor
    ok = doctor.report()
    if args.webgl:
        doctor.webgl_benchmark()
    return 0 if ok else 1


def cmd_style(_args):
    from config import style
    style.export_web()
    print("scenes/web/style.css and style.json written")
    return 0


def cmd_facts(args):
    from tools import gen_facts
    text, ok = gen_facts.generate(force=args.force)
    (ROOT / "facts.md").write_text(text, encoding="utf-8")
    print(f"facts.md written; brief checks {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


def cmd_narration(_args):
    from tools import narration
    return narration.main()


def cmd_test(_args):
    return subprocess.call([sys.executable, "-m", "pytest", "-q", str(ROOT / "tests")])


def cmd_plan(args):
    args.force = getattr(args, "force", False)
    for step in (cmd_style, cmd_facts, cmd_narration, cmd_test):
        rc = step(args)
        if rc:
            return rc
    return 0


def cmd_voices(args):
    import soundfile as sf
    from kokoro_onnx import Kokoro

    from config import style
    k = Kokoro(str(ROOT / "assets/models/kokoro-v1.0.onnx"), str(ROOT / "assets/models/voices-v1.0.bin"))
    out = ROOT / "audio" / "voice_samples"
    out.mkdir(parents=True, exist_ok=True)
    for v in args.names or DEFAULT_SAMPLE_VOICES:
        lang = "en-us" if v.startswith("a") else "en-gb"
        samples, sr = k.create(VOICE_SAMPLE_TEXT, voice=v, speed=style.VOICE_SPEED, lang=lang)
        sf.write(out / f"{v}.wav", samples, sr)
        print(f"  {v}: {len(samples) / sr:.1f} s -> audio/voice_samples/{v}.wav")
    return 0


def cmd_textures(_args):
    from tools import make_textures
    make_textures.main()
    return 0


def cmd_tts(args):
    from tools import narration, tts
    rc = narration.main()
    if rc:
        return rc
    tts.build(set(args.scenes) or None)
    return 0


def _kind(scene_id: str) -> str:
    if (ROOT / "scenes" / "manim" / f"{scene_id}.py").exists():
        return "manim"
    if (ROOT / "scenes" / "3d" / f"{scene_id}.js").exists():
        return "web"
    raise SystemExit(f"no scene source for {scene_id}")


def _fresh(scene_id: str) -> bool:
    """The rendered scene is newer than everything it is built from."""
    out = ROOT / "renders" / "scenes" / f"{scene_id}.mp4"
    if not out.exists():
        return False
    deps = [ROOT / "scenes" / "3d" / f"{scene_id}.js", *(ROOT / "scenes" / "3d" / "lib").glob("*.js"),
            ROOT / "scenes" / "3d" / "export.py", ROOT / "config" / "events.py", ROOT / "scenes" / "web" / "runtime.js"]
    return out.stat().st_mtime > max(p.stat().st_mtime for p in deps if p.exists())


def _busy(scene_id: str) -> bool:
    """Another process is rendering this scene right now (its segments are still growing)."""
    import time
    d = ROOT / "renders" / "frames" / scene_id
    return d.exists() and any(time.time() - p.stat().st_mtime < 90 for p in d.glob("seg*.mp4"))


def cmd_scene(args):
    if not args.force and (_fresh(args.id) or _busy(args.id)):
        print(f"  {args.id}: {'up to date' if _fresh(args.id) else 'being rendered by another process'}; skipped")
        return 0
    if _kind(args.id) == "manim":
        from tools import render_manim
        render_manim.render(args.id, preview=args.preview)
    else:
        cmd_scene_web(args.id, args.workers)
    return 0


def cmd_stills(args):
    from tools import capture
    _export_web(args.id)
    for p in capture.stills(args.id, args.times, ROOT / "renders" / "stills"):
        print(f"  {p.relative_to(ROOT)}")
    return 0


def cmd_thumbnail(args):
    from tools import capture, thumbnail
    if args.pick:
        path = thumbnail.pick(args.pick)
        print(f"  {path.relative_to(ROOT)}  ({thumbnail.check(path)})")
        return 0
    from tools import thumb_compose
    scaled = {}
    for v, still in thumb_compose.build().items():
        scaled[v] = thumbnail.scale(still, ROOT / "renders" / "stills" / f"thumbnail_{v}.png")
        print(f"  {scaled[v].relative_to(ROOT)}  ({thumbnail.check(scaled[v])})")
    out = thumbnail.sheet(scaled, ROOT / "renders" / "stills" / "thumbnail_sheet.png")
    print(f"  {out.relative_to(ROOT)}\n  pick one: build.py thumbnail --pick A|B -> renders/final/thumbnail.png")
    return 0


def _export_web(scene_id: str):
    import importlib.util
    spec = importlib.util.spec_from_file_location("export3d", ROOT / "scenes" / "3d" / "export.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.export(scene_id)


def cmd_scene_web(scene_id: str, workers: int):
    from tools import capture
    _export_web(scene_id)
    capture.render(scene_id, workers)


def cmd_assemble(args):
    from tools import assemble
    assemble.assemble(args.ids, args.name)
    return 0


def cmd_samples(args):
    from tools import samples
    samples.build([float(x) for x in args.speeds] or [0.90])
    return 0


def cmd_short(_args):
    from tools import short
    short.build()
    return 0


def cmd_upload(_args):
    from tools import upload
    print(' ', upload.write().relative_to(ROOT))
    return 0


def cmd_cover(_args):
    from tools import cover
    print(' ', cover.build().relative_to(ROOT))
    return 0


def cmd_final(_args):
    from config import style
    from tools import assemble
    fin = ROOT / "renders" / "final"
    assemble.assemble(style.SCENE_ORDER, "chess_short", full=True, out_dir=fin, caps_dir=fin / "captions",
                      stems_dir=fin / "stems")
    return 0


SAMPLE_SCENE = "S03_Runaway"


def cmd_sample(_args):
    """Checkpoint 2: one scene, mixed and mastered exactly like the final."""
    from tools import assemble
    out = ROOT / "renders" / "sample"
    assemble.assemble([SAMPLE_SCENE], "sample_scene", full=True, out_dir=out, caps_dir=out, stems_dir=out)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("textures").set_defaults(fn=cmd_textures)
    p = sub.add_parser("tts")
    p.add_argument("scenes", nargs="*")
    p.set_defaults(fn=cmd_tts)
    p = sub.add_parser("scene")
    p.add_argument("id")
    p.add_argument("--preview", action="store_true")
    p.add_argument("--workers", type=int, default=3)
    p.add_argument("--force", action="store_true", help="render even if up to date")
    p.set_defaults(fn=cmd_scene)
    p = sub.add_parser("stills")
    p.add_argument("id")
    p.add_argument("times", nargs="+", type=float)
    p.set_defaults(fn=cmd_stills)
    p = sub.add_parser("assemble")
    p.add_argument("--name", required=True)
    p.add_argument("ids", nargs="+")
    p.set_defaults(fn=cmd_assemble)
    sub.add_parser("sample").set_defaults(fn=cmd_sample)
    sub.add_parser("short").set_defaults(fn=cmd_short)
    sub.add_parser("upload").set_defaults(fn=cmd_upload)
    sub.add_parser("final").set_defaults(fn=cmd_final)
    sub.add_parser("cover").set_defaults(fn=cmd_cover)
    p = sub.add_parser("thumbnail")
    p.add_argument("--pick", choices=["A", "B"])
    p.set_defaults(fn=cmd_thumbnail)
    p = sub.add_parser("doctor")
    p.add_argument("--webgl", action="store_true")
    p.set_defaults(fn=cmd_doctor)
    sub.add_parser("style").set_defaults(fn=cmd_style)
    p = sub.add_parser("facts")
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_facts)
    sub.add_parser("narration").set_defaults(fn=cmd_narration)
    sub.add_parser("test").set_defaults(fn=cmd_test)
    p = sub.add_parser("plan")
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_plan)
    p = sub.add_parser("samples")
    p.add_argument("speeds", nargs="*")
    p.set_defaults(fn=cmd_samples)
    p = sub.add_parser("voices")
    p.add_argument("names", nargs="*")
    p.set_defaults(fn=cmd_voices)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
