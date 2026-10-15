#!/bin/bash
# Render the whole video in four segments cut at scene changes (frames at 60 fps).
# Sequential on purpose: software GL already uses every core, so parallel jobs do not help.
#   S1 0-24.5 s sky | S2 24.5-43.2 s pond | S3 43.2-60.0 s stagger + radio | S4 60.0-end sky
cd "$(dirname "$0")/.."
mkdir -p renders/seg logs
FRAMES=$(python3 -c "import json,math;print(math.ceil(json.load(open('config/timeline.json'))['duration']*60))")
B=(0 1470 2592 3600 $FRAMES)
for i in 1 2 3 4; do
  if [ -n "$ONLY" ] && [ "$ONLY" != "$i" ]; then continue; fi
  node web/render.mjs video ${B[$((i-1))]} ${B[$i]} renders/seg/seg$i.mp4 > logs/seg$i.log 2>&1 && echo "seg$i done" >> logs/render_progress.log
done
echo "all done" >> logs/render_progress.log
