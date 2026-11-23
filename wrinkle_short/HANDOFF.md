# HANDOFF: "Why fingers wrinkle in water" (vertical Short, YouTube Shorts + Instagram Reels)

## Status 2026-11-23: v2 delivered (new finger), waiting for the user's review

v1 (2026-11-22) was approved apart from the finger: the user found it sausage-like, with no fingerprint, no lines and
no nail. v2 rebuilds the finger (see Decisions) and re-renders every scene; the script, voice, timing and sound are
unchanged.

Built in a cloud session (Linux, no GPU) from the approved script v1 ("Okay approved"). As with the tattoo Short,
the look test and the sample-scene checkpoint were skipped. Everything rebuilds on the laptop with the commands in
`README.md`.

| Scene | Narration | What happens |
|---|---|---|
| S00_Hook 5.35 s | "When your fingers wrinkle in the bath, it isn't just your skin soaking up water." | A finger hangs over the bath, seen from the nail side. As it dips, the camera swings round to the pad: MINUTES LATER the pad (fingerprint and all) has buckled into folds. It lifts out (NOT JUST WATER), a glowing cut line runs round a patch of the pad, and a small block of skin lifts off toward us. |
| S01_Nerves 8.15 s | "Instead, your nerves tell the blood vessels under the skin to tighten, so the fingertip shrinks and its skin buckles into folds." | The block settles into the standard view and its folds rewind flat. The NERVE fires pulses up to the BLOOD VESSELS (a loop under every future valley). The vessels tighten, the dermis sinks a little, and the skin buckles into FOLDS, with the valleys right over the loops. |
| S02_Test 6.88 s | "And that's why a finger with a damaged nerve doesn't wrinkle, which doctors have even used as a nerve test." | Two fingers dip side by side with their nerves shown x-ray style. The right one's nerve is broken (DAMAGED NERVE, an X). The left finger wrinkles and the right one stays smooth (NO WRINKLES): THE WRINKLE TEST. |
| S03_Treads 7.88 s | "So the wrinkles might be on purpose, working like tire treads to grip wet things, although scientists still argue about that." | A wrinkled fingertip, turned three-quarters so the nail shows, presses a wet glass marble and squeezes the water out of the contact. Below, a treaded tyre rolls on a wet road, throwing spray (LIKE TIRE TREADS?). Then STILL DEBATED. |
| S04_Same 8.62 s | "And the folds even come back in the same pattern every time, because the blood vessels underneath stay in the same place." | The folds of SOAK 1 are traced in cinnabar. The finger lifts out and dries smooth, dips again (SOAK 2) and the new folds land on the same lines (SAME PATTERN). An x-ray shows the BLOOD VESSELS running under the valleys. The finger rises and the camera swings back round to the nail side, the opening shot (loop). |

### Final (v2, 2026-11-23)

`final/` (in git): `wrinkle_short.mp4` (captions burned in), `wrinkle_short_clean.mp4`, `wrinkle_short.srt`,
`cover.png`, `upload.md`. The silent version, the stems and the scene renders are in `renders/` (not in git, rebuilt
by `build.py`).
- Measured: **34.88 s**, 1080 x 1920 @ 60, **-13.8 LUFS** integrated (ebur128 on the final file), -1.8 dBTP,
  LRA 2.2 LU. Linear loudnorm gain of +5.75 dB after the look-ahead limiter trimmed peaks above -7.7 dBFS. The sound
  is the same as v1; only the picture changed.
- Mix: voice -22.4 LUFS; SFX 10 LU under the voice; music 16 LU under it, ducked under the voice.
- Captions: the text is identical to the script (checked). Word captions in Archivo Captions, ivory with the
  spoken word in cinnabar.
- Loop: the last frame matches the first (the nail side of the fingertip over the bath). Mean difference
  1.34 / 255; the worst 60 px block is 4.1 / 255, in the water's ripple rings.
- Renders (SwiftShader, 3 workers): S00 760 s, S01 2006 s, S02 861 s, S03 496 s, S04 1029 s (about 86 min).
- Checked by eye: the finger in stills from every scene before the render, 12 frames per scene video after it,
  14 frames of the captioned final, the cover. Audio checked by measurement only, not by listening.
