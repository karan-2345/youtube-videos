# chess_reel: "You think chess is easy?" (Instagram Reel)

A 1080×1920, 30 fps, 50-second (1500-frame) Remotion reel. Every visual is made in code (SVG, canvas and CSS). Narration is Kokoro `af_heart` at speed 0.9.

## Build
```bash
npm install
python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile numpy
# model files go in models/ (not committed), from github.com/thewh1teagle/kokoro-onnx releases, model-files-v1.0:
#   kokoro-v1.0.onnx, voices-v1.0.bin
.venv/bin/python tts.py                  # -> public/audio/voiceover.wav
npm run render                           # scans public/audio, then -> out/reel.mp4
node scripts/stills.mjs 230,620,1180     # review stills -> out/stills/
```

## Audio
`src/audio/slots.ts` lists every cue (bassHit, tick, swell, whoosh, riser, silenceDip, sub, shimmer) with its global frame. Put a file named after the slot's `file` (for example `bassHit.wav` or `whoosh.wav`) in `public/audio/` and run `npm run render`. `scripts/scan-audio.mjs` picks it up automatically. A slot with no file is skipped and logs a warning.
The voiceover is one track (`voiceover.wav`). If you add `voiceover-1.wav` … `voiceover-6.wav`, they replace it, one per scene.

## Notes
- The numbers are string literals in `src/constants.ts` and are never computed.
- Inter ExtraBold is bundled from `public/fonts` and loaded with the FontFace API rather than `@remotion/google-fonts`, so renders don't depend on the network.
