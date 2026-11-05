#!/usr/bin/env bash
# tools/assemble.sh -- picture + captions + master -> final.mp4 (captions burned in) and renders/final_clean.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
DUR=$(python3 -c "import json; print(json.load(open('cache/data.json'))['duration'])")
PIC=renders/picture.mp4
ENC=(-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 5.1 -r 60
     -colorspace bt709 -color_primaries bt709 -color_trc bt709
     -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart -t "$DUR")
ffmpeg -y -loglevel error -i $PIC -i audio/master.wav -vf "subtitles=cache/captions.ass:fontsdir=fonts" -map 0:v -map 1:a "${ENC[@]}" final.mp4
ffmpeg -y -loglevel error -i $PIC -i audio/master.wav -map 0:v -map 1:a "${ENC[@]}" renders/final_clean.mp4
ls -la final.mp4 renders/final_clean.mp4
