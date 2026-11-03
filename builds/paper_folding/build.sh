#!/usr/bin/env bash
# build.sh -- the whole Short from nothing (see REPORT.md, "Rebuild"). Steps are idempotent; the render resumes per segment.
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv; .venv/bin/pip install -q kokoro-onnx soundfile scipy fonttools; }
mkdir -p models
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -f models/$f ] || curl -sSL -o models/$f https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f
done
[ -d web/node_modules/three ] || (cd web && npm install --silent three@0.186.1)
[ -e web/node_modules/playwright ] || ln -s "$(npm root -g)/playwright" web/node_modules/playwright
.venv/bin/python config/facts.py              # recompute every number, assert the brief's values
.venv/bin/python tools/tts.py                 # voice + measured timings
.venv/bin/python tools/export.py              # cache/data.json for the scene
node tools/cues.js                            # sound cues from a dry pass over the timeline
.venv/bin/python tools/audio.py               # SFX, music, mix, master (-14 LUFS)
.venv/bin/python tools/captions.py            # word captions (ASS) + captions.srt
./tools/render.sh "${WORKERS:-4}"             # every frame, headless Chromium -> renders/picture.mp4
.venv/bin/python tools/splice.py              # re-rendered patches, if any -> renders/picture_final.mp4
./tools/assemble.sh                           # final.mp4 (captions) + renders/final_clean.mp4
