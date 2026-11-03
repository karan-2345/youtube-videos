# patriot: "The rounding error that a fix made deadly" (YouTube Short)

Vertical 1080×1920, 60 fps, 2:50 (170.2 s). Script v1 (469 words as written, 483 spoken: numbers are spoken in full).
Built in a Claude Code cloud session (Linux), on the pipeline of the earlier `how_fast` Short.

**Central question:** a clock wrong by one part in a million shouldn't matter, so why did it matter? The answer the
popular telling skips (Skeel, SIAM News 1992): the error should have cancelled, and only stopped cancelling because a
patch made the time conversion accurate in some places and not others. See `research/notes.md`.

## Files
| | |
|---|---|
| `final/patriot_rounding_error.mp4` | the Short, captions burned in |
| `final/upload.md` | title, description, tags, sources for the upload |
| `final/captions.srt` | sentence captions for the upload |
| `config/narration.md` | the script with `[display|spoken]` swaps and `{#event}` cues |
| `checks/compute1.py` | every number, with exact fractions (all checks pass) |
| `research/notes.md` | sources and what the popular version gets wrong |

## Pipeline
| Step | Command | Output |
|---|---|---|
| Number checks | `python checks/compute1.py` | prints each check; exit 1 on a failure |
| Model patch (once) | `.venv/bin/python tools/patch_model.py` | `assets/models/kokoro-v1.0-dur.onnx` (adds the duration output for word timings) |
| Voice (Kokoro `af_heart`, speed 0.95) | `.venv/bin/python tools/voice.py` | `audio/narration.wav`, `config/timeline.json` |
| Captions | `.venv/bin/python tools/captions.py` | `captions/captions.ass` (burned in, current word amber), `captions/captions.srt` |
| Music + sound (synthesized) | `.venv/bin/python tools/audio.py` | `audio/music.wav`, `audio/sfx.wav` |
| Mix | `.venv/bin/python tools/mix.py` | `audio/master.wav` (−14 LUFS, ≤ −1 dBTP, linear gain after a look-ahead limiter) |
| Stills | `node web/render.mjs stills 5,42.5,81.5 renders/stills` | PNGs |
| Frames → video | `bash tools/render_all.sh` | `renders/seg/seg1-4.mp4` (4 workers, about 7 min) |
| Final | `.venv/bin/python tools/assemble.py` | `final/*.mp4` (CRF 20 so the captioned file stays under GitHub's 100 MB) |

All visuals are one 2D canvas, a pure function of time, in `web/main.js`: the console, the binary chop at bit 23, the
two clocks drifting over 100 hours, the radar pulses, the patched code blocks, the search window sliding 687 m, the
February 1991 calendar, the reboot and the return to the console. The last frame is the first frame (loop).

## Setup (not in git)
- Python 3.11 venv: `numpy scipy soundfile onnxruntime onnx misaki num2words spacy phonemizer-fork espeakng-loader
  pyloudnorm pillow`, `kokoro-onnx --no-deps`, `python -m spacy download en_core_web_sm`. Do not install `misaki[en]`
  (it pulls in torch). System: `espeak-ng`, ffmpeg with libass, Node 22 with the global `playwright` and Chromium at
  `/opt/pw-browsers/chromium`.
- Kokoro model files from github.com/thewh1teagle/kokoro-onnx releases (model-files-v1.0): `kokoro-v1.0.onnx`,
  `voices-v1.0.bin` into `assets/models/`.

## Credits
Fonts: Inter, JetBrains Mono (SIL OFL). Music and sound: generated in `tools/audio.py`. Voice: Kokoro (Apache-2.0).
