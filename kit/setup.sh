#!/bin/bash
# kit/setup.sh -- install what the Shorts pipeline needs (safe to run again; skips what is already there).
#   bash kit/setup.sh            from the repo root
set -e
cd "$(dirname "$0")/.."
python3 -m pip install -q kokoro-onnx soundfile scipy numpy pillow
mkdir -p /home/user/models
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -s "/home/user/models/$f" ] || curl -sSL -o "/home/user/models/$f" \
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
done
# three.js for every Short's player (one install, the others link to it)
first=""
for d in */scenes/web; do
  [ -f "$d/package-lock.json" ] || continue
  if [ -z "$first" ]; then
    [ -d "$d/node_modules/three" ] || (cd "$d" && rm -rf node_modules && npm ci --silent --no-audit --no-fund)
    first="$d"
  elif [ ! -e "$d/node_modules" ]; then
    ln -s "../../../$first/node_modules" "$d/node_modules"
  fi
done
ls -la /home/user/models
echo "setup: ok"
