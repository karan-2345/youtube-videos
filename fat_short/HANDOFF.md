# HANDOFF: "Where does the fat go when you lose weight?" (fat Short)

## Status 2026-11-22: delivered

Finals in `renders/final/`: `fat_short.mp4` (captions burned in), `fat_short_clean.mp4`, `captions/fat_short.srt`,
`cover.png`, `upload.md`. Measured: 1080 x 1920, 60 fps, 3872 frames, 64.53 s; -13.9 LUFS integrated, true peak
-1.6 dBTP, LRA 2.1 LU; SRT text equals `config/narration.py` word for word. Full render: 2 workers, 1 h 56 min.
After the full render the last frame's background was darker than frame 0 (the floor was switched on at "because"
and never off) and the floor popped on at 6.05 s; the floor now fades in with the body and out before the loop
point, the last breath's specks fade out too, and frames 354-429 and 3808-3871 were re-rendered and spliced in.

The user gave the hook and the idea ("a glowing piece of fat breaking into tiny specks that drift out with each
breath") from the list proposed on 2026-11-21, and asked for the same care as the Pisa Short. The voice is Kokoro
`af_heart`. They also asked for a way to keep context across chats: see `CLAUDE.md`, `.claude/skills/new-short`,
`kit/` and `IDEAS.md` at the repo root.

## Script (`config/narration.py`, 186 words, 64.5 s)

| Beat | What happens on screen |
|---|---|
| hook | Title "WHERE DOES THE FAT GO?" over a glowing, wobbling lump of fat (fat cells visible). "melt away": it slumps and drips, red ✕, rewinds. "turn into muscle": it stretches into a striped red muscle with tendons, ✕. "sweat it out": water beads, ✕. "because...": the camera pulls back -- the lump is in the belly of a glass body; golden specks rise into the lungs; on "breathe out" they stream up the windpipe and out of the mouth with the breath, "BREATHED OUT ✓". |
| survey | The body is one of 150 glass figures; "50 DOCTORS / 50 DIETITIANS / 50 PERSONAL TRAINERS" (each block lights up); "WHERE DOES THE FAT GO?"; 147 dim, 3 turn mint: "3 / OUT OF 150 GOT IT RIGHT". |
| atoms | A dive into the hero's lump (gold flash) to one fat molecule, C55H104O6, ball and stick, atom for atom; carbon, hydrogen and oxygen light up with counts (x55, x104, x6); 78 O2 fly in; the molecule bursts. |
| split | The atoms snap together as 55 CO2 (they float up: "CO2 · BREATHED OUT") and 52 H2O; the fat's own atoms keep a golden glow. Back on the body: sweat beads on the forehead, a tear, the bladder glows blue ("PEE"), a breath of vapour. |
| numbers | A 10 kg block of fat (20 x 28 x 20 cm, about 11 litres) drops in; the top 84 % dissolves from the top down into a golden cloud ("8.4 KG BREATHED OUT"); the last 16 % slumps into a pool of water ("1.6 KG WATER"). |
| twist | Fast breathing: puffs of vapour, the lump unchanged, ✕. Jogging (full body, the floor grid scrolls, the legs glow warm): the lump sends specks up and out with each breath, "MOVING ✓". Panting on purpose: dizzy stars. |
| end | Calm breaths with a few specks each; the camera sinks back into the lump while the body fades: the first frame (loop). |

## Decisions

- **Facts** (`config/facts.py`, `facts.md`): Meerman & Brown, BMJ 2014 (the chemistry, 84 % / 16 %, 10 kg -> 8.4 +
  1.6 kg, lungs as the main way out, hyperventilation); UNSW press release (the survey: 150 = 50 + 50 + 50, 3 right).
  Our own atom count from the molecule the scene builds gives 84.3 % / 15.7 %.
- **The molecule** is palmitic + oleic + stearic acid on glycerol = exactly C55H104O6 (checked at build time); the
  reaction balances exactly (checked); 4 of the fat's 6 oxygens go to CO2 and 2 to water, as in the paper.
- **Simplified:** the specks travel straight up inside the body to the lungs (really: carried as CO2 in the blood);
  the "10 kg" block is drawn at a real 11-litre size; the lump is stylised belly fat.
- **"Breathing faster won't help"**: the paper says hyperventilating causes dizziness and does not make you burn fat.
- **Look:** a dark studio; the glass body is one smooth distance-field mesh, skinned to a skeleton (breathes, jogs,
  pants), drawn with a depth pre-pass so overlaps never double up; HDR bloom added to the runtime.
- **Sound:** all synthesized (`tools/sfx.py`): a wet jiggle, melt and drips, a rubbery stretch, sweat plips, ✕ stamps,
  inhale/exhale (every big breath, the panting, the jog), sparkles, chimes for the right answers, a whoomp into the fat,
  atom blips, a burst and snaps, the 10 kg thud, a sizzle, a slosh, footsteps, a dizzy wobble. Music (`tools/music.py`):
  an FM mallet arpeggio in A minor (Am-F-C-G) over a pad and sub, 100 bpm; drums only in the middle.

## Files

| Path | What |
|---|---|
| `scenes/3d/Fat.js` | the timeline: cameras, every beat, overlays |
| `scenes/3d/lib/body.js` | glass body (SDF + skinning), lungs, airways, poses (stand, breathe, jog, dizzy), crowd mesh |
| `scenes/3d/lib/fat.js` | the live lump (metaballs re-meshed each frame), fat material (cells, muscle, water, dissolve) |
| `scenes/3d/lib/molecule.js` | the triglyceride and the full reaction, every atom accounted for |
| `scenes/3d/lib/specks.js` | breath clock, golden specks through the body, breath vapour |
| `scenes/3d/lib/sdf.js`, `studio.js` | distance fields + surface nets; backdrop, floor, motes, environment map |
| `tools/align.py` | word times (phoneme share, commas pinned to pauses) |
| `tools/export.py` | anchors, breath cycles, jog |
