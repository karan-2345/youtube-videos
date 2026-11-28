"""
kit/new_short.py -- start a new Short from the latest one's pipeline.

    python3 kit/new_short.py <name>_short [--from fat_short] [--scene Name]

Copies the shared machinery (runtime with bloom and motion blur, capture, TTS, word alignment, assemble, cover, contact
sheets, fonts, .gitignore) and writes clean starting points for what every Short writes itself: the script, the facts,
the anchors, the scene, the sound and the music. Then follow .claude/skills/new-short/SKILL.md.
"""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SHARED = ["build.py", "config/__init__.py", "config/style.py", "tools/__init__.py", "tools/tts.py", "tools/align.py",
          "tools/assemble.py", "tools/capture.js", "tools/cover.py", "tools/sheet.py", "tools/music.py", "tools/sfx.py",
          "scenes/web/runtime.js", "scenes/web/player.html", "scenes/web/overlay.css", "scenes/web/package.json",
          "scenes/web/package-lock.json"]

NARRATION = '''"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

House rules: the hook lands in the first sentence and carries the whole promise; sentences flow on conjunctions and
prepositions (And, Because, Then, So, But, When); no fragments or mic-drop kickers; no maths to follow; the last line
loops back into the hook. 185-210 words for 60-70 s.
"""

BEATS = [
    ("hook", "TODO: the hook, word for word if the user gave one."),
    ("end", "TODO: the last line, which flows back into the hook."),
]
'''

FACTS = '''"""
config/facts.py -- every claim in this Short, where it comes from, and a check.  python3 build.py facts -> facts.md

Sources (checked YYYY-MM-DD):
  [A]  ...
"""

from __future__ import annotations

CLAIMS = [
    # ("the claim as said", lambda: <check>, "[A]: the quote or the arithmetic"),
]


def report() -> tuple[str, bool]:
    rows, ok = [], True
    for claim, check, note in CLAIMS:
        good = bool(check())
        ok &= good
        rows.append(f"| {'PASS' if good else 'FAIL'} | {claim} | {note} |")
    text = "# facts.md\\n\\n| | Claim | Source / check |\\n|---|---|---|\\n" + "\\n".join(rows) + "\\n"
    return text, ok and bool(CLAIMS)
'''

SCENE = '''// scenes/3d/{scene}.js -- the Short's one continuous scene. setup(ctx) -> {{ scene, camera, update(t), post, look }}
import * as THREE from 'three';
import {{ ease, ramp, track, rng }} from '/scenes/web/runtime.js';

export async function setup(ctx) {{
  const {{ renderer, data, overlay: O }} = ctx;
  const P = data.palette, A = data.anchors, D = data.duration;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.01, 300);
  // TODO: build the world; everything is a pure function of t (deterministic capture)
  function update(t) {{
    camera.position.set(0, 1.5, 4); camera.lookAt(0, 1, 0);
  }}
  return {{ scene, camera, update, post: {{ ss: 1.5, msaa: 0, grain: 0.02, vignette: 0.3, bloom: 0.15, samples: 1 }},
           look: (t) => ({{}}) }};
}}
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--from", dest="src", default="fat_short")
    ap.add_argument("--scene", default=None)
    ap.add_argument("--dest", default=str(REPO))
    a = ap.parse_args()
    name = a.name if a.name.endswith("_short") else a.name + "_short"
    scene = a.scene or "".join(p.capitalize() for p in name[:-6].split("_"))
    src, dst = REPO / a.src, Path(a.dest) / name
    if dst.exists():
        raise SystemExit(f"{dst} already exists")
    for rel in SHARED:
        (dst / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src / rel, dst / rel)
    shutil.copytree(src / "assets" / "fonts", dst / "assets" / "fonts")
    (dst / ".gitignore").write_text((src / ".gitignore").read_text().replace(a.src, name))
    for d in ("scenes/3d/lib", "renders/final", "audio"):
        (dst / d).mkdir(parents=True, exist_ok=True)
    (dst / "config" / "narration.py").write_text(NARRATION)
    (dst / "config" / "facts.py").write_text(FACTS)
    (dst / "scenes" / "3d" / f"{scene}.js").write_text(SCENE.format(scene=scene))
    # names and per-Short settings back to neutral
    sub = lambda rel, pat, rep: (dst / rel).write_text(re.sub(pat, rep, (dst / rel).read_text(), flags=re.S))
    sub("tools/assemble.py", r'NAME = "[a-z_]+"', f'NAME = "{name}"')
    sub("tools/assemble.py", r"fat_short", name)
    sub("tools/assemble.py", r"    drums = \[.*?\n    hush = \[.*?\n",
        '    drums = [(A["hook_end"], A["end"])]                    # TODO: where the beat plays\n    hush = []\n')
    sub("config/style.py", r'SCENE = "[A-Za-z]+"', f'SCENE = "{scene}"')
    sub("tools/tts.py", r"IPA_FIXES: dict\[str, str\] = \{.*?\n\}", "IPA_FIXES: dict[str, str] = {}")
    sub("tools/tts.py", r"SAY = \{.*?\}\n", "SAY: dict[str, str] = {}     # e.g. {\"1990\": \"nineteen ninety\"}\n")
    # export.py: keep the machinery, empty the anchors and the Short's own clocks
    ex = (src / "tools" / "export.py").read_text()
    ex = re.sub(r"ANCHORS = \[.*?\n\]\n", "ANCHORS = [\n    # (\"name\", \"beat\", \"phrase\"),   TODO\n]\n", ex, flags=re.S)
    ex = re.sub(r"def regular\(.*?(?=def cues)", "", ex, flags=re.S)
    ex = ex.replace('        "breath": breath_cycles(A, tm["duration"]), "jog": jog(A),\n', "")
    ex = re.sub(r'        "facts": \{.*?\},\n', '        "facts": {},\n', ex, flags=re.S)
    (dst / "tools" / "export.py").write_text(ex)
    # three.js: link the first installed copy
    nm = dst / "scenes" / "web" / "node_modules"
    for cand in sorted(REPO.glob("*_short/scenes/web/node_modules")):
        if (cand.resolve() / "three").exists():
            nm.symlink_to(Path("../../..") / cand.resolve().relative_to(REPO))
            break
    print(f"new Short: {dst.relative_to(REPO) if dst.is_relative_to(REPO) else dst}  (scene {scene}.js)")
    print("next: config/narration.py, config/facts.py, then follow .claude/skills/new-short/SKILL.md")


if __name__ == "__main__":
    main()
