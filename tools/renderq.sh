#!/usr/bin/env bash
# tools/renderq.sh -- render scenes one after another (2 workers each) and run the frame-jump check on each.
#   bash tools/renderq.sh S00_Chirp S01_Title ...      log: renders/logs/renderq.log
cd "$(dirname "$0")/.." || exit 1
mkdir -p renders/logs
for s in "$@"; do
  echo "=== $s $(date +%T)" >> renders/logs/renderq.log
  if .venv/Scripts/python build.py scene "$s" --workers 2 >> "renders/logs/$s.log" 2>&1; then
    .venv/Scripts/python tools/jumpcheck.py "renders/scenes/$s.mp4" >> renders/logs/renderq.log 2>&1
  else
    echo "FAILED $s" >> renders/logs/renderq.log
  fi
done
echo "=== done $(date +%T)" >> renders/logs/renderq.log
