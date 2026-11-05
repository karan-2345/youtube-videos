#!/usr/bin/env bash
# tools/render.sh [workers] -- render the whole timeline in contiguous segments, one headless Chromium per worker,
# then join them losslessly into renders/picture.mp4. Segments already rendered (seg<i>.done) are skipped.
set -euo pipefail
cd "$(dirname "$0")/.."
W=${1:-4}
N=$(python3 -c "import json; d=json.load(open('cache/data.json')); print(round(d['duration']*60))")
mkdir -p frames/full renders
echo "frames: $N on $W workers"
T0=$(date +%s)
for i in $(seq 0 $((W-1))); do
  a=$((N*i/W)); b=$((N*(i+1)/W))
  if [ -f frames/full/seg$i.done ]; then continue; fi
  ( node tools/capture.js $a $b frames/full/seg$i.mp4 > frames/full/log$i.txt 2>&1 && touch frames/full/seg$i.done ) &
done
wait
T1=$(date +%s)
: > frames/full/list.txt
for i in $(seq 0 $((W-1))); do [ -f frames/full/seg$i.done ] || { echo "segment $i failed"; exit 1; }; echo "file 'seg$i.mp4'" >> frames/full/list.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i frames/full/list.txt -c copy renders/picture.mp4
echo "render wall $((T1-T0)) s, $(python3 -c "print(round($N/max(1,$T1-$T0),2))") frames/s"
