# HANDOFF: "How the Egyptians moved stones heavier than a car" (pyramid Short, "water on the sand")

## Status

**Delivered 2026-11-23.** Final `renders/final/pyramid_short.mp4`: 1080x1920, 60 fps, 4156 frames, 69.27 s; -14.0 LUFS integrated, true peak -2.1 dBTP; SRT text equals `narration.py` (204 words); loop seam (last vs first frame) mean difference 3.4 levels. Full render 9174 s (2 workers, 0.45 frames/s). The user hasn't said yet whether it's uploaded.

The user asked for "more like the Leaning Tower of Pisa" (a famous landmark with a hidden story), was offered six
landmark ideas, and picked the pyramid one: the man pouring water on the sand in Djehutihotep's tomb painting and the
2014 Amsterdam wet-sand experiment. The hook was proposed by Claude and accepted as is. Voice: Kokoro `af_heart`.

## Script (`config/narration.py`, 204 words, 69.3 s)

| Beat | What happens on screen |
|---|---|
| hook | Golden-hour Giza: a team of 20 hauls a 2.5 t limestone block on a wooden sled toward the Great Pyramid (two-thirds built); a man on the front pours water on the sand. "2.5 TONNES / MORE THAN A [car]"; the camera cranes up over the dunes and the other teams ("HOW?"), swings to the pourer, and brush strokes paint the live scene over into the wall painting. |
| painting | The tomb wall (torch-lit): the pourer and the painted water flowing; pull back ("≈ 1850 BC / ALMOST 4,000 YEARS AGO"); a counter lights up all 172 haulers row by row; push into the statue; the painting is wiped away into the same scene in 3D: the colossus on its sledge, 4 rows of 43 men, a clapper on its knee; down to the pourer ("WATER"); "ONLY A RITUAL?". |
| lab | 2014, a tray of desert sand, a small sled with brass weights, a force sensor on a motor rail ("2014 / UNIVERSITY OF AMSTERDAM"). Dry: jerky, the sand heaps up in front ("SAND PILES UP"), the force bar high and red. |
| secret | The sand is levelled, a beaker pours a little water, the dark front spreads ("JUST A LITTLE WATER / 2–5 % OF THE SAND"); the sled glides, the bar drops to half ("HALF THE FORCE"). Macro: loose grains jostle, then water bridges grow between them ("WATER BRIDGES"); a slab presses down and the pile holds ("2× STIFFER"). Back to the sled gliding. |
| mud | The beaker pours a lot ("TOO MUCH WATER"), the sand turns to glossy mud with puddles, the sled stops and sinks, the bar climbs red ("MUD · IT SINKS"). The colossus pourer again: "A RITUAL" struck out, "ENGINEERING ✓". |
| end | The Great Pyramid with a timeline (2560 BC pyramid, 1850 BC painting, "≈ 700 YEARS LATER"); the hero team: every other man dissolves ("½ THE PEOPLE"); crane up over the road ("2,000,000+ STONES IN THE GREAT PYRAMID") and back down into the first frame (loop). |

## Decisions

- **Facts** (`config/facts.py`, `facts.md`, ALL PASS): Fall et al., PRL 112, 175502 (2014) and its coverage (Bonn:
  up to 50 % less force, wet sand about twice as stiff, optimum about 2–5 % water, too wet fails; Egyptologists had
  read the water as ceremonial); Djehutihotep (12th Dynasty, c. 1900–1850 BC; 172 workers; colossus about 6.8 m);
  Great Pyramid (finished c. 2560 BC, about 2.3 million blocks averaging about 2.5 t). The web pages themselves
  could not be fetched from this environment; the facts come from search summaries quoting them.
- **Simplified, and said in the script or on screen:** the painting is about 700 years younger than the Great
  Pyramid and shows a statue ("would have let half as many people pull each of its stones"). The hook's "for
  thousands of years nobody knew how" is storytelling; how the pyramids were built is still debated.
- **Not literal:** the painting is a re-drawing in the Egyptian manner, not a copy (the original scene was destroyed
  in 1890 and survives in a photo); the 3D colossus is a simplified seated figure; the lab rig is a stylised
  version of the experiment (tray, sled, force sensor), the force bar is relative (dry = 100 %).
- **Loop:** the hero sled's position is `V t` in the first half and `V (t - D)` in the second, so it is continuous
  inside every desert shot and across the loop; the strides, the music (16 bars) and the dust are periodic over the
  video; the last 2.2 s follow the hook's own camera path (u < 0), so the crane lands in frame 0. The men who
  dissolve for "½ THE PEOPLE" re-form while the camera is high, before the descent.
- **Bugs met (see CLAUDE.md lessons):** an anchor named like a beat (`mud`) was silently overwritten by the beat's
  start time (renamed `mudw`; export now has no collisions); `pow(x, 2.)` with negative x is undefined in GLSL;
  a `ramp(t, a, b)` with a > b gives 1 before a.

## Files

| Path | What |
|---|---|
| `scenes/3d/Pyramid.js` | the timeline: sets, shots, cameras, the brush transitions, overlays |
| `scenes/3d/lib/people.js` | instanced workers with a small FK rig (haul, pour, clap) and a dissolve |
| `scenes/3d/lib/desert.js` | sky, dunes, sand shader with wet tracks, the pyramid under construction, motes |
| `scenes/3d/lib/props.js` | sled, block, ropes, colossus, water stream, particles |
| `scenes/3d/lib/painting.js` | the procedural wall painting (colour + index mask), wall and brush-sheet materials |
| `scenes/3d/lib/lab.js` | the tray (sand surface shaped in the vertex shader), sled, sensor, beaker |
| `scenes/3d/lib/grains.js` | the grain pile and the water bridges |
| `tools/export.py` | anchors, the hauling clock (8-stride multiple), the cut list shared with the sound |
| `tools/sfx.py`, `music.py` | effects on anchors/cuts/strides; oud-like Hijaz arpeggios + darbuka, tempo-locked |
| `tools/capture.js preview <step> <out>` | new: a fast preview of every step-th frame with the voice |
