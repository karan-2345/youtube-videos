# HANDOFF: "Why tattoos don't wash off" (vertical Short, YouTube Shorts + Instagram Reels)

## Status 2026-11-21: final built, waiting for the user's review

Built in a cloud session (Linux, no GPU) from the approved script v1. The user said "Build it", so the look test
and the sample-scene checkpoint were skipped, the same as the chess Short ("build final video like this sample").
Everything rebuilds on the laptop with the commands in `README.md`.

| Scene | Narration | What happens |
|---|---|---|
| S00_Hook 6.0 s | "Your skin sheds its outer layer every few weeks, so why doesn't your tattoo shed with it?" | A forearm running down the frame with a black star tattoo. Time-lapse: flakes of dead skin peel away all over, but the star stays. A glowing cut line runs round the star and a small block of skin lifts out. |
| S01_Held 9.2 s | "It's because the needle puts the ink deeper, where immune cells called macrophages swallow it but can't digest it, so they just hold on to it." | The block grows into the specimen as the arm sinks away. The needle punches through the OUTER LAYER and drops ink grains in the dermis, where the star's two front arms cross the cut face. Three MACROPHAGEs per spot crawl in and reach out to swallow the grains, glow as they try to digest them, and keep them. |
| S02_Relay 9.4 s | "So when scientists killed those cells in tattooed mice, the tattoos didn't fade, because new cells swallowed the spilled ink in the same spot." | A circular inset shows a TATTOOED MOUSE (ink band on its tail). The cells burst one by one and spill their grains, which stay put; the tail band is STILL THERE. NEW CELLS crawl in from other directions and swallow the same grains in the same places. |
| S03_Laser 10.0 s | "And that's why lasers take so many sessions to remove a tattoo, since they have to shatter the ink small enough for those cells to carry it away." | A laser hand-piece pulses over the star, SESSION 1 to 7 (WEEKS APART), and the star fades a little each time. Close up, one pulse shatters the grains into dust; the cells crawl down to the LYMPH VESSEL and the dust flows away. The block drops back into the arm and the camera returns to the opening shot (loop). |

### Final (2026-11-21)

`final/` (in git): `tattoo_short.mp4` (captions burned in), `tattoo_short_clean.mp4`, `tattoo_short.srt`,
`cover.png`, `upload.md`. The silent version, the stems and the scene renders are in `renders/` (not in git, rebuilt
by `build.py`).
- Measured: **33.13 s**, 1080 x 1920 @ 60, **-13.8 LUFS** integrated (ebur128 on the final file), -2.2 dBTP,
  LRA 2.9 LU. Linear loudnorm gain of +5.8 dB after the look-ahead limiter trimmed peaks above -7.7 dBFS.
- Mix: voice -22.4 LUFS; SFX 10 LU under the voice; music 16 LU under it, ducked under the voice.
- Captions: the text is identical to the script (checked). Word captions in Archivo Captions, ivory with the
  spoken word in cinnabar.
- Loop: the last frame matches the first (the forearm and star). Mean difference 1.34 / 255, no 60 px block above
  2.24 / 255.
- Renders (SwiftShader, 3 workers, 0.6 frames/s): S00 551 s, S01 869 s, S02 972 s, S03 1033 s (about 57 min).
- Checked by eye: 10 frames of the captioned final, every scene's key beats in stills, the mouse inset close up,
  the cover full frame and its 3:4 crop. Audio checked by measurement only, not by listening.
- Cover: S00 at 5.8 s (the block lifting out of the arm), with "WHY DON'T / TATTOOS / WASH OFF?" in Inter ExtraBold.

## Decisions

- **Look "Cut-away"** (ours, not a copy of another channel's characters or style). One object, one slice, one idea:
  the real thing first, then a block cut out of it, on a dark warm backdrop. The palette is in `config/style.py`.
  Cinnabar is the one accent (captions' spoken word, MACROPHAGE, STILL THERE), Inter ExtraBold labels and Archivo
  captions as in the chess Short, and everything important sits inside the middle 3:4 (y 240-1680).
- **The cut face matches the tattoo.** The ink spots on the cut face sit exactly where the star's two front arms cross
  it (`starSegments` in `lib/cut.js`), so the cross-section agrees with the tattoo on top.
- **Mouse study shown as a mouse study.** The script says "in tattooed mice". The inset shows a lab mouse with a
  tattooed tail band (FLAG 7 in `research/notes.md`: which body part the paper tattooed isn't checked yet).
- **Voice:** Kokoro af_heart 0.95 (same as the chess Short). "macrophages" is spoken from IPA (MAK-ruh-fay-jiz,
  `tools/tts.py`); espeak said MAK-ruh-fij-iz.
- **Sound:** every effect is synthesized (`tools/sfx.py`), and each scene's JS lists its own cue rows (needle punches,
  swallows, bursts, laser pulses) that the capture harness saves, so every sound lands on its visual. The music
  (`tools/music.py`) is a light marimba ostinato (C, A minor, F, G at 100 bpm).

## Files

- `config/narration.src.md` script (the one source of the words), `research/notes.md` claims and sources,
  `research/beat_plan.md` the original plan.
- `scenes/3d/lib/cut.js` stage, arm, block, needle, ink, macrophages, mouse and inset, laser, lymph vessel, labels.
  `scenes/3d/lib/story.js` where every grain and cell is (shared by S01-S03 so the cuts match).
  `scenes/3d/S0x_*.js` one timeline per scene, every event on a phrase anchor (`scenes/3d/export.py`).
- `tools/capture.py` picks SwiftShader on Linux and the iGPU (D3D11) on Windows, and also saves each scene's sound cues.

## Gotchas

- `assets/models/` (Kokoro, 354 MB), `scenes/web/node_modules/` and `renders/` are git-ignored. On the laptop, copy
  or link the chess Short's model files and run `npm install` in `scenes/web`.
- The palette's `ink` is the tattoo ink (blue-black). Text is `ink_text`. `tools/assemble.py` uses `ink_text` for the
  captions.
- Software WebGL in the cloud renders about 0.6 frames/s on 3 workers (about 1 hour for all four scenes). The laptop's
  iGPU should be faster.
