#!/bin/bash
# Render the whole Short in 4 parallel segments: bash tools/render_all.sh
cd "$(dirname "$0")/.."
F=$(python3 -c "import json,math; print(math.ceil(json.load(open('config/timeline.json'))['duration']*60))")
mkdir -p renders/seg logs
for i in 1 2 3 4; do
  a=$(( (i - 1) * F / 4 )); b=$(( i * F / 4 ))
  node web/render.mjs video $a $b renders/seg/seg$i.mp4 > logs/seg$i.log 2>&1 &
done
wait
tail -n 2 logs/seg*.log
