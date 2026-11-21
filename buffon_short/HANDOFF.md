# HANDOFF: "You can calculate pi without a single circle" (Buffon's needle Short)

## Status 2026-11-21: final built, waiting for the user's review

`renders/final/`:
- `buffon_short.mp4`: captions burned in
- `buffon_short_clean.mp4`: no captions
- `buffon_short_silent.mp4`: not committed; rebuild with `build.py final`
- `captions/buffon_short.srt`
- `cover.png`
- `upload.md`
- `stems/`: not committed

Measured on the final files:
- **69.20 s**, 4,152 frames, 1080 x 1920 at 60 fps, H.264 at CRF 18 (about 10.8 Mb/s, 94 MB), AAC 48 kHz stereo.
- **Loudness:** −13.9 LUFS integrated (ebur128 on the final file), −2.2 dBTP, LRA 2.3 LU. The two-pass loudnorm stayed linear.
- **Stems before the master:** voice −22.3 LUFS. SFX are mixed 9 LU and music 12 LU under the voice, and the music ducks 6 dB under speech.
- **Captions:** 20 cards, and their text matches the script word for word (checked).
- **Loop:** the last frame leads into the first like any other frame. The seam step is 2.68/255 mean and 70.7/255 in the worst 60 px block. Frames 0 to 1 measure 1.89 and 70.0; the difference is the falling hero needle.
- **Checked by eye:** 24 frames of the captioned final across every beat, two at full size, and the cover.
- **Render times:** `capture.js render --workers 2` took 6,625 s (1 h 50 min, 0.63 frames/s on SwiftShader). `build.py final` took 9 min.

## Script (`config/narration.py`, 189 words)

Kokoro `af_heart` at speed 0.95 in en-us. "Lazzarini" is respelled in IPA as `lˌæzəɹˈiːni`.

| Beat | Time (s) | What happens |
|---|---|---|
| hook | 0.35–14.15 | The hero needle falls and *tinks*. π appears, a shower of needles drops, and 3.141592 types out under "MARIO LAZZARINI · 1901" with 3,408 drops and 1,808 crossings. Everything freezes in mono on "cheated". |
| bridge | 14.60–19.30 | The hook rewinds and one needle falls with a direction ring. |
| rule | 19.75–27.76 | Needles as long as the boards are wide: across always hits a crack, along almost never does. |
| circle | 28.21–38.13 | A ring of directions, 2/π (about 64%) of which cross. The formula appears and the rain begins: 3,000 seeded drops with a live estimate. |
| slow | 38.58–45.32 | The estimate ends at 3.1283 (3,000 drops, 1,918 crossings). The 1 turns red, since the run is right to one decimal place. |
| catch | 45.77–61.14 | 355/113, then Zu Chongzhi about AD 480, then 3,408 = 16 × 213 and 1,808 = 16 × 113 with the 113 in red. |
| end | 61.59–68.19 | Lazzarini's count ticks up and stops when it hits. The strike-through comes on "weren't", the rain rewinds, and the camera dives home into the loop. |

## Decisions

- **Facts:** the needle length equals the board width, so P(cross) = 2/π and π ≈ 2N/C.
  - Lazzarini's actual setup was a 2.5 cm needle and 3 cm lines, which gives 355/113 exactly. `facts.md` covers that and the rest.
  - "An honest 3,000-drop run usually gets one decimal right" comes from an exact binomial: 64.8% get exactly one decimal, 26.1% none, 9.0% two or more.
- **Rain:** seed 10 (`config/facts.py`), a typical run. Every one of the 3,000 needles is drawn.
- **Look:** dark oak under a warm spot lamp, steel needles, and crossings in accent red (#E0502F).
  - Inter ExtraBold for type and Archivo for captions.
  - Captions sit at y 1330–1470, and everything stays inside the middle 3:4 for Instagram.
- **Speed:** SwiftShader has no GPU, so frames render at supersampling 1.5 with MSAA off. The PMREM environment map is on the needles only. The rewinds use 4 sub-frame motion-blur samples.

## Files

| Path | What |
|---|---|
| `build.py` | facts, tts, export, stills, render, final, all |
| `config/narration.py`, `style.py`, `facts.py` | script, palette, timing and layout, number checks |
| `tools/tts.py` | Kokoro synthesis, `audio/voice.wav`, `renders/cache/timings.json` |
| `tools/export.py` | phrase anchors, needle drops, cue sheet: `renders/cache/scene.json` |
| `scenes/3d/Buffon.js` | the whole scene: floor shader, needles, cameras, overlays |
| `scenes/web/` | runtime (post pipeline from the chess Short), player.html, overlay.css |
| `tools/capture.js` | headless Chromium capture (stills, render, range, bench) |
| `tools/sfx.py`, `music.py`, `assemble.py` | sound effects, music bed, mix, master, captions, encode |
| `tools/cover.py`, `sheet.py` | cover image, contact sheets |

To rebuild from scratch:
1. Install the Python packages and run `npm ci` in `scenes/web`.
2. Download the Kokoro model files from the kokoro-onnx GitHub releases; huggingface.co was blocked here.
3. Run `python build.py all`, which takes about 2 h.
