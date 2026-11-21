# HANDOFF: "The Leaning Tower of Pisa should have fallen over" (Pisa Short)

## Status 2026-11-21: final being built

The user asked for a Short that "everyone can watch" (not only science fans), picked the Pisa idea, and asked for the
best possible animation and a hook that grabs in the first seconds. The voice is Kokoro `af_heart` (as before).

## Script (`config/narration.py`, 206 words, 68.8 s)

Kokoro `af_heart` at speed 0.95 in en-us. Years are spoken as years ("eleven seventy-three", "nineteen ninety");
the captions keep the digits.

| Beat | What happens |
|---|---|
| hook | The tower in golden light starts to tip on "should have fallen over", topples with the joints opening, debris and dust; it freezes (bullet-time orbit, desaturated) on "800 years ago"; rewinds upright; time keeps running backwards (counter 2026 -> 1178) as floors 8..4 lift off; "a genius engineer" is struck out; "A WAR" with crossed swords, the sky goes red. |
| bridge | The camera comes down to the ground and the front half of the block drops away: the cut through the ground. |
| ground | 1173: the three floors lift off and are rebuilt (thuds, dust), labels for the sand, the soft wet clay and the dense sand, a "3 m" dimension on the shallow foundation, floor numbers 1-2-3, the tower starts to tip ("SINKING"). |
| war | Swords, a red sky, the counter rolls 1178 -> 1272 over a three-day time-lapse; water droplets rise out of the clay under the tower and the clay darkens ("CLAY GETS FIRMER"); the red ghost of the floors that would have been built stacks up and fails into the ground. |
| banana | 1272: four galleries drop in, each a wedge (taller on one side); side profile, the curve exaggerated x12, a red axis line against a dashed straight one; the bell chamber lands in 1372 and the bells ring. |
| modern | The counter rolls to 1990 as the lean grows; "CLOSED" (the tourists vanish); six drills under the north side draw soil out; the tower turns back; at the top, red (1990) and white (now) plumb lines "≈ 45 cm" apart; 2001 reopened, tourists return. |
| end | Earthquakes counted 1-2-3-4 (the block shakes, waves run through the layers, damped in the clay); the front half of the ground rises back; the camera returns to the opening shot (loop). |

## Decisions

- **Facts** (`config/facts.py`, `facts.md`): Wikipedia, Burland (Ingenia 1999; Bull. Eng. Geol. Env. 1998), University
  of Bristol (2018). Burland notes the reasons for the stoppages are not recorded with certainty; Wikipedia ties
  the first one to Pisa's wars with Genoa, Lucca and Florence. The script says "Pisa went to war, and the work
  stopped", and "what saved it ... was a war" (the popular account, sourced).
- **"Almost half a meter"** rather than 45 cm in the voice (sources give 44-50 cm); the picture shows "≈ 45 cm".
- **Exaggerations, labelled:** the curve (x12, on screen). Unlabelled and small: the early tilt in 1178 (shown as
  2 degrees so it reads), the lean while closed (4.5 -> 4.0 degrees, so the half metre matches the drawing).
- **Look:** a floating diorama in golden-hour light; white marble with stone courses, veining, grime and baked AO;
  mowed lawn, cypresses, small tourists for scale (present day only); the cut shows sand, blue-grey clay, dense
  sand. Inter ExtraBold for type, a dark scrim behind the top text, Archivo captions.
- **Sound:** all synthesized (`tools/sfx.py`): creak, rumble and cracks for the fall, the freeze and the tape
  rewind, a whoosh for each floor lifted into the past, a stone thud for each floor set down, swords and a war
  drum, ticks as the year counter turns (at most 22 a second), drips, the bells (bell chamber), a CLOSED stamp,
  the drill, four quakes and a long one. Music (`tools/music.py`): a Karplus-Strong lute in D Dorian over a D-A
  drone with a frame drum, 96 bpm; the drone alone under the freeze.

## Files

| Path | What |
|---|---|
| `build.py` | facts, tts, export, stills, render, final, all |
| `config/narration.py`, `style.py`, `facts.py` | script, palette and timing, claims and sources |
| `tools/tts.py` | Kokoro synthesis (years said as years), `audio/voice.wav`, `renders/cache/timings.json` |
| `tools/export.py` | phrase anchors, floor events, the year keys, cue sheet: `renders/cache/scene.json` |
| `scenes/3d/tower.js` | the tower, procedural, one merged geometry per floor (+ bells, foundation) |
| `scenes/3d/world.js` | sky, the ground block (two halves and the cut), lawn/soil/paving/marble shaders, cypresses, people |
| `scenes/3d/Pisa.js` | the timeline: fall, freeze, rewind, floors, ghost, wedges, drills, quakes, cameras, overlays |
| `scenes/web/` | runtime (post pipeline), player.html, overlay.css |
| `tools/capture.js` | headless Chromium capture (stills, render, range, bench) |
| `tools/sfx.py`, `music.py`, `assemble.py` | sound effects, music bed, mix, master, captions, encode |
| `tools/cover.py`, `sheet.py` | cover image (its own camera), contact sheets |
