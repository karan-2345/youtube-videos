# how_fast: "How fast are you moving right now?" (YouTube Short)

Vertical 1080×1920, 60 fps, about 79 s. Built in a Claude Code cloud session (Linux).

## Pipeline
| Step | Command | Output |
|---|---|---|
| Facts + checks | `python config/facts.py 71` | prints derived numbers and sanity checks; `config/facts.json` for the renderer |
| Voice (Kokoro `af_heart`, speed 0.86) | `python tools/voice.py` | `audio/narration.wav`, `config/timeline.json` (word times, events) |
| Captions | `python tools/captions.py` | `captions/captions.ass` (burned in), `captions/captions.srt` |
| Music + SFX (synthesized) | `python tools/audio.py` | `audio/music.wav`, `audio/sfx.wav` |
| Mix | `python tools/mix.py` | `audio/master.wav` (−14 LUFS, −1 dBTP), `audio/stems/` |
| Stills for review | `node web/render.mjs stills 5,17.5,55 renders/stills` | PNGs |
| Frames → video | `node web/render.mjs video <from> <to> renders/seg/segN.mp4` | 60 fps segments |
| Final | `python tools/assemble.py` | `final/*.mp4` |

The script lives in `config/narration.md` (`[display|spoken]`, `{{fact}}` tokens, `{#event}` anchors, `@pause`).
All visuals are a pure function of time in `web/main.js`: Three.js for Earth, the orbit and the galaxy, and a 2D canvas for
the diagrams, HUD and notes.

## Not included (download again)
- Kokoro model: `kokoro-v1.0.onnx` + `voices-v1.0.bin` from github.com/thewh1teagle/kokoro-onnx releases (model-files-v1.0).
  `tools/tts.py` expects `assets/models/kokoro-v1.0-dur.onnx`: the same model with its duration tensor
  (`/encoder/Clip_output_0`) added as a second graph output (a few lines with the `onnx` package), which gives the word timings.
- `npm install three@0.170.0 playwright-core` inside `web/`; Python: numpy scipy soundfile onnxruntime onnx misaki spacy
  (en_core_web_sm) phonemizer-fork espeakng-loader pyloudnorm pillow; system: ffmpeg (with libass), espeak-ng.

## Credits
Earth textures: NASA Blue Marble and Black Marble (public domain), via the three-globe npm package.
Fonts: Inter, JetBrains Mono (SIL OFL). Music and SFX: generated in `tools/audio.py`.
