# starlink_phased_array: "The flat Starlink antenna that steers without moving" (YouTube Short / Instagram Reel)

Vertical 1080×1920, 60 fps, about 83 s. Built in a Claude Code cloud session (Linux, software GL, no GPU).
The picture is Three.js: a night roof with a flat panel and a time-lapse satellite pass, and a real wave-interference
simulation (a vertex shader sums one ripple per source) shown first as a pond, then as radio waves from a row of antennas.

## Pipeline
| Step | Command | Output |
|---|---|---|
| Facts + checks | `python config/facts.py --export` | prints derived physics numbers and sanity checks; `config/facts.json` for the renderer |
| Voice (Kokoro `af_heart`, speed 0.86) | `python tools/voice.py` | `audio/narration.wav`, `config/timeline.json` (word times, events) |
| Captions | `python tools/captions.py` | `captions/captions.ass` (burned in), `captions/captions.srt` |
| Music + SFX (synthesized) | `python tools/audio.py` | `audio/music.wav`, `audio/sfx.wav` |
| Mix | `python tools/mix.py` | `audio/master.wav` (−14 LUFS, −1 dBTP), `audio/stems/` |
| Stills for review | `node web/render.mjs stills 5,17.5,55 renders/stills` then `python tools/sheet.py renders/stills renders/sheets` | PNGs and contact sheets |
| Frames → video | `tools/render_all.sh` (four segments cut at scene changes; `ONLY=3 tools/render_all.sh` redoes one) | `renders/seg/seg1..4.mp4` |
| Final | `python tools/assemble.py` | `final/*.mp4` |

The script lives in `config/narration.md` (`[display|spoken]`, `{{fact}}` tokens, `{#event}` anchors, `@pause`).
Every animation is a pure function of time in `web/main.js`, cued to the word times in `config/timeline.json`, so the picture
and the voice stay in step when the script changes. Software GL uses every core, so render segments one after another
(about 55 min in total).

## What is real and what is drawn
- The field is computed, not faked: each source adds `a·cos(k·r − ωt + φ)`, the stones land one period apart so they ripple in step,
  and the steered row uses `φ = k·x·sin θ` (the same delay the stones show). Crest-meets-crest and the leaning wave come out of that sum.
- Numbers on screen (angles, picoseconds) are computed live from the drawn geometry; see `research/notes.md` for sources and caveats.
- Not claimed anywhere: the real antenna count, field of view, gain or power.

## Not included (download again)
- Kokoro model: `kokoro-v1.0.onnx` + `voices-v1.0.bin` from github.com/thewh1teagle/kokoro-onnx releases (model-files-v1.0) into `assets/models/`.
  `python tools/patch_model.py` makes `kokoro-v1.0-dur.onnx`: the same model with its duration tensor (`/encoder/Clip_output_0`)
  added as a second graph output, which gives the word timings.
- `npm install` inside `web/` (three@0.170.0, playwright-core); Python 3.13: numpy scipy soundfile onnxruntime onnx misaki kokoro-onnx
  num2words spacy (plus the `en_core_web_sm` wheel) phonemizer-fork espeakng-loader pyloudnorm pillow; system: ffmpeg (with libass), espeak-ng.

## Credits
Fonts: Inter, JetBrains Mono (SIL OFL). Music and SFX: generated in `tools/audio.py`. Narration: Kokoro TTS (synthetic voice).