- Cover: S00 at 2.65 s (the wrinkled pad under water, fingerprint whorl in the middle) with "WHY DO FINGERS /
  WRINKLE / IN WATER?" in Inter ExtraBold over a soft dark band (the bath's waterline runs between the first two
  lines).

## Decisions

- **Same look as the tattoo Short ("Cut-away")**: the real thing first, then a block cut out of it, on the dark warm
  backdrop, with cinnabar as the one accent. New colours for this topic (water, nerve yellow, vessel red, glass,
  rubber, road) are in `config/style.py`.
- **A real finger, not a capsule (v2).** `lib/finger.js` builds the skin from one shape function (`surfR`): a slightly
  square rounded tip, a fuller pad, a flatter back, a waist before the end joint and knuckles at both joints. The
  nail is its own thin plate (pink bed, pale lunula, thin ivory free edge that stands a little off the tip, clearcoat)
  and the skin folds over its base and sides. The shader draws fingerprint ridges (a whorl on the pad, ridges across
  the middle segment, faded out when they get smaller than a few pixels), the palm-side creases of both joints (uneven
  and wavy, so the finger doesn't look like sausage links) and wrinkles over the knuckles. The fold pattern, the valley
  lines, the cut and the water rings all use the same shape function, so they still sit on the skin.
- **The nail is on screen.** The opening (and the loop end) look at the finger from the nail side, 150 degrees round
  from the pad, and the camera orbits round the finger's axis to the pad (`orbitPath`); the marble shot turns the
  finger 1.4 rad. S02 stays front-on because the test is about the pads.
- **One fold pattern everywhere.** The finger's folds come from a fixed formula (`foldW` in `lib/finger.js`, with a
  GLSL twin), so SOAK 2 really does land on SOAK 1's lines, and the block's vessel loops sit right under its valleys.
  The picture agrees with the claim instead of faking it.
- **The grip claim stays a maybe.** The script says "might" and "scientists still argue about that"; the picture says
  LIKE TIRE TREADS? and STILL DEBATED, and the pinned comment asks viewers to pick a side (2013 vs 2014 study).
- **Labels sit on dark pills** (`.lab` in `scenes/web/overlay.css`): plain text was hard to read over skin.
- **Voice:** Kokoro af_heart 0.95, as in the earlier Shorts. No word needed an IPA fix.
- **Sound:** every effect is synthesized (`tools/sfx.py`, now 26 sounds, including plop, bubbles, creak, drip,
  rewind, nerve ticks, squeeze, snap, squelch, road and thud). Each scene lists its own cue rows. The music is the
  tattoo Short's marimba bed moved to F, D minor, B-flat, C at 100 bpm, so the series sounds related but not the same.

## Files

- `config/narration.src.md` script (the one source of the words), `research/notes.md` claims, sources and FLAGs,
  `research/beat_plan.md` the original plan.
- `scenes/3d/lib/finger.js` finger (shape, nail, fold and skin-detail shaders), water, fold block (vessels, nerve, pulses), x-ray nerve, marble,
  tyre, pad cut, camera poses. `scenes/3d/lib/cut.js` is the tattoo Short's stage, block and label code.
  `scenes/3d/S0x_*.js` one timeline per scene, every event on a phrase anchor (`scenes/3d/export.py`).

## Open points

- FLAG 1 and 2 in `research/notes.md`: the grip study is contested (said so on screen), and "same pattern every
  time" was tested with soaks days apart, not years. The cloud session couldn't open the publishers' pages, so
  re-read the key abstracts on the laptop before publishing.
- FLAG 3: no Zack D. Films video about wrinkly fingers turned up in a web search, but that check isn't conclusive.

## Gotchas

- `assets/models` (Kokoro) and `scenes/web/node_modules` are symlinks to the tattoo Short's copies and, with
  `renders/`, git-ignored. The ignore lines have no trailing slash on purpose: `models/` doesn't match a symlink. On
  the laptop, point them at the Kokoro files and run `npm install` in `scenes/web`.
- Motion-blur sub-frames can ask for negative times, so any `x % 1` phase must wrap as `((x % 1) + 1) % 1`
  (a negative phase crashed S01's first frame).
- Vessel tightening is a relative morph target (`morphTargetsRelative = true`). With absolute targets the vessels
  vanished.
- The vessels and nerve on the cut face sit a hair in front of it (`VZ`, `NZ` in `makeFoldBlock`), or the face hides
  them.
