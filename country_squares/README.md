# Every country as a square: a vertical Short (1080 x 1920, 60 fps)

Every country morphs on the map into a perfect square of the same area. The 195 squares then line up from biggest
to smallest, from Russia's 4,135 km square down to Vatican City's 663 m one. The camera rides the queue, past the
giants (Russia, Canada, US, China, Brazil, Australia), India, Malawi in the middle, and the tiny ones (San Marino,
Tuvalu, Nauru, Monaco, Vatican City). Then the squares fly back and turn into the map again, so the video loops.

Areas come from the CIA World Factbook's final edition, outlines from Natural Earth, and the projection is Equal
Earth (equal-area, so the squares are to scale with the map). It is drawn with Canvas 2D in headless Chromium and
assembled with ffmpeg. The voice is Kokoro, and the music and SFX are synthesized.

Status, decisions and file map: `HANDOFF.md`. Sources and judgement calls: `research/notes.md`. Every number: `facts.md`.

## Setup (once)

```bash
uv venv .venv --python 3.13
uv pip install --python .venv/bin/python numpy scipy soundfile kokoro-onnx shapely pyproj pytest playwright==1.63.0
(cd scenes/web && npm install)            # flag-icons
mkdir -p assets/models && cd assets/models && \
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx && \
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

## Build

```bash
.venv/bin/python build.py plan            # data, facts, narration, tests
.venv/bin/python build.py tts             # voice + measured timings
.venv/bin/python build.py style && .venv/bin/python build.py export
.venv/bin/python build.py final --render  # every scene (~10 min on 4 cores), then the mix
.venv/bin/python build.py cover && .venv/bin/python build.py upload
```
